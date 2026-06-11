# Architecture Audit Verification Report — narc-kart (v2)

**Verifier:** Verification Agent
**Date:** 2026-06-11
**Original Audit:** arch-audit.md (v2) — complete rewrite
**Task:** Verify architecture audit findings for patterns, SOLID, DRY, separation of concerns

---

## Executive Summary

The updated architecture audit (v2) is **comprehensive and accurate**. Key improvements over v1:
1. Covers the previously-missed `frontend/api/` Vercel serverless layer
2. Identifies a **three-way data layer schism** (previously two-way)
3. Corrects false positive claims about missing `dompurify` and `framer-motion`
4. Adds VERDICT section and SPEC conformance table
5. All claims are well-evidenced with file paths and line numbers

**Verdict: PASS** — The audit is thorough, accurate, and provides a clear remediation path.

---

## Confirmed Findings (Verified by Independent Audit)

### Critical Issues (All 5 Confirmed)

#### C1: THREE-WAY DATA LAYER SCHISM ✅
**Evidence:**
- `backend/database.py` (sync sqlite3) — archived
- `backend/database/models.py` (async SQLAlchemy) — archived
- `frontend/api/` (Vercel Supabase) — ACTIVE deployment
- `frontend/public/data.json` (static mode) — fallback

**Schema differences verified:**

| Field | FastAPI main.py | FastAPI api/ | Vercel Supabase | data.json |
|-------|-----------------|--------------|-----------------|-----------|
| City | `location_city` | `city` | `city` | `city` (flat) |
| Lat | `latitude` | `lat` | `lat` | `lat` (flat) |
| DrugType | `drug_type` | `drug_type` | `drug_type` | `drugType` (camelCase) |
| Quantity | `quantity_kg` | `quantity_kg` | `quantity_kg` | `quantityKg` (camelCase) |
| Source | `source_name` | `source_name` | `source_name` | `sourceName` (camelCase) |

#### C2: `mapApiSeizure(s: any)` TYPE BLACK HOLE ✅
**Evidence:** `frontend/src/hooks/useApi.ts:42-59`
```typescript
function mapApiSeizure(s: any): Seizure {  // ← any type accepted
  return {
    location: {
      city: s.city || s.location_city || '',  // 2-4 fallback aliases
      lat: s.lat ?? s.latitude ?? s.location_lat ?? null,
    },
    drugType: s.drug_type || s.drugType || '',
    // ...
  };
}
```
All fields have fallback chains. No Zod validation. Silent data corruption on schema mismatch.

#### C3: DUAL FASTAPI BACKENDS ✅
**Evidence:**
- `backend/main.py` (413 lines) — routes inline, sync sqlite3
- `backend/api/main.py` (169 lines) — router-based, async SQLAlchemy

Both define overlapping routes (`/api/seizures`, `/api/stats`, `/api/health`).

#### C4: `refresh.py` BROKEN RELATIVE IMPORT ✅
**Evidence:** `backend/api/routes/refresh.py:22`
```python
from database.connection import AsyncSessionLocal  # ← bare module name
```
This will fail with `ModuleNotFoundError` when mounted by `api/main.py`.

#### C5: `AppContext` DEFINED BUT NEVER CONSUMED ✅
**Evidence:** `grep AppProvider` in `frontend/src/`:
- Defined: `AppContext.tsx:44`
- Imported elsewhere: **ZERO matches**

`App.tsx` uses local `useState` for all state management.

---

### High Issues (All 8 Confirmed)

#### H1: `TerminalPanel.tsx` LOCAL Seizure TYPE ✅
**Evidence:** `TerminalPanel.tsx:5-14`
```typescript
interface Seizure {  // Local redefinition
    id: string;
    location: { city: string; state: string; lat: number; lon: number };  // All required
    drugType: string;
    quantityKg: number;
    // Missing: caseNo, images
}
```
Missing `caseNo`, `images`, and `SeizureSource` type. Structural divergence from canonical `types/index.ts`.

#### H2: DESIGN TOKEN WAR ✅
**Evidence:**
- `design-tokens.css`: Never imported anywhere — **ORPHANED**
- `design-system.css`: Only file imported by `global.css`
- Token conflict:
  - `design-tokens.css`: `--text-primary: #00FF00` (SPEC green)
  - `design-system.css`: `--text-primary: #FFFFFF` (white)
  - SPEC.md: `--text-primary: #00FF00` → **SPEC VIOLATION**

#### H3: NO REACT ERROR BOUNDARY ✅
**Evidence:** `grep -r ErrorBoundary frontend/src/` → **Zero results**
`main.tsx:5-8` wraps only with `React.StrictMode`. No ErrorBoundary.

#### H4: `useApi.ts` 275-LINE GOD HOOK ✅
Single hook handles: cache, static fetch, API fetch, field mapping, filter building, offline fallback, reactive effects.

#### H5: SCRAPER DUPLICATED ACROSS STACKS ✅
- `backend/scraper/scraper.py` — BeautifulSoup + Playwright + Ollama
- `frontend/api/scrape/index.ts` — RSS feeds + regex only

NCB scraper in Vercel is a stub that returns empty: `frontend/api/scrape/index.ts:64-70`

#### H6: CORS `*` WILDCARDS ✅
All three Vercel serverless functions use `Access-Control-Allow-Origin: *`.

#### H7: NO DATABASE MIGRATION SYSTEM ✅
`init_db()` uses `CREATE TABLE IF NOT EXISTS` — no schema evolution.

#### H8: `getSeverityClass` COPIED IN 3 COMPONENTS ✅
**Evidence:**
- `LiveFeed.tsx:8`
- `TrendingPanel.tsx:15`
- `SeizurePopup.tsx:22`

Identical function body, identical thresholds.

---

### Medium Issues (Verified Spot-Checks)

#### M2: `SeizureMarker` SVG Recreation ✅
`L.divIcon()` created on every render — confirmed in code.

#### M3: `IndiaMap` GeoJSON Fetch ✅
`useEffect` with `fetch()` inside — confirmed.

#### M5: `DOMPurify` IS IN package.json ✅
**CORRECTION ACKNOWLEDGED:** Producer correctly noted this was a false positive in v1.
```json
// frontend/package.json:14
"dompurify": "^3.4.5"
```
Also `framer-motion` confirmed at line 15.

#### M6: HARDCODED 2.5s TIMER ✅
`App.tsx:33-36` — `setTimeout(..., 2500)`.

#### M10: `StatBoxes` DOUBLE-NULLISH ✅
`StatBoxes.tsx:13`: `{stats?.totalSeizures ?? recentCount ?? 0}`
`recentCount` is typed `number`, so `?? recentCount` is dead code.

---

### Low Issues (Verified Spot-Checks)

#### L2: HARD-CODED COLORS ✅
`IndiaMap.tsx:29`: `#00FFFF`
`SeizureMarker.tsx:12-14`: `#E83D3D`, `#FF8C42`, `#FFCC00`

#### L5: `maxZoom={8}` ✅
`IndiaMap.tsx:45`: max zoom is 8, limiting street-level detail.

#### L10: MOBILE OVERFLOW HIDDEN ✅
`global.css:12`: `html, body, #root { overflow: hidden; }`

---

## Corrections from v1

| Issue | v1 Claim | v2 Correction | Status |
|-------|----------|---------------|--------|
| `dompurify` missing | Flagged as missing | Confirmed in package.json | ✅ Corrected |
| `framer-motion` missing | Flagged as missing | Confirmed in package.json | ✅ Corrected |
| Frontend-only audit | Missing `frontend/api/` | Now covers Vercel serverless | ✅ Corrected |
| Two-way schema schism | Identified | Three-way (added Supabase) | ✅ Expanded |

---

## SPEC Conformance Analysis (Producer's Table Verified)

| SPEC Requirement | Status | Evidence |
|-----------------|--------|----------|
| React 19 + Vite + TypeScript | ✅ | `package.json:6,17-18` |
| CSS Modules | ✅ | All components use `.module.css` |
| React Context + useReducer | ❌ | `AppContext` defined but never mounted |
| FastAPI backend | ✅ | Both `main.py` and `api/main.py` exist |
| SQLite database | ⚠️ | Active: Supabase PostgreSQL |
| Terminal green `#00FF00` | ❌ | Active: `#FFFFFF` in design-system.css |
| `#E83D3D` accent | ✅ | `design-system.css:22` |

---

## Verdict

**VERDICT: PASS**

The updated architecture audit is comprehensive, accurate, and well-evidenced. The key improvements:
1. **Three-way data layer schism** correctly identified (previously missed Vercel/Supabase)
2. **False positives corrected** (`dompurify`, `framer-motion`)
3. **SPEC conformance table** provides clear baseline vs actual
4. **VERDICT section** gives explicit posture assessment
5. All claims have file paths and line numbers

No false positives found in Critical or High categories. The audit provides a solid foundation for remediation prioritization.
