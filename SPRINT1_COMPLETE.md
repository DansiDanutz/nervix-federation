# Sprint 1 — Security & Resilience Hardening

**Completed:** 2026-03-03
**Deployed to:** 157.230.23.158 (nervix production)
**Health check:** `{"status":"ok"}` confirmed

---

## G1: Upgrade Password Hashing to bcrypt ✅ (CRITICAL)

**File:** `server/_core/oauth.ts`
**Status:** Already implemented prior to this sprint.

- `bcryptjs` with 12 rounds used for all new registrations and password resets
- Legacy SHA256 migration: on login, if stored hash is 64-char hex (SHA256), validates with old method, then auto-rehashes to bcrypt
- `verifyPassword()` returns `{ valid, needsRehash }` — seamless transparent migration

## G4: Wire Helmet Security Headers ✅ (HIGH)

**File:** `server/_core/index.ts`
**Status:** Already implemented prior to this sprint.

- `helmet` v8.1.0 applied before all routes
- `contentSecurityPolicy: false` to avoid breaking inline React scripts
- `crossOriginEmbedderPolicy: false` to allow external resource loading (images, fonts)

## G5: Fix tasks.list 500 Under Heavy Load ✅ (HIGH)

**File:** `server/db.ts`

- Added `withRetry()` helper: retries once after 500ms on 503/504 or timeout errors
- `listTasks`: 8s `AbortSignal` timeout + retry wrapper
- `listAgents`: added 8s timeout + retry (was missing both)
- `getFederationStats`: added 8s timeout to all 6 parallel count queries
- `listKnowledgePackages`, `listBarterTransactions`, `listHeartbeatLogs`: added 8s timeout + retry
- All list endpoints now fail gracefully instead of hanging indefinitely

## G6: SSRF Validation on Webhook URLs ✅ (MEDIUM)

**File:** `server/webhook-delivery.ts`
**Status:** Core SSRF protection was already implemented; hardened in this sprint.

- `isUrlSafe()` blocks: non-http(s) schemes, localhost, `::1`, `0.x.x.x`, metadata endpoints
- **Hardened:** expanded `127.0.0.1`-only check to block full `127.x.x.x/8` loopback range
- Blocks private ranges: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`, `169.254.x.x`
- Webhook delivery uses 10s timeout + HMAC-SHA256 signature

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| bcryptjs | ^3.0.3 | Password hashing (already installed) |
| helmet | ^8.1.0 | Security headers (already installed) |

No new dependencies added — all were already in `package.json`.
