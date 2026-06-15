# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What this is

**NARC KART** — a static-deployed intelligence dashboard for publicly available Indian drug seizure data. Cyberpunk/tactical-styled Leaflet map of India with sidebar panels (RADAR / INTEL / NETWORK / TRENDING / AGENCY / COMPARE / TERMINAL), live feed, and case-file modals.

Originally a FastAPI + SQLite + Cloudflare-tunnel full-stack app. The current shipped form is **fully static** — a single `frontend/public/data.json` baked in, deployed to Vercel, no backend, no CORS pain. Older backend code is archived but still kept buildable.

Strategic framing and anti-references live in `PRODUCT.md`. Full design system lives in `DESIGN.md` and `frontend/src/styles/design-system.css`. **Read both before any design/frontend work.**

---

## Commands

### Frontend (the only thing that ships)

```bash
cd frontend
npm install
npm run dev          # vite dev server on http://localhost:5173
npm run build        # tsc -b && vite build  →  frontend/dist/
npm run preview      # serve the built dist
```

Vite dev server proxies `/api` to `http://localhost:8000` (the FastAPI backend, if running). `frontend/public/data.json` is served at `/data.json` for static mode.

### Backend (archived, not part of the shipped product)

```bash
cd backend
pip install -r requirements.txt
bash run.sh                                            # or: python -m uvicorn backend.api.main:app --reload
python -m backend.seed_database                        # one-time seed from data.json
```

Backend serves `/docs` (Swagger), `/api/seizures`, `/api/stats`, `/health`, and mounts `frontend/dist/` as static at `/`.

### Docker (full stack)

```bash
docker-compose up --build                              # FastAPI + built frontend on :8000
```

### Data refresh (local)

```bash
pip install -r scripts/requirements.txt
python scripts/collect_data.py                         # rewrites frontend/public/data.json
```

---

## Architecture: the three data modes

The frontend's `useApi` hook (`frontend/src/hooks/useApi.ts`) auto-detects mode from `VITE_API_BASE` and falls back to static data on any failure. This is the most important architectural concept in the repo.

| Mode | Trigger | Backing store | Where the endpoints live |
|---|---|---|---|
| **Static** (default, what ships) | `VITE_API_BASE` empty or `/api` | `frontend/public/data.json` | The JSON file itself; `useApi` maps fields and reads from localStorage cache |
| **Vercel serverless** | `VITE_API_BASE` set to deployment URL | Supabase (Postgres) | `frontend/api/{seizures,stats,scrape}/index.ts` — `@vercel/node` handlers, service-role key |
| **FastAPI** | `VITE_API_BASE` set to FastAPI host | SQLite (SQLAlchemy async) | `backend/api/routes/*.py` — full CORS allowlist, Pydantic validation, lifespan-managed DB |

The mode-switching happens in `isStaticMode()` and the `fetchSeizures = isStaticMode() ? fetchStatic : fetchFromApi` line in `useApi.ts`. Live API failure transparently falls back to static.

### Data pipeline (how records get into `data.json`)

1. `.github/workflows/scrape-weekly.yml` (Sun 18:00 IST) runs `backend/scraper/run_scraper.py` — RSS-based scraper.
2. `.github/workflows/update-data.yml` (cron every ~20 days) runs `scripts/collect_data.py` — broader collector, also writes to `frontend/public/data.json`.
3. Either workflow commits `frontend/public/data.json` if changed. Vercel auto-deploys.
4. Local equivalent: run the same script and commit manually.

`frontend/public/data.json` is the single source of truth for static mode. Its shape (seizure records + `stats` block) is consumed by `fetchStaticData()` in `useApi.ts`. The `stats` block is pre-computed (totals, by_state, by_drug_type, by_month, top_locations) — the frontend does not aggregate at runtime.

---

## Frontend layout (the parts that matter)

- **`App.tsx`** — three-column shell: `Sidebar` (tabs) · center panel (map or `IntelPanel`/`NetworkPanel`/`TrendingPanel`/`AgencyPanel`/`ComparePanel`/`TerminalPanel`) · `LiveFeed` (right). Also wires `FilterPanel` modal, `SeizureModal`, `LoadingScreen`, `OfflineBadge`, `StatBoxes`.
- **`hooks/useApi.ts`** — the data contract. `useApi()` returns `{ seizures, stats, filters, applyFilters, resetFilters, refresh, isOffline, lastUpdate }`. Every panel reads from this; do not introduce another data-fetching path.
- **`types/index.ts`** — the `Seizure` / `FilterState` / `ApiStats` types are the schema. The static JSON uses flat fields (`city`, `state`, `lat`, `lon`); the in-app `Seizure` type wraps them in `location: { city, state, lat, lon }`. The mapping lives in `mapApiSeizure()` and `fetchStaticData()`.
- **`components/IndiaMap.tsx`** + **`SeizureMarker.tsx`** — Leaflet with CARTO dark tiles + India boundary GeoJSON overlay (`/india-boundary.geojson`). Markers are SVG `divIcon`s (not `CircleMarker`) so they can pulse for major seizures. Leaflet CSS overrides live in `styles/global.css`.
- **`styles/design-system.css`** — CSS custom properties for the whole app. Always reach for a token (`--accent`, `--bg-secondary`, `--severity-critical`, etc.) instead of hardcoding hex.
- **`context/AppContext.tsx`** — `useReducer`-based shell state. Currently a thin layer; `App.tsx` mostly uses local `useState` instead. Don't add global state to it without reason.

Panel components (`IntelPanel`, `TrendingPanel`, `NetworkPanel`, etc.) are self-contained — they call `useApi()` directly. The `FilterPanel` writes back through `applyFilters` / `resetFilters`.

---

## Design constraints (non-negotiable)

Read `DESIGN.md` and `PRODUCT.md` first. Highlights that must be respected:

- **Signal Red rule.** `#E83D3D` (the accent) appears on ≤5% of any screen — only active nav border, critical severity, LIVE pulse, primary buttons. Never on decorative borders or fills.
- **Severity scale.** Red = critical (>100kg), orange = high (>10kg), yellow = low. The thresholds are in `SeizureMarker.tsx` (`getSeverityColor`) and the CSS tokens. They encode meaning — do not reuse these colors for decoration.
- **Mono-only.** All UI text is `Share Tech Mono` (`--font-mono`). Never switch to sans-serif "for readability." Inter is the fallback, not a substitute.
- **Flat by default.** No shadows anywhere except the Leaflet map popup. Depth comes from `bg-primary → bg-secondary → bg-tertiary` tonal layering.
- **CLASSIFIED watermark** + "CLASSIFIED" stamps are brand. The diagonal overlay on `App.tsx` (`App.module.css` `.classifiedWatermark`) is committed.
- **Anti-references (per `PRODUCT.md`):** not Stripe/Linear/Vercel-style SaaS, not neon cyberpunk pastiche, not beige cream warmth, not mobile-first. If a change could be confused with a generic productivity dashboard, it's wrong.
- **Accessibility stance** is "in-frame, on-brand." Real work: WCAG AA contrast (terminal green / white-on-black passes), visible focus rings, `prefers-reduced-motion` honored, keyboard nav through panel tabs and modal. Not "neutralize the aesthetic for compliance."

When working on frontend code, the `impeccable` design skill at `.github/skills/impeccable/SKILL.md` is available — invoke it for craft/audit/polish work, or for any new component that needs design judgment.

---

## Deployment

- **Production**: Vercel auto-deploys from the repo. `vercel.json` builds `frontend/` and outputs `frontend/dist/`. The `frontend/api/*` serverless functions deploy alongside the static build.
- **Static fallback** works with any static host (Netlify, GitHub Pages, etc.) — only `frontend/dist/` is needed, and only if you have a way to keep `public/data.json` populated.
- **Custom backend**: set `VITE_API_BASE` in `.env.production` and rebuild.

---

## Things there aren't

- **No test suite.** `package.json` has no `test` script. Backend has `pytest` in requirements but no `tests/` dir. QA lives in `qa/` as markdown checklists (`functionality-tests.md`, `code-review-checklist.md`, etc.) — use them as a guide, not a runnable suite.
- **No lint config.** TypeScript strict mode is the only enforced guardrail (`tsconfig.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`).
- **No Cursor / Copilot rules files** in the repo.
- **No mobile-first design.** The dashboard is desktop ambient viewing; mobile is best-effort.

---

## Things to know that aren't obvious

- `frontend/public/data.json` is large (~1.6 MB) and committed. Don't try to gitignore it.
- The `drug_seizures_india.json` at repo root and `frontend/public/data.json` are the same data — root copy is the older format. The frontend reads `public/data.json`.
- `useApi.ts` uses a `mountedRef` pattern in its effects to avoid setState-after-unmount. Keep that pattern if you add fetches.
- The 7-day-TTL localStorage cache (`narc_kart_cache`) is what makes the dashboard load instantly on repeat visits and surface the `OfflineBadge` when the network drops mid-session. The cache is the offline story — don't bypass it.
- `frontend/.vercel/` is the Vercel project link (committed by accident — it's in `.gitignore` but was tracked before the ignore was added). It is safe to keep; just don't edit `project.json` by hand.
- `AppContext.tsx` exists but `App.tsx` uses local state. If you reach for global state, decide first whether to wire it through the context or add a new hook.
- Several sibling agents/tools have left scratchpads: `.mavis/audit/` (audits), `.impeccable/` (design state), `.opencode/` (older skills). Useful as background, not as the source of truth.
