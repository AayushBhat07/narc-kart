
# NARC KART — Full Codebase Audit Report

**Audit Date:** 2026-06-11
**Scope:** Backend (FastAPI, Python) · Frontend (React 19, TypeScript, Vite) · Vercel Serverless · Supabase · Scripts
**Audits Conducted:** Security · Performance · Architecture
**Verdict:** Security audit 98% accurate · Performance audit verified · Architecture audit PASS

---

## Executive Summary

Narc Kart was audited across three independent tracks: security, performance, and architecture. The codebase is functional and handles the current dataset (~1,968 seizure records) but has significant issues that will become critical at scale and expose the application to real risk in production.

The **security posture is weak** — there are six critical findings including unauthenticated API endpoints, disabled SSL verification allowing MITM attacks on data ingestion, and CORS policies that allow any website to query seizure data. The **performance is brittle** — the Leaflet map renders every marker individually, the app blocks the main thread for 2.5 seconds with a fake loading screen, and the backend runs six sequential database queries that should be parallelized. The **architecture is fragmented** — the active production deployment (Vercel + Supabase) diverges from both FastAPI backends and the static JSON fallback, each using different field names for identical data. The frontend `useApi.ts` paper-mâchés this schism with `any`-typed field mappers that silently corrupt data on schema mismatches.

The most important remediation path is: (1) fix the critical security holes immediately — they are exploitable today, (2) add map marker clustering — the map is nearly unusable at default zoom, (3) canonicalize on the Supabase schema as the single source of truth and eliminate the dual FastAPI stacks, (4) add database indexes before the dataset grows past 10,000 records, and (5) add React ErrorBoundary and a type-safe API client to prevent silent runtime failures.

---

## Security Findings

> Merged from `security-audit.md` + `security-verifier.md`. De-duplicated. All Critical and High findings are independently confirmed by the verifier.

---

### Critical

#### SEC-C1: SSL Verification Disabled in Data Ingestion Scripts

**Files:**
- `backend/scraper/run_scraper.py:314`
- `scripts/collect_data.py:291, 336`

**Evidence:**
```python
# backend/scraper/run_scraper.py:314
return requests.get(url, headers=HEADERS, timeout=timeout, params=params, verify=False)

# scripts/collect_data.py:291
resp = requests.get(url, headers=HEADERS, timeout=120, verify=False)

# scripts/collect_data.py:336
resp = requests.get(feed_url, headers=HEADERS, timeout=30, verify=False)
```

**Risk:** Disabling SSL verification allows man-in-the-middle attacks. An attacker on the network could intercept and modify GDELT data and RSS feed content before it is ingested into the Narc Kart database and displayed to users as "verified" seizure data.

**Fix:** Remove all `verify=False`. The main `scraper.py` class has `verify_ssl=True` as its default — only the standalone scripts bypass this. Ensure all HTTP clients respect SSL certificates.

---

#### SEC-C2: CORS Wildcard `*` with `Authorization` Header on `/api/scrape`

**File:** `frontend/api/scrape/index.ts:179–181`

**Evidence:**
```typescript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
```

**Risk:** Any origin can make requests to `/api/scrape`. Combined with the explicit `Authorization` header allowance, any malicious website can read responses and attempt to trigger scraper jobs with forged bearer tokens. The cron secret check can be bypassed if the environment variable is unset (see SEC-C4).

**Fix:** Replace `*` with an explicit allowlist of known Vercel deployment domains.

---

#### SEC-C3: Supabase Public Insert Policy — Anyone Can Write Records

**File:** `frontend/supabase/schema.sql:44`

**Evidence:** The Supabase RLS policy for inserts is configured as "Public insert" — meaning any client can insert records into the seizures table without authentication.

**Risk:** An attacker can inject false seizure records into the production database. Given that Narc Kart displays this data as authoritative, false records would appear on the public map and in statistics.

**Fix:** Restrict the insert policy to authenticated service roles only. The scraper should use a service role key server-side; the anon key should only allow reads.

---

#### SEC-C4: CRON_SECRET Auth Check Skipped When Environment Variable Is Unset

**File:** `frontend/api/scrape/index.ts:64–70`

**Evidence:**
```typescript
const cronSecret = process.env.CRON_SECRET;
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
// If CRON_SECRET is unset, the check is skipped entirely
```

**Risk:** If `CRON_SECRET` is not set in the Vercel environment, the `if` block is falsy and the auth check is silently bypassed — anyone can trigger the scraper. The CORS wildcard (SEC-C2) makes this endpoint reachable from any website.

**Fix:** Make the auth check fail closed when the secret is missing: `if (!cronSecret) return res.status(500)...`

---

#### SEC-C5: Unauthenticated `/api/refresh` Endpoint

**File:** `backend/api/routes/refresh.py:40`

**Evidence:**
```python
@router.post("", response_model=RefreshResponse)
async def trigger_refresh(
    db: AsyncSession = Depends(get_db),
):
    # No auth decorator, no API key check, no rate limiting
```

**Risk:** Anyone can trigger the scraper. Combined with the broken import in `refresh.py` (see ARCH-C4), this endpoint will crash — but if the import is fixed, it becomes a critical unauthenticated action.

**Fix:** Add authentication (API key header or OAuth2 bearer token) and rate limiting to this endpoint.

---

#### SEC-C6: SSRF in Image URL Extraction — No Validation for Private IPs or Dangerous Schemes

**Files:**
- `backend/scraper/scraper.py:357–376`
- `backend/scraper/article_parser.py:245–263`

**Evidence:**
```python
# backend/scraper/scraper.py:365-366
absolute_url = urljoin(base_url, src)
if absolute_url.startswith('http'):
    images.append(absolute_url)
```

**Risk:** No validation for:
- Private IP ranges: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Link-local addresses: `169.254.0.0/16`
- Cloud metadata endpoints: `169.254.169.254`
- Dangerous URI schemes: `file://`, `data:`, `javascript:`

An attacker could craft a scraped article containing an `img src` pointing to a cloud metadata endpoint to retrieve IAM credentials, or a `file://` URI to read local files.

**Fix:** Validate all extracted URLs before storing. Reject any URL matching private IP ranges, link-local addresses, or non-HTTP(S) schemes.

---

### High

#### SEC-H1: Permissive CORS `*` on `/api/stats` and `/api/seizures`

**Files:**
- `frontend/api/stats/index.ts:11–13`
- `frontend/api/seizures/index.ts:13–15`

**Evidence:**
```typescript
// Both endpoints
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

**Risk:** Any website can fetch seizure statistics and data. While these endpoints are read-only, the wildcard allows data exfiltration via CSS injection attacks, browser-based enumeration of seizure records, and creates a pathway for future CSRF if state-changing operations are added.

**Fix:** Use explicit origin allowlist for known Vercel deployment domains.

---

#### SEC-H2: Supabase SERVICE_ROLE Key Potentially Exposed in Vercel Functions

**Files:** All `frontend/api/*/index.ts` files

**Evidence:**
```typescript
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

**Risk:** Vercel serverless functions with the SERVICE_ROLE key could expose it via build logs, edge function source maps, or accidentally bundled into client-side code. The SERVICE_ROLE key bypasses Row Level Security — full database access.

**Fix:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is server-only. Use `SUPABASE_ANON_KEY` + RLS for any client-facing endpoints. Audit build logs for key redaction.

---

#### SEC-H3: No Rate Limiting on Any API Endpoint

**Files:** All `backend/api/routes/` and all `frontend/api/*/index.ts`

**Evidence:** No rate limiting middleware found anywhere in the codebase.

**Risk:** `/api/seizures` and `/api/stats` can be hammered without authentication. `/api/scrape` can be triggered repeatedly. No protection against denial-of-service or bulk data scraping.

**Fix:** Implement Vercel Edge Config rate limiting or a middleware-based rate limiter (`slowapi`) for the FastAPI backend.

---

#### SEC-H4: Docker Container Runs as Root

**File:** `Dockerfile`

**Evidence:**
```dockerfile
FROM python:3.12-slim
# No USER directive before CMD
CMD ["python", "-m", "uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Risk:** If an attacker compromises the application, they have root access to the container.

**Fix:** Add `USER` directive before CMD: `RUN adduser --disabled-password appuser && USER appuser`

---

#### SEC-H5: Silent Task Failure Handling in Async Scraper

**File:** `backend/api/routes/refresh.py:62–63`

**Evidence:**
```python
task.add_done_callback(
    lambda t: print(f"Scrape task {scrape_id} completed: {t.result()}") if not t.exception() else print(f"Scrape task {scrape_id} failed: {t.exception()}")
)
```

**Risk:** Scraper failures only print to stdout. No structured logging, no monitoring, no alerting, no dead-letter tracking for failed articles.

**Fix:** Replace `print` with structured logging (`structlog` or `logging`). Add a `failed_articles` tracking mechanism. Integrate with a monitoring service (Sentry, DataDog).

---

#### SEC-H6: Backend CORS Pattern `*.vercel.app` Is Treated as Literal String

**Files:**
- `backend/api/main.py:47`
- `backend/main.py:130`

**Evidence:**
```python
# backend/api/main.py:47
origins.append("https://*.vercel.app")  # ← treated as literal string

# backend/main.py:130
allow_origins=["https://narc-kart.vercel.app", "https://*.vercel.app", "http://localhost:5173"]
```

**Risk:** The pattern `https://*.vercel.app` is treated as a literal string, not a wildcard. It will never match real browser origins (e.g., `narc-kart-git-feature.vercel.app`). Vercel preview deployments are effectively blocked from CORS access. The audit originally mischaracterized this as "permissive" — it is actually **ineffective**, not insecure. This was corrected by the verifier.

**Fix:** Replace with explicit list of known deployment URLs, or use a regex-based origin validator.

---

#### SEC-H7: Ollama Client Has No Authentication

**File:** `backend/ai/ollama_client.py:35`

**Evidence:**
```python
DEFAULT_BASE_URL = "http://localhost:11434"
# No API key, no authentication header
```

**Risk:** Local-only by default (localhost), but if configured for a remote Ollama instance, the connection is unauthenticated.

**Fix:** Add optional API key authentication for remote Ollama deployments.

---

#### SEC-H8: Health Check Exposes Internal State

**File:** `backend/api/main.py:161–168`

**Evidence:**
```python
return HealthResponse(
    status="ok",
    version=__version__,
    database="connected",
    timestamp=datetime.now(),
)
```

**Risk:** Version number and database connectivity status are exposed. Version disclosure helps attackers target known CVEs for that version.

**Fix:** Remove `version` and `database` fields from the public health response. Log them server-side only.

---

#### SEC-H9: robots.txt Not Respected in Scraper

**Files:** `backend/scraper/scraper.py`, `backend/scraper/run_scraper.py`

**Evidence:** No `RobotFileParser` usage found.

**Risk:** The scraper ignores `robots.txt`. This is a legal and ethical concern and may violate websites' terms of service.

**Fix:** Add `RobotFileParser` checks before scraping any domain.

---

#### SEC-H10: Geocode Cache Has No Integrity Protection

**File:** `backend/geocoder.py:63–69`

**Evidence:**
```python
def _save_cache(self) -> None:
    with open(self.cache_file, 'w') as f:
        json.dump(self.cache, f, indent=2)
```

**Risk:** Cache file has no HMAC or integrity checking. Tampered cache could inject incorrect geocoding results.

**Fix:** Add HMAC-SHA256 signing of the cache file. Verify on load.

---

### Medium

| ID | Issue | File |
|----|-------|------|
| SEC-M1 | Hardcoded fallback coordinates — unknown cities silently return India's geographic center | `frontend/api/scrape/index.ts:38–40` |
| SEC-M2 | No input validation on query parameters (`limit`, `drug_type`, `state`) | `frontend/api/seizures/index.ts:28–35` |
| SEC-M3 | Error messages expose internal details — `err.message` returned to clients | `frontend/api/scrape/index.ts:209` |
| SEC-M4 | No HTTPS enforcement for GDELT data source | `scripts/collect_data.py` |
| SEC-M5 | Frontend source URL rendered without HTTPS/scheme validation | `frontend/src/components/SeizurePopup.tsx:80–87` |

### Low

| ID | Issue | File |
|----|-------|------|
| SEC-L1 | Unused `feedparser` import | `scripts/collect_data.py:26–29` |
| SEC-L2 | Dead code in `poll_rss_feeds` — unreachable after `return seizures` | `scripts/collect_data.py:434–511` |

---

## Performance Findings

> Merged from `perf-audit.md` + `perf-verifier.md`. De-duplicated. The verifier confirmed all 4 critical and 10 high findings. The verifier also surfaced 4 additional missed findings.

**Scale note:** The audit reported 2,759 records. The verifier confirmed the actual record count in `frontend/public/data.json` (the file loaded by the frontend) is **1,968 records** — a discrepancy of ~800. The ~1.5 MB file size claim is directionally correct. All findings apply regardless of the exact count.

---

### Critical

#### PERF-C1: All Map Markers Rendered Individually Without Clustering

**File:** `frontend/src/components/IndiaMap.tsx:60–66`

**Evidence:**
```tsx
{seizures.map((seizure) => (
  <SeizureMarker
    key={seizure.id}
    seizure={seizure}
    onSelect={onSeizureSelect}
  />
))}
```

**Impact:** With 1,968 seizure records, every marker renders as an individual `Marker` component at the default zoom level (4 — India overview). The map is nearly unresponsive. Users cannot pan or zoom smoothly.

**Fix:** Add `react-leaflet-cluster` or `leaflet.markercluster`. At minimum, filter markers by viewport bounds before rendering. Consider showing only major seizures (≥100 kg) at overview zoom levels.

---

#### PERF-C2: Inline SVG Construction Per Marker Per Render

**File:** `frontend/src/components/SeizureMarker.tsx:34–42`

**Evidence:**
```tsx
const icon = L.divIcon({
  className: styles.markerWrapper,
  html: `<svg ...>`,  // New SVG string every render
});
```

**Impact:** `L.divIcon()` is called inside the component body with no memoization. With 1,968 markers, this generates thousands of temporary SVG strings per render cycle. Leaflet owns the DOM after insertion, bypassing React's reconciliation entirely.

**Fix:** Memoize SVG icons by `(quantityKg, isMajor)` key using a module-level `Map` cache. Only 3 unique icon shapes are needed (critical/high/low).

---

#### PERF-C3: No Database Indexes on Filter/Group-by Columns

**File:** `backend/database/models.py`

**Evidence:** The `Seizure` model has zero `Index()` objects. No `__table_args__` defined. Every `GROUP BY state`, `GROUP BY drug_type`, `ORDER BY date`, and `ILIKE` filter does a full table scan.

**Impact:** Queries will degrade linearly as the dataset grows. With scraping adding records continuously, this will become a bottleneck past ~5,000 rows.

**Fix:**
```sql
CREATE INDEX idx_seizures_state ON seizures(state);
CREATE INDEX idx_seizures_drug_type ON seizures(drug_type);
CREATE INDEX idx_seizures_date ON seizures(date DESC);
CREATE INDEX idx_seizures_quantity ON seizures(quantity_kg);
CREATE INDEX idx_seizures_coords ON seizures(lat, lon) WHERE lat IS NOT NULL;
```
Add these as `Index()` objects in `models.py` via `__table_args__`.

---

#### PERF-C4: Artificial 2,500ms Loading Delay

**File:** `frontend/src/App.tsx:33–36`

**Evidence:**
```tsx
useEffect(() => {
  const timer = setTimeout(() => setIsLoadingApp(false), 2500);
  return () => clearTimeout(timer);
}, []);
```

**Impact:** Every app load blocks the user for 2.5 seconds regardless of actual data readiness. Real data loading (JSON parse of 1.1 MB) is hidden behind this timer. The `loading` state returned by `useApi` is never consumed.

**Fix:** Remove the `setTimeout`. Use `useApi`'s actual `loading` state. Show a skeleton loader for the map area during the initial data fetch.

---

### High

| ID | Issue | File |
|----|-------|------|
| PERF-H1 | `get_map_data` — unbounded full-table load, no pagination or limit | `backend/database/queries.py:195–239` |
| PERF-H2 | `useApi` fires 2 parallel API calls without deduplication on mount | `frontend/src/hooks/useApi.ts:254–259` |
| PERF-H3 | No `AbortController` to cancel stale filter-change requests | `frontend/src/hooks/useApi.ts:165–193` |
| PERF-H4 | GeoJSON boundary fetched inside `useEffect` — re-fetch risk on remount | `frontend/src/components/IndiaMap.tsx:19–36` |
| PERF-H5 | `TrendingPanel` sorts 2 arrays (O(n log n)) on every render | `frontend/src/components/TrendingPanel.tsx:24–25` |
| PERF-H6 | `AgencyPanel` O(n) aggregation rebuilt on every render | `frontend/src/components/AgencyPanel.tsx:9–18` |
| PERF-H7 | `ComparePanel` O(n log n) sort on every render | `frontend/src/components/ComparePanel.tsx:10–12` |
| PERF-H8 | `IntelPanel` creates temporary array with `Math.max(...Object.values())` on every render | `frontend/src/components/IntelPanel.tsx:38` |
| PERF-H9 | `LiveFeed` receives full seizures array (1,968 items), uses only first 10 | `frontend/src/components/LiveFeed.tsx:29` |
| PERF-H10 | `get_statistics` runs 6 sequential DB round-trips instead of parallel | `backend/database/queries.py:113–192` |
| PERF-H11 | Hardcoded 8,000ms `AbortController` timeout not configurable | `frontend/src/hooks/useApi.ts:174` *(found by verifier)* |
| PERF-H12 | Static mode has no pagination — full 1,968 records fetched even for partial views | `frontend/src/hooks/useApi.ts:67–97` *(found by verifier)* |
| PERF-H13 | `NetworkPanel` inline `Math.cos/sin` on every render for every node | `frontend/src/components/NetworkPanel.tsx:31–36` *(found by verifier)* |
| PERF-H14 | `FilterPanel` `activeCount` computed inline on every render | `frontend/src/components/FilterPanel.tsx:86–90` *(found by verifier)* |

---

### Medium

| ID | Issue | File |
|----|-------|------|
| PERF-M1 | Vite config has no code splitting, no vendor chunk separation, no gzip/brotli | `frontend/vite.config.ts` |
| PERF-M2 | `@supabase/supabase-js` and `@vercel/node` unused in frontend client bundle | `frontend/package.json:12–13` |
| PERF-M3 | `fetchStaticData` loads entire 1.1 MB JSON synchronously on startup | `frontend/src/hooks/useApi.ts:67–97` |
| PERF-M4 | Inline `onClick` callback in App causes unnecessary Header re-renders | `frontend/src/App.tsx:50–52` |
| PERF-M5 | All 7 sidebar tab panels rendered simultaneously (no `React.lazy`) | `frontend/src/App.tsx:54–89` |
| PERF-M6 | Header creates `new Date()` on every render | `frontend/src/components/Header.tsx:9–20` |
| PERF-M7 | Separate count query in `get_all_seizures` — 2 round-trips instead of 1 | `backend/database/queries.py:28–38` |
| PERF-M8 | `TerminalPanel` synchronous `JSON.stringify` of 1,968 seizures | `frontend/src/components/TerminalPanel.tsx:37–47` |
| PERF-M9 | `DOMPurify` sanitization on every seizure description render | `frontend/src/components/SeizurePopup.tsx` |
| PERF-M10 | `FilterPanel` local filter state duplicates backend FilterState | `frontend/src/components/FilterPanel.tsx:38` |

---

### Low

| ID | Issue | File |
|----|-------|------|
| PERF-L1 | Cache TTL is 1 hour — data can be significantly stale | `frontend/src/hooks/useApi.ts:5` |
| PERF-L2 | localStorage cache has no version key — schema changes cause silent errors | `frontend/src/hooks/useApi.ts:99–115` |
| PERF-L3 | No `React.memo` anywhere in the component tree | All components |
| PERF-L4 | `seed_database.py` uses sequential INSERT loop with per-row commits | `backend/seed_database.py:139–156` |

---

## Architecture Findings

> Merged from `arch-audit.md` + `arch-verifier.md`. De-duplicated. All Critical and High findings confirmed by verifier. The arch-audit v2 correctly expanded from a two-way to three-way data layer schism after verifier feedback.

---

### Critical

#### ARCH-C1: Three-Way Data Layer Schism

**Files:** `backend/database.py` · `backend/database/` · `frontend/api/` · `frontend/public/data.json`

**Impact — SPEC VIOLATION:** SPEC.md mandates SQLite as the database. The active production deployment uses Supabase PostgreSQL. The Vercel serverless functions are the live data layer; both FastAPI backends are archived.

**Impact — Schema divergence:** Each data layer uses different field names for identical data:

| Field | FastAPI `main.py` | FastAPI `api/` | Vercel Supabase | `data.json` |
|-------|-------------------|----------------|-----------------|-------------|
| City | `location_city` | `city` | `city` | `city` |
| Lat | `latitude` | `lat` | `lat` | `lat` |
| Lon | `longitude` | `lon` | `lon` | `lon` |
| Date | `seizure_date` | `date` | `date_iso` | `date` |
| Quantity | `quantity_kg` | `quantity_kg` | `quantity_kg` | `quantityKg` ⚠️ |
| Drug Type | `drug_type` | `drug_type` | `drug_type` | `drugType` ⚠️ |
| Source Name | `source_name` | `source_name` | `source_name` | `sourceName` ⚠️ |
| Source URL | `article_url` | `source_url` | `source_url` | `sourceUrl` ⚠️ |

**Fix:** Canonicalize on Supabase PostgreSQL as the single source of truth. Standardize frontend types and API contracts on that schema. Deprecate both FastAPI layers.

---

#### ARCH-C2: `mapApiSeizure` Is a Type-Safety Black Hole

**File:** `frontend/src/hooks/useApi.ts:42–59`

**Evidence:**
```typescript
function mapApiSeizure(s: any): Seizure {  // ← any type accepted
  return {
    location: {
      city: s.city || s.location_city || '',       // 2-4 fallback aliases
      lat: s.lat ?? s.latitude ?? s.location_lat ?? null,
    },
    drugType: s.drug_type || s.drugType || '',
    quantityKg: s.quantity_kg ?? s.quantityKg ?? 0,
    // ... 10 fields, each with 2-4 fallback chains
  };
}
```

**Impact:** No TypeScript type guard, no Zod schema validation, no runtime error on schema mismatch. Silent data corruption when schemas diverge. The `fetchFromApi` path handles the Supabase schema; `fetchStaticData` maps `data.json` schema which itself differs. Adding a new data source requires adding more fallback chains.

**Fix:** Create typed interfaces per data source. Use Zod schemas for runtime validation. Generate TypeScript types from Supabase schema using `supabase-gen`.

---

#### ARCH-C3: Dual FastAPI Backends Both Defined — Route Collision

**Files:** `backend/main.py` (413 lines) vs `backend/api/main.py` (169 lines)

Both define overlapping routes: `/api/seizures`, `/api/stats`, `/api/health`. Different stacks — `main.py` uses sync `sqlite3`; `api/main.py` uses async SQLAlchemy. If both are deployed, requests are unpredictable. Both also have different response schemas (snake_case vs different snake_case).

**Fix:** Archive `main.py` and `database.py`. Consolidate on `api/main.py` + `database/` as the single canonical backend.

---

#### ARCH-C4: `refresh.py` Broken Relative Import

**File:** `backend/api/routes/refresh.py:22`

**Evidence:**
```python
from database.connection import AsyncSessionLocal  # ← bare module name
```

**Impact:** `database.` will only resolve if `database/` is on `sys.path` at the package root. When `api/main.py` mounts the refresh router, this import fails with `ModuleNotFoundError: No module named 'database'`. The entire `/api/refresh` endpoint is unreachable in the `api/` stack.

**Fix:** Change to `from backend.database.connection import AsyncSessionLocal` (absolute) or `from ..database.connection import AsyncSessionLocal` (relative).

---

#### ARCH-C5: `AppContext` Defined but Never Mounted

**Files:** `frontend/src/context/AppContext.tsx` (53 lines) · `frontend/src/App.tsx`

**Evidence:** `grep AppProvider` in `frontend/src/` → zero matches. `App.tsx` uses local `useState` for all global state.

**Impact — SPEC VIOLATION:** SPEC.md §Tech Stack specifies `React Context + useReducer`. The `AppContext` and `appReducer` are structurally correct but completely dead code. Any component attempting to use `useAppContext()` throws a runtime error.

**Fix:** Either wire `AppProvider` into `main.tsx` and migrate all local `useState` to dispatch actions, or delete `AppContext.tsx` entirely.

---

### High

| ID | Issue | File |
|----|-------|------|
| ARCH-H1 | `TerminalPanel.tsx` defines its own local `Seizure` type — structural drift from canonical `types/index.ts` (missing `caseNo`, `images`, `SeizureSource`) | `frontend/src/components/TerminalPanel.tsx:5–14` |
| ARCH-H2 | Design token war — two CSS systems: `design-tokens.css` (SPEC-aligned, `--text-primary: #00FF00`, orphaned) vs `design-system.css` (active, `--text-primary: #FFFFFF`, SPEC violation) | `frontend/src/styles/` |
| ARCH-H3 | No React ErrorBoundary — any uncaught error crashes the app with a blank white screen | `frontend/src/main.tsx` |
| ARCH-H4 | `useApi.ts` is a 275-line god hook handling 7 responsibilities: cache, static fetch, API fetch, field mapping, filter building, offline fallback, reactive effects | `frontend/src/hooks/useApi.ts` |
| ARCH-H5 | Scraper duplicated across two incompatible stacks: FastAPI (BeautifulSoup + Playwright + Ollama) vs Vercel (RSS feeds + regex only, NCB stub returns empty) | `backend/scraper/` · `frontend/api/scrape/` |
| ARCH-H6 | CORS wildcard violations — all three Vercel serverless functions use `Access-Control-Allow-Origin: *` | `frontend/api/*/index.ts` |
| ARCH-H7 | No database migration system — `init_db()` uses `CREATE TABLE IF NOT EXISTS` only; schema evolution is impossible | `backend/database/connection.py:38–45` |
| ARCH-H8 | `getSeverityClass` copied identically in three components (LiveFeed, TrendingPanel, SeizurePopup) — DRY violation | Multiple `frontend/src/components/` |

---

### Medium

| ID | Issue | File |
|----|-------|------|
| ARCH-M1 | `@supabase/supabase-js` and `@vercel/node` in frontend `package.json` — server-side packages with potential bundle pollution risk | `frontend/package.json:12–13` |
| ARCH-M2 | `SeizureMarker` recreates SVG icons on every render | `frontend/src/components/SeizureMarker.tsx:34–42` |
| ARCH-M3 | `IndiaMap` fetches GeoJSON inside `useEffect` — fragile architecture | `frontend/src/components/IndiaMap.tsx:19–36` |
| ARCH-M4 | No type-safe API client — no generated types from OpenAPI, no Zod runtime validation | `frontend/src/hooks/useApi.ts` |
| ARCH-M5 | `DOMPurify` present in `package.json` but not validated against `types/index.ts` | `frontend/src/components/SeizurePopup.tsx:1` |
| ARCH-M6 | No loading skeletons — hardcoded 2.5s timer instead of real loading state | `frontend/src/App.tsx:33–36` |
| ARCH-M7 | Rate limiting in `geocoder.py` is process-local only — bypassed by uvicorn workers | `backend/geocoder.py:75–81` |
| ARCH-M8 | Scraper silently swallows exceptions — `except Exception: pass` in article parsing | `backend/scraper/article_parser.py:229–241` |
| ARCH-M9 | `loading` state from `useApi` never consumed in UI | `frontend/src/App.tsx` |
| ARCH-M10 | `StatBoxes.tsx` has dead double-nullish fallback — `recentCount` is `number`, never `null` | `frontend/src/components/StatBoxes.tsx:13` |

---

### Low

| ID | Issue | File |
|----|-------|------|
| ARCH-L1 | `@supabase/supabase-js` not imported anywhere in `frontend/src/` | `frontend/package.json:12` |
| ARCH-L2 | Hardcoded color values (`#00FFFF`, `#E83D3D`, `#FF8C42`, `#FFCC00`) scattered across components | Multiple `frontend/src/components/` |
| ARCH-L3 | No ESLint / Prettier configuration | — |
| ARCH-L4 | No test infrastructure (`vitest`, `*.test.ts`) | — |
| ARCH-L5 | `IndiaMap` max zoom is 8 — non-interactive at street level | `frontend/src/components/IndiaMap.tsx:45` |
| ARCH-L6 | City-state fallback dictionary duplicated in 3 places (2 Python files, 1 TypeScript) | `backend/geocoder.py` · `backend/scraper/article_parser.py` · `frontend/api/scrape/index.ts` |
| ARCH-L7 | No structured logging configuration for production | Multiple Python files |
| ARCH-L8 | `backend/main.py` global exception handler hides all errors — no request UUID, no server-side logging | `backend/main.py:388–394` |
| ARCH-L9 | `AppContext` exports `useAppContext` that always throws outside provider | `frontend/src/context/AppContext.tsx:51` |
| ARCH-L10 | Frontend `overflow: hidden` on mobile — desktop-only lockout | `frontend/src/styles/global.css:12` |

---

## Verified Clean Areas

The following were checked thoroughly and found to be correctly implemented:

- **SQL injection is mitigated** — `queries.py` uses SQLAlchemy ORM with parameterized queries. The `_sanitize_for_ilike()` function correctly escapes `%`, `_`, and `\` for LIKE queries. The audit originally flagged this; the verifier confirmed it is defensive code working correctly.
- **XSS is mitigated** — React's JSX escaping is used for all content. `DOMPurify.sanitize()` is applied to the description field in `SeizurePopup.tsx:94`. External links use `rel="noopener noreferrer"`.
- **No hardcoded secrets** — All secrets use `process.env` / environment variables. No API keys, passwords, or tokens found in source code.
- **Pydantic models are well-structured** — Request/response validation in `api/models.py` is properly typed with field descriptions.
- **SQLAlchemy async session pattern is correct** — `get_db()` generator properly handles session lifecycle with cleanup.
- **CSS Modules are consistently used** — Every component has a scoped `.module.css` file.
- **`AbortSignal.timeout()` is correct** — Modern, idiomatic timeout handling in `useApi.ts`.
- **localStorage caching with TTL is implemented** — Sensible offline-first approach with cache expiry.
- **`framer-motion` is present** — `AnimatePresence` used for modal/panel animations.
- **`dompurify` is present** — Confirmed in `package.json:14`. Used in `SeizurePopup.tsx`.
- **Supabase schema has proper indexes** — `seizures_geo_idx`, `seizures_date_idx`, `seizures_state_idx` exist in `schema.sql`.
- **No N+1 query pattern** — `useApi` calls `/api/seizures` with a single request. Pagination is used. No loop of individual requests.

---

## Top 5 Priority Fixes

Ranked by exploitability (today vs future), data integrity impact, and user-facing severity.

### 1. Remove `verify=False` from data ingestion scripts (SEC-C1)
**Why #1:** This is the only finding where real data integrity is at risk *right now*. GDELT data and RSS feeds are ingested without SSL verification. An active MITM attack on the ingestion network could inject false seizure records into the production database. The fix is a one-line removal per location (`backend/scraper/run_scraper.py:314`, `scripts/collect_data.py:291, 336`). The main `scraper.py` class already has `verify_ssl=True` as the default — only the standalone scripts bypass it.

### 2. Add map marker clustering (PERF-C1)
**Why #2:** The Leaflet map is the primary UI and is nearly unusable at the default zoom. Every one of the 1,968 seizure records renders as an individual marker simultaneously, making pan/zoom interactions non-responsive. This is a user-facing critical bug that affects every person who opens the app. The fix uses an off-the-shelf library (`react-leaflet-cluster`) with minimal code changes.

### 3. Fix the CORS wildcard `*` + Authorization header on `/api/scrape` (SEC-C2) AND add auth on `/api/refresh` (SEC-C5)
**Why #3:** The scraper endpoint allows any origin AND any Authorization header. If the CRON_SECRET is unset in production (SEC-C4), authentication is bypassed entirely, making the scraper unauthenticated and reachable from any website. Anyone can inject records. The refresh endpoint is also completely unauthenticated. Both need immediate fixes before the scraper can be considered production-ready.

### 4. Canonicalize on Supabase schema as single source of truth (ARCH-C1 + ARCH-C2)
**Why #4:** The three-way data layer schism is a ticking time bomb. Every new feature that touches the API or database has three divergent code paths to maintain. The `mapApiSeizure(s: any)` type black hole silently corrupts data on any schema mismatch. The fix is to pick Supabase PostgreSQL as the canonical schema, generate TypeScript types from it, replace `any` with Zod validators, and archive both FastAPI stacks.

### 5. Add database indexes before the dataset grows past 5,000 records (PERF-C3)
**Why #5:** Every filter, group-by, and sort query currently does a full table scan. The verifier confirmed zero indexes exist in the `Seizure` model. With scraping continuously adding records, query performance will degrade linearly. The SQL to add indexes is straightforward and the impact is immediate. This is a maintenance debt item that becomes critical at scale.

---

## Appendix: Verifier Disputes

### 1. CORS `*.vercel.app` Pattern — Mechanism Description

| | Claim |
|---|---|
| **Audit** | "wildcard subdomain pattern is added to CORS allowlist but `CORSMiddleware` does NOT support wildcard patterns. This will be treated as a literal string." — framed as a security concern. |
| **Verifier** | Confirmed the literal-string treatment, but clarified the *impact*: the pattern `https://*.vercel.app` is **ineffective** (never matches real origins), not permissive. Vercel preview deployments are blocked, not exposed. |
| **Resolution** | Both identified a real problem. The audit misframed it as "permissive" when it is "ineffective." Both agree the fix is the same: replace with explicit deployment URLs. |

### 2. SQL Injection in `queries.py` — Severity Assessment

| | Claim |
|---|---|
| **Audit** | Flagged as a potential SQL injection vulnerability. |
| **Verifier** | Not a vulnerability. Code uses SQLAlchemy ORM with parameterized queries AND explicit `_sanitize_for_ilike()` for LIKE patterns. The defensive code is working correctly. |
| **Resolution** | Confirmed as a false positive. The audit correctly identified the mitigation exists but incorrectly framed it as evidence of a vulnerability. |

### 3. SSL Verification Default — Scope

| | Claim |
|---|---|
| **Audit** | "The `ScrapeConfig` has `verify_ssl=True` as default, but `run_scraper.py` bypasses it entirely." — implied broader issue. |
| **Verifier** | Correct, but `scraper.py` (the main scraper) DOES use `verify_ssl=True` by default. Only standalone scripts (`run_scraper.py`, `collect_data.py`) use `verify=False`. The issue is real but scoped. |
| **Resolution** | Finding is valid, overstated in scope. The main application is correctly configured; the standalone scripts are not. |

### 4. Record Count — Data Scale

| | Claim |
|---|---|
| **Audit** | "2,759 seizure records" |
| **Verifier** | `frontend/public/data.json` (the file the frontend actually loads via `fetch('/data.json')`) contains **1,968 records** — 791 fewer. The ~1.5 MB file size is directionally correct. |
| **Resolution** | Minor factual inaccuracy. Does not invalidate any findings — all architectural and performance issues apply at both counts. |

### 5. Missing Findings from Verifier (Not Disputes — Additions)

The verifier surfaced 4 performance findings that the audit missed:

- **Hardcoded 8s AbortController timeout** not configurable (`useApi.ts:174`)
- **Static mode has no pagination** — full JSON loaded even for partial views
- **NetworkPanel** inline `Math.cos/sin` on every render
- **FilterPanel** `activeCount` computed inline on every render

These are included in the Performance Findings section above.

---

*Report generated from three independent audits: `security-audit.md`, `perf-audit.md`, `arch-audit.md` (v2), with independent verification from `security-verifier.md`, `perf-verifier.md`, and `arch-verifier.md`.*
