# Nervix GitHub Repository Setup & Structure Guide

**Date:** 2026-03-02
**Author:** Nano (Nervix Orchestrator)
**Status:** READY FOR REVIEW

---

## Overview

Nervix platform currently exists in two directory structures:

1. **nervix-federation/** — Nervix V2 (TypeScript, React, TON blockchain)
   - Active GitHub repository: `https://github.com/DansiDanutz/nervix-federation`
   - Latest commits and active development
   - Next.js 14 frontend with App Router
   - Drizzle ORM for MySQL/TiDB
   - TON Connect wallet integration
   - This is the future production platform

2. **nervix/** — Nervix V1 (Express.js, Production)
   - NOT in git (no commits)
   - Running in production via systemd service `nervix-api`
   - Located at: `/home/Nano1981/.openclaw/workspace/nervix/api`
   - Supabase database integration
   - Express.js backend API
   - Current production system

---

## Directory Structure

```
/home/Nano1981/.openclaw/workspace/
├── nervix/                          # Nervix V1 (Production)
│   ├── api/                         # Express.js backend
│   │   ├── routes/                  # API routes (v1.js, tasks.js, agents.js, etc.)
│   │   ├── services/                # Business logic
│   │   ├── middleware/              # Auth, rate limiting
│   │   ├── server.js                # Entry point (running in production)
│   │   └── package.json
│   ├── agents/                      # Agent configurations
│   ├── scripts/                     # Utility scripts
│   ├── supabase/                    # Database migrations
│   └── [other files]
│
├── nervix-federation/               # Nervix V2 (Development)
│   ├── client/                      # React 19 frontend (nervix.io)
│   ├── server/                      # tRPC/Express backend
│   │   ├── routers.ts               # tRPC router definitions
│   │   ├── db.ts                    # Drizzle database integration
│   │   └── [other backend files]
│   ├── drizzle/                     # Drizzle ORM migrations
│   ├── ton-contracts/               # TON smart contracts (FunC)
│   ├── cli/                         # OpenClaw plugin
│   ├── shared/                      # Shared TypeScript types
│   └── package.json
│
└── [workspace config files]         # AGENTS.md, IDENTITY.md, etc.
```

---

## Current Git Status

### nervix-federation/ (Active Repository)
```bash
✅ Remote: https://github.com/DansiDanutz/nervix-federation
✅ Branch: main (up to date)
✅ Commits: Active development history
✅ Last pull: 2026-03-02 (deployment pipeline improvements)
```

**Uncommitted Changes:**
- Modified: `pnpm-lock.yaml`
- Untracked: `GIT_CONFIG_ISSUE.md`, `NERVIX_VERCEL_STATUS.md`, `VERCEL_DNS_ISSUES.md`, `public/`

### nervix/ (No Version Control)
```bash
❌ Remote: None
❌ Commits: None (not in git)
❌ Branch: master (no commits)
❌ Status: Production system, not tracked
```

**Running in Production:**
- Service: `nervix-api.service`
- Process: `/usr/bin/node server.js` (PID: 829506)
- Directory: `/home/Nano1981/.openclaw/workspace/nervix/api`
- Uptime: Running since 2026-03-02 14:33 UTC

---

## Production Audit Findings

### Critical Issues Found

#### 1. Database Schema Mismatches
**Issue:** Two critical schema blocks:

**Agents Table:**
- Missing columns: `agent_id`, `reputation_score`, `rating_avg`, `tasks_completed`, etc.
- Impact: Agent enrollment completely blocked
- Migration ready: `fix_agents_comprehensive.sql`
- Status: Awaiting manual application via Supabase Dashboard

**Tasks Table:**
- Schema mismatch between actual table and API expectations
- Impact: GET /v1/tasks endpoint failing
- Migration ready: `fix_tasks_schema.sql`
- Status: Awaiting manual application via Supabase Dashboard

#### 2. API Endpoints Implemented (Awaiting Restart)
**Status:** Implementation complete, waiting for server restart

Three new endpoints added to `/home/Nano1981/.openclaw/workspace/nervix/api/routes/`:

1. **GET /v1/reputation/leaderboard**
   - Returns ranked agents by reputation score
   - Pagination support
   - Files: `reputation.js`

2. **GET /v1/quality/scores**
   - Returns quality scores for agents
   - Filter by agent_id (optional)
   - Files: `quality.js`

3. **GET /v1/economics/stats**
   - Platform-wide economic statistics
   - Overview: total_agents, active_agents, total_earnings
   - Files: `economics.js`

**Blocker:** Requires `sudo systemctl restart nervix-api` (password needed)

---

## GitHub Repository Strategy

### Option A: Two Separate Repositories (Recommended)

**Repository 1: nervix-federation (V2)**
- URL: `https://github.com/DansiDanutz/nervix-federation`
- Status: ✅ Already exists and active
- Purpose: Nervix V2 development
- Tech Stack: TypeScript, React 19, Drizzle ORM, TON blockchain

**Repository 2: nervix-production (V1)**
- URL: `https://github.com/DansiDanutz/nervix-production` (to be created)
- Status: ⏸️ Needs creation and initial commit
- Purpose: Nervix V1 production system
- Tech Stack: Express.js, Supabase, Node.js

**Advantages:**
- Clear separation between V1 and V2
- V1 can continue running in production while V2 is developed
- Easy to deprecate V1 once V2 is ready
- Independent release cycles

**Disadvantages:**
- More repositories to manage
- Potential code duplication during transition

---

### Option B: Single Repository with Monorepo

**Repository: nervix (All versions)**
- URL: `https://github.com/DansiDanutz/nervix` (to be created)
- Structure:
  ```
  nervix/
  ├── v1/               # Current production code
  │   └── api/
  ├── v2/               # Nervix-federation (TypeScript)
  │   ├── client/
  │   └── server/
  └── shared/           # Shared types and utilities
  ```
- Status: ⏸️ Needs creation and migration

**Advantages:**
- Single source of truth
- Easy code sharing between V1 and V2
- Simplified CI/CD

**Disadvantages:**
- Complex migration (nervix-federation already has commits)
- Large monorepo can be difficult to manage
- V1 and V2 are fundamentally different architectures

---

## Recommended Actions

### Immediate (Do Now)

1. **Commit and push nervix-federation changes**
   ```bash
   cd /home/Nano1981/.openclaw/workspace/nervix-federation
   git add pnpm-lock.yaml
   git add GIT_CONFIG_ISSUE.md NERVIX_VERCEL_STATUS.md VERCEL_DNS_ISSUES.md public/
   git commit -m "docs: Add deployment and DNS issue documentation + public assets"
   git push origin main
   ```

2. **Create nervix-production repository**
   - Create new repository on GitHub: `https://github.com/DansiDanutz/nervix-production`
   - Add comprehensive README with V1 documentation
   - Configure `.gitignore` (exclude node_modules, logs, .env files)

3. **Initialize git in nervix/ directory**
   ```bash
   cd /home/Nano1981/.openclaw/workspace/nervix
   git init
   git add .
   git commit -m "Initial commit: Nervix V1 production system"
   git remote add origin https://github.com/DansiDanutz/nervix-production.git
   git branch -M main
   git push -u origin main
   ```

4. **Document repository split in nervix-federation README**
   - Add section explaining V1 vs V2
   - Link to nervix-production repository
   - Explain migration path from V1 to V2

---

### Short Term (This Week)

1. **Add CI/CD to nervix-federation**
   - Configure GitHub Actions for testing
   - Set up automated deployment to Vercel
   - Add automated security scanning (CodeQL, Dependabot)

2. **Create migration plan document**
   - Document V1 → V2 migration steps
   - Identify data migration requirements
   - Define API compatibility layer (if needed)

3. **Set up monitoring for nervix-production**
   - Add health check endpoints
   - Configure logging and error tracking
   - Set up uptime monitoring

---

### Medium Term (This Month)

1. **Complete V2 development**
   - Finish remaining features in nervix-federation
   - Complete TON smart contract integration
   - Finish OpenClaw plugin

2. **Deploy V2 to staging**
   - Set up staging environment
   - Run comprehensive E2E tests
   - Performance testing and optimization

3. **Plan V1 deprecation**
   - Define timeline for V1 shutdown
   - Migrate production traffic to V2
   - Archive nervix-production repository

---

## GitHub Best Practices Checklist

### nervix-federation Repository
- [x] Repository created
- [x] README.md exists
- [x] LICENSE file
- [x] CONTRIBUTING.md exists
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Issue templates
- [ ] Pull request templates
- [ ] Branch protection rules
- [ ] Dependabot configured
- [ ] CodeQL security scanning
- [ ] Release process documented

### nervix-production Repository (To Be Created)
- [ ] Repository created
- [ ] Comprehensive README.md
- [ ] LICENSE file
- [ ] CONTRIBUTING.md
- [ ] CI/CD pipeline
- [ ] Issue templates
- [ ] Pull request templates
- [ ] Branch protection rules
- [ ] Security documentation
- [ ] Deployment documentation

---

## Next Steps

### For David (System Owner)
1. **Apply database migrations** via Supabase Dashboard
   - `fix_agents_comprehensive.sql`
   - `fix_tasks_schema.sql`
2. **Provide sudo password** to restart nervix-api service
3. **Review repository strategy** (Option A vs Option B)
4. **Create nervix-production repository** (if Option A chosen)

### For Nano (Nervix Orchestrator)
1. ✅ Complete GitHub setup documentation (this file)
2. ⏸️ Commit and push nervix-federation changes (pending strategy decision)
3. ⏸️ Initialize git in nervix/ directory (pending strategy decision)
4. ⏸️ Update nervix-federation README with V1/V2 explanation
5. ⏸️ Complete Production Audit - Phase 82 final report

---

## Blockers

| Blocker | Status | Owner | Resolution |
|---------|--------|-------|------------|
| Database schema (agents) | BLOCKING | David | Apply `fix_agents_comprehensive.sql` via Supabase Dashboard |
| Database schema (tasks) | BLOCKING | David | Apply `fix_tasks_schema.sql` via Supabase Dashboard |
| Server restart for API endpoints | BLOCKING | David | Provide sudo password for `systemctl restart nervix-api` |
| GitHub repository strategy decision | PENDING | David | Choose Option A (2 repos) or Option B (monorepo) |

---

## References

- **Audit Report:** `/home/Nano1981/.openclaw/workspace/PRODUCTION_AUDIT_PHASE_82.md`
- **Database Issues:** `/home/Nano1981/.openclaw/workspace/CRITICAL_DATABASE_ISSUES_REPORT_2026-03-01.txt`
- **Tasks Analysis:** `/home/Nano1981/.openclaw/workspace/TASKS_ENDPOINT_ANALYSIS_2026-03-01.md`
- **Missing Endpoints Implementation:** `/home/Nano1981/.openclaw/workspace/MISSING_ENDPOINTS_IMPLEMENTATION_REPORT_2026-03-02.md`
- **Frontend Deep Dive:** `/home/Nano1981/.openclaw/workspace/FRONTEND_DEEP_DIVE_REPORT_2026-03-02.md`

---

*Document by: Nano (Nervix Orchestrator)*
*Last Updated: 2026-03-02 18:10 UTC*
