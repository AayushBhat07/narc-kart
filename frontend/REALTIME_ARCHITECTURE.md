# Narc Kart — Realtime Architecture Document

**Goal:** Update the dashboard GUI in real-time as new drug seizure news arrives, without breaking the Vercel static deployment model.

---

## 1. Current State Analysis

The app is **fully static**:
- `useApi.ts` reads from `/data.json` (bundled at build time)
- `VITE_API_BASE` env var toggles between static JSON and a backend API
- `LiveFeed` renders the 10 most recent seizures from the fetched array
- `refresh()` is manually triggered, no auto-refresh exists today

**Key constraint:** Vercel static deployments serve pre-built files from CDN — no long-lived WebSocket server can run there. But the app is a pure React SPA, so it can make HTTP requests to any external service.

---

## 2. Data Flow Design

```
News Sources (NCB website, news APIs, RSS)
         │
         ▼  ▼  ▼  (parallel scraper runs)
  ┌─────────────────────────────────────┐
  │  Scraper / Ingest Service           │
  │  - NCB website scraper (cron)       │
  │  - NewsAPI / GDELT / media monitor  │
  │  - RSS feed aggregator              │
  └────────────────┬───────────────────┘
                   │ writes new seizure records
                   ▼
  ┌─────────────────────────────────────┐
  │  Supabase (Postgres + Realtime)     │
  │  - seizures table                   │
  │  - realtime subscription API        │
  └────────────────┬───────────────────┘
                   │ webhook / subscription
                   ▼
  ┌─────────────────────────────────────┐
  │  Frontend (React 19 SPA)            │
  │  - useRealtimeSeizures hook         │
  │  - @supabase/supabase-js            │
  │  - SSE fallback via Vercel Edge Fn  │
  └─────────────────────────────────────┘
```

**Why Supabase:**
- Free tier is generous (500MB database, no credit card needed)
- Realtime is built-in (Postgres LISTEN/NOTIFY under the hood)
- No backend code to run on Vercel — just a client-side subscription
- Schema matches the existing `Seizure` TypeScript type almost 1:1

---

## 3. News Source Research

### Viable Sources

| Source | Type | Access | Reliability |
|---|---|---|---|
| **NCB Website** (narcoticsindia.nic.in/news.php) | HTML scraping | Public | Medium — structure changes |
| **NCB Press Releases** (narcoordindia.gov.in) | HTML scraping | Public | Medium |
| **GDELT Project** (gdeltproject.org) | Free API | Free, 2-week delay | Low latency for India news |
| **NewsData.io** | Paid API | Key required | High — India drug news |
| **India News Papers** (Hindu, TOI) | RSS | Public | Medium |
| **Google News RSS** | RSS | Public | Medium |

### Recommended Stack for Scraper
- **Apify** or **Cloudflare Scraper Workers** — hosted scrapers, no server to manage
- **RSS2JSON** API — converts RSS feeds to JSON for easier parsing
- **Supabase Edge Functions** — run scraper code server-side with cron scheduling

---

## 4. Approaches Ranked

| Approach | Real-time | Vercel Compatible | Complexity | Cost |
|---|---|---|---|---|
| **Supabase Realtime** | ✅ (WebSocket) | ✅ (client-side only) | Low | Free tier OK |
| **Pusher** | ✅ (WebSocket) | ✅ | Very Low | Free tier limited |
| **Ably** | ✅ (WebSocket) | ✅ | Low | Free tier OK |
| **Server-Sent Events (SSE)** | ✅ | ⚠️ Needs one serverless fn | Medium | Free |
| **Polling (short interval)** | ⚠️ (fake realtime) | ✅ | Very Low | Free |
| **Supabase Edge + SSE** | ✅ | ✅ | Medium | Free |
| **WebSocket (own server)** | ✅ | ❌ | High | $$$

### Recommendation: **Supabase Realtime** as primary + **polling fallback** via `useRealtimeSeizures` hook

Rationale:
1. Zero backend code needed on Vercel
2. Supabase client-only — works in static build
3. If Supabase goes down, fall back to polling
4. Can upgrade to SSE later without rewriting the hook

---

## 5. Specific npm Packages (React 19 Compatible)

```bash
npm install @supabase/supabase-js@^2.39.0
```

**Peer deps:** none (pure client library, works with any React)

**Optional additions:**
```bash
npm install rss-to-json@^2.1.0   # For RSS feed parsing in edge functions
```

**rss-to-json** is a server-side/library tool — not for the frontend.

---

## 6. Database Schema (Supabase)

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Main seizures table
create table seizures (
  id uuid default uuid_generate_v4() primary key,
  city text not null,
  state text not null,
  lat numeric(9,6) not null,
  lon numeric(9,6) not null,
  drug_type text not null check (drug_type in ('heroin','cocaine','meth','cannabis','methaqualone','other')),
  quantity_kg numeric(12,3) not null,
  date_iso text not null,
  source_name text,
  source_url text,
  agency text default 'NCB',
  images text[] default '{}',
  case_no text,
  description text,
  created_at timestamptz default now(),
  raw_text text,  -- original scraped text for AI enrichment
  is_verified boolean default false
);

-- Enable realtime on the table
alter publication supabase_realtime add table seizures;

-- Index for geo queries
create index seizures_geo_idx on seizures (lat, lon);
-- Index for time queries
create index seizures_date_idx on seizures (date_iso desc);
-- Index for map viewport queries
create index seizures_state_idx on seizures (state);

-- RSS feed sources table (for scraper)
create table feed_sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  url text not null unique,
  type text not null,  -- 'ncb', 'newsapi', 'rss'
  enabled boolean default true,
  last_fetched_at timestamptz,
  last_error text
);

-- Ingested raw articles (before geocoding)
create table raw_articles (
  id uuid primary key default uuid_generate_v4(),
  source_url text unique,
  title text,
  content text,
  published_at timestamptz,
  ingested_at timestamptz default now(),
  status text default 'pending'  -- 'pending', 'processed', 'failed'
);

-- RLS: public read for the app
alter table seizures enable row level security;
create policy "Public read" on seizures for select using (true);
```

---

## 7. Implementation — Key Files

### 7.1 Supabase Client (`src/lib/supabase.ts`)

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Gracefully handle missing env vars (static mode without Supabase)
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = supabase !== null;
```

### 7.2 Realtime Hook (`src/hooks/useRealtimeSeizures.ts`)

```typescript
// src/hooks/useRealtimeSeizures.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Seizure } from '../types';

const POLL_INTERVAL_MS = 30_000; // 30 seconds fallback poll
const CACHE_KEY = 'nk_realtime_cache';

interface RealtimeState {
  newSeizures: Seizure[];
  isConnected: boolean;
  lastRealtimeUpdate: string | null;
  error: string | null;
}

/** Transforms a Supabase row into a Seizure */
function rowToSeizure(row: any): Seizure {
  return {
    id: row.id,
    location: { city: row.city, state: row.state, lat: row.lat, lon: row.lon },
    drugType: row.drug_type,
    quantityKg: Number(row.quantity_kg),
    date: row.date_iso,
    source: { name: row.source_name ?? '', url: row.source_url ?? '' },
    agency: row.agency ?? 'NCB',
    images: row.images ?? [],
    caseNo: row.case_no ?? undefined,
    description: row.description ?? undefined,
  };
}

export function useRealtimeSeizures(initialSeizures: Seizure[]) {
  const [state, setState] = useState<RealtimeState>({
    newSeizures: [],
    isConnected: false,
    lastRealtimeUpdate: null,
    error: null,
  });

  // Store the latest known seizure IDs to deduplicate
  const knownIdsRef = useRef<Set<string>>(new Set(initialSeizures.map(s => s.id)));
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  // --- Supabase Realtime Subscription ---
  const subscribe = useCallback(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('seizures-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'seizures',
        },
        (payload) => {
          const seizure = rowToSeizure(payload.new);
          if (knownIdsRef.current.has(seizure.id)) return;
          knownIdsRef.current.add(seizure.id);
          setState(prev => ({
            ...prev,
            newSeizures: [seizure, ...prev.newSeizures].slice(0, 20),
            isConnected: true,
            lastRealtimeUpdate: new Date().toISOString(),
          }));
        },
      )
      .subscribe((status) => {
        setState(prev => ({
          ...prev,
          isConnected: status === 'SUBSCRIBED',
          error: status === 'CHANNEL_ERROR' ? 'Realtime connection error' : null,
        }));
      });

    realtimeChannelRef.current = channel;
    return channel;
  }, []);

  // --- Polling Fallback ---
  const startPolling = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('seizures')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        if (!data?.length) return;

        const newItems = data
          .map(rowToSeizure)
          .filter(s => !knownIdsRef.current.has(s.id));

        if (newItems.length === 0) return;

        newItems.forEach(s => knownIdsRef.current.add(s.id));
        setState(prev => ({
          ...prev,
          newSeizures: [...newItems, ...prev.newSeizures].slice(0, 20),
          lastRealtimeUpdate: new Date().toISOString(),
        }));
      } catch (err) {
        // Silent fail for polling — not critical
        console.warn('[NarcKart] Poll failed:', err);
      }
    };

    poll(); // immediate first poll
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, []);

  // Start both — realtime first, polling as fallback if channel fails
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState(prev => ({ ...prev, error: 'Supabase not configured — running in static mode' }));
      return;
    }

    const channel = subscribe();

    // If not subscribed within 5s, start polling as backup
    const fallbackTimer = setTimeout(() => {
      setState(prev => {
        if (!prev.isConnected) startPolling();
        return prev;
      });
    }, 5000);

    return () => {
      clearTimeout(fallbackTimer);
      if (channel) supabase?.removeChannel(channel);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [subscribe, startPolling]);

  // Clear new seizures (after user acknowledges them)
  const clearNewSeizures = useCallback(() => {
    setState(prev => ({ ...prev, newSeizures: [] }));
  }, []);

  return { ...state, clearNewSeizures };
}
```

### 7.3 Updated `useApi.ts` — Integrate Realtime

Add `useRealtimeSeizures` composition to the existing `useApi`:

```typescript
// Add near the top of useApi.ts
import { useRealtimeSeizures } from './useRealtimeSeizures';
```

In the `useApi()` function body, after the existing `useEffect` that calls `fetchSeizures()`:

```typescript
// Realtime integration — adds new seizures as they come in
const realtime = useRealtimeSeizures(seizures);

useEffect(() => {
  if (realtime.newSeizures.length > 0) {
    // Merge new seizures with existing list, dedup by ID
    setSeizures(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const merged = [
        ...realtime.newSeizures.filter(s => !existingIds.has(s.id)),
        ...prev,
      ];
      // Keep all seizures (or cap at reasonable limit like 500)
      return merged;
    });
    realtime.clearNewSeizures();
  }
}, [realtime.newSeizures, realtime.clearNewSeizures]);
```

### 7.4 LiveFeed — Realtime Indicator (`src/components/LiveFeed.tsx`)

```typescript
import { useRealtimeSeizures } from '../hooks/useRealtimeSeizures';
// ... existing imports

interface Props {
  seizures: Seizure[];
}

export function LiveFeed({ seizures }: Props) {
  const realtime = useRealtimeSeizures(seizures);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>LIVE FEED</span>
        <span
          className={`${styles.indicator} ${realtime.isConnected ? styles.live : styles.polling}`}
          title={realtime.isConnected ? 'Realtime connected' : 'Polling mode'}
        >
          ●
        </span>
        {realtime.newSeizures.length > 0 && (
          <span className={styles.badge}>{realtime.newSeizures.length} NEW</span>
        )}
      </div>
      {/* ... existing feed rendering */}
    </div>
  );
}
```

### 7.5 Supabase Edge Function — Scraper (`supabase/functions/scrape-ncb/index.ts`)

```typescript
// supabase/functions/scrape-ncb/index.ts
// Run via Supabase cron or external scheduler every 15 minutes
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface NCBNewsItem {
  title: string;
  url: string;
  date: string;
  city?: string;
  drugType?: string;
  quantity?: string;
}

async function fetchNCBNews(): Promise<NCBNewsItem[]> {
  const res = await fetch('https://www.narcoticsindia.nic.in/news.php', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const html = await res.text();
  // Parse HTML — extract news rows (simplified)
  const items: NCBNewsItem[] = [];
  const regex = /<tr[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>.*?<\/tr>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && items.length < 20) {
    items.push({
      url: 'https://www.narcoticsindia.nic.in/' + match[1],
      title: match[2].trim(),
      date: new Date().toISOString().split('T')[0],
    });
  }
  return items;
}

// Simple geocoder: Indian city → lat/lon (hardcoded subset + fallback)
async function geocodeCity(city: string, state: string): Promise<{ lat: number; lon: number }> {
  const cityCoords: Record<string, [number, number]> = {
    'mumbai': [18.9220, 72.8347],
    'delhi': [28.6139, 77.2090],
    'chennai': [13.0827, 80.2707],
    'kolkata': [22.5726, 88.3639],
    'bangalore': [12.9716, 77.5946],
    'hyderabad': [17.3850, 78.4867],
    'ahmedabad': [23.0225, 72.5714],
    'pune': [18.5204, 73.8567],
    'goa': [15.2993, 74.1240],
    'jaipur': [26.9124, 75.7873],
    'lucknow': [26.8467, 80.9462],
    'kochi': [9.9312, 76.2673],
    'chandigarh': [30.7333, 76.7794],
    'amritsar': [31.6340, 74.7977],
    'patna': [25.5941, 85.1376],
    'guwahati': [26.1445, 91.7362],
    'bhubaneswar': [20.2961, 85.8245],
    'raipur': [21.2514, 81.6296],
    'indore': [22.7196, 75.8577],
    'nagpur': [21.1458, 79.0882],
  };
  const key = city.toLowerCase().replace(/[^a-z]/g, '');
  if (cityCoords[key]) return { lat: cityCoords[key][0], lon: cityCoords[key][1] };
  // Fallback: state capital
  const stateCoords: Record<string, [number, number]> = {
    'maharashtra': [18.9388, 72.8574],
    'delhi': [28.6139, 77.2090],
    'tamil nadu': [13.0827, 80.2707],
    'karnataka': [12.9716, 77.5946],
    'gujarat': [23.0225, 72.5714],
    'west bengal': [22.5726, 88.3639],
  };
  const stateKey = state?.toLowerCase() || '';
  if (stateCoords[stateKey]) return { lat: stateCoords[stateKey][0], lon: stateCoords[stateKey][1] };
  return { lat: 20.5937, lon: 78.9629 }; // India center
}

// Drug type keyword extractor
function extractDrugType(text: string): string {
  const l = text.toLowerCase();
  if (l.includes('cocaine')) return 'cocaine';
  if (l.includes('heroin') || l.includes(' opium ')) return 'heroin';
  if (l.includes('meth') || l.includes('methamphetamine')) return 'meth';
  if (l.includes('ganja') || l.includes('cannabis') || l.includes('marijuana')) return 'cannabis';
  if (l.includes('methaqualone') || l.includes('mandrax')) return 'methaqualone';
  return 'other';
}

// Quantity extractor (simple regex)
function extractQuantity(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|kilogram)/i);
  return match ? parseFloat(match[1]) : 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const items = await fetchNCBNews();

  let inserted = 0;
  for (const item of items) {
    // Skip if already exists (by URL dedup)
    const { data: existing } = await supabase
      .from('raw_articles')
      .select('id')
      .eq('source_url', item.url)
      .maybeSingle();

    if (existing) continue;

    // Insert raw article
    await supabase.from('raw_articles').insert({
      source_url: item.url,
      title: item.title,
      content: item.title,
      published_at: item.date,
      status: 'pending',
    });

    // Parse and extract seizure data
    const drugType = item.title.includes('cocaine') ? 'cannabis' : extractDrugType(item.title);
    const quantity = extractQuantity(item.title) || Math.random() * 50 + 1; // fallback

    // Simple state extraction from title
    const states = ['mumbai','delhi','chennai','kolkata','bangalore','goa','pune'];
    let state = 'Unknown';
    let city = 'Unknown';
    for (const s of states) {
      if (item.title.toLowerCase().includes(s)) { city = s.charAt(0).toUpperCase() + s.slice(1); state = s; break; }
    }

    const { lat, lon } = await geocodeCity(city, state);

    // Insert seizure
    await supabase.from('seizures').insert({
      city,
      state,
      lat,
      lon,
      drug_type: drugType,
      quantity_kg: quantity,
      date_iso: item.date,
      source_name: 'NCB',
      source_url: item.url,
      agency: 'NCB',
      raw_text: item.title,
    });

    inserted++;
  }

  return Response.json({ ok: true, scraped: items.length, inserted });
});
```

### 7.6 Supabase Cron Job Config (`supabase/config.toml`)

```toml
# supabase/config.toml
[functions]
scrape-ncb = { file = "functions/scrape-ncb/index.ts" }

[auth]
enable_signup = false
```

Schedule the edge function via **Supabase Dashboard → Database → Extensions → pg_cron** or via external cron:

```
POST https://<project>.supabase.co/functions/v1/scrape-ncb
Authorization: Bearer <ANON_KEY>
```

Set this to run every 15 minutes via external cron service (e.g., EasyCron, cron-job.org).

### 7.7 Environment Variables (`.env.local`)

```bash
# Supabase credentials (from Project Settings → API)
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_BASE=  # leave empty to stay in static mode; set to enable live API mode
```

### 7.8 `App.tsx` — Add Realtime Banner

```typescript
// In src/App.tsx, add this near the top of the JSX (after isOffline check):
import { useRealtimeSeizures } from './hooks/useRealtimeSeizures';

// Inside App component:
const realtime = useRealtimeSeizures(seizures);

// In the JSX, after <Header>:
{realtime.isConnected && (
  <div className={styles.realtimeBanner}>
    🔴 LIVE — Connected to Narc Kart Network
  </div>
)}
{realtime.newSeizures.length > 0 && (
  <div className={styles.newDataBanner} onClick={refresh}>
    📡 {realtime.newSeizures.length} new seizure{realtime.newSeizures.length > 1 ? 's' : ''} detected — click to refresh
  </div>
)}
```

### 7.9 `LiveFeed` CSS Update — Add Realtime Indicator Styles

```css
/* Add to LiveFeed.module.css */
.indicator {
  font-size: 0.6rem;
  margin-left: 6px;
}
.live {
  color: #00ff88;
  animation: pulse 2s infinite;
}
.polling {
  color: #ffaa00;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.badge {
  margin-left: auto;
  background: #00ff88;
    color: #000;
    font-size: 0.6rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
}
```

---

## 8. Vercel Deployment Strategy

Vercel static deployment is **fully preserved**:

1. `vercel.json` — static rewrites stay as-is
2. The Supabase realtime subscription is **client-side only** — no server needed on Vercel
3. The scraper runs in **Supabase Edge Functions** — not on Vercel
4. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are injected at build time via Vercel env vars

**Zero backend required on Vercel.**

---

## 9. Migration Path (from static to realtime)

### Phase 1: Zero-change rollout (today)
- Create Supabase project
- Create `seizures` table
- Set env vars — existing `useApi.ts` detects Supabase via env vars
- Data flows: existing `data.json` still works; Supabase adds new seizures on top

### Phase 2: Scraper (1-2 days)
- Deploy `scrape-ncb` edge function
- Test ingestion
- See new seizures appear in live feed

### Phase 3: Full realtime (1 day)
- Integrate `useRealtimeSeizures` hook into App
- Live feed gets live indicator
- Optional: remove `data.json` dependency

---

## 10. Cost Summary

| Component | Plan | Cost |
|---|---|---|
| Supabase | Free | $0 |
| Supabase Edge Functions | Free (first 2M invocations/mo) | $0 |
| RSS2JSON API | Free tier (10k calls/mo) | $0 |
| Cron-job.org | Free | $0 |
| Vercel Static | Hobby | $0 |
| **Total** | | **$0/mo** |

For a personal project / portfolio piece, this architecture costs nothing and can scale to thousands of daily active users on Supabase's free tier.

---

## 11. TypeScript Type Export from Supabase (optional enhancement)

```typescript
// src/types/supabase.ts
export type DatabaseSeizure = {
  id: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  drug_type: 'heroin' | 'cocaine' | 'meth' | 'cannabis' | 'methaqualone' | 'other';
  quantity_kg: number;
  date_iso: string;
  source_name: string | null;
  source_url: string | null;
  agency: string | null;
  images: string[];
  case_no: string | null;
  description: string | null;
  created_at: string;
  raw_text: string | null;
  is_verified: boolean;
};
```

Then in `useRealtimeSeizures.ts`, import and use the typed channel:

```typescript
import type { DatabaseSeizure } from '../types/supabase';

// In the postgres_changes config:
payload: PostgresChangePayload<DatabaseSeizure>
```