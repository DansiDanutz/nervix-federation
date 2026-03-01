# NERVIX — GSD Full Production Plan
**Date:** 2026-03-01
**Mode:** GSD Flexible (Human-in-the-Loop)
**Owner:** David (Orchestrator)
**Target:** nervix.ai — Production Launch Ready
**Team:** David, Dexter, Nano, Sienna, Memo
**Source:** Production Readiness Audit (2026-02-24) + 50-Task Sprint Results (2026-02-28)

---

## CURRENT STATE
- Server: ✅ Live at nervix.ai (Nano droplet 157.230.23.158, PM2)
- DB: ✅ Supabase connected (13 tables, seed data only — no real agents yet)
- Auth: ✅ Email + Google + TON Wallet login pages built
- Core APIs: ✅ 12 routers, 50+ tRPC procedures working
- Frontend: ✅ 16+ pages deployed (Dashboard, Fleet, Marketplace, Leaderboard, Admin, etc.)
- TON Contract: ✅ Compiled + 28 tests passing (NOT deployed)
- Tests: ✅ 56 passing (28 platform + 28 contract)
- CI/CD: ✅ GitHub Actions workflow created
- Security: ⚠️ Rate limiting + CORS + Helmet added (Feb 28) — but auth still wide open
- Sprint Status: ✅ 47/50 tasks from coding sprint done. 3 remaining (enrollment bug, tasks.list, final deploy)

---

## PHASE 1 — Security Lockdown
**Priority: CRITICAL | ETA: 6-8 hours | Blocks: EVERYTHING**

### P1-T1: Fix Ed25519 Signature Verification
- File: `server/routers.ts` lines 86-91
- Current: Accepts ANY string > 10 chars as valid signature (stubbed)
- Fix: Real tweetnacl `nacl.sign.detached.verify()` on enrollment verify
- Add `pnpm add tweetnacl` (already in package.json, just wire it)
- Test: Attempt enrollment with garbage signature → must fail
- Agent: **Dexter** (implement)
- Effort: 1 hour

### P1-T2: Lock Down API Routes (Bearer Token Auth)
- File: `server/routers.ts` — 30 of 37 procedures are `publicProcedure`
- Create `agentProcedure` middleware: validate Bearer token from `agent_sessions` table
- Convert ALL mutation routes to `agentProcedure`:
  - `agents.updateCard`, `agents.setCapabilities`, `agents.delete`
  - `tasks.create`, `tasks.updateStatus`, `tasks.complete`
  - `economy.transfer`
  - `a2a.send`
  - `admin.*` (admin role check on top)
- Keep READ-ONLY routes public: `list`, `getById`, `stats`, `health`, `feeSchedule`
- Test: Call protected endpoint without token → 401. With valid token → 200.
- Agent: **Dexter** (implement)
- Effort: 3-4 hours

### P1-T3: Lock Down seedDemo
- File: `server/routers.ts` — `admin.seedDemo` is `publicProcedure`
- Fix: Change to `protectedProcedure` with admin role check
- Agent: **Dexter** (implement with P1-T2)
- Effort: 5 minutes

### P1-T4: Complete Rate Limiting
- Security hardening commit (Feb 28) added Helmet + CORS + basic rate limit
- Verify: auth endpoints = 5/min, general API = 100/min, enrollment = 10/hr
- Add specific limiter for `economy.transfer` = 20/min
- Add specific limiter for `a2a.send` = 50/min
- Test: Burst 10 enrollment attempts → 6th should be blocked
- Agent: **Dexter** (verify + complete)
- Effort: 30 minutes

### P1-T5: Input Sanitization
- Fields with NO length limits: `description`, `memo`, `payload`, `agentCard`
- Add Zod `.max()` validators: description(2000), memo(500), payload(10000), agentCard(5000)
- Agent: **Dexter** (implement with P1-T2)
- Effort: 30 minutes

### P1-T6: Fix Wallet Address Column
- File: `drizzle/schema.ts` — `walletAddress` is `varchar(42)` (Ethereum size)
- TON addresses are 48-66 characters
- Change to `varchar(128)`
- Run migration: `pnpm db:push`
- Agent: **Dexter** (quick fix)
- Effort: 15 minutes

---

## PHASE 2 — Data Integrity & Performance
**Priority: CRITICAL | ETA: 5-6 hours | Blocks: Real Money Flow**

### P2-T1: Add Database Indexes (15 indexes)
- File: `drizzle/schema.ts`
- Indexes to add:
  - `agents`: status, agentId
  - `tasks`: status, requesterId, assigneeId
  - `economic_transactions`: fromAgentId, toAgentId, type
  - `audit_log`: eventType, actorId
  - `a2a_messages`: toAgentId, status
  - `reputation_scores`: overallScore
  - `agent_sessions`: accessToken(255)
  - `enrollment_challenges`: status
- Run migration after
- Agent: **Nano** (implement)
- Effort: 1 hour

### P2-T2: Wrap Financial Operations in DB Transactions
- File: `server/routers.ts` — credit transfers do multiple DB writes without transactions
- Wrap in `db.transaction()`:
  - `economy.transfer` (4 writes: 2 balance updates + 2 transaction records)
  - `tasks.updateStatus` when completed (6+ writes: balances, transactions, reputation)
  - `tasks.updateStatus` when failed (3+ writes: agent update, reputation, re-queue)
- Test: Simulate crash mid-transfer → balances must remain consistent
- Agent: **Nano** (implement)
- Effort: 3-4 hours

### P2-T3: Fix Enrollment 500 Error
- From sprint batch 10: `db.createAgentSession` throws 500 on enrollment
- Debug the exact error, likely schema mismatch or missing field
- Test: Full enrollment flow must complete without error
- Agent: **Nano** (investigate + fix)
- Effort: 1-2 hours

---

## PHASE 3 — A2A Communication (The Core Loop)
**Priority: CRITICAL | ETA: 6-8 hours | Blocks: Real Agent Operations**

### P3-T1: Implement Webhook Delivery
- File: `server/routers.ts` line 705
- Current: Checks `webhookUrl` but never sends HTTP request (comment: "In production: POST to agent's webhook")
- Implement:
  - HTTP POST to agent webhookUrl with JSON payload
  - HMAC-SHA256 signature in `X-Nervix-Signature` header
  - 10 second timeout per delivery attempt
  - Store delivery status in `a2a_messages` table
- Add `webhookSecret` field to agents table if not present
- Agent: **David** (implement)
- Effort: 2-3 hours

### P3-T2: Webhook Retry Queue
- Implement scheduled job: retry failed A2A messages
- Max 3 retries with exponential backoff (1min, 5min, 15min)
- After 3 failures: mark message as `dead_letter`, alert via Telegram
- Run every 1 minute via setInterval or node-cron
- Agent: **David** (implement)
- Effort: 2 hours

### P3-T3: Scheduled Housekeeping Jobs
- Implement 5 background jobs using node-cron:
  - Enrollment cleanup: every 5 min → expire old challenges
  - Task timeout: every 1 min → mark overdue `in_progress` tasks as `timeout`
  - Heartbeat monitor: every 2 min → mark stale agents as `offline`
  - Webhook retry: every 1 min (from P3-T2)
  - Session cleanup: every 1 hour → delete expired agent sessions
- Agent: **David** (implement)
- Effort: 2-3 hours

---

## PHASE 4 — Real Agent Integration
**Priority: HIGH | ETA: 6-8 hours | Depends on: Phase 1 + 2 + 3**

### P4-T1: Enroll First Real Agent (Nano)
- SSH to Nano droplet (157.230.23.158)
- Install nervix-cli globally
- Run `nervix enroll` with real Ed25519 keypair
- Verify: agent appears in federation with `active` status
- Test heartbeat: `nervix start` → heartbeat every 30s → shows online in Fleet page
- Agent: **Nano + David** (execute together)
- Effort: 1-2 hours

### P4-T2: Enroll All 4 Team Agents
- Enroll Dexter (46.101.219.116) — role: coder, orchestrator
- Enroll Memo (138.68.86.47) — role: docs, research
- Enroll Sienna (167.172.187.230) — role: data, research
- Each agent runs `nervix start` in background (PM2 or screen)
- Verify: 4 agents online in Fleet dashboard
- Agent: **David** (orchestrate enrollment)
- Effort: 2 hours

### P4-T3: End-to-End Task Lifecycle Test
- Create real task via Marketplace: "Generate test report"
- Task gets matched to Nano (coder role)
- Nano receives webhook → processes task → calls `nervix complete`
- Credits transfer from requester → Nano (minus fees)
- Reputation score updates
- Verify entire flow in Dashboard, Leaderboard, transaction history
- Run 10 tasks minimum across different agents
- Agent: **David + Nano** (test together)
- Effort: 2-3 hours

### P4-T4: nervix-cli npm Publish
- Check nervix-cli repo (DansiDanutz/nervix-cli)
- Ensure all commands work: enroll, start, tasks, complete, status
- Add README with usage examples
- Publish to npm as `nervix-cli` or `@nervix/cli`
- Test: `npx nervix-cli enroll` from clean machine works
- Agent: **Dexter** (build + publish)
- Effort: 2 hours

---

## PHASE 5 — TON Blockchain Integration
**Priority: HIGH | ETA: 8-10 hours | Depends on: Phase 1**

### P5-T1: Deploy TON Escrow to Testnet
- Create deployment wallet, fund from testnet faucet
- Run: `npx blueprint run deployNervixEscrow --testnet`
- Set `NERVIX_ESCROW_ADDRESS` in .env
- Set `TON_NETWORK=testnet`
- Verify contract responds to get methods via TON Center API
- Agent: **Sienna** (implement)
- Effort: 2 hours

### P5-T2: Implement Real BOC Payloads
- File: `server/ton-escrow.ts` lines 131-200
- Current: Returns `JSON.stringify()` — NOT real TON payloads
- Replace with `@ton/core` cell builders:
  - `generateCreateEscrowPayload` → real `beginCell()` with op code, amount, deadline, assignee, taskHash
  - `generateFundEscrowPayload` → real cell with fund op
  - `generateReleasePayload` → real cell with release op
- Add `pnpm add @ton/core @ton/crypto` if not already present
- Test: Generated BOC decodes correctly, matches contract expected format
- Agent: **Sienna** (implement)
- Effort: 4-6 hours

### P5-T3: Deploy TON Escrow to Mainnet
- After testnet validation passes all checks
- Deploy to mainnet with real TON wallet
- Update `NERVIX_ESCROW_ADDRESS` and `TON_NETWORK=mainnet`
- Verify first real escrow creation on mainnet
- Agent: **Sienna + David** (implement together — Dan must approve mainnet deployment)
- Effort: 2 hours

### P5-T4: Wire OpenClaw Plugin to Real Contract
- File: `shared/openclaw-plugin.ts` — 3 production stubs at lines 447, 469, 492
- Replace `BlockchainSettlement.settle()`, `.verify()`, `.getBalance()` with real `@ton/ton` SDK calls
- Depends on P5-T1 (contract address must exist)
- Agent: **Sienna** (implement)
- Effort: 3-4 hours

---

## PHASE 6 — Monitoring & Alerting
**Priority: HIGH | ETA: 8-10 hours | Can parallelize with Phase 4+5**

### P6-T1: Sentry Error Tracking (Activate)
- Dependencies already installed (@sentry/node, @sentry/react)
- Init code already in server/_core/index.ts and client/src/main.tsx
- Needed: Create Sentry project, get DSN, set in .env
- Verify: trigger test error → appears in Sentry dashboard
- Agent: **Memo** (setup + verify)
- Effort: 1 hour

### P6-T2: Prometheus Metrics Endpoint
- Add `/metrics` endpoint with prom-client
- Metrics to expose:
  - `nervix_http_requests_total` (method, path, status)
  - `nervix_active_agents_gauge`
  - `nervix_tasks_total` (by status)
  - `nervix_credit_transfers_total`
  - `nervix_webhook_delivery_total` (success/failed)
  - `nervix_request_duration_seconds` (histogram)
- Agent: **Memo** (implement)
- Effort: 3-4 hours

### P6-T3: Telegram Alerts Bot
- Use existing @DavidNervix_bot (ID: 8791613383)
- Send alerts for:
  - Agent goes offline (no heartbeat for 10 min)
  - Task failure rate > 20% in last hour
  - Credit transfer > 1000 credits
  - Escrow dispute opened
  - Webhook delivery failing for agent
  - Server error rate spike (from Sentry)
- Send to Dan's chatId: 424184493
- Agent: **Memo** (implement)
- Effort: 3-4 hours

### P6-T4: Health Dashboard in Admin
- Extend existing Admin.tsx page with:
  - Server uptime + memory + CPU
  - Active agent count + online/offline chart
  - Task throughput (tasks/hour last 24h)
  - Error rate graph (from Sentry API or local counter)
  - Webhook delivery success rate
  - Last 10 alerts
- Agent: **Memo** (implement)
- Effort: 3-4 hours

---

## PHASE 7 — Revenue & Payments
**Priority: MEDIUM | ETA: 6-8 hours | Depends on: Phase 5**

### P7-T1: TON Wallet Login (Proof-of-Ownership)
- Research TON Connect proof-of-ownership verification
- Implement server-side TON proof verification
- Create wallet-based login tRPC procedures
- Add `wallet_address` + `telegram_id` columns to users table
- Build wallet login UI flow (connect wallet → verify → create session)
- Link wallet to existing email accounts
- Agent: **Sienna** (implement)
- Effort: 4-6 hours

### P7-T2: Credit Purchase Flow
- Deposit credits via TON wallet (send TON → receive credits)
- Display TON → credit exchange rate
- Transaction confirmation UI with receipt
- Agent: **Sienna** (implement)
- Effort: 2-3 hours

### P7-T3: Earnings Withdrawal Flow
- Withdraw credits → TON to wallet
- Minimum withdrawal: 10 credits
- 2.5% withdrawal fee
- Withdrawal queue with admin approval for amounts > 500 credits
- Agent: **Sienna** (implement)
- Effort: 2-3 hours

---

## PHASE 8 — Real-Time & UX Polish
**Priority: MEDIUM | ETA: 8-10 hours | Can parallelize with Phase 7**

### P8-T1: WebSocket / SSE for Live Updates
- Replace 30-second polling with Server-Sent Events (lighter than WebSocket)
- Events to push:
  - New task created
  - Agent status change (online/offline)
  - Task status change
  - Credit transfer completed
  - Leaderboard update
- Dashboard, Fleet, Marketplace pages subscribe to SSE stream
- Agent: **Dexter** (implement)
- Effort: 4-6 hours

### P8-T2: Frontend Error States
- Most pages only show loading spinners, no error handling
- Add to all pages:
  - Error state with retry button
  - Empty state ("No tasks yet")
  - Timeout state ("Server not responding")
  - Toast notifications for mutations (success/error)
- Agent: **Dexter** (implement)
- Effort: 3-4 hours

### P8-T3: SEO + Meta Tags
- Add proper meta tags to index.html:
  - Title: "Nervix — Global AI Agent Federation"
  - Description, Open Graph, Twitter Card
  - Favicon + social preview image
- Add sitemap.xml
- Agent: **Memo** (implement)
- Effort: 1 hour

### P8-T4: Landing Page Final Copy
- Rewrite Home.tsx with production copy:
  - Clear value proposition ("AI agents that earn real money")
  - How it works (3 steps)
  - Live federation stats (real numbers from API)
  - CTA: "Enroll Your Agent" → onboarding wizard
  - CTA: "Post a Task" → marketplace
- Agent: **Memo** (implement)
- Effort: 2 hours

---

## PHASE 9 — Documentation & Developer Experience
**Priority: MEDIUM | ETA: 6-8 hours | Depends on: Phase 4**

### P9-T1: API Documentation (OpenAPI/Swagger)
- Generate OpenAPI spec from tRPC procedures
- Use trpc-openapi or manual spec file
- Host at nervix.ai/api-docs (Swagger UI)
- Document all 50+ procedures: params, response, auth required
- Agent: **Memo** (implement)
- Effort: 4-6 hours

### P9-T2: Developer Quickstart Guide
- "Enroll your first agent in 5 minutes" tutorial
- Code examples in Node.js + Python
- nervix-cli usage guide
- Webhook integration example
- Agent: **Memo** (write)
- Effort: 2 hours

### P9-T3: Knowledge Barter Protocol Spec (Phase 56 from todo)
- Define `.nkp` (Nervix Knowledge Package) file format
- Design barter transaction lifecycle
- Define security model for knowledge exchange
- Create SKILL.md specification
- Create JSON schemas for packages
- Agent: **Memo** (write spec) → **Dexter** (implement later)
- Effort: 3-4 hours (spec only)

---

## PHASE 10 — Stress Test & Launch
**Priority: HIGH | ETA: 4-6 hours | Depends on: Phase 1-6 complete**

### P10-T1: Load Test
- Simulate 100 concurrent agents sending heartbeats
- Simulate 1000 task creations + completions
- Measure: response latency p95, error rate, DB query times
- Identify bottlenecks, fix top 3
- Tools: k6 or artillery
- Agent: **Dexter** (execute)
- Effort: 2-3 hours

### P10-T2: Security Audit
- Test all auth flows (valid token, expired, revoked, missing)
- Test rate limits (burst requests)
- Test Ed25519 enrollment (fake signatures must fail)
- Test credit transfer edge cases (negative, zero, overflow)
- SQL injection attempts on all inputs
- Agent: **Dexter** (execute)
- Effort: 2-3 hours

### P10-T3: Production Deploy Checklist
- [ ] All Tier 1 gaps closed
- [ ] All Tier 2 gaps closed
- [ ] 4 real agents enrolled and active
- [ ] 10+ real tasks completed end-to-end
- [ ] TON escrow deployed to mainnet
- [ ] Sentry active, Telegram alerts active
- [ ] CI/CD deploying from main branch
- [ ] GitHub Actions secrets configured
- [ ] .env.production verified on server
- [ ] PM2 ecosystem file with proper env vars
- [ ] Domain nervix.ai pointing to production
- [ ] SSL certificate valid
- [ ] Backup strategy documented
- Agent: **David** (verify checklist)
- Effort: 1-2 hours

### P10-T4: Launch
- Announce on Telegram
- Monitor Sentry + metrics for 24 hours
- Hot-fix any critical issues
- Agent: **All team**

---

## EXECUTION ORDER

### Week 1: Security + Data + Core Loop (Phase 1 + 2 + 3)
| Day | Tasks | Owner | Hours |
|-----|-------|-------|-------|
| Day 1 | P1-T1 Ed25519 fix, P1-T2 API auth lockdown, P1-T3 seedDemo lock, P1-T4 rate limits, P1-T5 input sanitization, P1-T6 wallet column | Dexter | 6-8 |
| Day 2 | P2-T1 DB indexes, P2-T2 DB transactions, P2-T3 enrollment bug fix | Nano | 5-6 |
| Day 2 | P3-T1 webhook delivery, P3-T2 retry queue | David | 4-5 |
| Day 3 | P3-T3 scheduled jobs, P4-T4 nervix-cli publish | David + Dexter | 4-5 |

### Week 1 (parallel): Monitoring + TON start (Phase 5 + 6)
| Day | Tasks | Owner | Hours |
|-----|-------|-------|-------|
| Day 1-2 | P6-T1 Sentry activate, P6-T3 Telegram alerts | Memo | 4-5 |
| Day 1-2 | P5-T1 TON testnet deploy, P5-T2 BOC payloads | Sienna | 6-8 |
| Day 3 | P6-T2 Prometheus metrics | Memo | 3-4 |

### Week 2: Integration + Revenue + Polish (Phase 4 + 7 + 8)
| Day | Tasks | Owner | Hours |
|-----|-------|-------|-------|
| Day 4 | P4-T1 enroll Nano, P4-T2 enroll all agents, P4-T3 E2E test | David + Nano | 5-6 |
| Day 4-5 | P5-T3 TON mainnet deploy, P5-T4 plugin stubs, P7-T1 wallet login | Sienna | 6-8 |
| Day 4-5 | P8-T1 SSE live updates, P8-T2 error states | Dexter | 6-8 |
| Day 5 | P6-T4 health dashboard, P8-T3 SEO, P8-T4 landing page | Memo | 5-6 |

### Week 2 (continued): Revenue + Docs + Launch (Phase 7 + 9 + 10)
| Day | Tasks | Owner | Hours |
|-----|-------|-------|-------|
| Day 6 | P7-T2 credit purchase, P7-T3 withdrawal flow | Sienna | 4-6 |
| Day 6 | P9-T1 API docs, P9-T2 quickstart guide | Memo | 6-8 |
| Day 7 | P10-T1 load test, P10-T2 security audit | Dexter | 4-6 |
| Day 7 | P10-T3 deploy checklist, P10-T4 launch | David (all team) | 2-3 |

---

## AGENT TASK SUMMARY

| Agent | Total Tasks | Focus Area |
|-------|-------------|------------|
| **David** | 8 tasks | Webhooks, scheduled jobs, orchestration, enrollment, launch checklist |
| **Dexter** | 10 tasks | Security lockdown, CLI publish, SSE, error states, load test, security audit |
| **Nano** | 4 tasks | DB indexes, transactions, enrollment bug, first agent enrollment |
| **Sienna** | 7 tasks | TON deploy (testnet+mainnet), BOC payloads, plugin stubs, wallet login, payments |
| **Memo** | 8 tasks | Sentry, Prometheus, Telegram alerts, health dashboard, SEO, docs, landing page |
| **TOTAL** | **37 tasks** | **~80-100 hours across team = 7-10 working days** |

---

## CRITICAL PATH (Minimum Viable Launch)

If we need to ship FAST, these 15 tasks are the absolute minimum:

1. **P1-T1** Ed25519 fix (1 hr) — Dexter
2. **P1-T2** API auth lockdown (3-4 hrs) — Dexter
3. **P1-T3** seedDemo lock (5 min) — Dexter
4. **P1-T4** Rate limiting verify (30 min) — Dexter
5. **P2-T1** DB indexes (1 hr) — Nano
6. **P2-T2** DB transactions (3-4 hrs) — Nano
7. **P2-T3** Enrollment bug fix (1-2 hrs) — Nano
8. **P3-T1** Webhook delivery (2-3 hrs) — David
9. **P3-T3** Scheduled jobs (2-3 hrs) — David
10. **P4-T1** Enroll first agent (1-2 hrs) — Nano + David
11. **P4-T3** E2E test 10 tasks (2-3 hrs) — David + Nano
12. **P5-T1** TON testnet deploy (2 hrs) — Sienna
13. **P5-T2** BOC payloads (4-6 hrs) — Sienna
14. **P6-T1** Sentry activate (1 hr) — Memo
15. **P6-T3** Telegram alerts (3-4 hrs) — Memo

**Critical path total: ~30-40 hours = 3-4 days with full team**

---

## DEFINITION OF DONE

nervix.ai is PRODUCTION READY when:
- [ ] No `publicProcedure` on any mutation route
- [ ] Ed25519 signatures verified with real crypto
- [ ] 4 real agents enrolled and sending heartbeats
- [ ] 10+ real tasks completed end-to-end with credit transfers
- [ ] TON escrow deployed (at minimum testnet, ideally mainnet)
- [ ] Webhook delivery working with retry
- [ ] Sentry catching errors
- [ ] Telegram alerts firing
- [ ] Load test passed (100 agents, 1000 tasks)
- [ ] Security audit passed (no auth bypass, no injection)
- [ ] CI/CD deploying from GitHub main branch
