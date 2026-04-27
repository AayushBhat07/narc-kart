# Narc Kart — Full Codebase Analysis Report

## Project Overview

Narc Kart is a full-stack India drug seizure intelligence platform.
- **Frontend:** React 19 + Vite + TypeScript, Leaflet map, CSS Modules, Framer Motion
- **Backend:** Python FastAPI (two conflicting entry points), SQLite, BeautifulSoup scraper, Ollama LLM extraction
- **Theme:** Matrix/military intelligence aesthetic

---

## 1. Architecture Overview

### Critical Problem: Two Conflicting Backend Entry Points

The backend has **two completely separate FastAPI applications** that both serve the same purpose but are architecturally incompatible:

| | `backend/api/main.py` | `backend/main.py` |
|---|---|---|
| Style | Async SQLAlchemy | Sync sqlite3 |
| DB | `backend/database/` (async) | `backend/database.py` (sync) |
| Scraper | No | Yes, inline |
| Used by | `run.py` | `python -m backend.main` |
| API routes | `/api/seizures`, `/api/stats`, `/api/map-data`, `/api/refresh` | Same routes |
| CORS | Fixed (allowlist) | **Still `allow_origins=["*"]`** |

`run.py` starts `backend.api.main:app` (the async version).
`backend/main.py` is a **standalone alternative** that mounts the scraper and uses a completely different database class (`Database` from `backend/database.py`).

**These two systems have different schemas, different query styles, and different data models.** Running both simultaneously would create data inconsistency.

### Data Model Mismatch

| Field | `backend/database/models.py` (Seizure) | `backend/database.py` (seizures table) |
|---|---|---|
| Location | `city`, `state` (flat) | `location_city`, `location_state` (flat) |
| Coordinates | `lat`, `lon` | `latitude`, `longitude` |
| ID type | `String(50)` | `INTEGER PRIMARY KEY` |
| Images | JSON string in `images` column | Separate `images` table |

The `backend/api/routes/seizures.py` response model uses snake_case keys matching the SQLAlchemy model, but `useApi.ts` transforms them to camelCase for the frontend — this is correctly handled in the hook.

### Frontend State Architecture
- `AppContext` (useReducer) manages only UI state: selected seizure, filter panel open, active tab
- `useApi` hook manages all server state independently — **two separate state management systems**
- `App.tsx` reads from both — works but is architecturally messy

---

## 2. Data Flow

```
News Sources (news_sources.py)
    ↓ HTTP GET / Playwright JS render
Article HTML
    ↓ BeautifulSoup parse (article_parser.py)
Raw article text
    ↓ Ollama LLM extraction OR regex fallback (ai/extractor.py)
SeizureData object
    ↓ Geocoding via Nominatim (geocoder.py)
Coordinates added
    ↓ db.insert_seizure() (database.py)
SQLite storage
    ↓ FastAPI route handler (api/routes/)
JSON response
    ↓ useApi.ts transforms
React state
    ↓ Leaflet map / LiveFeed / IntelPanel
UI Render
```

### The Two API Paths
1. **API path (Vite proxy → FastAPI):** `useApi.ts → /api/seizures → backend/api/main.py → database queries → SQLite**
2. **Static path (no env):** `useApi.ts → /data.json` (pre-built static file)

---

## 3. Security Posture

### Already Fixed in PR #1 (branch `fix/critical-security-issues`):
- ✅ CWE-89: SQL injection in LIKE queries (`queries.py`)
- ✅ CWE-346: CORS wildcard (`api/main.py`)
- ✅ CWE-209: Error message leak (`api/main.py`)
- ✅ Hardcoded `raids_this_week` placeholder

### Still Present in `backend/main.py` (NOT fixed by PR #1):

**CRITICAL: `backend/main.py` still has `allow_origins=["*"]`**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ← unfixed!
    allow_credentials=True,
    ...
)
```
This is a separate entry point — anyone running `python -m backend.main` gets the vulnerable CORS.

**CRITICAL: `backend/main.py` exposes exception details:**
```python
return JSONResponse(
    status_code=500,
    content={"detail": "Internal server error"}  # ← already fixed in api/main.py
)
```
Wait — this one is actually fine in `main.py` (generic message). But the `allow_origins=["*"]` is still present.

### Additional Security Issues Found:

| # | CWE | Severity | Location | Issue |
|---|---|---|---|---|
| S1 | CWE-20 | HIGH | `backend/main.py` `/api/seizures` | No input validation on filter params passed to `db.get_seizures()` — raw params go directly into SQL |
| S2 | CWE-79 | MEDIUM | `SeizurePopup.tsx`, `LiveFeed.tsx` | `seizure.description` and `seizure.caseNo` rendered as raw text — no XSS sanitization |
| S3 | CWE-22 | MEDIUM | `article_parser.py` `_extract_images()` | Image URLs from scraped HTML are stored and rendered without scheme validation — `data:`, `javascript:`, `file://` URLs could be accepted |
| S4 | CWE-20 | LOW | `article_parser.py` `QUANTITY_PATTERNS` | Quantity regex `r'(\d+)\s*(kg)'` (second pattern) is a subset of the first — second pattern never matches because first already consumed all `X kg` strings |
| S5 | CWE-778 | LOW | `refresh.py` `run_scraper_task()` | `scrape_logs` table used but `log_scrape()` in `backend/database.py` is never called — no scrape audit trail |
| S6 | CWE-295 | INFO | `geocoder.py` | SSL verification can be disabled via `verify_ssl` config but there's no env var to control it — defaults to True which is correct |
| S7 | CWE-435 | LOW | `SeizureMarker.tsx` | Marker coordinates used directly without bounds check — invalid lat/lon from bad data could break map rendering |

---

## 4. Bug Report

### B1: Duplicate Import in `IndiaMap.tsx` (TypeScript Error)
**File:** `frontend/src/components/IndiaMap.tsx`
```typescript
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
// ... later in file ...
import { motion, AnimatePresence } from 'framer-motion';  // ← duplicate import at bottom of file
import { Seizure } from '../types';
import { SeizurePopup } from './SeizurePopup';
```
The `motion` and `AnimatePresence` imports are at the bottom of the file, not at the top. In TypeScript/ES modules, imports must be at the top-level. This will cause a build error.

### B2: `Sidebar.tsx` — Dead Refresh Button
**File:** `frontend/src/components/Sidebar.tsx`
```typescript
<button className={styles.actionBtn}>
  <span>↺</span> REFRESH  <!-- ← onClick missing! -->
</button>
```
The sidebar's Refresh button doesn't wire to `onRefresh`. Only the header refresh button triggers it.

### B3: `refresh.py` — Silently Swallows Import Errors
**File:** `backend/api/routes/refresh.py`
```python
try:
    from scraper import run as run_scraper
    new_count = await run_scraper(db)
except (ImportError, AttributeError):
    # Scraper not implemented yet - simulate
    await asyncio.sleep(1)
    new_count = random.randint(0, 5)
```
If the scraper import fails for any reason (syntax error, broken import), it silently falls back to a random number. A developer would never know the scraper failed.

### B4: `refresh.py` — Scrape Log Never Written
**File:** `backend/api/routes/refresh.py` → calls `create_scrape_run()` and `complete_scrape_run()` but `backend/database/queries.py` has no `log_scrape()` method — only `create_scrape_run` and `complete_scrape_run`. The `ScrapeMetadata` table exists in the async model but `complete_scrape_run` in `queries.py` requires the async connection but the sync `refresh.py` tries to use it. The logging system is broken.

### B5: Quantity Regex — Duplicate Pattern Never Fires
**File:** `backend/scraper/article_parser.py`
```python
QUANTITY_PATTERNS = [
    r'(\d+(?:\.\d+)?)\s*(kg|kilograms?)\b',  # ← catches "45 kg"
    r'(\d+)\s*(kg)',                          # ← never reached for "45 kg"
    ...
]
```
The second pattern `r'(\d+)\s*(kg)'` is strictly a subset of the first. If the first fails (e.g., "45kilograms" without space — unlikely), the second would also fail to match because the space is required. Actually, looking more carefully, the second pattern `r'(\d+)\s*(kg)'` has no word boundary and would match "45kg" where the first wouldn't... but there's a third pattern `r'(\d+)\s*(gram)'` which is also a subset. These duplicate patterns indicate dead code.

### B6: `get_statistics` — `raids_this_week` Bug (Already Fixed in PR)
`datetime.now().replace(day=1, month=1)` gives January 1st of the current year — which filters to seizures from Jan 1 only, not the last 12 months. **Fixed** in PR #1 by using `timedelta(days=365)`.

### B7: `Seed Database` — Connects to Wrong DB Path
**File:** `backend/seed_database.py`
```python
DB_PATH = os.path.join(os.path.dirname(__file__), "narc_kart.db")
```
Seeds `narc_kart.db` in the backend directory, but `database.py` and `connection.py` use different paths:
- `database.py`: `Path.home() / ".narc-kart" / "narc-kart.db"`
- `connection.py`: env var `DATABASE_PATH` or `narc_kart.db` (relative)

Running `seed_database.py` could seed a different database than the one the API uses.

### B8: Frontend/Backend Schema Alignment in Static Mode
**File:** `frontend/src/hooks/useApi.ts`
When in static mode (`VITE_API_BASE` not set), it fetches `/data.json` and maps:
```typescript
const seizures: Seizure[] = data.seizures.map((s: any) => ({
    id: s.id,
    location: { city: s.city, state: s.state, lat: s.lat, lon: s.lon },
    ...
}))
```
The static JSON must have flat `city`/`state` fields matching the sync `database.py` schema, not the SQLAlchemy nested model. If generated by the async API, the static JSON would have `location_city` / `location_state` and this mapping breaks silently.

### B9: `useApi.ts` — `readCache()` Called Twice on Mount
**File:** `frontend/src/hooks/useApi.ts`
```typescript
useEffect(() => {
    const cached = readCache();  // ← first call
    if (cached) { ... }
}, []);

useEffect(() => {
    mountedRef.current = true;
    fetchSeizures();  // ← which calls readCache internally again
    ...
}, []);
```
`readCache()` is cheap (localStorage read), but the second call inside `fetchStatic()` / `fetchFromApi()` means the cache is validated twice per mount.

### B10: `IndiaMap` — `maxZoom: 8` Too Restrictive
**File:** `frontend/src/components/IndiaMap.tsx`
```typescript
maxZoom={8}
```
India is a large country. Zoom level 8 is not enough for users who want to inspect specific cities. Standard map apps allow zoom 18+. This is a UX limitation.

### B11: `SeizureMarker` — No Bounds Check on Coordinates
**File:** `frontend/src/components/SeizureMarker.tsx`
```typescript
position={[seizure.location.lat, seizure.location.lon]}
```
If `lat` or `lon` is `NaN`, `undefined`, or outside valid ranges (-90/90, -180/180), Leaflet will silently reject the marker or render it incorrectly. Should validate before rendering.

### B12: `liveFeed` — `slice(0, 10)` Then `idx` as Key
**File:** `frontend/src/components/LiveFeed.tsx`
```typescript
{seizures.slice(0, 10).map((seizure, idx) => (
    <div key={`${seizure.id}-${idx}`}>
```
Using `idx` in the key defeats React's reconciliation for re-ordered items. Since it's sliced to 10 and the source is pre-sorted by date, this rarely causes visible bugs — but it's incorrect.

---

## 5. Tech Debt & Quality Issues

### TD1: No Test Suite
Zero pytest, zero Vitest, zero Playwright tests. Any refactor risks silent regressions.

### TD2: Duplicate Backend Systems
Two complete FastAPI apps (`backend/api/main.py` + `backend/main.py`) with different databases, different schemas, different data models. One should be deleted.

### TD3: Hardcoded Values Throughout
| Location | Value | Should Be |
|---|---|---|
| `queries.py` `get_statistics` | `RAIDS_THIS_WEEK = 12` | Real DB query (fixed in PR) |
| `IndiaMap.tsx` `maxZoom={8}` | 8 | Configurable |
| `geocoder.py` `FALLBACK_COORDINATES` | 20 cities hardcoded | Generated from authoritative source |
| `article_parser.py` hardcoded city list | ~25 cities | Centralized constants file |
| `NewsSource` URLs | All hardcoded | Config or env var |

### TD4: Missing `india-boundary.geojson`
`SPEC.md` specifies a `frontend/public/india-boundary.geojson` file for the India map outline. This file doesn't exist. The map only shows markers with a CARTO dark tile basemap — no India boundary is rendered.

### TD5: `NetworkPanel` is Decorative, Not Functional
The network graph draws SVG circles at calculated positions — but these don't represent real network connections (e.g., trafficking routes). The "connections" are fake line segments between adjacent array items. This is a placeholder visualization.

### TD6: `CMD Input` in `App.tsx` Does Nothing
```tsx
<input
  type="text"
  placeholder="Enter command..."
  className={styles.cmdField}
/>
```
The command input in the center panel has no `onChange`, `onKeyDown`, or any handler. It's visually present but completely non-functional.

### TD7: `Header.tsx` Settings Button Has No Handler
```tsx
<button className={styles.iconBtn} title="Settings">
  ⚙
</button>
```
Dead button.

### TD8: Error Handling — Silent Failures in `useApi.ts`
In `fetchFromApi`, any error results in fallback to cache or `setError('Failed to fetch seizures')`. The error itself is never logged or surfaced in the UI beyond a generic message.

### TD9: `OLLAMAHealthCheck` Background Thread Never Monitored
In `refresh.py`:
```python
task = asyncio.create_task(run_scraper_task(scrape_id))
task.add_done_callback(lambda t: print(...))
```
If the task raises an exception, it prints to stdout but no alert is raised. In production, this would be invisible.

### TD10: Negative Geocoding Results Cached Forever
In `geocoder.py`:
```python
self.cache[cache_key] = {"latitude": 0, "longitude": 0, "not_found": True}
```
A failed geocode for "Unknown City, Unknown State" is cached with `not_found=True`. On next scrape with the same location, it returns `(0, 0)` immediately — without retry. This could place seizures at the equator (0,0) permanently.

### TD11: `SeizurePopup` — `target="_blank"` Without `rel`
```tsx
<a href={seizure.source.url} target="_blank" rel="noopener noreferrer">
```
This is actually correct — `noopener noreferrer` is present. Good.

### TD12: No Environment Validation
No Pydantic `Settings` or `pydantic-settings` used anywhere. All env vars are read with `os.getenv` with no validation of types or required vs optional.

---

## 6. Completeness Check

### Implemented:
- ✅ India map with Leaflet + CARTO dark tiles
- ✅ Seizure markers with severity-based colors + pulsing animation
- ✅ Seizure detail modal with case info
- ✅ Filter panel (time period, drug type, state, severity)
- ✅ Live feed (scrollable recent seizures)
- ✅ Stat boxes (total seizures, raids this week)
- ✅ Intel panel (bar charts, lists)
- ✅ Terminal panel (working command input)
- ✅ CORS allowlist (api/main.py, PR #1)
- ✅ SQL injection protection (queries.py, PR #1)
- ✅ Error sanitization (api/main.py, PR #1)
- ✅ Async database with SQLAlchemy
- ✅ Ollama LLM extraction
- ✅ BeautifulSoup scraper with Playwright
- ✅ Nominatim geocoding with fallback
- ✅ Rate limiting in scraper
- ✅ Docker + docker-compose setup

### Missing / Incomplete:
- ❌ `india-boundary.geojson` — India outline not rendered
- ❌ `NetworkPanel` — fake network graph (decorative only)
- ❌ Command input in App center — non-functional
- ❌ Settings button — dead
- ❌ Scrape audit logging — broken
- ❌ `backend/main.py` — duplicate unmaintained entry point with `*` CORS
- ❌ Real-time updates — no WebSocket or polling for live feed
- ❌ User auth / API key — all endpoints are public
- ❌ Pagination UI — offset/limit pagination exists in API but no UI controls
- ❌ Tests — none
- ❌ `Vercel Frontend URL` env var validation — if wrong, CORS fails silently

---

## 7. Summary for Developer — Priority Fix List

### P0 — Must Fix Immediately (Security/Production Risk)
1. **Fix CORS in `backend/main.py`** — `allow_origins=["*"]` is still there. Either delete `backend/main.py` entirely (recommended) or apply the same allowlist fix.
2. **Delete one of the two backend entry points** — having both is architecturally dangerous. Recommend keeping `backend/api/main.py` (async, SQLAlchemy) and `backend/main.py` as a deprecated stub to be removed.
3. **Fix DB path mismatch** — `seed_database.py` and `connection.py` point to different DB files. Consolidate to one path.

### P1 — High Priority (Correctness Bugs)
4. **Fix `IndiaMap.tsx` duplicate imports** — TypeScript build will fail.
5. **Fix `refresh.py` silent fallback** — scraper failures must be logged, not hidden behind random number generation.
6. **Fix scrape audit trail** — `create_scrape_run`/`complete_scrape_run` don't work properly with async DB in the refresh flow.
7. **Wire `Sidebar.tsx` Refresh button** — dead button should call `onRefresh`.

### P2 — Medium Priority (Security)
8. **Sanitize image URLs from scraper** — validate `data:`, `javascript:`, `file://` schemes are rejected before storage.
9. **Add XSS protection for seizure descriptions** — render `description` and `caseNo` through a sanitization function (e.g., DOMPurify) before displaying.
10. **Validate coordinate bounds** in `SeizureMarker` before rendering.

### P3 — Lower Priority (Tech Debt)
11. **Add test suite** — pytest for backend, Vitest for frontend.
12. **Add `india-boundary.geojson`** or clarify the spec if boundary rendering is not needed.
13. **Replace `NetworkPanel` fake graph** with real data (seizure route connections) or replace with a real feature.
14. **Make `maxZoom` configurable** or increase to 18 for city-level inspection.
15. **Fix `refresh.py` task exception handling** — don't just print to stdout, use proper logging.
16. **Add pagination UI controls** — offset/limit API already exists.
17. **Remove dead buttons** (settings, command input) or implement them.

---

*Report generated by deep-dive analysis of all files in the Narc Kart repository.*
*Files analyzed: 40+ source files across backend (Python) and frontend (TypeScript/React).*
