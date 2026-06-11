# Architecture Audit Report — narc-kart

**Auditor:** Architecture Audit Agent
**Date:** 2026-06-11
**Scope:** Full codebase — Backend (FastAPI, Python) + Frontend (React 19, TypeScript, Vite) + Vercel Serverless Layer
**Backend Status:** Archived/static — not actively maintained
**Frontend Status:** Active development target

## Architectural Baseline

Per **SPEC.md** (§Tech Stack):
- Frontend: React 19 + Vite + TypeScript
- Backend: Python FastAPI
- Scraper: BeautifulSoup + Playwright
- AI Extraction: Ollama (local)
- Geocoding: Nominatim (OSM)
- Database: **SQLite**
- Hosting: Local or Railway

Per **SPEC.md** (§Data Pipeline):
```
News Source → HTTP Request → HTML Parser → AI Extraction (Ollama) → Structured Data
                                              ↓
                                    Geocoding (Nominatim)
                                              ↓
                                    SQLite Storage
```

Per **SPEC.md** (§Project Structure):
```
backend/
  scraper/
  api/
  ai/
  database/
```

Per **SPEC.md** (§Tech Stack → State): `React Context + useReducer`

Per **UX_ROADMAP.md** (Priority 1 — THREAT LEVEL INDICATOR):
- Component must use `useMemo` to derive threat level from stats
- SPEC color for accent red: `#E83D3D`
- `design-tokens.css` (SPEC-aligned): `--accent-red: #FF0040`; UX_ROADMAP corrects this to `#E83D3D`
- `design-system.css` (active): `--accent: #E83D3D` ✅

---

## VERDICT

**Architecture Posture: CRITICAL — THREE-WAY DATA LAYER SCHISM**

The codebase has **three mutually-incompatible data layers** serving **one frontend**:

1. **Layer A — FastAPI `main.py`** (archived): sync sqlite3 via `database.py`, serves at `backend:8000`
2. **Layer B — FastAPI `api/main.py`** (archived): async SQLAlchemy via `database/`, serves at `api:8000`
3. **Layer C — Vercel Supabase** (ACTIVE): serverless functions at `frontend/api/`, Supabase PostgreSQL as DB

The frontend can also run in **static mode** from `drug_seizures_india.json` (deployed at Vercel).

All three data layers return **different field names** for the same data. The frontend's `useApi.ts` uses `mapApiSeizure(s: any)` to paper over the inconsistencies — this is a silent type safety hole that masks the schema divergence.

**The active production deployment uses Layer C (Vercel + Supabase). Both FastAPI layers are archived. The SPEC.md architecture is NOT what is deployed.**

---

## Critical Architecture Issues

### C1: THREE-WAY DATA LAYER SCHISM
- **Files:** `backend/database.py` vs `backend/database/` vs `frontend/api/` vs `drug_seizures_india.json`
- **Impact — SPEC VIOLATION:** SPEC.md mandates SQLite as the database. The active deployment uses Supabase **PostgreSQL**. The `frontend/api/` Vercel serverless functions are the live data layer; both FastAPI backends are archived.
- **Impact — Schema divergence:** Each data layer uses different field names for identical data:

| Field | FastAPI `main.py` | FastAPI `api/main.py` | Vercel Supabase | `drug_seizures_india.json` |
|---|---|---|---|---|
| City | `location_city` | `city` | `city` | `city` |
| Lat | `latitude` | `lat` | `lat` | `lat` |
| Lon | `longitude` | `lon` | `lon` | `lon` |
| Date | `seizure_date` | `date` | `date_iso` | `date` |
| Quantity | `quantity_kg` | `quantity_kg` | `quantity_kg` | `quantityKg` ⚠️ |
| Source name | `source_name` | `source_name` | `source_name` | `sourceName` ⚠️ |
| Source URL | `article_url` | `source_url` | `source_url` | `sourceUrl` ⚠️ |
| Images | JSON string | JSON string | `text[]` array | `images[]` |
| Drug type | `drug_type` | `drug_type` | `drug_type` | `drugType` ⚠️ |
| Verified | — | — | `is_verified` | — |
| Raw text | — | — | `raw_text` | — |

- **Impact — Frontend coupling:** `useApi.ts` handles all three schemas via `mapApiSeizure(s: any)` with 8-level fallback chains. This is unmaintainable as additional data sources are added.
- **Suggested fix:** Pick one canonical schema. Supabase PostgreSQL is the active deployment — standardize the frontend types and API contracts on that schema. Deprecate both FastAPI layers. Replace `mapApiSeizure(s: any)` with a Zod validator per data source mode.

### C2: `mapApiSeizure` IS A TYPE-SAFETY BLACK HOLE
- **File:** `frontend/src/hooks/useApi.ts:42-59`
- **Evidence:**
```typescript
function mapApiSeizure(s: any): Seizure {  // ← any type
  return {
    id: s.id,
    location: {
      city: s.city || s.location_city || '',       // 3 fallback aliases
      state: s.state || s.location_state || '',
      lat: s.lat ?? s.latitude ?? s.location_lat ?? null,  // 4 fallback aliases
      lon: s.lon ?? s.longitude ?? s.location_lon ?? null,
    },
    drugType: s.drug_type || s.drugType || '',
    quantityKg: s.quantity_kg ?? s.quantityKg ?? 0,  // camelCase from data.json
    date: s.date || s.seizure_date || '',
    source: { name: s.source_name || s.sourceName || '', url: s.source_url || s.sourceUrl || '' },
    images: s.images ? (typeof s.images === 'string' ? JSON.parse(s.images) : s.images) : [],
    caseNo: s.case_no || s.caseNo || '',            // snake_case vs camelCase
    description: s.description || '',
  };
}
```
- **Impact:** All 10 fields have 2-4 fallback aliases. Any missing field silently returns empty string or `null`. No TypeScript type guard, no Zod schema validation, no runtime error. Runtime mismatches produce silent data corruption. The `fetchFromApi` path handles the Supabase schema; `fetchStaticData` maps `data.json` schema (which itself differs from the canonical `Seizure` type — `drugType` vs `drug_type`, `quantityKg` vs `quantity_kg`).
- **Suggested fix:** Create typed interfaces for each data source (`ApiSeizureFastAPI`, `ApiSeizureSupabase`, `StaticSeizure`). Use Zod schemas for runtime validation. Generate TypeScript types from Supabase schema using `supabase-gen`.

### C3: DUAL FASTAPI BACKENDS — `main.py` VS `api/main.py` BOTH DEFINED
- **Files:** `backend/main.py` (413 lines) vs `backend/api/main.py` (169 lines)
- **Impact — Incompatible stacks:**
  - `main.py` uses synchronous `sqlite3` via `database.py` (Database class). Routes inline at module level. Sync scraper with BeautifulSoup.
  - `api/main.py` uses async SQLAlchemy via `database/` (models.py + queries.py). Routes in separate files under `api/routes/`. Scraper's `refresh.py` stub imports `from database.connection` (bare module name — see C4).
- **Impact — Route collision:** Both define `/api/seizures`, `/api/stats`, `/api/health` endpoints. If both are deployed, requests are unpredictable.
- **Impact — Schema mismatch:** `main.py`'s `SeizureResponse` uses `location_city`, `latitude`, `longitude`, `seizure_date`, `article_url`, `extraction_confidence`. `api/models.py`'s `SeizureResponse` uses `city`, `lat`, `lon`, `date`, `source_url`. These are different Python objects serving the same routes.
- **Suggested fix:** Archive `main.py` and `database.py`. Consolidate on `api/main.py` + `database/` as the single canonical backend. Migrate `Scraper` to async-compatible code for integration with the async SQLAlchemy stack.

### C4: `refresh.py` BROKEN RELATIVE IMPORT — `database.` NOT `backend.database.`
- **File:** `backend/api/routes/refresh.py:22`
- **Evidence:** `from database.connection import AsyncSessionLocal`
- **Impact:** `database.` is a bare module name — it will only resolve if `database/` is on `sys.path` at the package root level. When `api/main.py` mounts `refresh_router`, this import will fail with `ModuleNotFoundError: No module named 'database'`. This makes the entire refresh endpoint unreachable in the `api/` stack.
- **Suggested fix:** Change to `from backend.database.connection import AsyncSessionLocal` (absolute) or `from ..database.connection import AsyncSessionLocal` (relative to `api/`).

### C5: `AppContext` DEFINED — NEVER IMPORTED OR CONSUMED
- **Files:** `frontend/src/context/AppContext.tsx` (53 lines) vs `frontend/src/App.tsx`
- **Evidence — `grep AppProvider` in `frontend/src/`:**
  - `AppContext.tsx:44` — `export function AppProvider(...)`
  - No other file imports `AppProvider` or `useAppContext`
- **Evidence — `App.tsx` state management:**
  ```tsx
  // App.tsx uses local useState for ALL global state:
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('radar');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedSeizure, setSelectedSeizure] = useState<Seizure | null>(null);
  ```
- **Impact — SPEC VIOLATION:** SPEC.md §Tech Stack specifies `React Context + useReducer`. The architecture defines `AppContext` + `appReducer` correctly, but `App.tsx` completely bypasses it. The reducer is dead code. Any component trying to use `useAppContext` will throw `"useAppContext must be used within AppProvider"` because `AppProvider` is never mounted.
- **Impact — DX confusion:** Developers reading the codebase will reasonably assume `AppContext` is the state management solution. Using it will fail silently at runtime.
- **Suggested fix:** Either wire `AppProvider` into `main.tsx` wrapping `<App />` and migrate all local `useState` to dispatch actions through the context, or delete `AppContext.tsx` entirely to eliminate misleading dead code.

---

## High Architecture Issues

### H1: `TerminalPanel.tsx` DEFINES LOCAL `Seizure` TYPE — TYPE DIVERGENCE
- **File:** `frontend/src/components/TerminalPanel.tsx:5-14`
- **Evidence:**
```typescript
interface Seizure {  // Local redefinition of canonical type
    id: string;
    location: { city: string; state: string; lat: number; lon: number; };
    drugType: string;
    quantityKg: number;
    date: string;
    source: { name: string; url: string };
    agency: string;
    description?: string;
}
```
- **Impact — DRY + type divergence:** This is a **worse** violation than a copy-paste. The local `Seizure` type in `TerminalPanel.tsx` differs structurally from the canonical `Seizure` type in `types/index.ts`:
  - `types/index.ts`: `Seizure.location` has optional fields (all optional)
  - `TerminalPanel.tsx`: `Seizure.location` fields are all required
  - `types/index.ts`: `Seizure.caseNo?: string; images: string[]`
  - `TerminalPanel.tsx`: Missing both `caseNo` and `images`
  - `TerminalPanel.tsx`: Missing `SeizureSource` type for `source` field
- If `types/index.ts` is updated to add a field (e.g., `severity`), `TerminalPanel.tsx`'s local copy is NOT updated — silent type drift.
- **Suggested fix:** Delete the local interface. Import `Seizure` from `../types`. Replace all local usages with the canonical type.

### H2: DESIGN TOKEN WAR — TWO OPPOSING AESTHETIC SYSTEMS, ONE ACTIVE, ONE ORPHANED
- **Files:** `frontend/src/styles/design-tokens.css` vs `frontend/src/styles/design-system.css`
- **Evidence — `grep design-tokens` in `frontend/src/`:**
  - `design-tokens.css`: **Never imported anywhere** — fully orphaned
  - `design-system.css`: **Only imported** by `global.css:1` (`@import './design-system.css'`)
- **Evidence — Token conflict:**

| Token | `design-tokens.css` (SPEC-aligned) | `design-system.css` (active) | SPEC.md |
|---|---|---|---|
| `--text-primary` | `#00FF00` (green) | `#FFFFFF` (white) | `#00FF00` |
| `--accent-red` | `#FF0040` (neon) | `#E83D3D` (signal red) | `#E83D3D` (UX_ROADMAP correction) |
| `--bg-primary` | `#000000` | `#000000` | `#000000` |
| `--severity-critical` | undefined | `#E83D3D` | — |
| `--accent` | undefined | `#E83D3D` | — |

- **Impact — SPEC VIOLATION:** SPEC.md mandates terminal green (`#00FF00`) for `--text-primary`. The active `design-system.css` uses white (`#FFFFFF`). The SPEC-aligned `design-tokens.css` is orphaned.
- **Impact — UX_ROADMAP says to fix this first:** UX_ROADMAP.md §One Critical Fix First: "replace `--accent-red` usage gap" — recommends unifying to `#E83D3D`. This is partially done in `design-system.css` (`--accent: #E83D3D`) but the green terminal theme from `design-tokens.css` is lost.
- **Impact — Component inconsistency:** `SeizureMarker.tsx` uses `#E83D3D` (design-system). `IndiaMap.tsx` hard-codes `#00FFFF` (design-tokens). `LiveFeed.tsx` uses CSS classes that reference design-tokens. Components use a mix of the two systems.
- **Suggested fix:** Consolidate: adopt `design-system.css` as the base (it has the corrected `#E83D3D` accent), then extend it with the terminal green tokens from `design-tokens.css` for text/background. Import the unified file in `main.tsx`. Audit all hardcoded color values.

### H3: NO REACT ERROR BOUNDARY — ANY UNCAUGHT ERROR CRASHES THE APP
- **Files:** `frontend/src/App.tsx`, `frontend/src/main.tsx`, all components
- **Evidence — `grep -r ErrorBoundary frontend/src/`:**
  - **Zero results** — no ErrorBoundary anywhere in the codebase.
- **Evidence — `main.tsx`:**
  ```tsx
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  ```
- **Impact:** React 19 does not have automatic error boundaries. Any uncaught error in any component (network failure, null dereference, failed render) crashes the entire app with a blank white screen. No recovery mechanism.
- **Suggested fix:** Add at least one top-level `class ErrorBoundary extends React.Component` wrapping `<App />` in `main.tsx`. Consider per-panel boundaries for graceful degradation.

### H4: `useApi.ts` IS A 275-LINE GOD HOOK — SEVEN RESPONSIBILITIES
- **File:** `frontend/src/hooks/useApi.ts`
- **Impact — SRP violation:** This single hook handles: (1) localStorage cache read/write, (2) static JSON fetch, (3) live API fetch with AbortSignal timeout, (4) response field mapping (`mapApiSeizure`), (5) filter parameter building (`mapFiltersToParams`), (6) offline fallback logic, (7) reactive filter updates via `useEffect`. Any change to one concern risks breaking all others.
- **Impact — SPEC VIOLATION:** `loading` state is returned but **never consumed** in `App.tsx`. The app shows a 2.5-second hardcoded timer (`setTimeout(() => setIsLoadingApp(false), 2500)`) instead of using the actual loading state.
- **Suggested fix:** Split into: `useApiClient()` (pure fetch + timeout), `useCache()` (localStorage), `useSeizures()` (data + loading), `useFilters()` (filter state). `useApi` composes them. Wire `loading` into the UI or remove it from the return type.

### H5: SCRAPER DUPLICATED ACROSS TWO INCOMPATIBLE STACKS
- **Files:** `backend/scraper/scraper.py` (BeautifulSoup + Playwright, sync) vs `frontend/api/scrape/index.ts` (RSS feeds + Google News, Node.js)
- **Impact:** Two completely different scraping implementations:
  - FastAPI scraper: HTTP requests + BeautifulSoup HTML parsing + Playwright JS rendering + Ollama AI extraction + Nominatim geocoding
  - Vercel scraper: RSS feed polling + Google News RSS via `rss2json.com` API + rough geocoder (20-city dictionary lookup) + no AI extraction
- **Impact — NCB scraper stub:** `frontend/api/scrape/index.ts:64-70`:
  ```typescript
  async function scrapeNCB(): Promise<ScraperResult[]> {
    console.log('[scrape] NCB scraper stub — returning empty (needs Playwright)');
    return [];  // ← Never actually scrapes NCB
  }
  ```
- **Impact — Data quality:** The Vercel scraper only uses regex pattern matching on RSS titles + Google News content. No AI extraction. `drug_type` assignment is purely keyword-based (`if /heroin/i.test(content)`). The FastAPI scraper was more sophisticated but is archived.
- **Suggested fix:** Consolidate on one scraper. If the Vercel/Supabase layer is the active deployment, enhance the Vercel scraper with Playwright (via `@sparticuz/chromium` for serverless) and Ollama API calls. If FastAPI is preferred, deprecate the Vercel scraper.

### H6: CORS CONFIGURATIONS USE `*` WILDCARDS — SECURITY POLICY VIOLATION
- **Files:** `backend/api/main.py:47` and `frontend/api/seizures/index.ts:13`, `frontend/api/stats/index.ts:11`, `frontend/api/scrape/index.ts:179-181`
- **Evidence:**
  - `api/main.py:47`: `origins.append("https://*.vercel.app")` — `CORSMiddleware` does NOT support wildcard subdomain patterns; this is treated as a literal string, matching nothing valid
  - All three Vercel serverless functions: `res.setHeader('Access-Control-Allow-Origin', '*')`
- **Evidence — SECURITY.md mandate:** "Use explicit allowlist for CORS origins (no wildcard `*` in production)"
- **Impact:** All Vercel API routes allow any origin. SECURITY.md violation. Exposes Supabase data to any website.
- **Suggested fix:** Replace `*` with explicit Vercel deployment URLs. Use `CORSMiddleware` with a verified allowlist. For Vercel functions, use `VercelServerSideCors` or conditional origin checks.

### H7: NO DATABASE MIGRATION SYSTEM
- **Files:** `backend/database/connection.py:38-45`
- **Evidence:** `init_db()` calls `Base.metadata.create_all()` — `CREATE TABLE IF NOT EXISTS` semantics. Existing tables are never altered when schemas change.
- **Impact:** Schema evolution is impossible. If a column is renamed in `models.py`, the live database silently keeps the old schema. Incompatible with any production deployment.
- **Suggested fix:** Add Alembic (`alembic init`) for the FastAPI stack. For Supabase, use Supabase migrations (`supabase/migrations/`).

### H8: `getSeverityClass` COPIED IDENTICALLY IN THREE COMPONENTS
- **Files:**
  - `frontend/src/components/LiveFeed.tsx:8-12`
  - `frontend/src/components/TrendingPanel.tsx:15-19`
  - `frontend/src/components/SeizurePopup.tsx:22-26`
- **Evidence — Identical function body:**
  ```typescript
  function getSeverityClass(kg: number): string {
    if (kg > 100) return 'critical';
    if (kg > 10) return 'high';
    return 'low';
  }
  ```
- **Impact — DRY violation:** Three copies of identical logic. If the severity thresholds change (e.g., major seizure from >100kg to >50kg), all three must be updated independently.
- **Suggested fix:** Extract to `frontend/src/utils/severity.ts`:
  ```typescript
  export function getSeverityClass(kg: number): 'critical' | 'high' | 'low' {
    if (kg > 100) return 'critical';
    if (kg > 10) return 'high';
    return 'low';
  }
  ```

---

## Medium Architecture Issues

### M1: `@supabase/supabase-js` AND `@vercel/node` IN FRONTEND `package.json`
- **File:** `frontend/package.json:12-13`
- **Evidence:** Both packages are listed as frontend `dependencies`.
- **Impact:** These are server-side packages. `frontend/api/` is Vercel serverless functions — they may be bundled separately. But `@supabase/supabase-js` in `package.json` means it could be imported into the React bundle if any component imports it. Currently, no component does (confirmed via grep), but this is a latent risk. `@vercel/node` types (`VercelRequest`, `VercelResponse`) are imported only in `frontend/api/` TypeScript files, which are outside the Vite build scope.
- **Suggested fix:** Move `@vercel/node` to the serverless function layer (separate `api/package.json` or Vercel's auto-detected `api/` convention). Keep `@supabase/supabase-js` for the API layer but audit bundle impact.

### M2: `SeizureMarker` RECREATES SVG ICONS ON EVERY RENDER
- **File:** `frontend/src/components/SeizureMarker.tsx:34-42`
- **Impact:** `L.divIcon(...)` is called on every render, creating new SVG strings and icon objects. With hundreds of markers, this causes GC pressure and unnecessary re-renders.
- **Suggested fix:** Memoize with `React.memo` or extract severity-to-icon mapping to a module-level constant cache.

### M3: `IndiaMap` FETCHES GEOJSON ON EVERY EFFECT RUN
- **File:** `frontend/src/components/IndiaMap.tsx:19-37`
- **Impact:** The GeoJSON file (`/india-boundary.geojson`) is fetched via `fetch()` inside a `useEffect`. The ref guard `geoJsonAdded.current` prevents double-fetch, but if the component remounts, the guard resets and a duplicate fetch occurs. No loading state for this async operation.
- **Suggested fix:** Import the GeoJSON directly as a module: `import indiaBoundary from '../assets/india-boundary.geojson'` — Vite handles this natively. Or move the fetch outside the component to a module-level cache.

### M4: NO TYPE-SAFE API CLIENT
- **File:** `frontend/src/hooks/useApi.ts`
- **Impact:** No generated types from OpenAPI. No Zod validation at runtime. The frontend is manually coupled to backend field names. Any backend schema change silently breaks the frontend at runtime.
- **Suggested fix:** Use `openapi-typescript-codegen` or `orval` to generate TypeScript from `/openapi.json`. Or add Zod schemas per data source.

### M5: `SeizurePopup` USES `DOMPurify` — PRESENT BUT NOT IN `types/index.ts`
- **File:** `frontend/src/components/SeizurePopup.tsx:1,94`
- **Evidence:** `import DOMPurify from 'dompurify'` — **confirmed present in `package.json:14`** (`dompurify: "^3.4.5"`). My first audit was incorrect on this point.
- **Impact — Low:** `DOMPurify.sanitize(seizure.description)` is used on the description field. This is appropriate XSS prevention for user-generated content, but `description` comes from the backend (NCB news articles), which may not be user-controlled. This is belt-and-suspenders but not harmful.
- **Suggested fix:** If descriptions are from trusted news sources, remove `DOMPurify` to reduce bundle size. If there's any possibility of user-contributed descriptions, keep it.

### M6: NO LOADING SKELETONS — HARDCODED 2.5s TIMER
- **File:** `frontend/src/App.tsx:33-36`
- **Evidence:** `const timer = setTimeout(() => setIsLoadingApp(false), 2500)` — always shows loading for exactly 2.5 seconds regardless of actual data loading time. If data loads in 100ms, user waits 2.4s. If data takes 10s, user sees loading screen for only 2.5s.
- **Impact:** Fake loading UX that doesn't reflect actual state.
- **Suggested fix:** Replace with `useApi`'s `loading` state (which is returned but not used). Show a `LoadingPanel` or skeleton components while `loading === true`.

### M7: RATE LIMITING IN `geocoder.py` IS PROCESS-LOCAL ONLY
- **File:** `backend/geocoder.py:75-81`
- **Impact:** `_rate_limit()` only applies within a single Python process. Nominatim requires 1 req/sec globally. With uvicorn workers (`-w N`), multiple processes bypass the rate limit. No distributed lock.
- **Suggested fix:** Document the 1 req/sec constraint as process-local only. Use Redis for distributed rate limiting in production. Add a note in `geocoder.py`.

### M8: SCRAPER SILENTLY SWALLOWS EXCEPTIONS
- **Files:** `backend/scraper/article_parser.py:229-241`, `backend/scraper/scraper.py:238-243`
- **Evidence:** `except Exception: pass` in date extraction; Playwright fetch failures return `None` silently.
- **Impact:** Scraper failures are invisible. No dead-letter queue for failed articles. No alerting.
- **Suggested fix:** Use specific exception types. Log failures with context. Add a `failed_articles` table to track permanently failed URLs.

### M9: `loading` STATE FROM `useApi` NEVER CONSUMED IN UI
- **Files:** `frontend/src/hooks/useApi.ts:274` (returns `loading`), `frontend/src/App.tsx`
- **Evidence:** `useApi` returns `loading` but `App.tsx` never destructures it. Only `isOffline` and `lastUpdate` are used.
- **Impact:** The `loading` state exists but provides no UX feedback.
- **Suggested fix:** Wire `loading` into panel-level loading states or remove from return type.

### M10: `StatBoxes.tsx:13` HAS DOUBLE-NULLISH FALLBACK
- **File:** `frontend/src/components/StatBoxes.tsx:13`
- **Evidence:** `{stats?.totalSeizures ?? recentCount ?? 0}` — `recentCount` is `number` (passed from `App.tsx:62` as `seizures.length`), never `null`. The `?? recentCount` fallback is dead code.
- **Impact — Minor:** No runtime failure, but misleading code.
- **Suggested fix:** Simplify to `{stats?.totalSeizures ?? seizures.length ?? 0}` or pass `loading` state to show a dash.

---

## Low / Suggestions

### L1: `@supabase/supabase-js` NOT USED IN FRONTEND CLIENT CODE
- **File:** `frontend/package.json:12`
- **Evidence — grep `@supabase` in `frontend/src/`: Zero matches.
- **Impact:** Package is in `dependencies` but imported only in `frontend/api/` (serverless, outside Vite scope). Potential bundle pollution if mistakenly imported into React components.
- **Suggested fix:** Audit with `npm ls @supabase/supabase-js` to confirm it's excluded from the Vite bundle. If confirmed excluded, move to a separate `api/package.json`.

### L2: HARD-CODED COLOR VALUES IN COMPONENTS
- **Files:** `IndiaMap.tsx:29` (`#00FFFF`), `SeizureMarker.tsx:12-14` (`#E83D3D`, `#FF8C42`, `#FFCC00`)
- **Impact:** Theming requires editing TSX files. Inconsistent with design token system.
- **Suggested fix:** Use CSS custom properties (`--accent-cyan`, `--severity-critical`, etc.).

### L3: NO ESLINT / PRETTIER CONFIGURATION
- **Files:** No `.eslintrc`, `.prettierrc`, or similar in the frontend root.
- **Impact:** Mixed import styles, inconsistent formatting, no linting rules enforced.
- **Suggested fix:** Add `@eslint/js`, `eslint-plugin-react-hooks`, `prettier`. Configure `tsconfig.json` to extend recommended configs.

### L4: NO TEST INFRASTRUCTURE
- **Files:** No `vitest.config.ts`, no `*.test.ts` files in frontend.
- **Impact:** No automated tests for components, hooks, or data transformations.
- **Suggested fix:** Add `vitest` + `@testing-library/react`. Write tests for `mapApiSeizure`, `getSeverityClass`, and critical UI interactions.

### L5: `IndiaMap` MAX ZOOM IS 8 — INDIA MAP NON-INTERACTIVE AT STREET LEVEL
- **File:** `frontend/src/components/IndiaMap.tsx:45`
- **Evidence:** `maxZoom={8}`
- **Impact:** With `zoom={4}` as default, max zoom of 8 gives only 4 zoom levels. May be insufficient for urban seizure detail.
- **Suggested fix:** Increase `maxZoom` to 15-18 for street-level detail when users zoom in.

### L6: CITY-STATE FALLBACK DICTIONARY DUPLICATED
- **Files:** `backend/geocoder.py:326-373` vs `backend/scraper/article_parser.py:63-80` + `frontend/api/scrape/index.ts:14-33`
- **Impact:** Three separate Indian geography dictionaries across two languages (Python, TypeScript). Inconsistent — `geocoder.py` has 32 cities; `article_parser.py` has 24 cities; `frontend/api/scrape/index.ts` has 20 cities.
- **Suggested fix:** Extract to `backend/data/india_locations.py` and `frontend/src/data/india_locations.ts` as shared constants.

### L7: NO LOGGING CONFIGURATION FOR PRODUCTION
- **Files:** Multiple Python files call `logging.basicConfig(level=logging.INFO)`
- **Impact:** Logging level is hardcoded. No JSON structured logging for log aggregation.
- **Suggested fix:** Centralize in `backend/config.py`: `os.getenv("LOG_LEVEL", "INFO")`.

### L8: `backend/main.py` GLOBAL EXCEPTION HANDLER HIDES ALL ERRORS
- **File:** `backend/main.py:388-394`
- **Impact:** `global_exception_handler` catches `Exception` and returns a generic 500. No error ID for tracing, no server-side stack trace logging.
- **Suggested fix:** Generate a request UUID, log the full exception server-side, return the error ID to the client.

### L9: `AppContext` EXPORTS `useAppContext` THAT THROWS OUTSIDE PROVIDER
- **File:** `frontend/src/context/AppContext.tsx:51`
- **Evidence:** `if (!ctx) throw new Error('useAppContext must be used within AppProvider')`
- **Impact:** Any developer attempting to use `useAppContext()` will get an opaque runtime error. `AppProvider` is never mounted, so this will always throw.
- **Suggested fix:** Either wire `AppProvider` or delete the file entirely.

### L10: FRONTEND OVERFLOWS HIDDEN ON MOBILE
- **File:** `frontend/src/styles/global.css:12`
- **Evidence:** `html, body, #root { overflow: hidden; }` — SPEC says desktop-first, but mobile is completely locked out.
- **Suggested fix:** Add responsive breakpoints. Use `overflow: auto` on panels instead of the root.

---

## Design Pattern Observations

### What IS Being Used Well

**Backend (FastAPI — `api/` stack):**
- Clean router separation: each endpoint group in its own file under `api/routes/`
- Dependency injection via `Depends(get_db)` — correctly isolates async session lifecycle
- Pydantic models for request/validation in `api/models.py` — well-structured with field descriptions
- SQLAlchemy async session pattern — `get_db()` generator with proper cleanup
- SQL injection prevention in `queries.py` — `_sanitize_for_ilike()` with parameterized queries
- Lifespan context manager for startup/shutdown in `api/main.py`
- `ScrapeMetadata` model for tracking async scrape jobs
- Error handlers in `api/main.py` — structured JSON responses for validation and generic errors

**Frontend (React 19):**
- CSS Modules — each component has its own scoped `.module.css` file
- Component-per-file convention — one named export per file
- `useRef` for component identity (`geoJsonAdded.current`, `mountedRef`)
- `AbortSignal.timeout()` for fetch timeout — modern and correct
- localStorage caching with TTL — sensible offline-first approach
- `AnimatePresence` from framer-motion for modal/panel animations
- `useReducer` pattern correctly implemented in `AppContext` (unused but structurally correct)
- `React.StrictMode` in `main.tsx`

**Vercel Supabase Stack:**
- Supabase schema with proper indexes (`seizures_geo_idx`, `seizures_date_idx`, `seizures_state_idx`)
- Row Level Security policies — "Public read" and "Public insert" documented
- Real-time enabled on seizures table
- Clean TypeScript interfaces for `ScraperResult` in `scrape/index.ts`

### What Is Missing

**Backend:**
- No Alembic/migrations for schema evolution
- No dependency injection container
- No structured JSON logging
- No health-check depth (only checks `db is not None`, doesn't query the DB)
- No circuit breaker for external services (Ollama, Nominatim)

**Frontend:**
- No React ErrorBoundary
- No test infrastructure
- No ESLint/Prettier config
- No loading skeleton states
- No responsive breakpoints
- No bundle analysis configuration

**Vercel Layer:**
- No rate limiting on scrape endpoint (anyone can POST to `/api/scrape`)
- No deduplication check before `supabase.from('seizures').insert()` — race condition possible
- No retry logic for failed RSS feed fetches
- Scraper cron secret (`CRON_SECRET`) documented but the Vercel cron configuration (`vercel.json` or `vercel.toml`) is not present

---

## SPEC.md Conformance Analysis

| SPEC Requirement | Actual Implementation | Status |
|---|---|---|
| React 19 + Vite + TypeScript | `react: ^19.0.0`, `vite: ^6.2.0` | ✅ CONFORMANT |
| Leaflet + React-Leaflet | `leaflet: ^1.9.4`, `react-leaflet: ^5.0.0` | ✅ CONFORMANT |
| CSS Modules | All components use `.module.css` | ✅ CONFORMANT |
| **React Context + useReducer** | `AppContext` defined but never mounted; `App.tsx` uses `useState` | ❌ VIOLATION |
| **FastAPI** | Both `main.py` and `api/main.py` exist | ✅ ARCHITECTURAL INTENT MET (FastAPI chosen) |
| BeautifulSoup + Playwright | `scraper/scraper.py` has both | ✅ ARCHITECTURAL INTENT MET |
| Ollama (local) | `ai/ollama_client.py` — `llama3.2:latest`, `localhost:11434` | ✅ ARCHITECTURAL INTENT MET |
| Nominatim (OSM) | `geocoder.py` — `openstreetmap.org`, 1 req/sec rate limit | ✅ ARCHITECTURAL INTENT MET |
| **SQLite** | Active deployment uses **Supabase PostgreSQL** | ⚠️ DEVIATION (pragmatic for serverless) |
| Local or Railway hosting | Deployed on Vercel (frontend + serverless) | ⚠️ DEVIATION (pragmatic) |
| Data pipeline: Source → Parser → AI → Geocode → SQLite | Implemented in FastAPI but **archived** | ⚠️ ARCHIVED |
| Design: terminal green on black, `--text-primary: #00FF00` | Active: `--text-primary: #FFFFFF` | ❌ VIOLATION |
| Design: `--accent-red: #FF0040` (SPEC) → `#E83D3D` (UX_ROADMAP) | Active: `--accent: #E83D3D` | ✅ CONFORMANT (post-UX_ROADMAP correction) |

---

## Overall Architecture Posture

The Narc Kart architecture is a **three-layer schism** where the SPEC.md blueprint, the archived FastAPI implementation, and the active Vercel+Supabase deployment have all diverged. The frontend is well-structured on its own terms — CSS Modules, React 19 patterns, localStorage caching, and a clean component hierarchy — but it is loosely coupled to multiple incompatible backend schemas through an `any`-typed API mapper that masks the divergence. The most critical remediation path is: (1) canonicalize on the Supabase PostgreSQL schema as the single source of truth, (2) generate TypeScript types from that schema, (3) replace `mapApiSeizure(s: any)` with Zod-validated typed interfaces, (4) delete both FastAPI layers and the orphaned `design-tokens.css`, and (5) wire the `AppContext` or remove it entirely. Secondary priorities: add React ErrorBoundary, add Alembic migrations for the FastAPI layer, and reconcile the visual design system with the SPEC.md terminal aesthetic.
