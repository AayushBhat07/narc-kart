# Security Audit Findings — narc-kart

**Audit Date:** 2026-06-11
**Scope:** Additional findings from `frontend/api/` (Vercel serverless) and `scripts/`
**Note:** These findings supplement the main `arch-audit.md` which did NOT cover `frontend/api/` or `scripts/`.

---

## Critical Security Issues

### SEC-C1: CORS Wildcard `*` with Authorization Header on `/api/scrape`

**File:** `frontend/api/scrape/index.ts:179-181`
**Evidence:**
```typescript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
```

**Risk:** 
- CORS wildcard `*` allows ANY origin to make requests
- `Authorization` header is explicitly allowed, meaning bearer tokens or API keys sent in Authorization headers can be read by arbitrary cross-origin websites
- The `/api/scrape` endpoint writes to the Supabase database using the SERVICE_ROLE key (server-side, not exposed to client) but the auth header check is trivial (`Bearer ${process.env.CRON_SECRET}`)
- If an attacker tricks a browser user into visiting a malicious site, that site can:
  1. Read any data returned from `/api/scrape`
  2. Attempt to trigger scraper jobs with forged Authorization headers

**Fix:** Replace `*` with an explicit allowlist of known Vercel deployment domains.

---

### SEC-C2: SSL Verification Disabled in `collect_data.py`

**File:** `scripts/collect_data.py:291, 336`
**Evidence:**
```python
# Line 32: Global warning suppression
warnings.filterwarnings('ignore', category=requests.packages.urllib3.exceptions.InsecureRequestWarning)

# Line 291: SSL disabled fallback for GDELT
resp = requests.get(url, headers=HEADERS, timeout=120, verify=False)

# Line 336: SSL disabled for RSS feeds
resp = requests.get(feed_url, headers=HEADERS, timeout=30, verify=False)
```

**Risk:**
- Disabling SSL verification (`verify=False`) allows man-in-the-middle attacks
- An attacker on the network could intercept and modify:
  - GDELT data being downloaded
  - RSS feed content being scraped
- This is especially dangerous because the data is ingested into the Narc Kart database and displayed to users as "verified" seizure data

**Fix:** Remove all `verify=False` usages. Only use as an absolute last resort with explicit user opt-in.

---

## High Security Issues

### SEC-H1: Permissive CORS on `/api/stats` and `/api/seizures`

**Files:**
- `frontend/api/stats/index.ts:11-13`
- `frontend/api/seizures/index.ts:13-15`

**Evidence:**
```typescript
// stats/index.ts
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

// seizures/index.ts
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

**Risk:**
- `Access-Control-Allow-Origin: *` means any website can fetch this data
- While these endpoints are read-only, the wildcard allows:
  - Data exfiltration via CSS injection attacks
  - Browser-based enumeration of seizure data
  - Cross-site request forgery (CSRF) if state-changing operations are added later

**Note:** For public data, `*` is acceptable IF there are no authentication cookies/headers. However, the pattern is inconsistent with the backend `api/main.py` which uses an explicit allowlist.

**Fix:** Use explicit origin allowlist for production domains.

---

### SEC-H2: Supabase SERVICE_ROLE Key in Vercel Edge Functions

**File:** `frontend/api/*/index.ts:6-11`

**Evidence (all three files):**
```typescript
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

**Risk:**
- Vercel serverless functions with `SUPABASE_SERVICE_ROLE_KEY` are potentially exposed in:
  - Build logs (if not redacted)
  - Edge function source code (if not properly excluded from public access)
  - Client-side bundles (if imported incorrectly)
- The SERVICE_ROLE key bypasses Row Level Security (RLS) — it has full database access
- If exposed, an attacker can read/write/delete all Supabase data

**Fix:**
1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is only in server-side environment variables
2. Use `SUPABASE_ANON_KEY` + RLS for client-accessible endpoints
3. Never expose the service role key to the client

---

### SEC-H3: No Rate Limiting on API Endpoints

**File:** All `frontend/api/*/index.ts` files

**Evidence:** No rate limiting middleware in any of the three serverless functions.

**Risk:**
- `/api/seizures` and `/api/stats` can be hammered without authentication
- `/api/scrape` can be triggered repeatedly (though it has a cron secret check)
- No protection against denial-of-service or data scraping

**Fix:** Implement Vercel Edge Config or a rate limiting middleware.

---

## Medium Security Issues

### SEC-M1: Hardcoded Fallback Coordinates in Serverless Scraper

**File:** `frontend/api/scrape/index.ts:38-40`

**Evidence:**
```typescript
function roughGeocode(city: string): [number, number] {
  // Fallback: return center of India
  return [20.5937, 78.9625];
}
```

**Risk:**
- Unknown/misspelled cities silently return India's geographic center
- This could result in visually misleading map data
- Not a security issue per se, but a data integrity concern

---

### SEC-M2: No Input Validation on Query Parameters

**File:** `frontend/api/seizures/index.ts:28-35`

**Evidence:**
```typescript
const {
  time_period = 'all',
  drug_type,
  state,
  severity_min = '0',
  severity_max = '500',
  limit = '100',
} = req.query;
```

**Risk:**
- No validation that `limit` is within reasonable bounds
- `drug_type` and `state` are passed directly to Supabase without sanitization
- While Supabase client uses parameterized queries (safe from SQL injection), improper input could cause unexpected behavior

**Fix:** Add explicit validation for all query parameters.

---

### SEC-M3: Error Messages Expose Internal Details

**Files:** All `frontend/api/*/index.ts` files

**Evidence:**
```typescript
// scrape/index.ts:209
res.status(500).json({ error: err.message ?? 'Scrape job failed' });

// stats/index.ts:105
res.status(500).json({ error: 'Failed to fetch stats' });

// seizures/index.ts:88
res.status(500).json({ error: 'Failed to fetch seizures' });
```

**Risk:**
- `scrape/index.ts` exposes `err.message` to clients, potentially revealing:
  - Database connection strings
  - Internal API endpoints
  - Environment variable names
- The other two endpoints use generic messages, which is better

**Fix:** Return only generic error messages to clients. Log detailed errors server-side.

---

### SEC-M4: No HTTPS Enforcement for Internal Data Sources

**File:** `scripts/collect_data.py`

**Evidence:**
- RSS feeds use `https://` but GDELT uses `https://data.gdeltproject.org/`
- No certificate validation (see SEC-C2)

**Risk:** Data could be intercepted and modified in transit.

---

## Low Security Issues

### SEC-L1: Unused `feedparser` Import

**File:** `scripts/collect_data.py:26-29`

**Evidence:**
```python
try:
    import feedparser
    FEEDPARSER_AVAILABLE = True
except ImportError:
    FEEDPARSER_AVAILABLE = False
```

The `feedparser` module is imported but never used (lines 434-511 are dead code unreachable after `return seizures` at line 432).

---

### SEC-L2: Dead Code in `poll_rss_feeds`

**File:** `scripts/collect_data.py:434-511`

**Evidence:** The `feeds` list and the code to process it is unreachable — the function returns at line 432 before reaching this code.

---

## Summary

| ID | Severity | Issue | File |
|----|----------|-------|------|
| SEC-C1 | Critical | CORS `*` with Authorization header | frontend/api/scrape/index.ts |
| SEC-C2 | Critical | SSL verification disabled | scripts/collect_data.py |
| SEC-H1 | High | Permissive CORS `*` on read endpoints | frontend/api/stats,seizures/index.ts |
| SEC-H2 | High | Supabase SERVICE_ROLE key exposure risk | frontend/api/*/index.ts |
| SEC-H3 | High | No rate limiting | frontend/api/*/index.ts |
| SEC-M1 | Medium | Hardcoded fallback coordinates | frontend/api/scrape/index.ts |
| SEC-M2 | Medium | No input validation on query params | frontend/api/seizures/index.ts |
| SEC-M3 | Medium | Error messages expose internal details | frontend/api/scrape/index.ts |
| SEC-M4 | Medium | No HTTPS enforcement for data sources | scripts/collect_data.py |
| SEC-L1 | Low | Unused feedparser import | scripts/collect_data.py |
| SEC-L2 | Low | Dead code unreachable | scripts/collect_data.py |

---

## Recommendations

### Immediate (Critical)
1. Replace CORS wildcard `*` with explicit allowlist in `frontend/api/scrape/index.ts`
2. Remove all `verify=False` in `scripts/collect_data.py`

### Short-term (High)
3. Add rate limiting to all API endpoints
4. Verify SERVICE_ROLE key is not exposed to client-side code
5. Use generic error messages in all API responses

### Medium-term (Medium)
6. Add input validation for all query parameters
7. Implement proper error handling with server-side logging
8. Document SSL/TLS requirements for all external data sources
