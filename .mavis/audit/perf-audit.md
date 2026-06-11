# Performance Audit Report — narc-kart

**Audit Date:** 2026-06-11  
**Scope:** Backend (FastAPI + SQLAlchemy async) + Frontend (React 19 + Vite) + Data Layer  
**Data Scale:** 2,759 seizure records in `drug_seizures_india.json` (~1.5 MB JSON)

---

## Critical Performance Issues

### `frontend/src/components/IndiaMap.tsx:60–66` — All 2,759 markers rendered individually
- **Impact:** Leaflet renders 2,759 individual `Marker` components simultaneously. At zoom level 4 (India overview), this causes severe DOM bloat, map lag, and 5–10+ second render times. Users cannot interact with the map.
- **Suggested Fix:** Replace with `react-leaflet-cluster` or `leaflet.markercluster`. At minimum, filter markers by viewport bounds before rendering. Consider rendering only "major" seizures (≥100kg) on the overview, and adding a zoom-based marker density threshold.

### `frontend/src/components/SeizureMarker.tsx:23–42` — Inline SVG construction per marker per render
- **Impact:** `L.divIcon()` creates a new SVG string on every render. With 2,759 markers, this generates thousands of temporary strings and bypasses React's reconciliation entirely (Leaflet owns the DOM after insertion). No memoization.
- **Suggested Fix:** Memoize SVG icons by `(quantityKg, isMajor)` key using a `Map` cache. Example:
  ```ts
  const iconCache = new Map<string, L.DivIcon>();
  function getCachedIcon(seizure: Seizure): L.DivIcon {
    const key = `${seizure.quantityKg}-${seizure.quantityKg > 100}`;
    if (!iconCache.has(key)) { /* build and cache */ }
    return iconCache.get(key)!;
  }
  ```

### `backend/database/models.py` — No database indexes on filter/group-by columns
- **Impact:** Every `GROUP BY state`, `GROUP BY drug_type`, `ORDER BY date`, and `WHERE state ILIKE` / `WHERE drug_type ILIKE` query does a full table scan on a table that will grow. With 2,759 rows today and scraping adding more, this will degrade linearly.
- **Suggested Fix:** Add indexes on the most-used columns:
  ```sql
  CREATE INDEX idx_seizures_state ON seizures(state);
  CREATE INDEX idx_seizures_drug_type ON seizures(drug_type);
  CREATE INDEX idx_seizures_date ON seizures(date DESC);
  CREATE INDEX idx_seizures_quantity ON seizures(quantity_kg);
  CREATE INDEX idx_seizures_coords ON seizures(lat, lon) WHERE lat IS NOT NULL;
  ```
  Also add these via SQLAlchemy `Index()` objects in the model file.

### `frontend/src/App.tsx:33–36` — Artificial 2,500ms loading delay
- **Impact:** Every app load is artificially blocked for 2.5 seconds with a fake "initializing" screen. Real data loading (JSON parse of 1.5 MB) is hidden behind this delay, making the app feel slower than it is.
- **Suggested Fix:** Remove the `setTimeout`. Show the loading screen only while actual data is being fetched (`loading` state from `useApi`). Use a skeleton loader for the map area during the initial data fetch.

---

## High Performance Issues

### `backend/database/queries.py:195–239` (`get_map_data`) — Unbounded full-table load
- **Impact:** Loads ALL seizures with lat/lon into memory every call, builds marker objects in a Python loop, computes bounds with `min/max` over the full array. No pagination, no limit. Scales O(n) with data growth.
- **Suggested Fix:** Add a `limit` parameter (e.g., default 500). Or pre-aggregate major seizures into a separate endpoint. Consider returning only the bounding box summary instead of all markers for initial load.

### `frontend/src/hooks/useApi.ts:244–259` — Cache-then-fetch with no deduplication
- **Impact:** On initial mount: (1) reads localStorage cache synchronously, (2) sets state from cache, (3) immediately fires `fetchSeizures()` + `fetchStats()` (2 separate API calls). If filters change rapidly, multiple in-flight requests stack with no `AbortController` cancellation.
- **Suggested Fix:** Use a single combined fetch for the initial load. Implement request deduplication — skip the API call if an identical request is already in flight. Add `AbortController` to cancel stale filter-change requests.

### `frontend/src/hooks/useApi.ts:165–193` (`fetchFromApi`) — Missing `AbortController` per-request cancellation
- **Impact:** When a user rapidly changes filters, stale responses can overwrite fresher ones (race condition). No way to cancel the previous fetch when filters change.
- **Suggested Fix:** Track a `currentController` ref. On each new request, call `currentController.abort()` before creating a new `AbortController`.

### `frontend/src/components/IndiaMap.tsx:19–36` — GeoJSON boundary fetched on every effect run
- **Impact:** `geoJsonAdded.current` prevents double-add to the map, but does NOT prevent the `fetch('/india-boundary.geojson')` from running if the component remounts (e.g., React StrictMode in dev, or future routing changes). The ~50–200 KB GeoJSON file is re-fetched unnecessarily.
- **Suggested Fix:** Cache the GeoJSON data in module-level state or localStorage. Fetch once, reuse across mounts.

### `frontend/src/components/TrendingPanel.tsx:24–25` — Sorting 2,759 items on every render
- **Impact:** `sortedByQuantity` and `sortedByDate` sort the entire seizures array on every render (2 sorts × O(n log n)). For 2,759 items, this is noticeable on low-end devices.
- **Suggested Fix:** Memoize sorted results with `useMemo([seizures])`. Or pre-compute top-N at the data layer and expose them from `useApi`.

### `frontend/src/components/AgencyPanel.tsx:9–18` — O(n) aggregation on every render
- **Impact:** `agencyMap` builds from scratch on every render by iterating the full seizures array.
- **Suggested Fix:** Move aggregation to `useMemo` or pre-compute in `useApi` and expose an `agencies` derived value.

### `frontend/src/components/ComparePanel.tsx:10–12` — O(n log n) sort on every render
- **Impact:** `Object.entries(stateData).sort(...)` re-runs on every render.
- **Suggested Fix:** Wrap in `useMemo`.

### `frontend/src/components/IntelPanel.tsx:38` — `Math.max(...Object.values(...))` creates temporary array on every render
- **Impact:** Destructuring and creating a temporary array for every bar in the drug type chart (O(n) temporary allocation per render).
- **Suggested Fix:** Compute `max` once with `useMemo`.

### `frontend/src/components/LiveFeed.tsx:29–45` — Full seizures prop causes unnecessary renders
- **Impact:** `LiveFeed` receives the full `seizures[]` array. Any change to any seizure (even metadata-only) triggers a re-render of this component, even though it only shows the first 10.
- **Suggested Fix:** Pass `seizures.slice(0, 10)` as a separate prop, or memoize the feed items.

### `backend/database/queries.py:113–192` (`get_statistics`) — 6 sequential DB round-trips
- **Impact:** `total_seizures`, `total_quantity_kg`, `raids_this_week`, `by_state`, `by_drug_type`, `by_month` — each is a separate `await db.execute()` running sequentially. With async DB connections this is 6× network latency.
- **Suggested Fix:** Combine into 2–3 queries using subqueries/CTEs, or use `asyncio.gather()` to run all 6 in parallel.

---

## Medium Performance Issues

### `frontend/vite.config.ts` — No production build optimizations configured
- **Impact:** No code splitting, no vendor chunk separation, no gzip/brotli compression, no Leaflet tree-shaking. The full Leaflet library (~41 KB gzipped) and framer-motion are bundled into a single JS chunk.
- **Suggested Fix:**
  ```ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
    sourcemap: false,
  }
  ```
  Also add `vite-plugin-compression` for gzip/brotli.

### `frontend/package.json` — Leaflet not code-split; `@supabase/supabase-js` unused
- **Impact:** `@supabase/supabase-js` is listed as a dependency but no Supabase client code was found in the codebase. It contributes to bundle size unnecessarily.
- **Suggested Fix:** Remove unused `@supabase/supabase-js` and `@vercel/node` from frontend `dependencies`. Move `@vercel/node` to backend-only dependencies or remove entirely.

### `frontend/src/hooks/useApi.ts:67–96` (`fetchStaticData`) — Entire JSON loaded at startup
- **Impact:** `fetch('/data.json')` fetches the full 1.5 MB file and parses all 2,759 seizure records synchronously (partially) before the first render. No streaming, no pagination, no lazy loading.
- **Suggested Fix:** Split `data.json` into chunks (e.g., `/data/seizures-0-100.json`, paginated API). Or use a Web Worker for JSON parsing to avoid blocking the main thread.

### `frontend/src/App.tsx:50–52` — Header/refresh button with inline `onClick` callback
- **Impact:** `onRefresh={refresh}` creates a new function reference on every App render, causing Header to re-render even when its props haven't changed.
- **Suggested Fix:** Wrap `refresh` in `useCallback` in App.tsx (it already is in useApi), or use `React.memo` on Header.

### `frontend/src/App.tsx:54–89` — All sidebar tab content rendered simultaneously
- **Impact:** All 7 panels (`IntelPanel`, `NetworkPanel`, `TrendingPanel`, etc.) are mounted at all times, conditionally rendered with CSS. This means React reconciles all components' trees even when only one tab is active.
- **Suggested Fix:** Use `React.lazy` + `Suspense` to defer mounting of inactive panels:
  ```tsx
  const IntelPanel = lazy(() => import('./components/IntelPanel'));
  ```

### `frontend/src/components/Header.tsx:9–20` — New Date object on every render
- **Impact:** `const now = new Date()` runs on every Header render (every time App re-renders), causing `toLocaleDateString` and `toLocaleTimeString` to run.
- **Suggested Fix:** Move date/time display to a dedicated `useInterval` hook updating every second, or memoize the formatted string.

### `backend/database/queries.py:28–38` (`get_all_seizures`) — Separate count query
- **Impact:** Two round-trips to DB (count + data) where one could suffice using `SELECT COUNT(*) OVER() AS total`.
- **Suggested Fix:** Use window function to get total in the same query as data.

### `frontend/src/components/TerminalPanel.tsx:37–47` (`exportData`) — `JSON.stringify` on 2,759 seizures
- **Impact:** Synchronous `JSON.stringify` of the full seizures array + stats blocks the main thread.
- **Suggested Fix:** Offload to a Web Worker or use `JSON.stringify` in chunks with `requestIdleCallback`.

### `frontend/src/components/SeizurePopup.tsx:1` — DOMPurify used for every description render
- **Impact:** DOMPurify sanitization runs on every popup open. For a trusted dataset (self-scraped), this is redundant overhead.
- **Suggested Fix:** If data is trusted, skip sanitization. If external, cache sanitized results.

### `frontend/src/components/FilterPanel.tsx:38` — Local filter state copies backend FilterState
- **Impact:** On every filter toggle, a new `FilterState` object is created. The parent `useApi` also maintains its own filter state, creating potential for stale state if the two get out of sync.
- **Suggested Fix:** Consider a single source of truth for filter state — either local in FilterPanel (pure UI) or lifted to useApi.

---

## Low / Opportunities

### `frontend/src/hooks/useApi.ts:5` — Cache TTL is 1 hour
- **Impact:** Stale data shown for up to 1 hour. With frequent scraping, data can be significantly outdated.
- **Suggested Fix:** Lower TTL to 5–10 minutes for live API mode. Keep 1 hour only for static/offline fallback.

### `frontend/src/hooks/useApi.ts:99–115` — localStorage cache has no version key
- **Impact:** If data schema changes between deployments, stale cached data with old schema can cause type errors or silent data loss.
- **Suggested Fix:** Add a `version` field to the cache and invalidate if `CACHE_VERSION` doesn't match.

### `frontend/src/components/NetworkPanel.tsx:32–35` — Inline math on every render
- **Impact:** `Math.max/min`, `Math.cos/sin` run on every render for each node.
- **Suggested Fix:** `useMemo` for node positions.

### `frontend/src/components/FilterPanel.tsx:86–90` — `activeCount` computed inline
- **Impact:** Recomputes on every render.
- **Suggested Fix:** `useMemo` or derive from `localFilters` object reference.

### `backend/database/queries.py:242–262` (`upsert_seizure`) — No batch upsert
- **Impact:** Single-record upsert pattern. When seeding from 2,759 records, this means 2,759 individual `SELECT + COMMIT` cycles.
- **Suggested Fix:** Use `INSERT ... ON CONFLICT DO UPDATE` (batch) with `execute_many()` or raw SQL bulk insert.

### `frontend/src/components/StatBoxes.tsx` — No memoization
- **Impact:** Re-renders when parent passes new `stats` reference even if values are unchanged.
- **Suggested Fix:** `React.memo(StatBoxes)` — the component is cheap but unnecessary renders add up.

### `backend/database/queries.py:151–159` — `strftime` for monthly grouping is DB-vendor-specific
- **Impact:** `func.strftime("%Y-%m", Seizure.date)` uses SQLite/PostgreSQL-specific syntax. Not portable to other backends.
- **Suggested Fix:** Use a database-agnostic date truncation approach or compute month grouping in Python if portability matters.

### `frontend/src/App.tsx:62` — `recentCount={seizures.length}` passes new number on every seizure update
- **Impact:** `StatBoxes` re-renders whenever `seizures` changes, even if only 1 item was added to the end.
- **Suggested Fix:** `React.memo` on StatBoxes (trivial) or memoize the length.

---

## Data Scale Assessment

**How well does the app handle the 2,759-record dataset?**

The current architecture handles 2,759 records at a **marginal-to-poor** level:

1. **Static mode (default):** Loads all 2,759 records as a 1.5 MB JSON file on startup. The `fetchStaticData` path parses this synchronously enough for 2,759 records (~50ms parse time), but blocks the main thread during JSON parsing. No pagination means the full array lives in memory.

2. **Map rendering (critical bottleneck):** 2,759 Leaflet markers without clustering makes the map **unusable** at the default zoom level. This is the single worst performance problem in the app — users see a laggy, non-interactive map.

3. **API mode:** The backend handles this dataset reasonably (pagination, async DB, indexed queries). However, `get_map_data()` has no limit, meaning the map endpoint could return thousands of rows in production if many seizures have coordinates.

4. **Frontend aggregations:** All panels (Trending, Compare, Agency, Intel) run O(n) JavaScript loops over the full array on every render. This is acceptable for 2,759 records but will degrade noticeably past 10,000.

**Recommendations for scale:**
- Pagination: load seizures in pages of 100–200, lazy-load on scroll
- Marker clustering: non-negotiable for map usability past 500 markers
- Pre-aggregate stats at the backend: the `by_state`, `by_drug_type`, `top_locations` already exist in `get_statistics()` — the frontend should use these instead of re-deriving them
- Move JSON parsing off the main thread (Web Worker)
- Server-side filtering for large datasets (backend already supports it)

---

## Overall Performance Posture

The narc-kart frontend is functional for a 2,759-record dataset but has **significant performance gaps** that will become critical as data grows. The most severe issue is the unclustered Leaflet map rendering all markers simultaneously, which makes the primary view nearly unresponsive. Secondary concerns include the artificial 2.5s loading delay, repeated O(n) aggregations on every render in multiple panels, and missing React memoization throughout the component tree. The backend is reasonably well-structured with async queries and parameterized filters, but lacks database indexes that will cause full table scans as the dataset grows. The Vite build has no code splitting or compression, meaning the full Leaflet + framer-motion bundle ships on initial load. With targeted fixes — marker clustering, `useMemo`/`React.memo` hygiene, `AbortController` deduplication, database indexes, and build chunking — this codebase could handle 10,000+ records comfortably. The current state is not production-ready for scale.
