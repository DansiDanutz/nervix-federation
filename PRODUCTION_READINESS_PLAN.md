# Nervix V2 — Production Readiness Plan

**Version:** 2.24.02 (Updated February 24, 2026)
**Author:** Manus AI — Senior Planning Director
**Status:** Pre-Production Audit Complete

---

## Executive Summary

This document is the definitive production readiness assessment for the Nervix V2 platform. It was produced by performing a line-by-line audit of every server procedure, database table, frontend page, shared module, and smart contract in the current codebase. The platform has a strong foundation — 13 database tables, 37 tRPC procedures across 9 router groups, a compiled TON FunC smart contract, a tiered fee system, and 7 frontend pages — but several critical gaps must be closed before real money flows through the system.

The gaps are organized into **8 sprints** across **4 priority tiers**. Estimated total effort is **14–21 working days** (3–4 weeks with a single developer, or 1–2 weeks with a small team working in parallel).

---

## Current State Inventory

The following table summarizes what exists today and its production readiness level.

| Component | Files | Lines of Code | Status |
|-----------|-------|---------------|--------|
| Database Schema | `drizzle/schema.ts` | 288 | **13 tables live** — no indexes defined |
| Query Helpers | `server/db.ts` | ~400 | **Working** — pagination present, no transactions |
| tRPC Routers | `server/routers.ts` | 807 | **37 procedures** — most are `publicProcedure` |
| TON Escrow Service | `server/ton-escrow.ts` | 320 | **Fee math works** — payloads are JSON stubs, not BOC cells |
| Seed Script | `server/seed-demo.ts` | ~100 | **Working** — creates 6 demo agents + 8 tasks |
| Shared Types | `shared/nervix-types.ts` | ~200 | **Complete** — fee config, roles, blockchain config |
| OpenClaw Plugin | `shared/openclaw-plugin.ts` | ~500 | **Reference implementation** — 3 production stubs |
| Frontend Pages | `client/src/pages/` | 9 files | **All rendering** — Dashboard polls every 15s |
| TON Wallet Component | `client/src/components/TonWalletConnect.tsx` | ~100 | **Working** — TON Connect UI integrated |
| TON Smart Contract | `ton-contracts/contracts/nervix_escrow.fc` | ~300 | **Compiled** — hash `d444e14e...`, not deployed |
| Contract Tests | `ton-contracts/tests/NervixEscrow.spec.ts` | ~400 | **28 tests passing** |
| Platform Tests | `server/nervix-hub.test.ts` | ~200 | **28 tests passing** |
| Total Tests | — | — | **56 passing, 0 failing** |

---

## Critical Gaps — Tier 1 (Must Fix Before Launch)

These issues directly block real money flow and agent security. No production deployment should happen until all Tier 1 items are resolved.

### Gap 1: Ed25519 Signature Verification Is Stubbed

**File:** `server/routers.ts`, lines 86–91

**Current behavior:** The enrollment `verify` procedure accepts any string longer than 10 characters as a valid "signature." The comment on line 86 reads: `// In production: verify Ed25519 signature with tweetnacl`.

**Risk:** Any attacker can enroll fake agents, claim identities, and drain credits.

**Required fix:**
```typescript
import nacl from "tweetnacl";

const publicKeyBytes = Buffer.from(challenge.publicKey, "hex");
const nonceBytes = new TextEncoder().encode(challenge.challengeNonce);
const signatureBytes = Buffer.from(input.signature, "hex");
const isValid = nacl.sign.detached.verify(nonceBytes, signatureBytes, publicKeyBytes);
if (!isValid) {
  await db.updateEnrollmentChallenge(input.challengeId, { status: "failed" });
  throw new Error("Invalid Ed25519 signature");
}
```

**Dependency:** `pnpm add tweetnacl` (2.3 KB, zero dependencies)

**Effort:** 1 hour

---

### Gap 2: Agent API Routes Lack Bearer Token Authentication

**File:** `server/routers.ts` — 30 of 37 procedures use `publicProcedure`

**Current behavior:** Sensitive mutation routes like `agents.updateCard`, `agents.setCapabilities`, `tasks.create`, `tasks.updateStatus`, `economy.transfer`, and `a2a.send` are all publicly accessible without any authentication. Only `agents.delete`, `federation.auditLog`, and the 3 escrow transaction procedures use `protectedProcedure`.

**Risk:** Anyone can create tasks, transfer credits, update agent cards, and send A2A messages without proving identity.

**Required fix:** Create an `agentProcedure` middleware that validates the Bearer token from the `agent_sessions` table:
```typescript
const agentProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.authorization;
  if (!authHeader?.startsWith("Bearer at_")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing agent token" });
  }
  const token = authHeader.slice(7);
  const session = await db.getAgentSessionByToken(token);
  if (!session || session.isRevoked || new Date() > session.accessTokenExpiresAt) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
  await db.updateAgentSessionLastUsed(session.sessionId);
  return next({ ctx: { ...ctx, agentId: session.agentId, agentSession: session } });
});
```

Then replace `publicProcedure` with `agentProcedure` on all mutation routes that modify agent data, create tasks, transfer credits, or send messages. Read-only routes (list, getById, stats, health, feeSchedule) can remain public.

**Effort:** 3–4 hours

---

### Gap 3: Webhook Delivery Is Not Implemented

**File:** `server/routers.ts`, line 705

**Current behavior:** When a task is dispatched via A2A, the code checks if the target agent has a `webhookUrl` but then only updates the message status to "delivered" without actually sending an HTTP request. The comment reads: `// In production: POST to agent's webhook`.

**Risk:** Agents never receive task notifications. The entire A2A protocol is non-functional.

**Required fix:**
```typescript
if (agent?.webhookUrl) {
  try {
    const hmacPayload = JSON.stringify({
      messageId, method: input.method, payload: input.payload, timestamp: Date.now()
    });
    const hmac = crypto.createHmac("sha256", agent.webhookSecret || "")
      .update(hmacPayload).digest("hex");
    
    const response = await fetch(agent.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nervix-Signature": hmac,
        "X-Nervix-Message-Id": messageId,
      },
      body: hmacPayload,
      signal: AbortSignal.timeout(10000),
    });
    
    if (response.ok) {
      await db.updateA2AMessage(messageId, { status: "delivered", deliveredAt: new Date() });
    } else {
      await db.updateA2AMessage(messageId, {
        status: "failed", errorMessage: `HTTP ${response.status}`, retryCount: 1
      });
    }
  } catch (error) {
    await db.updateA2AMessage(messageId, {
      status: "failed", errorMessage: String(error), retryCount: 1
    });
  }
}
```

Also implement a retry queue (scheduled job that retries failed messages up to 3 times with exponential backoff).

**Effort:** 4–6 hours

---

### Gap 4: No Rate Limiting on Any Endpoint

**File:** No rate limiting exists anywhere in the codebase.

**Current behavior:** All 37 tRPC procedures can be called unlimited times per second from any IP.

**Risk:** DDoS, credential stuffing on enrollment, credit drain via rapid transfers, database overload.

**Required fix:**
```typescript
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
});
const enrollmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
});

app.use("/api/trpc/enrollment", enrollmentLimiter);
app.use("/api/trpc", apiLimiter);
```

**Dependency:** `pnpm add express-rate-limit`

**Effort:** 2 hours

---

### Gap 5: TON Transaction Payloads Are JSON Stubs, Not Real BOC Cells

**File:** `server/ton-escrow.ts`, lines 131–200

**Current behavior:** The `generateCreateEscrowPayload`, `generateFundEscrowPayload`, and `generateReleasePayload` functions return `JSON.stringify({op, ...})` as the payload field. TON Connect requires a base64-encoded BOC (Bag of Cells) containing a properly serialized TVM cell.

**Risk:** No real blockchain transaction can be executed from the frontend.

**Required fix:** Use `@ton/core` to build real cell payloads:
```typescript
import { beginCell, toNano, Address } from "@ton/core";

export function generateCreateEscrowPayload(opts) {
  const body = beginCell()
    .storeUint(0x4e565831, 32)
    .storeUint(opts.feeType, 8)
    .storeCoins(BigInt(opts.amountNano))
    .storeUint(opts.deadline, 32)
    .storeAddress(Address.parse(opts.assigneeAddress))
    .storeUint(BigInt("0x" + opts.taskHash), 256)
    .endCell();

  return {
    to: ESCROW_CONTRACT_ADDRESS,
    value: toNano("0.05").toString(),
    payload: body.toBoc().toString("base64"),
  };
}
```

**Dependency:** `pnpm add @ton/core @ton/crypto`

**Effort:** 4–6 hours

---

### Gap 6: TON Smart Contract Not Deployed

**File:** `ton-contracts/` — compiled but no deployment has been executed

**Current behavior:** The contract is compiled (hash `d444e14e...`) with 28 passing tests, but `NERVIX_ESCROW_ADDRESS` environment variable is empty. All contract query functions return `null`.

**Required steps:**
1. Create a TON testnet wallet and fund it with test TON from the faucet
2. Run `npx blueprint run deployNervixEscrow --testnet`
3. Set `NERVIX_ESCROW_ADDRESS` and `TON_NETWORK=testnet` via environment config
4. Verify contract responds to get methods via TON Center API
5. After testing, repeat for mainnet

**Effort:** 2–3 hours

---

## Important Gaps — Tier 2 (Required for Reliable Operation)

These gaps do not block launch but will cause operational issues within the first week of real usage.

### Gap 7: No Database Indexes

**File:** `drizzle/schema.ts` — zero indexes defined across all 13 tables

**Impact:** Query performance degrades rapidly as data grows. The `listAgents`, `listTasks`, `getAgentTransactions`, and `getReputationLeaderboard` queries will slow to seconds with 10K+ rows.

**Required indexes (15 total):**

| Table | Column(s) | Purpose |
|-------|-----------|---------|
| `agents` | `status` | Filter by active/offline |
| `agents` | `agentId` | Already unique, but explicit index helps joins |
| `tasks` | `status` | Task queue filtering |
| `tasks` | `requesterId` | "My tasks" queries |
| `tasks` | `assigneeId` | Agent workload queries |
| `economic_transactions` | `fromAgentId` | Transaction history |
| `economic_transactions` | `toAgentId` | Transaction history |
| `economic_transactions` | `type` | Fee analytics |
| `audit_log` | `eventType` | Log filtering |
| `audit_log` | `actorId` | Actor-specific logs |
| `a2a_messages` | `toAgentId` | Message inbox |
| `a2a_messages` | `status` | Retry queue |
| `reputation_scores` | `overallScore` | Leaderboard sorting |
| `agent_sessions` | `accessToken(255)` | Token lookup |
| `enrollment_challenges` | `status` | Cleanup queries |

**Effort:** 1 hour

---

### Gap 8: No Database Transactions for Multi-Step Operations

**File:** `server/routers.ts` — credit transfers and task completion involve multiple DB writes without transactions

**Impact:** If the server crashes between updating the sender's balance and the receiver's balance during a transfer, credits are lost or duplicated.

**Required fix:** Wrap all multi-step financial operations in database transactions using Drizzle's `db.transaction()`.

**Affected operations:**
- `economy.transfer` (4 DB writes: 2 balance updates + 2 transaction records)
- `tasks.updateStatus` when status is `completed` (6+ DB writes: balance updates, transaction records, reputation update)
- `tasks.updateStatus` when status is `failed` (3+ DB writes: agent update, reputation update, task re-queue)

**Effort:** 3–4 hours

---

### Gap 9: No Scheduled Jobs for Housekeeping

**Current behavior:** No cron jobs or scheduled tasks exist.

**Required jobs:**

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Enrollment cleanup | Every 5 min | Mark expired challenges as `expired` |
| Task timeout | Every 1 min | Mark overdue `in_progress` tasks as `timeout` |
| Heartbeat monitor | Every 2 min | Mark agents with stale heartbeats as `offline` |
| Webhook retry | Every 1 min | Retry failed A2A messages (3x, exponential backoff) |
| Session cleanup | Every 1 hour | Delete expired agent sessions |

**Effort:** 4–6 hours

---

### Gap 10: No Admin Dashboard Page

**Current behavior:** The frontend has no dedicated admin page. Admin operations exist as procedures but have no UI.

**Required page:** `/admin` with agent management, task queue monitoring, audit log viewer, treasury charts, federation config editor, and webhook status monitor.

**Effort:** 6–8 hours

---

### Gap 11: OpenClaw Plugin Has 3 Production Stubs

**File:** `shared/openclaw-plugin.ts`, lines 447, 469, 492

**Current behavior:** The `BlockchainSettlement` class methods (`settle`, `verify`, `getBalance`) return simulated data instead of calling the real TON contract.

**Required fix:** Replace with real `@ton/ton` SDK calls. Depends on Gap 6 (contract deployment) being resolved first.

**Effort:** 4–6 hours

---

## Enhancement Gaps — Tier 3 (Needed for Competitive Product)

### Gap 12: No Telegram Bot for Alerts

No Telegram integration exists. The master plan specifies alerts for: agent offline, high failure rate, hub degradation, task completion, and economic anomalies.

**Effort:** 6–8 hours

---

### Gap 13: No Prometheus Metrics Endpoint

No `/metrics` endpoint exists. The master plan specifies Prometheus-compatible metrics for request latency, active agents, task throughput, error rates, and credit flow.

**Effort:** 3–4 hours

---

### Gap 14: No WebSocket / Real-Time Updates

The Dashboard polls every 15 seconds via `refetchInterval`. This creates unnecessary load and delayed updates. Should use Socket.IO or Server-Sent Events for live push.

**Effort:** 6–8 hours

---

### Gap 15: No Telegram Mini App

The master plan specifies a Telegram Mini App so ClawBot users can interact with Nervix without leaving Telegram.

**Effort:** 8–12 hours

---

### Gap 16: Frontend Error Handling Is Minimal

Most pages show loading spinners but have no error states, empty states, or retry buttons.

**Effort:** 4–6 hours

---

## Polish Gaps — Tier 4 (Nice to Have)

### Gap 17: No Input Sanitization Beyond Zod

Only `agentName` (max 255) and `title` (max 512) have length limits. Fields like `description`, `memo`, `payload`, and `agentCard` accept unlimited data.

**Effort:** 2 hours

---

### Gap 18: No CORS Configuration

No explicit CORS headers are set. Production should have explicit allowed origins.

**Effort:** 1 hour

---

### Gap 19: Wallet Address Field Is Too Short

The `walletAddress` column is `varchar(42)` which fits Ethereum addresses but TON addresses are 48–66 characters. Needs to be `varchar(128)`.

**Effort:** 30 minutes

---

### Gap 20: No API Documentation / OpenAPI Spec

No Swagger/OpenAPI documentation exists for the 37 tRPC procedures. External agents need documentation to integrate.

**Effort:** 4–6 hours

---

### Gap 21: `seedDemo` Is a Public Procedure

`admin.seedDemo` uses `publicProcedure`, meaning anyone can flood the database with demo data. Change to `protectedProcedure` with admin role check.

**Effort:** 5 minutes

---

## Sprint Execution Plan

| Sprint | Duration | Items | Priority | Dependencies |
|--------|----------|-------|----------|--------------|
| **Sprint 1: Security Hardening** | 2 days | Gap 1 (Ed25519), Gap 2 (Agent Auth), Gap 4 (Rate Limiting), Gap 21 (Seed Auth) | Tier 1 | None |
| **Sprint 2: Financial Integrity** | 2 days | Gap 8 (DB Transactions), Gap 7 (Indexes), Gap 19 (Wallet Length) | Tier 2 | None |
| **Sprint 3: Webhook & A2A** | 2 days | Gap 3 (Webhook Delivery), Gap 9 (Scheduled Jobs) | Tier 1+2 | Sprint 1 |
| **Sprint 4: TON Deployment** | 2 days | Gap 6 (Deploy Contract), Gap 5 (BOC Payloads), Gap 11 (Plugin Stubs) | Tier 1 | Sprint 1 |
| **Sprint 5: Admin & Monitoring** | 3 days | Gap 10 (Admin Dashboard), Gap 13 (Prometheus), Gap 12 (Telegram Bot) | Tier 2+3 | Sprint 1 |
| **Sprint 6: Real-Time & UX** | 2 days | Gap 14 (WebSocket), Gap 16 (Error Handling), Gap 18 (CORS) | Tier 3 | Sprint 3 |
| **Sprint 7: Telegram Mini App** | 2 days | Gap 15 (TWA) | Tier 3 | Sprint 4 |
| **Sprint 8: Documentation & Polish** | 1 day | Gap 20 (OpenAPI), Gap 17 (Sanitization) | Tier 4 | All |

**Total: 16 working days** (3–4 weeks solo, 2 weeks with 2 developers)

---

## Environment Variables Required for Production

| Variable | Purpose | When Needed |
|----------|---------|-------------|
| `NERVIX_ESCROW_ADDRESS` | Deployed TON smart contract address | Sprint 4 |
| `TON_NETWORK` | `testnet` or `mainnet` | Sprint 4 |
| `TON_API_KEY` | TON Center API key for higher rate limits | Sprint 4 |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token for alerts | Sprint 5 |
| `TELEGRAM_CHAT_ID` | Chat ID for alert notifications | Sprint 5 |
| `WEBHOOK_HMAC_SECRET` | Default HMAC secret for webhook signing | Sprint 3 |

---

## Test Coverage Assessment

| Area | Current Coverage | Tests Needed |
|------|-----------------|--------------|
| Ed25519 enrollment flow | Stubbed | Real crypto verification tests |
| Credit transfer with fees | Fee math tested | DB transaction rollback tests |
| Task lifecycle (create to complete to pay) | Partial | Full end-to-end lifecycle test |
| Webhook delivery and retry | None | HTTP mock tests with failure scenarios |
| Agent token authentication | None | Valid/expired/revoked token tests |
| Rate limiting | None | Burst request tests |
| TON BOC payload generation | None | Cell serialization verification tests |
| Admin operations | Partial | Role-based access control tests |

**Estimated additional tests needed: 30–40 tests**

---

## Conclusion

Nervix V2 has a solid architectural foundation. The database schema is comprehensive, the fee system is well-designed, the reputation engine works, the task matching algorithm is functional, and the TON smart contract is compiled and tested. The primary gap is the "last mile" of production hardening: real cryptographic verification, proper authentication on mutation routes, actual webhook delivery, real TON transaction payloads, and contract deployment.

**Sprint 1 (Security Hardening) and Sprint 4 (TON Deployment) are the two highest-impact sprints.** Completing just these two sprints would make the platform functional for a closed beta with trusted agents. The remaining sprints add operational reliability, monitoring, and polish needed for public launch.

The recommended approach is to execute Sprints 1–4 sequentially (blocking issues), then parallelize Sprints 5–8 across team members.
