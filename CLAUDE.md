# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What this is

**NARC KART** — a static-deployed intelligence dashboard for publicly available Indian drug seizure data. Cyberpunk/tactical-styled 3D wireframe globe (black sphere, white hairline borders) with sidebar panels (RADAR / INTEL / NETWORK / TRENDING / AGENCY / COMPARE / TERMINAL), live feed, and case-file modals.

Originally a FastAPI + SQLite + Cloudflare-tunnel full-stack app. It is now **fully static**: a single `frontend/public/data.json`, deployed to Vercel (free Hobby plan), refreshed weekly by a GitHub Action. The backend, Supabase and serverless code were removed; they're in git history if ever needed.

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

`frontend/public/data.json` is served at `/data.json`.

### Data refresh (local)

```bash
python scripts/update_data.py --dry-run   # stdlib only, no pip install
python scripts/update_data.py
```

---

## Architecture

Static only. `useApi` (`frontend/src/hooks/useApi.ts`) fetches `/data.json`, maps the flat records into the `Seizure` type, caches them in localStorage, and applies `FilterState` client-side.

### Data pipeline

1. `.github/workflows/scrape-weekly.yml` (Sun 18:00 IST) runs `scripts/update_data.py`: Google News RSS → keep headlines with drug + quantity + known city → **merge** into `data.json` (never shrinks it) → recompute `stats`.
2. If `data.json` changed, the job commits it. `deploy-vercel.yml` runs after the job (`workflow_run`), because bot pushes don't trigger `push` workflows.
3. `ci.yml` builds the frontend and validates every record and the `stats` keys.

The `stats` block uses snake_case keys (`total_seizures`, `by_state`, ...). `fetchStaticData()` throws if they're missing, so don't hand-edit them; rerun the script.

---

## Frontend layout (the parts that matter)

- **`App.tsx`** — three-column shell: `Sidebar` (tabs) · center panel (map or `IntelPanel`/`NetworkPanel`/`TrendingPanel`/`AgencyPanel`/`ComparePanel`/`TerminalPanel`) · `LiveFeed` (right). Also wires `FilterPanel` modal, `SeizureModal`, `LoadingScreen`, `OfflineBadge`, `StatBoxes`.
- **`hooks/useApi.ts`** — the data contract. `useApi()` returns `{ seizures, stats, filters, applyFilters, resetFilters, refresh, isOffline, lastUpdate }`. Every panel reads from this; do not introduce another data-fetching path.
- **`types/index.ts`** — the `Seizure` / `FilterState` / `ApiStats` types are the schema. The static JSON uses flat fields (`city`, `state`, `lat`, `lon`); the in-app `Seizure` type wraps them in `location: { city, state, lat, lon }`. The mapping lives in `fetchStaticData()`.
- **`components/SeizureGlobe.tsx`** — globe.gl on a black `MeshBasicMaterial` sphere. Borders are drawn as `THREE.LineSegments` hairlines (one draw call per layer): graticule, world countries (`world-atlas` 50m), Indian states and districts (meshed from `public/india-districts.topojson`). Selecting a seizure flies the camera along a great circle with an altitude "hop" plus a dashed arc. Lazy-loaded so three.js stays out of the first chunk.
- **`styles/design-system.css`** — CSS custom properties for the whole app. Always reach for a token (`--accent`, `--bg-secondary`, `--severity-critical`, etc.) instead of hardcoding hex.
- **`context/AppContext.tsx`** — `useReducer`-based shell state. Currently a thin layer; `App.tsx` mostly uses local `useState` instead. Don't add global state to it without reason.

Panel components (`IntelPanel`, `TrendingPanel`, `NetworkPanel`, etc.) are self-contained — they call `useApi()` directly. The `FilterPanel` writes back through `applyFilters` / `resetFilters`.

---

## Design constraints (non-negotiable)

Read `DESIGN.md` and `PRODUCT.md` first. Highlights that must be respected:

- **Signal Red rule.** `#E83D3D` (the accent) appears on ≤5% of any screen — only active nav border, critical severity, LIVE pulse, primary buttons. Never on decorative borders or fills.
- **Severity scale.** Red = critical (>100kg), orange = high (>10kg), yellow = low. The thresholds are in `SeizureGlobe.tsx` (`severityColor`), `SeizurePopup.tsx` and the CSS tokens. They encode meaning — do not reuse these colors for decoration.
- **Mono-only.** All UI text is `Share Tech Mono` (`--font-mono`). Never switch to sans-serif "for readability." Inter is the fallback, not a substitute.
- **Flat by default.** No shadows anywhere. Depth comes from `bg-primary → bg-secondary → bg-tertiary` tonal layering.
- **CLASSIFIED watermark** + "CLASSIFIED" stamps are brand. The diagonal overlay on `App.tsx` (`App.module.css` `.classifiedWatermark`) is committed.
- **Anti-references (per `PRODUCT.md`):** not Stripe/Linear/Vercel-style SaaS, not neon cyberpunk pastiche, not beige cream warmth, not mobile-first. If a change could be confused with a generic productivity dashboard, it's wrong.
- **Accessibility stance** is "in-frame, on-brand." Real work: WCAG AA contrast (terminal green / white-on-black passes), visible focus rings, `prefers-reduced-motion` honored, keyboard nav through panel tabs and modal. Not "neutralize the aesthetic for compliance."

When working on frontend code, the `impeccable` design skill at `.github/skills/impeccable/SKILL.md` is available — invoke it for craft/audit/polish work, or for any new component that needs design judgment.

---

## Deployment

- **Production**: Vercel, via `deploy-vercel.yml` (needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` repo secrets). `frontend/vercel.json` builds `frontend/` and serves `frontend/dist/`. Vite `base` is `/`.

---

## Things there aren't

- **No test suite.** `package.json` has no `test` script; CI only builds and validates `data.json`. QA lives in `qa/` as markdown checklists (`functionality-tests.md`, `code-review-checklist.md`, etc.) — use them as a guide, not a runnable suite.
- **No lint config.** TypeScript strict mode is the only enforced guardrail (`tsconfig.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`).
- **No Cursor / Copilot rules files** in the repo.
- **No mobile-first design.** The dashboard is desktop ambient viewing; mobile is best-effort.

---

## Things to know that aren't obvious

- `frontend/public/data.json` is committed and is the only data the site reads. The weekly job appends to it.
- `drug_seizures_india.json` at repo root is an older 2,759-record dataset (many UNODC rows geocoded to the centre of India). Nothing reads it.
- `useApi.ts` passes an `isMounted` guard into `load()` to avoid setState-after-unmount. Keep that pattern if you add fetches.
- The 1-hour localStorage cache (`narc_kart_cache`) is what makes the dashboard load instantly on repeat visits and surface the `OfflineBadge` when the network drops mid-session. The cache is the offline story — don't bypass it.
- `AppContext.tsx` exists but `App.tsx` uses local state. If you reach for global state, decide first whether to wire it through the context or add a new hook.
- Several sibling agents/tools have left scratchpads: `.mavis/audit/` (audits), `.impeccable/` (design state), `.opencode/` (older skills). Useful as background, not as the source of truth.
