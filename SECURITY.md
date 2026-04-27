# Narc Kart Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Narc Kart, please report it privately to the maintainer.
Do NOT open a public GitHub issue for security vulnerabilities.

Email: [maintainer email]
GitHub Security: https://github.com/AayushBhat07/narc-kart/security/advisories/new

## Security Requirements

### Authentication & Authorization
- All API endpoints that handle sensitive data must require authentication
- Use environment variables for secrets, never hardcode credentials
- Implement rate limiting on all public endpoints

### Input Validation
- Sanitize all user inputs before database queries (use parameterized queries)
- Validate and restrict file uploads
- Never trust user-supplied filenames or paths

### CORS Policy
- Use explicit allowlist for CORS origins (no wildcard `*` in production)
- Credentials should only be sent to trusted origins

### Data Protection
- Never expose internal error messages or stack traces to clients
- Use HTTPS in production
- Store secrets in environment variables, not in code

### Dependencies
- Run `pip-audit` or `npm audit` regularly to check for known vulnerabilities
- Pin dependency versions where possible

### Container Security
- Do not run containers as root
- Use read-only file systems where possible
- Scan Docker images for CVEs before deployment