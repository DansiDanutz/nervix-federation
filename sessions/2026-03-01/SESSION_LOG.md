# Session 2026-03-01 — Nervix Production Hardening

## Pre-Audit: GSD Items Already Done
Before this session started, code review revealed these items are ALREADY implemented:

| GSD Task | Status | Evidence |
|----------|--------|----------|
| P1-T1: Ed25519 Verification | DONE | `routers.ts:89-106` — real `nacl.sign.detached.verify()` |
| P1-T3: Lock seedDemo | DONE | `routers.ts:1856` — uses `adminProcedure` |
| P1-T4: Rate Limiting | DONE | `rateLimit.ts` — auth(10/15min), API(200/min), enrollment(20/hr), passwordReset(3/hr) |
| P1-T6: Wallet Address Column | DONE | `schema.ts:66` — already `varchar(128)` |
| P3-T1: Webhook Delivery | DONE | `routers.ts:930-971` — real HTTP POST with HMAC-SHA256 |
| Heartbeat Auto-Offline | DONE | `index.ts:90-96` — 5min interval marks stale agents offline |

## Session Work Items
| Task | Priority | Status |
|------|----------|--------|
| P1-T2: Agent Bearer Token Auth (agentProcedure) | CRITICAL | DONE |
| P1-T5: Input Sanitization | HIGH | DONE |
| P3-T2: Webhook Retry Queue | HIGH | DONE |
| P3-T3: Scheduled Housekeeping Jobs | HIGH | DONE |
| P2-T3: Fix Enrollment 500 Error | HIGH | DONE |
| P2-T1: Database Indexes (20 indexes) | HIGH | DONE (SQL ready, needs deploy) |
| P2-T2: Financial Transaction Safety | HIGH | DONE (RPC + fallback) |

## Changes Made

### 1. Agent Bearer Token Auth (P1-T2) — THE BIG ONE
**Files changed:** `server/_core/trpc.ts`, `server/db.ts`, `server/routers.ts`, 3 frontend pages

Created `agentProcedure` middleware that validates `Authorization: Bearer at_xxx` tokens against the `agent_sessions` table. Checks: token exists, not revoked, not expired. Updates `lastUsedAt` on each use.

**Routes converted from `publicProcedure` → `agentProcedure`:**
- `agents.updateCard` — now uses `ctx.agentId` instead of `input.agentId`
- `agents.heartbeat` — now uses `ctx.agentId`
- `agents.setCapabilities` — now uses `ctx.agentId`
- `tasks.create` — `requesterId` now comes from `ctx.agentId`
- `tasks.updateStatus` — actor from `ctx.agentId`
- `tasks.submitResult` — `agentId` from `ctx.agentId`
- `economy.transfer` — `fromAgentId` from `ctx.agentId`
- `a2a.send` — `fromAgentId` from `ctx.agentId`
- `knowledge.upload` — `authorAgentId` from `ctx.agentId`
- `knowledge.audit` — converted to `adminProcedure`
- `barter.propose` — `proposerAgentId` from `ctx.agentId`
- `barter.accept` — responder verified from `ctx.agentId`
- `barter.confirmFeePaid` — party verified from `ctx.agentId`
- `barter.complete` — party verified from `ctx.agentId`

**Routes that remain `publicProcedure` (read-only, correct):**
- All `.list`, `.getById`, `.get`, `.stats`, `.health`, `.feeSchedule` queries
- `enrollment.request`, `enrollment.verify` (agents don't have tokens yet during enrollment)

**Frontend fixes:** Removed `agentId`/`requesterId`/`proposerAgentId` from mutation calls in:
- `AgentManage.tsx` (updateCard, setCapabilities)
- `Marketplace.tsx` (createTask)
- `BarterMarket.tsx` (proposeBarter)

**New db functions:** `getAgentSessionByToken()`, `updateAgentSessionLastUsed()`

### 2. Input Sanitization (P1-T5)
Added `.max()` validators inline during the route conversions:
- `description`: max 5000 chars (tasks.create, knowledge.upload, agents.setCapabilities)
- `errorMessage`: max 2000 chars (tasks.updateStatus)
- `message`: max 5000 chars (tasks.submitResult)
- `memo`: max 500 chars (economy.transfer)

### 3. Scheduled Jobs (P3-T2 + P3-T3)
**New file:** `server/scheduled-jobs.ts`

5 background jobs running on intervals:
1. **Enrollment cleanup** (5 min) — expire old pending challenges
2. **Task timeout** (1 min) — timeout overdue in_progress tasks, decrement agent activeTasks
3. **Heartbeat monitor** (2 min) — mark stale agents offline (>10 min no heartbeat)
4. **Webhook retry** (1 min) — retry failed A2A messages up to 3x with exponential backoff (1min/5min/15min), dead-letter after max retries
5. **Session cleanup** (1 hour) — delete expired agent sessions

**Replaced** the old inline `setInterval` in `index.ts` with the new centralized job system.

### 4. Server Startup Fix
Fixed corrupted `isPortAvailable` function in `index.ts` that had duplicated heartbeat code inside it. Reduced body parser limit from 50mb to 10mb (security).

## TypeScript Status
Only 2 pre-existing errors remain (not from this session):
- `Login.tsx:550` — `TelegramLoginCard` not found
- `routers.ts:1091` — implicit any in knowledge audit proficiency lookup

### 5. Fix Enrollment 500 Error (P2-T3)
**File changed:** `server/db.ts`

Fixed `createAgentSession()` and `createEnrollmentChallenge()` to explicitly serialize Date objects to ISO strings before inserting into Supabase. Previously, raw `Date()` objects were passed through `as any` cast, which could cause serialization issues depending on Supabase client version. Now builds a clean record with explicit field mapping.

### 6. Database Performance Indexes (P2-T1)
**New file:** `sessions/2026-03-01/001_add_indexes.sql`

20 indexes across 9 tables, all using `IF NOT EXISTS` for safe re-runs:
- `agents`: status, lastHeartbeat (partial: active only)
- `tasks`: status, requesterId, assigneeId, status+createdAt (partial: in_progress only)
- `economic_transactions`: fromAgentId, toAgentId, type
- `audit_log`: eventType, actorId
- `a2a_messages`: toAgentId, status (partial: queued/failed only)
- `reputation_scores`: overallScore DESC (leaderboard)
- `agent_sessions`: accessToken (partial: non-revoked), refreshTokenExpiresAt
- `enrollment_challenges`: status (partial: pending only)
- `heartbeat_logs`: agentId + createdAt DESC

### 7. Atomic Credit Transfers (P2-T2)
**New file:** `sessions/2026-03-01/002_atomic_transfer_rpc.sql`
**Files changed:** `server/db.ts`, `server/routers.ts`

Created `nervix_transfer_credits` PostgreSQL function that atomically:
1. Locks sender row with `SELECT FOR UPDATE` (prevents double-spend)
2. Validates balance sufficiency
3. Debits sender + credits receiver
4. Records transfer + fee transactions

Updated `economy.transfer` to try atomic RPC first, falling back to the old non-atomic path if the RPC isn't deployed yet (graceful migration). Also added input validation: cannot transfer to yourself, amount must be positive.

**New db function:** `atomicTransferCredits()`

## TypeScript Status
Only 2 pre-existing errors remain (not from this session):
- `Login.tsx:550` — `TelegramLoginCard` not found
- `routers.ts:1130` — implicit any in knowledge audit proficiency lookup

## Deploy Steps Required
1. **Run SQL in Supabase Dashboard** (SQL Editor > New Query):
   - `001_add_indexes.sql` — performance indexes
   - `002_atomic_transfer_rpc.sql` — atomic transfer function
2. **Deploy server** — `git push` + PM2 restart on Nano droplet
3. **Verify** — check PM2 logs for "Atomic RPC not available" warning (means SQL not deployed yet)

## Still TODO (Next Session)
- Phase 4: Real agent enrollment testing (enroll Nano, Dexter, Memo, Sienna)
- Phase 5: TON blockchain (deploy escrow contract)
- Phase 6: Monitoring (Sentry activation, Telegram alerts)
