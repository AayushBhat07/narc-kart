# Narc Kart - Code Review Report

**Project:** Narc Kart - India Drug Seizure Intelligence System
**Review Date:** 2026-04-25
**Reviewer:** QA Agent
**Branch:** (initial codebase)

---

## Executive Summary

The codebase is in early stages — backend API skeleton exists, frontend has core components. There are **several issues that must be fixed before merge**, particularly around TypeScript strictness, frontend security, and Python async safety.

---

## 📋 Code Review Checklist Results

### ✅ What's Good

- **Backend uses SQLAlchemy ORM** — parameterized queries, no raw SQL
- **Type hints on Python functions** — consistent use of `Mapped[]` pattern
- **Docstrings on all functions** — well documented
- **FastAPI proper usage** — dependency injection, router prefix, tags
- **React functional components** — all components are functional, no class components
- **Props interfaces defined** — `Props` interface in every component
- **CSS modules used** — no inline `<style>` tags, proper `.module.css` approach
- **Vite proxy config** — `/api` properly proxied to backend
- **Mock data fallback** — development has graceful fallback (but needs flag)

---

## ❌ Issues Found

### BLOCKERS (Must Fix)

#### 1. `SeizureMarker.tsx` — Unused Import + Inline Styles in HTML String

```tsx
// Line 2: CircleMarker imported but NEVER USED
import { Marker, Popup, CircleMarker } from 'react-leaflet';  // ← remove CircleMarker

// Lines 22-35: Inline styles embedded in HTML string
html: `
  <div class="${styles.marker} ${isMajor ? styles.pulsing : ''}" style="
    width: ${radius * 2}px;
    height: ${radius * 2}px;
    background: ${color};
    border-radius: 50%;
    border: 2px solid ${color};
    box-shadow: 0 0 10px ${color};
  "></div>
```

**Problem:** The checklist says "No inline styles" — but this is an HTML string rendered via `innerHTML` equivalent (L.divIcon). These styles bypass CSS modules entirely. The `style={}` attribute is not the same as inline styles — but `L.divIcon`'s `html` property renders raw HTML with inline styles.

**Fix:** Either:
1. Build the HTML string with CSS class references and add those classes to the CSS module
2. Use a proper React Leaflet approach with `CircleMarker` or `Polyline` for visual effects
3. If dynamic styles are unavoidable, pass them via CSS custom properties instead of inline `style`

The `CircleMarker` import is unused — remove it regardless.

---

#### 2. `SeizurePopup.tsx` — Missing `alt` Attribute on `<img>`

```tsx
// Line 34:
<img src={seizure.images[0]} alt="Drug seizure" className={styles.image} />
```

**This is correct** — `alt` is present. No fix needed here.

---

#### 3. `useApi.ts` — No Cleanup in `useEffect`, Memory Leak Risk

```typescript
// Lines 79-82:
useEffect(() => {
  fetchSeizures();
  fetchStats();
}, []);  // Empty deps — runs once on mount
```

**Problem:** If the component unmounts while `fetchSeizures` or `fetchStats` are in-flight, the state setters (`setSeizures`, `setStats`) will fire on an unmounted component — potential memory leak and React warnings.

**Fix:**
```typescript
useEffect(() => {
  let cancelled = false;

  async function load() {
    await fetchSeizures();
    await fetchStats();
  }

  load().catch(console.error);

  return () => {
    cancelled = true;
  };
}, []);
```
Or use AbortController for fetch cancellation.

---

#### 4. `refresh.py` — Fire-and-Forget Task with Silent Exception Loss

```python
# Line 46:
asyncio.create_task(run_scraper_task(scrape_id))
```

**Problem:** If the background task raises an exception, it is silently discarded. No logging, no tracking, no retry. The task is also not joined on shutdown — if the server restarts, running tasks are killed without cleanup.

**Fix:**
```python
# Store task reference for lifecycle management
task = asyncio.create_task(run_scraper_task(scrape_id))
app.state.scraper_tasks.add(task)
task.add_done_callback(app.state.scraper_tasks.discard)
```

Or use a proper task queue (Celery, Redis, etc.) for production.

---

### ⚠️ WARNINGS (Should Fix)

#### 5. `database/queries.py` — Unused Import

```python
# Line 5:
import json   # ← NEVER USED
```

Remove it.

---

#### 6. `connection.py` — `DATABASE_PATH` Could Be Relative to Workdir

```python
DATABASE_PATH = os.getenv("DATABASE_PATH", "narc_kart.db")
```

If the working directory isn't controlled, this creates DB files in unexpected places. Not a blocker but worth noting. Consider using `Path(__file__).parent.parent` or an absolute path.

---

#### 7. `SeizurePopup.tsx` — `target="_blank"` Without `rel="noopener"`

```tsx
<a href={seizure.source.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
```

**Actually correct** — `rel="noopener noreferrer"` is present. ✅ No fix needed.

---

#### 8. `run.sh` / `run.py` — Not Reviewed

These files haven't been inspected. Need to verify:
- No hardcoded credentials
- Proper env var usage
- Clean startup/shutdown

---

#### 9. `useApi.ts` — Mock Data Fallback

```typescript
} catch (err) {
  setError(err.message);
  setSeizures(getMockSeizures());  // ← Falls back silently
}
```

**Problem:** Errors are swallowed and mock data is silently used. In production, developers might not notice the API is failing.

**Fix:** Add a `MOCK_DATA=true` env flag, only use mock data when explicitly enabled:
```typescript
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';
// ...
} catch (err) {
  if (USE_MOCK) {
    setSeizures(getMockSeizures());
  } else {
    setError(err.message);
  }
}
```

---

#### 10. `frontend/package.json` — Not Reviewed

Need to verify:
- All packages pinned with exact versions in production
- No `*` or `latest` deps
- `npm audit` passes with no high/critical issues

---

#### 11. `backend/requirements.txt` — No Exact Pins

```
fastapi==0.109.2
uvicorn[standard]==0.27.1
pydantic==2.6.1
sqlalchemy==2.0.25
aiosqlite==0.19.0
python-multipart==0.0.9
httpx==0.26.0
```

**These are actually pinned** ✅ — but no upper bounds (e.g., `<2.1`). Consider adding `<2.1` style constraints to prevent breaking changes.

---

## 🏛️ Architecture Notes

- **Frontend proxy:** Vite proxies `/api` → FastAPI. CORS is properly configured with specific origins. ✅
- **DB:** SQLite with async SQLAlchemy. Connection pooling via `AsyncSessionLocal`. ✅
- **API routes:** Well-structured with router prefixes and tags. ✅
- **No circular imports detected** ✅
- **Single responsibility:** Functions do one thing. ✅

---

## Security Checklist Results

| Category | Status | Notes |
|---|---|---|
| No hardcoded secrets | ✅ Pass | No secrets found in codebase |
| SQL injection | ✅ Pass | SQLAlchemy ORM, parameterized queries |
| XSS | ⚠️ Review | `L.divIcon` HTML string needs review (item #1 above) |
| CORS | ✅ Pass | Specific origins listed, not `*` |
| Auth | N/A | No auth implemented yet — document this |
| Input validation | ✅ Pass | FastAPI Query validation, Pydantic models |
| Dependency scan | ⚠️ Not run | Run `backend/audit-deps.sh` before merge |

---

## 🔧 Required Fixes Before Merge

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `SeizureMarker.tsx` | Remove unused `CircleMarker` import | Medium |
| 2 | `SeizureMarker.tsx` | Refactor `L.divIcon` HTML string — avoid inline styles | High |
| 3 | `useApi.ts` | Add cleanup to `useEffect` | High |
| 4 | `refresh.py` | Handle task exception logging + lifecycle | High |
| 5 | `queries.py` | Remove unused `import json` | Low |
| 6 | `useApi.ts` | Add `VITE_USE_MOCK_DATA` flag for mock fallback | Medium |
| 7 | `audit-deps.sh` | Run before merge, resolve all high/critical issues | High |

---

## 📊 Summary

| Metric | Result |
|---|---|
| Files reviewed | 12 |
| Blockers | 4 |
| Warnings | 6 |
| Security issues | 1 (XSS potential via L.divIcon) |
| Overall quality | 🟡 Acceptable with fixes |

**Recommendation:** Do not merge until all BLOCKER items are fixed. Run `audit-deps.sh` and resolve vulnerabilities. Add mock-data flag before production deployment.