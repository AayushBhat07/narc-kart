# GitHub Issues Created — 2026-05-21

Created 5 issues on `AayushBhat07/narc-kart` based on common deployment and codebase problems.

---

## Issues Created

| # | Title | Priority | Labels | URL |
|---|-------|----------|--------|-----|
| 10 | Backend API CORS misconfiguration on Vercel deployment | HIGH | bug, help wanted | [#10](https://github.com/AayushBhat07/narc-kart/issues/10) |
| 9 | Environment variables not configured for Vercel deployment | MEDIUM | enhancement, help wanted | [#9](https://github.com/AayushBhat07/narc-kart/issues/9) |
| 11 | SQLite database file path issue on Vercel (read-only filesystem) | MEDIUM | bug, enhancement | [#11](https://github.com/AayushBhat07/narc-kart/issues/11) |
| 12 | Add comprehensive API health check endpoint for uptime monitoring | LOW | enhancement, good first issue, help wanted | [#12](https://github.com/AayushBhat07/narc-kart/issues/12) |
| 13 | Add React Error Boundary components to frontend | FEATURE | enhancement, good first issue | [#13](https://github.com/AayushBhat07/narc-kart/issues/13) |

---

## Notes on Existing Issues

- **CORS already partially addressed**: The codebase does have CORS configured in `backend/main.py:130` with some Vercel origins allowlisted, but the configuration is incomplete (missing branch preview URLs and production domain).
- **Health endpoint exists**: `backend/main.py:137` has a basic `/api/health` — but it's minimal (no DB check, no version info). Issue #12 proposes an enhanced version.
- **No TODOs/FIXMEs found** in source files (only in `node_modules/`).
- Existing issues #3 (CORS wildcard), #4 (SQL injection), #5 (XSS), #6 (unsafe image URLs), #2 (TypeScript build) remain open — some are security-critical.

## GH CLI Available
Yes — `gh version 2.83.1` was used for all issue creation.

---
*Generated: 2026-05-21*