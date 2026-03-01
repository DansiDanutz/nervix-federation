# NERVIX V2 — 50-Task Implementation Sprint

## CONTEXT

- Server: root@157.230.23.158, SSH key ~/.ssh/id_ed25519_agent, app at /opt/nervix, PM2 name `nervix`
- Local repo: /Users/davidai/Desktop/DavidAi/nervix-federation/ (branch: feature/supabase-migration)
- Build: `bun run build` (esbuild --format=cjs)
- DO NOT USE npm (broken). Use `bun add` for packages.
- Supabase DB: kisncxslqjgdesgxmwen (camelCase columns!)
- NODE_ENV=production in .env

## BATCH 1: Foundation

T01 - Create deploy.sh:
Create /Users/davidai/Desktop/DavidAi/nervix-federation/deploy.sh:
```bash
#!/bin/bash
set -e
cd /Users/davidai/Desktop/DavidAi/nervix-federation
echo "Building..."
bun run build
echo "Rsyncing..."
rsync -avz --delete dist/ root@157.230.23.158:/opt/nervix/dist/ -e "ssh -i ~/.ssh/id_ed25519_agent"
rsync -avz .env root@157.230.23.158:/opt/nervix/dist/.env -e "ssh -i ~/.ssh/id_ed25519_agent"
rsync -avz .env root@157.230.23.158:/opt/nervix/.env -e "ssh -i ~/.ssh/id_ed25519_agent"
echo "Restarting PM2..."
ssh -i ~/.ssh/id_ed25519_agent root@157.230.23.158 "cd /opt/nervix && pm2 restart nervix --update-env"
echo "Health check..."
sleep 3
ssh -i ~/.ssh/id_ed25519_agent root@157.230.23.158 "curl -s http://localhost:3000/api/trpc/federation.health | head -c 200"
```
chmod +x deploy.sh

T02 - Email Verification Backend:
In server/_core/oauth.ts:
- On /api/auth/register: generate verifyToken = `vt_${nanoid(32)}`, store in Map<token, {email, userId, expires: Date.now()+3600000}>
- Send verification email via getResend() (already implemented): subject "Verify your Nervix email", link "https://nervix.ai/verify-email?token=TOKEN"
- Add GET /api/auth/verify-email endpoint: read token param, validate Map, update user emailVerified=true in Supabase (update users table set emailVerified=true where openId=userId), delete token from Map, redirect to /dashboard?verified=1
- Add POST /api/auth/resend-verification endpoint: requires auth cookie, rate limited 3/hr, resends email

T03 - VerifyEmail.tsx page:
Create client/src/pages/VerifyEmail.tsx:
- On mount: GET /api/auth/verify-email?token=XXX (from URL search params)
- Success: green checkmark, "Email verified!", auto-redirect to /dashboard after 3s
- Error: red X, "Invalid or expired link", button to resend
- Add /verify-email route in App.tsx

T04 - Email verification banner:
In client/src/pages/Dashboard.tsx:
- Parse JWT from cookie or use existing auth context to check emailVerified
- If false, show yellow alert bar: "⚠️ Please verify your email. [Resend verification email]"
- Resend button calls POST /api/auth/resend-verification
- Dismiss button (sessionStorage key so it doesn't reappear every 5 seconds)

T05 - JWT includes emailVerified:
In server/_core/oauth.ts, when signing JWT:
- Include emailVerified field: jwt.sign({ openId, email, name, role, emailVerified: user.emailVerified || false }, JWT_SECRET, ...)
- Google OAuth users get emailVerified=true automatically (Google already verified)
- Telegram users get emailVerified=true (no email, skip verification)

## BATCH 2: Sentry

T06 - Install Sentry:
Run: cd /Users/davidai/Desktop/DavidAi/nervix-federation && bun add @sentry/node @sentry/react

T07 - Sentry Backend:
In server/_core/index.ts, after imports:
```typescript
import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || "production", tracesSampleRate: 0.05 });
}
```
After all routes, before server.listen: app.use(Sentry.expressErrorHandler())

T08 - Sentry Frontend:
In client/src/main.tsx:
```typescript
import * as Sentry from "@sentry/react";
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: "production" });
}
```

T09 - Add Sentry env vars to .env:
Add lines to .env:
```
SENTRY_DSN=
VITE_SENTRY_DSN=
# Get DSN from https://sentry.io → New Project → Node.js + React
```

## BATCH 3: Admin Panel

T10 - Admin Router Backend:
In server/routers.ts, add adminRouter using adminProcedure:
- admin.stats: returns { totalUsers, totalAgents, totalTasks, activeAgents, completedTasks }
  (query users table count, agents count, tasks count, agents where status=active, tasks where status=completed)
- admin.users.list: input { limit=50, offset=0, role?: string }, returns users array
- admin.users.setRole: input { openId, role: 'admin'|'user' }, updates user role
- admin.users.delete: input { openId }, deletes user
- admin.agents.list: input { limit=50, offset=0, status?: string }, returns agents array  
- admin.agents.setStatus: input { agentId, status }, updates agent status
- admin.agents.delete: input { agentId }, deletes agent
- admin.tasks.list: input { limit=50, offset=0, status?: string }, returns tasks array
- admin.auditLog: input { limit=50, offset=0 }, returns audit_log entries ordered by createdAt desc
Add to appRouter: admin: adminRouter

T11 - Admin.tsx page:
Create client/src/pages/Admin.tsx:
- Import { trpc } from '../utils/trpc' (or wherever trpc client is)
- Check user role on mount — redirect to /dashboard if not admin
- Top stats row: 5 cards (Users, Agents, Tasks, Active Agents, Completed Tasks) from admin.stats
- Tabs component (use shadcn Tabs): Users | Agents | Tasks | Audit Log
- Users tab: table with columns: openId, name, email, role, emailVerified, lastSignedIn, actions (setRole dropdown, delete button)
- Agents tab: table: agentId, name, roles, status, lastHeartbeat, actions (activate, deactivate, delete)
- Tasks tab: table: taskId, title, status, priority, budget, assignedTo, createdAt
- Audit Log tab: table: createdAt, eventType, actorId, action

T12 - Admin route in App.tsx:
In client/src/App.tsx, add:
- import Admin from './pages/Admin'
- Route path="/admin" element={<Admin />}

T13 - Admin nav link:
In client/src/components/DashboardLayout.tsx:
- Add "Admin Panel" link in sidebar nav that only shows if user role === 'admin'
- Use shield icon (lucide-react Shield icon)

## BATCH 4: Real Data in UI

T14 - federation.stats + recentActivity procedures:
In server/routers.ts, federationRouter, add:
- stats: publicProcedure, no input, returns counts: { totalAgents, activeAgents, totalTasks, completedTasks, totalVolume: 0 }
  (use getDb().from('agents').select('*', {count:'exact'}) etc)
- recentActivity: publicProcedure, input { limit: z.number().default(10) }, returns last N audit_log rows

T15 - Dashboard real data:
In client/src/pages/Dashboard.tsx:
- Replace hardcoded numbers with trpc.federation.stats.useQuery()
- Replace mock activity with trpc.federation.recentActivity.useQuery({ limit: 10 })
- Show Skeleton while loading (use shadcn Skeleton component)
- Add { refetchInterval: 30000 } to auto-refresh every 30s

T16 - Fleet real data:
In client/src/pages/Fleet.tsx:
- Replace mock agents with trpc.agents.list.useQuery({ limit: 50 })
- Add status indicator dot: compute from agent.lastHeartbeat
  - green dot if lastHeartbeat within 5 min
  - yellow dot if within 30 min  
  - red dot if older or null
- Show "Active" / "Idle" / "Offline" label next to dot
- Add search input that filters agents.list with search param

T17 - Marketplace real data:
In client/src/pages/Marketplace.tsx:
- Replace mock tasks with trpc.tasks.list.useQuery({ status: 'created', limit: 50 })
- Show real task cards with budget, role badges, priority, deadline
- Add role filter buttons (devops, coder, qa, etc.)
- Add sort options

T18 - tasks.create mutation + Marketplace form:
In server/routers.ts, tasksRouter, add create protectedProcedure:
- Input: title (string), description (string), roles (array of VALID_ROLES), priority (PRIORITIES), budgetCredits (number), deadlineHours (number optional)
- Generate taskId = `tsk_${nanoid(20)}`
- Insert into tasks table
- Return task

In client/src/pages/Marketplace.tsx:
- Add "Post a Task" button (top right, only shown if logged in)
- Dialog with form for all task fields
- On submit: trpc.tasks.create.useMutation() → refresh list on success

T19 - Leaderboard real data:
In server/routers.ts, add leaderboardRouter:
- global: publicProcedure, input { limit: z.number().default(20), period: z.enum(['all','week','month']).default('all') }
  - Join agents + reputation_scores (or just query reputation_scores order by reputation desc)
  - Returns array: { rank, agentId, agentName, roles, tasksCompleted, successRate, reputation }
Add to appRouter: leaderboard: leaderboardRouter

In client/src/pages/Leaderboard.tsx:
- Replace mock data with trpc.leaderboard.global.useQuery({ limit: 20, period })
- Add period selector tabs: All Time / This Month / This Week
- Top 3 get special styling (gold/silver/bronze border)
- Show rank number, agent name, roles, tasks, reputation score

T20 - AgentDetail page real data:
In client/src/pages/AgentDetail.tsx:
- Get agentId from URL params
- Fetch with trpc.agents.get.useQuery({ agentId })
- Show: name, roles badges, status, joined date, public key (first 16 chars + ...)
- Stats: tasks completed, reputation score, success rate

## BATCH 5: Enrollment UX

T21+T22+T23+T24 - OnboardAgent.tsx multi-step wizard:
Rewrite client/src/pages/OnboardAgent.tsx as 4-step wizard:

Step 1 - Generate Keypair:
- Import tweetnacl: `import nacl from 'tweetnacl'`
- Button "Generate New Keypair" → `const kp = nacl.sign.newKeyPair()`
- Show publicKey in hex (Buffer.from(kp.publicKey).toString('hex'))
- Private key: show warning, offer download as nervix-private.json: { privateKey: hex, publicKey: hex }
- [Next →] disabled until keypair generated

Step 2 - Agent Info:
- Form fields: agentName, description, roles (checkbox grid of all VALID_ROLES), webhookUrl (optional), region (optional)
- [← Back] [Next →]

Step 3 - Enroll:
- Show summary of all info
- [Confirm & Enroll] button:
  1. Call trpc.enrollment.request.mutate({ agentName, publicKey, roles, description, webhookUrl })
  2. Get { challengeId, challengeNonce }
  3. Sign: `const sig = nacl.sign.detached(new TextEncoder().encode(challengeNonce), Buffer.from(privateKeyHex, 'hex'))`
  4. Call trpc.enrollment.verify.mutate({ challengeId, signature: Buffer.from(sig).toString('hex') })
  5. Get { agentId, accessToken, refreshToken }
- Show loading state during enrollment

Step 4 - Success:
- "🎉 Agent Enrolled!"
- Show agentId, first 20 chars of accessToken
- Download config button: saves nervix.json: { agentId, accessToken, refreshToken, publicKey }
- CLI quickstart code block: `npm install -g nervix-cli && nervix start --config nervix.json`
- [→ View in Fleet] button

## BATCH 6: API Completeness

T26 - agent.heartbeat procedure:
In server/routers.ts, agentsRouter, add heartbeat publicProcedure:
- Input: agentId (string), accessToken (string), status (enum: active/idle/busy/offline), load (number 0-1, optional), currentTask (string optional)
- Validate: query agent_sessions where agentId=agentId and accessToken=accessToken and accessTokenExpiresAt > now
- If invalid: throw Error("Invalid agent token")
- Update agents table: lastHeartbeat=now, status=input.status
- Insert heartbeat_logs: { logId: `hbl_${nanoid}`, agentId, status, load, timestamp: now }
- Return { ok: true, timestamp: new Date().toISOString() }

T27 - tasks.complete procedure:
In server/routers.ts, tasksRouter, add complete publicProcedure:
- Input: taskId, agentId, accessToken, result (string), proofHash (optional)
- Validate agent token (same as heartbeat)
- Update task: status=completed, completedAt=now
- Insert task_results: { resultId: `res_${nanoid}`, taskId, agentId, result, proofHash, createdAt: now }
- Update reputation_scores: increment tasksCompleted by 1, successfulTasks by 1
- Return { ok: true }

T28 - agent.myTasks procedure:
In server/routers.ts, agentsRouter, add myTasks publicProcedure:
- Input: agentId, accessToken, status (optional filter)
- Validate agent token
- Query tasks where assignedTo=agentId (and status filter if provided)
- Return tasks array

T29 - Heartbeat auto-timeout (server-side):
In server/_core/index.ts, after server starts:
```typescript
// Auto-offline agents that haven't heartbeated in 10 minutes
setInterval(async () => {
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await getDb().from('agents')
      .update({ status: 'offline' })
      .eq('status', 'active')
      .lt('lastHeartbeat', tenMinAgo);
  } catch(e) { console.error('Heartbeat timeout check failed:', e); }
}, 5 * 60 * 1000); // every 5 min
```
Import getDb from './db' (or '../db') in index.ts

## BATCH 7: nervix-cli

T33-T39 - nervix-cli package:
Create directory: /Users/davidai/Desktop/DavidAi/nervix-federation/cli/
Create cli/package.json:
```json
{
  "name": "nervix-cli",
  "version": "1.0.0",
  "description": "CLI for Nervix AI Agent Federation",
  "bin": { "nervix": "./dist/index.js" },
  "scripts": {
    "build": "bun build src/index.ts --outfile dist/index.js --target=node",
    "prepublish": "bun run build"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "tweetnacl": "^1.0.3",
    "ora": "^8.0.1",
    "chalk": "^5.3.0"
  },
  "keywords": ["nervix", "ai", "agents", "federation"],
  "license": "MIT"
}
```

Create cli/src/index.ts:
```typescript
#!/usr/bin/env node
const { program } = require('commander');
program.name('nervix').description('Nervix AI Agent CLI').version('1.0.0');
// Subcommands: enroll, start, tasks, complete, status
program.command('enroll').description('Enroll a new agent').action(require('./commands/enroll'));
program.command('start').description('Start agent heartbeat loop').action(require('./commands/start'));
program.command('tasks').description('List assigned tasks').action(require('./commands/tasks'));
program.command('complete <taskId>').description('Mark task complete').option('--result <text>', 'Result text').action(require('./commands/complete'));
program.command('status').description('Show agent status').action(require('./commands/status'));
program.parse();
```

Create cli/src/commands/enroll.ts:
- Prompts for agentName, roles, description using readline
- Uses tweetnacl to generate keypair
- Calls https://nervix.ai/api/trpc/enrollment.request and enrollment.verify
- Saves nervix.json config

Create cli/src/commands/start.ts:
- Loads nervix.json config
- Calls heartbeat API every 30s
- Shows "Agent running..." with spinner

Create cli/src/commands/tasks.ts:
- Loads config, calls /api/trpc/agent.myTasks
- Prints tasks table

Create cli/src/commands/complete.ts:
- Loads config, calls /api/trpc/tasks.complete
- Confirms completion

Create cli/src/commands/status.ts:
- Loads config, calls /api/trpc/agents.get
- Prints agent info

Install deps: cd cli && bun install

## BATCH 8: CI/CD

T40 - GitHub Actions deploy workflow:
Create .github/workflows/deploy.yml:
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install
      - run: bun run build
      - name: Deploy to Nano
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SERVER_IP: ${{ secrets.SERVER_IP }}
        run: |
          echo "$SSH_PRIVATE_KEY" > /tmp/deploy_key
          chmod 600 /tmp/deploy_key
          rsync -avz --delete dist/ root@$SERVER_IP:/opt/nervix/dist/ -e "ssh -i /tmp/deploy_key -o StrictHostKeyChecking=no"
          ssh -i /tmp/deploy_key -o StrictHostKeyChecking=no root@$SERVER_IP "pm2 restart nervix --update-env && sleep 3 && curl -sf http://localhost:3000/api/trpc/federation.health"
```

T41 - Health check script:
Create scripts/health-check.sh:
```bash
#!/bin/bash
RESPONSE=$(curl -sf https://nervix.ai/api/trpc/federation.health 2>&1)
if echo "$RESPONSE" | grep -q "healthy"; then
  echo "✅ nervix.ai healthy"
  echo "$RESPONSE"
else
  echo "❌ Health check FAILED: $RESPONSE"
  exit 1
fi
```
chmod +x scripts/health-check.sh

## BATCH 9: UI Polish

T43 - Home.tsx landing page:
Rewrite client/src/pages/Home.tsx as proper landing page:
- Dark gradient hero: "The AI Agent Economy" with subtitle
- Live stats row: fetch from federation.stats (animated counters)
- 3 feature cards: Federation Hub, Agent Economy, Secure Escrow
- How it works: 3 steps with icons
- CTA section: [Enroll Your Agent] [Browse Marketplace]
- Keep existing router/navigation intact

T44 - Better Docs.tsx:
In client/src/pages/Docs.tsx, add real API documentation:
- Authentication section with code examples
- Enrollment flow section with step-by-step
- Heartbeat format section
- Task lifecycle section
- tRPC endpoints table

T46 - Better 404:
Rewrite client/src/pages/NotFound.tsx:
- Show "404" in large text, robot emoji
- "This page doesn't exist in any agent's memory"
- Two buttons: Home and Dashboard

T47 - Skeleton components:
Create client/src/components/TableSkeleton.tsx (5 animated rows)
Create client/src/components/CardGridSkeleton.tsx (6 animated cards)
Use shadcn Skeleton component internally

## BATCH 10: Bug Fixes

T48 - Fix enrollment 500 error:
Investigate server/routers.ts enrollment.verify:
- Add console.error logging around each DB call to identify which one fails
- Check db.createAgentSession — ensure all fields exist in schema (sessionId, agentId, accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt)
- Check db.getOrCreateReputation — look at implementation in db.ts
- Check db.createAgent — ensure agentId, name, publicKey, roles, status all exist in schema
- If any field doesn't exist, look at how to handle (use existing column names)

T49 - tasks.list procedure (if missing):
Ensure tasksRouter has list procedure:
- Input: status, role, limit, offset (all optional)
- Returns tasks from DB with proper filtering
- This is needed by Marketplace

T50 - Final build and deploy:
1. Run bun run build — fix any TypeScript errors
2. Run ./deploy.sh to push to production
3. Run ./scripts/health-check.sh to verify
4. Do quick smoke tests on main routes

## COMPLETION

When done, run:
openclaw system event --text "Done: 50-task NERVIX sprint complete! Email verify, Sentry, Admin panel, real data in all pages, enrollment wizard, nervix-cli, CI/CD, landing page, health checks — all deployed to production." --mode now
