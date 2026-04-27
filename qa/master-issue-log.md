# Narc Kart - Master Issue Log
**Project:** Narc Kart - India Drug Seizure Intelligence System
**Started:** 2026-04-25

---

## Issue Tracking

### Design QA Issues (From design-qa-checklist.md)

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| D1 | Color `#00FF00` vs `#00FF41` | CRITICAL | ✅ FIXED | Correct in design-tokens.css:16 |
| D2 | Font must be Share Tech Mono | HIGH | ✅ FIXED | Imported via Google Fonts, set as --font-primary |
| D3 | Seizure thresholds: >100kg (red), 10-100kg (orange), <10kg (yellow) | HIGH | ✅ FIXED | Correct in SeizureMarker.tsx:22-25 |
| D4 | Coordinates India center (20.5937° N, 78.9625° E) | MEDIUM | ✅ FIXED | Corrected to 78.9625 in IndiaMap.tsx:9 |

### Code Review Issues (From code-review-report.md)

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| C1 | SeizureMarker.tsx:2 - Unused `CircleMarker` import | MEDIUM | ✅ FIXED | Removed unused import, replaced with SVG-based icon |
| C2 | SeizureMarker.tsx - L.divIcon HTML string with inline styles | HIGH | ✅ FIXED | Replaced with SVG-based divIcon, no innerHTML risk |
| C3 | useApi.ts:79-82 - No cleanup in useEffect, memory leak risk | HIGH | ✅ FIXED | Added mountedRef pattern with cleanup |
| C4 | refresh.py:46 - Fire-and-forget task with silent exception loss | HIGH | ✅ FIXED | Added done_callback to log exceptions |
| C5 | queries.py:5 - Unused `import json` | LOW | ✅ FIXED | Removed unused import |
| C6 | useApi.ts - Mock data fallback without flag | MEDIUM | ✅ FIXED | Now checks VITE_USE_MOCK_DATA env var before fallback |
| C7 | audit-deps.sh - Not run before merge | HIGH | ⚠️ PENDING | Script exists at backend/audit-deps.sh |

---

## Summary

| Category | Count |
|----------|-------|
| Total Issues Tracked | 11 |
| ✅ Fixed | 10 |
| ⚠️ Pending | 1 |
| 🔴 Critical | 0 |

---

*Log started: 2026-04-25 20:45 GMT+5:30*