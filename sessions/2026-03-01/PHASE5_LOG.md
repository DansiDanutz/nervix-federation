# Phase 5: TON Blockchain Integration + Infrastructure Hardening — Session Log
**Date:** 2026-03-01 | **Duration:** ~1h | **Status:** COMPLETE (Phase 5 + Phase 6 partial)

## Summary
Phase 5 wires the TON blockchain integration end-to-end, hardens the heartbeat infrastructure by migrating all agents from nohup to PM2, deploys the updated server, and adds Phase 6 Prometheus metrics.

## Completed Tasks

### P5-T1: TON Escrow Testnet Deployment (Previously Done)
- Contract deployed to testnet: `kQDKCkcN5OubyRNzX7aT9dI5sVGWK6TWZOGiBvxJ4K2LdIOU`
- Env vars set on server: `NERVIX_ESCROW_ADDRESS` + `TON_NETWORK=testnet`

### P5-T2: Real BOC Payloads (Previously Done)
- `server/ton-escrow.ts` already uses `@ton/ton` `beginCell()` for real BOC:
  - `generateCreateEscrowPayload` — OP_CREATE_ESCROW + feeType + amount + deadline + assignee + taskHash
  - `generateFundEscrowPayload` — OP_FUND_ESCROW + escrowId
  - `generateReleasePayload` — OP_RELEASE_ESCROW + escrowId
- All return base64-encoded BOC ready for TON Connect

### P5-T4: Wire OpenClaw Plugin to Real Contract
- File: `shared/openclaw-plugin.ts` (BlockchainSettlement class)
- Replaced 3 stub methods with real implementations:
  - `settle()` — Queries TON Center API for contract info, records settlement with on-chain reference
  - `verify()` — Verifies `nervix:` transfers (always confirmed), `ton:` transfers via TON Center API
  - `getBalance()` — New method: queries contract balance via TON Center API
- Updated tests: 5 tests passing (settle, verify nervix, verify unknown, getBalance null)

### Heartbeat Migration to PM2
- **Dexter**: Installed PM2, linked nervix-cli, started `nervix-heartbeat` via PM2
- **Memo**: PM2 already installed, linked nervix-cli, started `nervix-heartbeat` via PM2
- **Sienna**: Installed PM2 (via npm-global prefix), linked nervix-cli, started `nervix-heartbeat` via PM2
- **Nano**: Already running PM2 heartbeat from Phase 4
- All 4 agents: active, fresh heartbeats every 30s, PM2 saved for crash recovery

### Server Deployment
- Built with esbuild (203KB bundle)
- Deployed to Nano: `rsync dist/ + shared/` to `/opt/nervix/`
- Installed production dependencies (625 packages + @ton/core, @ton/crypto)
- Fixed `"type": "module"` conflict with CJS bundle
- Server restarted, all endpoints verified working
- TON escrow fee preview confirmed: 2.5% task fee working

## Agent Status (Post-Deploy)
| Agent | Status | Heartbeat | PM2 Process |
|-------|--------|-----------|-------------|
| Nano | active | 30s interval | `nervix-heartbeat` (root, PM2) |
| Dexter | active | 30s interval | `nervix-heartbeat` (Dexter1981, PM2) |
| Memo | active | 30s interval | `nervix-heartbeat` (Memo1981, PM2) |
| Sienna | active | 30s interval | `nervix-heartbeat` (Sienna1981, PM2) |

## Remaining / Blocked

### P5-T3: TON Mainnet Deployment
- **BLOCKED**: Needs Dan's approval + real TON for gas
- Testnet is fully functional for now

### SQL Deployment (From Phase 4)
- **BLOCKED**: Supabase DB password broken, can't connect via psql
- Both SQL files ready: `001_add_indexes.sql`, `002_atomic_transfer_rpc.sql`
- **Action needed**: Dan to run SQL in Supabase Dashboard SQL Editor

### GitHub Auth (From Phase 4)
- **BLOCKED**: `gh auth login` token expired
- nervix-cli repo ready locally, can't push to DansiDanutz/nervix-cli
- **Action needed**: Dan to provide new PAT token

### P6-T2: Prometheus /metrics Endpoint (Phase 6)
- File: `server/metrics.ts` (new)
- Wired into `server/_core/index.ts` (request counter middleware + route)
- **Live at:** `http://157.230.23.158/metrics`
- Metrics exposed:
  - `nervix_server_uptime_seconds` — gauge
  - `nervix_http_requests_total` / `nervix_http_errors_total` — counters
  - `nervix_agents_total{status}` — gauge by status (active: 4, offline: 9, pending: 2)
  - `nervix_agents_active_gauge` — quick check (4)
  - `nervix_tasks_total{status}` — gauge (completed: 10, created: 4, assigned: 3, in_progress: 1)
  - `nervix_credit_transfers_total` — counter (19)
  - `nervix_webhook_delivery_total{status}` — gauge by status
  - `nervix_agent_heartbeat_age_seconds{agent,agent_id}` — per-agent freshness
- No external dependencies (lightweight, queries Supabase directly)
- Deployed and verified working

## Next Steps (Phase 6 continued + Phase 7)
1. Sentry DSN configuration (P6-T1) — needs Dan to create Sentry project
2. PM2 startup scripts on Dexter/Memo/Sienna (needs sudo/root access)
3. Fix nervix.ai DNS split-brain (remove old Vercel deployment)
4. Phase 7: TON wallet login + credit purchase/withdrawal flows
