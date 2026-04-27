# Narc Kart - Code Review Checklist

> Quality gates that ALL PRs must pass before merge.

---

##_general_

- [ ] **No hardcoded secrets or API keys** — Except in `.env`, `.env.example`, or `config/` files
- [ ] **Error handling on all async operations** — No naked `await` without try/catch or `.catch()`
- [ ] **No TODO comments left in code** — Use `FIXME:`, `HACK:`, or `NOTE:` with ticket reference
- [ ] **Consistent naming conventions** — Follow project style (snake_case for Python, camelCase for TS/JS)
- [ ] **No commented-out code** — Delete dead code; use version control to recover if needed
- [ ] **Logging in place** — Every important function/path should have appropriate log level
- [ ] **No debug print statements** — Use proper logging, remove `console.log` / `print()` used for debugging

---

## 🐍 Python (Backend)

- [ ] **Type hints on all function signatures** — Including return types
- [ ] **Docstrings on all functions** — At minimum: what it does, params, returns
- [ ] **PEP 8 compliant formatting** — Run `black` and `isort`; no violations
- [ ] **No global state** — Use dependency injection, app config objects, or class state
- [ ] **Connection pooling for database** — Reuse connections; no connection-per-request
- [ ] **Parameterized SQL queries** — Never use f-strings or string formatting for SQL
- [ ] **Rate limiting on external API calls** — Use `tenacity` or similar; respect backoff
- [ ] **Secrets via environment variables** — No hardcoded tokens, keys, or credentials
- [ ] **Exception handling is specific** — Catch precise exceptions, not bare `except:`
- [ ] **No raw `eval()` or `exec()`** — Strictly forbidden
- [ ] **File paths handled safely** — No path traversal vulnerabilities; use `pathlib`
- [ ] **Input sanitization** — Validate and sanitize all external input before use

---

## 🌐 TypeScript / React (Frontend)

- [ ] **Strict TypeScript** — No `any` types; use `unknown` and narrow properly
- [ ] **Props interfaces defined** — Every component has explicit `Props` interface
- [ ] **No inline styles** — Use CSS modules (`.module.css`) or styled-components
- [ ] **Components are functional** — No class components; use hooks only
- [ ] **Hooks properly used** — Rules of hooks followed; no conditional hook calls
- [ ] **No memory leaks in useEffect** — Always include cleanup function when needed
- [ ] **Map cleanup on unmount** — Leaflet maps, event listeners, intervals cleared
- [ ] **Lazy loading for routes/components** — Use `React.lazy()` + `Suspense` for heavy components
- [ ] **No API keys in frontend code** — All secret values come from env, proxied through backend
- [ ] **CORS properly configured** — Backend specifies exact allowed origins, not `*` in production
- [ ] **Input validation** — Client-side + server-side validation; never trust client data
- [ ] **XSS prevention** — No `dangerouslySetInnerHTML` without sanitization; use DOMPurify

---

## 🔒 Security (All)

- [ ] **No API keys in code** — Keys go in env vars / config files only
- [ ] **CORS configured** — Whitelist specific domains; no broad `*` in production
- [ ] **Input validation on all endpoints** — Validate types, ranges, formats, lengths
- [ ] **SQL injection prevention** — Parameterized queries everywhere; ORM preferred
- [ ] **XSS prevention** — Escape output; sanitize HTML content; CSP headers
- [ ] **Authentication tokens not logged** — Never log tokens, passwords, or secrets
- [ ] **Secure headers** — Use `helmet.js` or equivalent (HSTS, CSP, X-Frame-Options)
- [ ] **No secrets in git** — `git-secrets` / `detect-secrets` pre-commit hook passes
- [ ] **Dependency vulnerabilities** — `npm audit` / `safety check` pass with no high/critical issues

---

## 📦 Dependencies

- [ ] **Backend `requirements.txt` / `Pipfile` pinned** — Exact versions or tight ranges
- [ ] **Frontend `package.json` deps pinned** — Exact versions in production; ranges OK dev
- [ ] **No unnecessary packages** — Review added deps; remove unused ones
- [ ] **Lock files committed** — `requirements.lock`, `package-lock.json` or `yarn.lock`

---

## 🧪 Testing

- [ ] **Backend unit tests** — `pytest`; >80% coverage on business logic
- [ ] **Frontend unit tests** — Vitest or Jest; key components covered
- [ ] **Integration tests** — API endpoints tested end-to-end
- [ ] **No test skipped/failed in CI** — All green before merge

---

## 📐 Architecture

- [ ] **No circular imports** — Check with `pyflakes`, `eslint`
- [ ] **Configuration externalized** — No magic numbers; use named constants/config
- [ ] **Single responsibility** — Functions/components do one thing well
- [ ] **API responses consistent** — Same shape for same error types

---

## Reviewer Notes

> Checklist must be verified by at least 1 reviewer before merge.
> Flag any Security issues immediately — do not let them pass.