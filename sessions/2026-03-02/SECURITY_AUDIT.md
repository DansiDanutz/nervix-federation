# NERVIX Security Audit — 2026-03-02

## Summary
- **15 findings** across 4 severity levels
- Codebase: nervix-federation (server + client)
- Auditor: David (automated scan)

---

## CRITICAL (1)

### 1. `.env` secrets in repository
- **Location**: `.env` file tracked in git
- **Risk**: Database URLs, JWT secrets, API keys exposed in version history
- **Fix**: Add `.env` to `.gitignore`, rotate all secrets, use `git filter-branch` or BFG to purge history
- **Priority**: Immediate

---

## HIGH (3)

### 2. SHA256 password hashing (should use bcrypt/argon2)
- **Location**: `server/auth.ts`
- **Risk**: SHA256 is fast and GPU-crackable. Not suitable for password storage
- **Fix**: Migrate to `bcrypt` or `argon2id` with cost factor ≥12
- **Priority**: Before launch

### 3. Missing security headers
- **Location**: Server response headers
- **Risk**: XSS, clickjacking, MIME sniffing attacks
- **Fix**: Add `helmet` middleware or manual headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000`
  - `Content-Security-Policy` (basic policy)
  - `X-XSS-Protection: 0` (deprecated but harmless)

### 4. SameSite=None on session cookie
- **Location**: Cookie configuration
- **Risk**: CSRF attacks — cookies sent on cross-site requests
- **Fix**: Change to `SameSite=Lax` (or `Strict` if no cross-site auth needed)

---

## MEDIUM (6)

### 5. SQL injection via ilike pattern
- **Location**: Search/filter queries using user input in `ilike` patterns
- **Risk**: Pattern injection (wildcards `%`, `_`) — low severity but can leak data
- **Fix**: Escape special characters in user input before passing to `ilike`

### 6. Webhook URL SSRF risk
- **Location**: `server/webhook-delivery.ts`
- **Risk**: Agents can register internal IPs (169.254.x.x, 10.x.x.x, localhost) as webhook URLs
- **Fix**: Validate webhook URLs against SSRF blocklist before making requests

### 7. Error messages leak internals
- **Location**: Various tRPC procedures
- **Risk**: Stack traces and internal details in error responses
- **Fix**: Sanitize error messages in production — return generic errors, log details server-side

### 8. Authorization inconsistency
- **Location**: Some admin endpoints
- **Risk**: Inconsistent auth checks across procedures
- **Fix**: Audit all procedures, ensure consistent middleware-level auth

### 9. Rate limiter configuration
- **Location**: Rate limiting middleware
- **Risk**: Per-IP limiting can be bypassed with proxies; no per-user limiting
- **Fix**: Add per-user (token-based) rate limiting alongside IP-based

### 10. No request body size limit
- **Location**: Express/tRPC server config
- **Risk**: Large payload DoS
- **Fix**: Add `express.json({ limit: '1mb' })` or equivalent

---

## LOW (5)

### 11. JWT token expiry too long
- **Location**: Token generation in auth
- **Risk**: Compromised tokens valid for extended period
- **Fix**: Reduce access token TTL, implement refresh token rotation

### 12. No audit logging
- **Location**: Admin actions, economy transactions
- **Risk**: No trail for forensic analysis
- **Fix**: Log admin actions and sensitive operations to dedicated audit table

### 13. CORS configuration permissive
- **Location**: CORS middleware
- **Risk**: Any origin can make requests
- **Fix**: Restrict to `nervix.ai` and known development origins

### 14. Missing input length validation
- **Location**: Some Zod schemas
- **Risk**: Extremely long strings in name/description fields
- **Fix**: Add `.max()` constraints to all string inputs

### 15. Console.log in production
- **Location**: Throughout server code
- **Risk**: Information disclosure in logs, performance overhead
- **Fix**: Use structured logger (pino/winston), filter by log level in production

---

## Positives
- Zod validation on all tRPC inputs
- HMAC-SHA256 webhook signatures
- Rate limiting present (IP-based)
- httpOnly cookies for sessions
- Atomic database transactions via Supabase RPCs
- Ed25519 challenge-response enrollment (strong agent auth)

---

## Recommended Priority Order
1. Remove `.env` from git, rotate secrets
2. Add bcrypt password hashing
3. Add security headers (helmet)
4. Fix SameSite cookie
5. Add webhook URL SSRF validation
6. Sanitize error messages
7. Add body size limits
8. Everything else before scaling
