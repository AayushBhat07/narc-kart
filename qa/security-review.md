# Narc Kart - Security Review Template

> Use this template when reviewing any PR for security concerns.

---

## 1. API Key Handling

- [ ] No API keys, tokens, secrets, or credentials in source code
- [ ] Secrets stored in `.env` files (not committed), `.env.example` committed with placeholders
- [ ] Backend env vars accessed via `os.environ.get()` or proper secrets manager
- [ ] Frontend never receives raw secrets — proxied through backend or uses read-only keys
- [ ] No secrets logged (no `logging.info(f"token={token}")`)
- [ ] `.gitignore` excludes `.env`, `*.local.env`, `credentials.json`, `secrets.yml`
- [ ] Git history scanned — if a secret was accidentally committed, it must be rotated

### Common mistakes to flag:
- Google API key in frontend code
- Database password in source file
- Bearer token in JavaScript
- AWS credentials in environment variables committed to repo

---

## 2. Input Validation

- [ ] All HTTP request params validated before processing
- [ ] Type checking on all API inputs (integer, string, enum values)
- [ ] Length limits on string inputs (prevents DoS via huge payloads)
- [ ] Sanitization on free-text inputs (names, descriptions, addresses)
- [ ] SQL parameters are always parameterized (never string interpolation)
- [ ] File upload validation (type, size, name sanitization)
- [ ] URL/redirect validation if any redirect logic exists
- [ ] API rate limiting on all public endpoints

### Validation checklist per endpoint:
```
✓ Type correct (int is int, string is string)
✓ Range/size acceptable (max length, min/max value)
✓ Format matches expectation (email regex, date format)
✓ Enum values are from allowed set
✓ Sanitized for special characters
```

---

## 3. Database Security

- [ ] Connection pooling enabled (no per-request new connection)
- [ ] Database credentials in env vars, not hardcoded
- [ ] Parameterized queries everywhere — no string-concatenated SQL
- [ ] ORM used where possible (SQLAlchemy for Python)
- [ ] Least-privilege database user — app doesn't use root/admin
- [ ] No raw SQL in frontend (no dynamic query building on client)
- [ ] DB connection string doesn't get logged
- [ ] Backup strategy defined and tested

### SQL Injection patterns to catch:
```python
# BAD - SQL injection vulnerability
query = f"SELECT * FROM users WHERE id = {user_id}"

# GOOD - Parameterized
query = "SELECT * FROM users WHERE id = :id"
```

---

## 4. Frontend Security

- [ ] No API keys or secrets in frontend code
- [ ] CORS set to specific origins, not `*` in production
- [ ] XSS prevention: no `dangerouslySetInnerHTML` without DOMPurify
- [ ] Content Security Policy (CSP) headers configured
- [ ] `helmet` or equivalent middleware used
- [ ] No localStorage/sessionStorage for sensitive data (use httpOnly cookies)
- [ ] JWT tokens stored securely (httpOnly cookie, not localStorage)
- [ ] Clickjacking protection (`X-Frame-Options: DENY`)
- [ ] Input sanitization on any user-generated content displayed

### React-specific checks:
```tsx
// BAD - XSS vulnerability
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// GOOD - Sanitized
import DOMPurify from 'dompurify';
<div>{DOMPurify.sanitize(userInput)}</div>
```

---

## 5. Dependency Vulnerability Scanning

### Run before every major release:

**Python (Backend):**
```bash
# Check for known vulnerabilities
pip-audit

# Check for outdated packages with security implications
pip list --outdated | grep -i security

# Optional: use safety
safety check
```

**JavaScript/TypeScript (Frontend):**
```bash
# Audit dependencies
npm audit

# Check for outdated packages
npm outdated

# Optional: use Snyk or GitHub dependency scanning
npx snyk test
```

### Severity thresholds:
- **Critical/High** — Must fix before merge
- **Medium** — Must fix within 1 sprint
- **Low** — Document in PR, fix in next sprint

---

## 6. Authentication & Authorization

- [ ] Authentication required on all protected endpoints
- [ ] Authorization checked after authentication (user can access this resource)
- [ ] Role-based access control defined and enforced
- [ ] Session management secure (expiry, logout, token rotation)
- [ ] No IDOR (Insecure Direct Object Reference) — users can't access other users' data by changing IDs

---

## 7. Secure Communication

- [ ] HTTPS enforced in production (redirect HTTP → HTTPS)
- [ ] TLS 1.2+ required for external API calls
- [ ] No self-signed certificates in production
- [ ] Secure cookies set (`Secure`, `HttpOnly`, `SameSite`)

---

## 8. Security Review Sign-off

| Category | Status | Notes |
|---|---|---|
| API Key Handling | ✅ Pass / ❌ Fail | |
| Input Validation | ✅ Pass / ❌ Fail | |
| Database Security | ✅ Pass / ❌ Fail | |
| Frontend Security | ✅ Pass / ❌ Fail | |
| Dependency Scanning | ✅ Pass / ❌ Fail | |
| Auth & Authorization | ✅ Pass / ❌ Fail | |
| Secure Communication | ✅ Pass / ❌ Fail | |

**Overall:** ✅ APPROVED / ❌ BLOCKED

---

## Common Security Issues to Flag Immediately

1. Hardcoded passwords/API keys — **BLOCK**
2. SQL injection vector — **BLOCK**
3. XSS vulnerability — **BLOCK**
4. Authentication bypass — **BLOCK**
5. Sensitive data in logs — **BLOCK**
6. Unrestricted CORS — **BLOCK** (unless explicitly justified for public API)

---

Report security issues to maintainers immediately. Do not wait for next review cycle.