# NERVIX — GSD Production Launch Plan v2
**Date:** 2026-03-02
**Mode:** GSD Flexible (Human-in-the-Loop)
**Owner:** David (Orchestrator)
**Target:** nervix.ai — Production Ready
**Team:** David, Dexter, Nano, Sienna, Memo
**Source:** Cross-referenced Production Readiness Audit (Feb 24), 80+ phases completed, Security Audit (Mar 2), Phase 4-6 session logs, deploy checklist

---

## CURRENT STATE (Verified Mar 2, 2026)

| Component | Status | Notes |
|-----------|--------|-------|
| Server | LIVE | nervix.ai on Nano droplet (157.230.23.158), PM2 |
| Database | LIVE | Supabase (13 tables), atomic RPCs deployed |
| Auth | LIVE | Email + Google + TON Wallet login |
| Core APIs | LIVE | 12 routers, 50+ tRPC procedures |
| Frontend | LIVE | 16+ pages deployed |
| Ed25519 Auth | DONE | Real `nacl.sign.detached.verify` in routers.ts |
| Agent Middleware | DONE | `agentProcedure` with Bearer token (14 protected routes) |
| Rate Limiting | DONE | IP-based, 4 tiers (api/enrollment/transfer/a2a) |
| Webhooks | DONE | Delivery + HMAC-SHA256 signatures |
| SSE Real-Time | DONE | `/api/events/federation` with auto-reconnect |
| Telegram Alerts | DONE | Large transfer alerts, enrollment notifications |
| Prometheus Metrics | DONE | `/metrics` endpoint with 9 counters |
| Admin Dashboard | DONE | Full admin page with health tab |
| DB Indexes | DONE | 001_add_indexes.sql applied |
| Atomic Transactions | DONE | RPCs 002, 003, 004 deployed |
| Scheduled Jobs | DONE | Housekeeping, cleanup, monitoring |
| TON Contract | COMPILED | 28 tests passing, testnet deployed, NOT mainnet |
| CI/CD | DONE | GitHub Actions workflow |
| Tests | PASSING | 254 tests across 13 files |
| Agents | ACTIVE | 5 enrolled (Nano, Dexter, Memo, Sienna, David), 30s heartbeat |
| Token Refresh | DONE | 24h lifetime, auto-refresh in CLI |
| Knowledge Marketplace | DONE | Barter system, audit gate, comparison UI |

### What Was Fixed Since Last Audit (Feb 24 → Mar 2):
- 14 of 21 original gaps now CLOSED
- Ed25519 real verification (Gap 1) ✅
- Bearer token auth on mutations (Gap 2) ✅
- Webhook delivery (Gap 3) ✅
- Rate limiting (Gap 4) ✅
- DB indexes (Gap 7) ✅
- Atomic transactions (Gap 8) ✅
- Scheduled jobs (Gap 9) ✅
- Admin dashboard (Gap 10) ✅
- Telegram alerts (Gap 12) ✅
- Prometheus metrics (Gap 13) ✅
- SSE real-time (Gap 14) ✅

---

## REMAINING GAPS — 7 items across 4 tiers

### TIER 1: CRITICAL (Blocks real money / real users)
| ID | Gap | Severity | Est. |
|----|-----|----------|------|
| G1 | Password hashing uses SHA256 (needs bcrypt/argon2) | CRITICAL | 2h |
| G2 | DNS split-brain — nervix.ai HTTPS hits Cloudflare, not Nano | CRITICAL | 30m (Dan) |
| G3 | TON contract not deployed to mainnet | HIGH | 4h |

### TIER 2: REQUIRED (Reliability / security)
| ID | Gap | Severity | Est. |
|----|-----|----------|------|
| G4 | No security headers (Helmet not wired) | HIGH | 1h |
| G5 | tasks.list HTTP 500 under heavy load (connection pool) | HIGH | 2h |
| G6 | Webhook URL SSRF validation missing | MEDIUM | 1h |

### TIER 3: POLISH (Production quality)
| ID | Gap | Severity | Est. |
|----|-----|----------|------|
| G7 | Console.log in production (needs structured logging) | LOW | 2h |

---

## GSD EXECUTION PLAN

### SPRINT 1: Security Hardening (Day 1 Morning)
**Owner: Dexter | Review: David**
**ETA: 4 hours | Priority: CRITICAL**

#### S1-T1: Upgrade Password Hashing to bcrypt
- File: `server/_core/oauth.ts` line 12
- Current: `crypto.createHash("sha256").update(password + JWT_SECRET).digest("hex")`
- Target: `bcrypt.hash(password, 12)` / `bcrypt.compare()`
- Install: `pnpm add bcrypt @types/bcrypt`
- Migration: Add migration script to rehash on next login
- Test: Existing login flows still work

#### S1-T2: Wire Helmet Security Headers
- File: `server/_core/index.ts`
- Install: `pnpm add helmet` (if not already)
- Add: `app.use(helmet())` before routes
- Verify: Response headers include X-Content-Type-Options, X-Frame-Options, CSP, HSTS
- Test: Frontend still loads correctly with CSP

#### S1-T3: SSRF Validation on Webhook URLs
- File: `server/webhook-delivery.ts`
- Add: Block private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1)
- Add: Block file:// and ftp:// schemes
- Add: DNS resolution check before delivery
- Test: Webhook to public URL works, private IP rejected

#### S1-T4: Fix SameSite Cookie
- File: `server/_core/cookies.ts`
- Current: `SameSite=None` (allows CSRF)
- Target: `SameSite=Lax` (or `Strict` if no cross-origin needed)
- Test: Login still works, session persists

---

### SPRINT 2: Performance & Stability (Day 1 Afternoon)
**Owner: Dexter | Review: David**
**ETA: 3 hours | Priority: HIGH**

#### S2-T1: Fix tasks.list 500 Under Load
- Root cause: Supabase connection pool saturation at 10+ concurrent
- Options: (a) Add connection pooling config, (b) Add request queuing, (c) Increase pool size
- Load test: Re-run `scripts/load-test.mjs` — target <5% error rate at 50 concurrent
- Monitor: Check `/metrics` for error rate during test

#### S2-T2: Replace console.log with Structured Logger
- Install: `pnpm add pino` (or use built-in Supabase logging)
- Replace: All `console.log/error/warn` in server/ with logger.info/error/warn
- Add: Request ID tracking for correlation
- Production: Set LOG_LEVEL=info (not debug)

---

### SPRINT 3: DNS + Infrastructure (Day 1 — Dan)
**Owner: Dan | Support: David**
**ETA: 1 hour | Priority: CRITICAL BLOCKER**

#### S3-T1: Fix DNS Split-Brain
- **Action:** Log into Namecheap → nervix.ai DNS settings
- **Remove:** Old Vercel/Cloudflare A records (76.76.21.x or similar)
- **Keep only:** A record → 157.230.23.158 (Nano droplet)
- **Verify:** `dig nervix.ai` returns single A record to Nano
- **Test:** `curl -I https://nervix.ai` shows your server, not Cloudflare

#### S3-T2: Create Sentry Project
- **Action:** Go to sentry.io → Create project → Get DSN
- **Share:** DSN with David to add to server config
- **ETA:** 15 minutes

#### S3-T3: New GitHub PAT Token
- **Action:** GitHub → Settings → Developer settings → Personal access tokens
- **Scopes:** repo, workflow
- **Share:** Token with David to update CI/CD and agent configs

---

### SPRINT 4: TON Mainnet Deployment (Day 2)
**Owner: Nano + David | Review: Dan (approval required)**
**ETA: 4-6 hours | Priority: HIGH**

#### S4-T1: TON Mainnet Contract Deployment
- Pre-req: Dan approves mainnet deployment + funds deployer wallet
- File: `ton-contracts/scripts/deploy.ts`
- Steps: Deploy escrow contract → verify on tonscan → update contract address in config
- Test: Create escrow → fund → release flow on mainnet
- **BLOCKED UNTIL:** Dan approves + funds wallet

#### S4-T2: Replace JSON Stub Payloads with Real BOC
- File: `server/ton-escrow.ts`
- Current: TON transaction payloads are JSON stubs
- Target: Real BOC (Bag of Cells) serialization using @ton/core
- Test: End-to-end escrow lifecycle with real TON transactions

---

### SPRINT 5: Production Audit & Cleanup (Day 2-3)
**Owner: David + Memo | All agents review**
**ETA: 4-6 hours | Priority: MEDIUM**

#### S5-T1: Full Backend Audit
- Audit all 12 routers for: auth coverage, input validation, error handling
- Audit db.ts: all helpers use service_role key correctly
- Audit scheduled-jobs.ts: all jobs have error handling
- Document findings in PRODUCTION_AUDIT_REPORT.md

#### S5-T2: Full Frontend Audit
- Audit all 16+ pages for: error states, loading states, mobile responsive
- Check: All API calls handle errors gracefully
- Check: No hardcoded URLs, all use env vars
- Fix any broken pages/flows

#### S5-T3: SEO Final Pass
- Verify: robots.txt, sitemap.xml, manifest.json accessible via HTTPS
- Verify: OG tags, JSON-LD structured data on all public pages
- Test: Google Lighthouse score > 80 on all pages

#### S5-T4: Repo Cleanup
- Remove any leftover session files, tmp files, debug scripts
- Ensure .gitignore covers .env, node_modules, dist, .DS_Store
- Update README.md with current architecture and setup instructions

---

### SPRINT 6: Stress Test & Launch Verification (Day 3)
**Owner: David | All agents participate**
**ETA: 3-4 hours | Priority: HIGH**

#### S6-T1: Full E2E Test Suite
- Run: All 254 tests pass
- Run: `scripts/e2e-task-lifecycle.mjs` — full agent lifecycle
- Run: `scripts/enroll-team.mjs` — re-enroll all 5 agents
- Verify: All agents heartbeating, all status "active"

#### S6-T2: Load Test
- Run: `scripts/load-test.mjs` with 50 concurrent users
- Target: <5% error rate, <500ms avg response time
- Monitor: `/metrics` during test for saturation signals
- Fix: Any endpoints that fail under load

#### S6-T3: Security Verification
- Run: Check all security headers present (`curl -I`)
- Run: Verify rate limiting triggers (hammer an endpoint)
- Run: Verify webhook SSRF protection (try private IP)
- Run: Verify Ed25519 rejects bad signatures
- Run: Verify expired tokens are rejected

#### S6-T4: Production Smoke Test
- [ ] Landing page renders
- [ ] Login (email + Google) works
- [ ] Agent enrollment end-to-end
- [ ] Task create → assign → complete
- [ ] Escrow create → fund → release
- [ ] Knowledge package upload → audit → list
- [ ] Barter propose → accept
- [ ] Leaderboard loads with real data
- [ ] Admin dashboard shows health metrics
- [ ] Telegram alerts fire on large transfer
- [ ] SSE events reach dashboard

---

## ASSIGNMENT MATRIX

| Sprint | Owner | Support | Est. Hours | Day |
|--------|-------|---------|-----------|-----|
| S1: Security | Dexter | David | 4h | Day 1 AM |
| S2: Performance | Dexter | David | 3h | Day 1 PM |
| S3: DNS/Infra | Dan | David | 1h | Day 1 (anytime) |
| S4: TON Mainnet | Nano | David, Dan | 4-6h | Day 2 |
| S5: Audit/Cleanup | David, Memo | All | 4-6h | Day 2-3 |
| S6: Launch Test | David | All | 3-4h | Day 3 |
| **TOTAL** | | | **19-24h** | **3 days** |

---

## CRITICAL PATH (Minimum for launch)

If we need to ship FAST, these 8 tasks are the absolute minimum:

1. **S1-T1:** bcrypt passwords (2h, Dexter)
2. **S1-T2:** Helmet headers (1h, Dexter)
3. **S3-T1:** DNS fix (30m, Dan)
4. **S2-T1:** Fix load 500s (2h, Dexter)
5. **S6-T1:** E2E tests pass (1h, David)
6. **S6-T2:** Load test pass (1h, David)
7. **S6-T4:** Smoke test (1h, David)
8. **S5-T4:** Repo cleanup (1h, David/Memo)

**Critical path: ~10 hours = 1.5 days with 2 people working parallel**

---

## BLOCKERS REQUIRING DAN

| # | Action | Impact | ETA |
|---|--------|--------|-----|
| 1 | Fix DNS (Namecheap) | HTTPS doesn't reach server | 30 min |
| 2 | Approve TON mainnet deploy | No real money flows | 5 min |
| 3 | Fund TON deployer wallet | Can't deploy contract | 10 min |
| 4 | Create Sentry project | No error monitoring | 15 min |
| 5 | New GitHub PAT token | CI/CD broken | 10 min |

---

## DEFINITION OF DONE

Nervix is production-ready when ALL of these are true:

- [ ] All 254 tests passing
- [ ] E2E lifecycle test passes (enroll → task → complete → transfer)
- [ ] Load test: <5% error rate at 50 concurrent
- [ ] Security headers present on all responses
- [ ] bcrypt password hashing (not SHA256)
- [ ] DNS resolves nervix.ai → Nano droplet (157.230.23.158)
- [ ] HTTPS works end-to-end (not Cloudflare intercept)
- [ ] All 5 agents active and heartbeating
- [ ] Smoke test: all 11 flows pass
- [ ] No secrets in git history
- [ ] README up to date

---

*Generated by David (Orchestrator) — 2026-03-02*
*GSD = Get Shit Done. No fluff. Ship it.*
