---
description: Validator — audit backend and frontend code against OWASP Top 10 and secure coding practices.
user-invocable: false
---
# /project:validate-security

## Type
Validator — checks security practices across backend and frontend code.

## Purpose
Audit code for common security vulnerabilities based on OWASP Top 10 and secure coding practices. Run after implementation, before deployment.

## When to Invoke
- During Stage 14 (Validate Backend)
- During Stage 24 (Validate Frontend)
- Anytime you want a security review of implemented code

## Instructions

### 1. Injection
- [ ] **SQL Injection**: All database queries use parameterized queries or ORM — no string concatenation in SQL
- [ ] **Command Injection**: No user input passed to shell execution functions (e.g., `exec`, `spawn`, `system`, `subprocess`, `os.popen`)
- [ ] **NoSQL Injection**: Query operators not exposed to user input
- [ ] **LDAP / XPath Injection**: User input sanitized before use in queries

### 2. Broken Authentication
- [ ] **Password Storage**: Passwords hashed with bcrypt/argon2/scrypt — never plaintext or weak hash (MD5, SHA1)
- [ ] **Session Management**: Sessions expire, tokens are rotated, logout invalidates tokens
- [ ] **Brute Force Protection**: Rate limiting or account lockout on login endpoints
- [ ] **JWT Security**: Tokens have expiry, secrets are not hardcoded, algorithm is not `none`

### 3. Broken Access Control
- [ ] **Authorization Checks**: Every endpoint verifies the user has permission to access the resource
- [ ] **IDOR**: Object references validated against the authenticated user (no `/api/users/123` accessible by user 456)
- [ ] **Privilege Escalation**: Role checks at service layer, not just UI — admin endpoints enforce admin role
- [ ] **CORS**: Allowed origins are explicit — no `Access-Control-Allow-Origin: *` in production

### 4. Cross-Site Scripting (XSS)
- [ ] **Output Encoding**: User-generated content is escaped before rendering in HTML
- [ ] **Stored XSS**: Data from database is sanitized before display
- [ ] **DOM XSS**: No unsafe HTML injection (e.g., `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, or equivalent) with user input
- [ ] **Content Security Policy**: CSP headers configured to prevent inline scripts

### 5. Cross-Site Request Forgery (CSRF)
- [ ] **CSRF Tokens**: State-changing operations require CSRF token or use SameSite cookies
- [ ] **SameSite Cookies**: Session cookies use `SameSite=Strict` or `SameSite=Lax`

### 6. Sensitive Data Exposure
- [ ] **No Secrets in Code**: No API keys, passwords, or tokens hardcoded — use environment variables
- [ ] **No Secrets in Logs**: PII, tokens, passwords not logged
- [ ] **HTTPS**: All API endpoints enforce HTTPS in production
- [ ] **Error Messages**: Errors don't leak stack traces, SQL queries, or internal paths to users
- [ ] **Response Headers**: Security headers set (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security)

### 7. Mass Assignment
- [ ] **Input Whitelisting**: API endpoints explicitly pick allowed fields — no direct object spread from request body to database
- [ ] **DTO Validation**: Request DTOs define exact expected shape — extra fields are rejected or ignored

### 8. Race Conditions
- [ ] **Database Transactions**: Concurrent writes use transactions with appropriate isolation level
- [ ] **Optimistic Locking**: Entities that can be concurrently modified use version/timestamp checks
- [ ] **Idempotency**: Critical operations (payments, state changes) are idempotent — duplicate requests don't cause double-processing
- [ ] **TOCTOU**: No time-of-check to time-of-use gaps (check and action happen atomically)

### 9. Rate Limiting & DoS
- [ ] **Rate Limiting**: Public endpoints have rate limits configured
- [ ] **Request Size**: File uploads and request bodies have size limits
- [ ] **Pagination**: List endpoints enforce pagination — no unbounded queries

### 10. Dependency Security
- [ ] **Known Vulnerabilities**: No dependencies with known critical CVEs (use the project's dependency audit tool)
- [ ] **Lockfile**: Dependencies pinned with a lockfile
- [ ] **Minimal Dependencies**: No unnecessary dependencies that expand attack surface

### Scoring
For each category, rate: PASS / NEEDS_IMPROVEMENT / FAIL
- **PASS**: All checks satisfied
- **NEEDS_IMPROVEMENT**: Minor issues, can proceed but should fix
- **FAIL**: Must fix before proceeding — security vulnerabilities block deployment

## Output Format
```markdown
# Security Validation Report

## Summary
| Category | Status | Issues |
|----------|--------|--------|
| Injection | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |
| Broken Authentication | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |
| Broken Access Control | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |
| XSS | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |
| CSRF | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |
| Sensitive Data | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |
| Mass Assignment | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |
| Race Conditions | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |
| Rate Limiting & DoS | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |
| Dependency Security | PASS/NEEDS_IMPROVEMENT/FAIL | N issues |

## Overall Security Readiness: PASS / NOT READY

## Issues (detailed)
### {category}
- **{check}** — {description} at `{file}:{line}` — Fix: {suggested fix}

## Fixes Applied
- {description of fix applied during this validation}
```

### Fix Guidelines
- Injection → parameterize queries, sanitize input
- Auth → hash passwords, add rate limiting, validate tokens
- Access Control → add authorization middleware, validate ownership
- XSS → escape output, use CSP, avoid innerHTML
- CSRF → add CSRF tokens or SameSite cookies
- Secrets → move to env vars, scrub logs
- Mass Assignment → use DTOs with explicit field picks
- Race Conditions → add transactions, optimistic locking, idempotency keys
- Rate Limiting → add middleware with sensible limits
- Dependencies → update or replace vulnerable packages
