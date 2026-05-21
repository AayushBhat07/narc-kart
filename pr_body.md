## Summary

This PR fixes **4 critical/high severity security issues** identified in the Narc Kart codebase:

### 1. SQL Injection (CWE-89) — HIGH
**File:** `backend/database/queries.py`

The `get_seizures_filtered()` function used raw string interpolation in `ILIKE` clauses. Special characters like `%`, `_`, `\` in user input could manipulate LIKE patterns, allowing an attacker to craft inputs that extract more data than intended.

Fixed by adding a `_sanitize_for_ilike()` helper that escapes `%`, `_`, and `\` characters, and using SQLAlchemy's `escape="\\"` parameter.

### 2. CORS Wildcard Accepting All Origins (CWE-346) — HIGH
**File:** `backend/api/main.py`

The CORS middleware allowed `*` (all origins) combined with `allow_credentials=True`. Per the Fetch standard, browsers block credentials responses from wildcard origins — meaning the app was effectively ignoring CORS protection for authenticated requests.

Fixed with an explicit allowlist loaded from environment variables (`VERCEL_FRONTEND_URL`, `CLOUDFLARE_TUNNEL_URL`), with safe defaults for local development only.

### 3. Information Exposure Through Error Messages (CWE-209) — MEDIUM
**File:** `backend/api/main.py`

The catch-all exception handler leaked internal stack traces, exception types, and request bodies to clients — useful info for attackers probing the API.

Fixed to return a generic error message (`"An unexpected error occurred. Please try again later."`) in all cases.

### 4. Hardcoded `raids_this_week` Placeholder — LOW
**File:** `backend/database/queries.py`

Stats endpoint returned `raids_this_week: 12` as a static placeholder instead of querying the database.

Fixed with a real count of seizures in the last 7 days.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/database/queries.py` | LIKE pattern sanitization, real raids_this_week query |
| `backend/api/main.py` | CORS allowlist via env vars, generic error responses |
| `SECURITY.md` | New vulnerability disclosure & security requirements |

---

## Testing Checklist

- Filter queries accept special chars (`%`, `_`) without breaking or bypassing filters
- Unlisted CORS origins are rejected
- Error responses are generic with no internal details
- `raids_this_week` reflects actual DB count

---

## Disclosure Policy

Please report vulnerabilities at https://github.com/AayushBhat07/narc-kart/security/advisories/new — do not open public issues for security bugs.