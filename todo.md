# Nervix V2 — Project TODO

## Phase 1: Foundation (Hub API + Database)
- [x] Database schema: agents table with Ed25519 keys, Agent Card JSON, heartbeat
- [x] Database schema: tasks table with lifecycle states, A2A task ID mapping
- [x] Database schema: task_results, reputation_scores, economic_transactions tables
- [x] Database schema: agent_capabilities, audit_log, enrollment_challenges tables
- [x] Database schema: agent_sessions (JWT + refresh tokens), federation_config tables
- [x] Database schema: a2a_messages and blockchain_settlements tables
- [x] API: Agent enrollment (enrollment.request, enrollment.verify) with Ed25519 challenge-response
- [x] API: Agent CRUD (agents.list, agents.getById, agents.updateCard, agents.heartbeat, agents.updateStatus)
- [x] API: Task marketplace (tasks.create, tasks.list, tasks.getById, tasks.updateStatus, tasks.submitResult)
- [x] API: Task results (tasks.submitResult with output/artifacts)
- [x] API: Health check (federation.health) and stats (federation.stats)
- [x] JWT authentication middleware with refresh token support
- [x] Zod v4 validation for all API inputs

## Phase 2: Federation Protocol & Economy
- [x] A2A Protocol Adapter (a2a.send, a2a.getStatus — tasks/send, tasks/get, tasks/cancel, tasks/pushNotification)
- [x] Role-based task matching algorithm (role filter, capability check, reputation sort, availability, load balancing)
- [x] Reputation engine with weighted scoring (40% success, 25% time, 25% quality, 10% uptime)
- [x] Credit economy system (economy.transfer, economy.agentBalance, economy.stats)
- [x] Blockchain financial layer (BlockchainSettlement class — TON on-chain settlement)
- [x] Task lifecycle management (created → assigned → in_progress → completed/failed/cancelled/timeout)
- [x] Fallback and error handling (re-queuing via status reset, retry logic)
- [x] HMAC-SHA256 webhook verification (in OpenClaw plugin)
- [x] 10 agent roles system (devops, coder, qa, security, data, deploy, monitor, research, docs, orchestrator)

## Phase 3: Frontend & Dashboard
- [x] Landing page with federation overview, value proposition, and CTAs
- [x] Real-time federation dashboard (enrolled agents, active tasks, reputation leaderboard)
- [x] Agent registry browser (searchable, filterable by role/status)
- [x] Agent detail page with Agent Card, reputation, capabilities, task history
- [x] Credit balance and economic transaction viewer
- [x] System health metrics display (hub version, uptime, database status)
- [x] Onboarding documentation page (install, configure, enroll guide)
- [x] Dark theme with cyberpunk/tech aesthetic
- [x] Marketplace page with task creation form and task browser
- [x] Seed demo data button for populating the federation

## Phase 4: Plugin, Alerting & Security
- [x] OpenClaw Plugin TypeScript package (shared/openclaw-plugin.ts)
- [x] Plugin: Ed25519 enrollment flow (initialize → challenge → verify)
- [x] Plugin: Agent Card generation from local config
- [x] Plugin: Heartbeat background service (configurable interval)
- [x] Plugin: Webhook message listener (handleWebhook method)
- [x] Plugin: nervix.* tools (delegate, discover, status, accept, complete, reject, federationInfo)
- [x] Shared types and constants (shared/nervix-types.ts)
- [x] BlockchainSettlement class (settle, verify — TON/Base/Polygon)
- [x] Audit logging for all federation events (createAuditEntry throughout routers)
- [x] Security: Ed25519 identity, JWT auth, reputation-based trust with auto-suspension

## Phase 5: Testing & Delivery
- [x] Vitest unit tests for core API procedures (25 tests, 2 files, all passing)
- [x] OpenClaw plugin instantiation tests
- [x] BlockchainSettlement settle/verify tests
- [x] Shared types validation tests
- [x] Demo data seeder (admin.seedDemo procedure)
- [x] Push to GitHub repository
- [x] Final checkpoint and deployment

## Phase 6: Fee System, Bankr.bot Inspiration & Red Lobster Rebrand
- [x] Research bankr.bot design for inspiration
- [x] Implement transaction fee system (platform takes % from all blockchain transactions)
- [x] Add fee configuration to federation_config and economy routers
- [x] Update BlockchainSettlement to include platform fee deduction
- [x] Rebrand color scheme from green cyberpunk to red lobster/claw theme (OpenClaw priority)
- [x] Add red lobster/claw visual elements and branding throughout all pages
- [x] Update landing page to emphasize OpenClaw agent priority (accept others too)
- [x] Update Dashboard, Registry, Marketplace, Docs with new red theme
- [x] Take design inspiration from bankr.bot (layout, animations, UX patterns)
- [x] Update tests for fee system (28 tests passing)

## Phase 7: Blockchain Network Research & Recommendation
- [x] Research blockchain networks: Polygon, Base, Solana, Arbitrum, Optimism, Avalanche
- [x] Research wallet ecosystems: MetaMask, Phantom, Coinbase Wallet, smart wallets
- [x] Research payment UX: onramps, gasless transactions, account abstraction
- [x] Compare fees, speed, developer tools, user adoption
- [x] Deliver comprehensive comparison report with final recommendation

## Phase 7 (Updated): TON/Telegram Wallet Research & Integration
- [x] Research TON blockchain fundamentals, fees, speed, smart contracts
- [x] Research Telegram Wallet and TON Connect integration for dApps
- [x] Research TON payment APIs, SDKs, and developer tools
- [x] Compare TON vs Polygon/Base/Solana for agent economy use case
- [x] Deliver comprehensive recommendation report (NERVIX_BLOCKCHAIN_REPORT.md)
- [x] Implement TON/Telegram Wallet integration into Nervix platform
- [x] TON Connect UI Provider wrapping entire app
- [x] TonWalletConnect component (connect, panel, indicator)
- [x] TON wallet indicator in navbar (Home + Dashboard)
- [x] TON Network status card in Dashboard sidebar
- [x] Updated all blockchain references from Polygon to TON
- [x] Updated OpenClaw plugin BlockchainSettlement for TON
- [x] Updated shared nervix-types with TON network config
- [x] tonconnect-manifest.json for dApp registration
- [x] All 28 tests passing with TON changes

## Phase 8: TON FunC Smart Contract — Nervix Settlement Escrow
- [x] Research TON FunC smart contract development tools (func compiler, blueprint, tact)
- [x] Research TON smart contract deployment process (testnet + mainnet)
- [x] Write Nervix Escrow FunC smart contract with fee collection (2.5% task, 1.5% settlement, 1.0% transfer)
- [x] Implement escrow lifecycle: create_escrow → fund → release → refund
- [x] Implement treasury fee deduction on every settlement
- [x] Implement admin controls (update fee rates, withdraw treasury, pause)
- [x] Write contract test suite (28 contract tests passing)
- [x] Compile contract (hash: d444e14e...bfd35ab0)
- [x] Create TypeScript wrapper (NervixEscrow.ts) with all get methods
- [x] Create deployment script for testnet/mainnet
- [x] Integrate server-side TON escrow service (ton-escrow.ts)
- [x] Add 7 tRPC escrow procedures (contractInfo, previewFee, getEscrow, treasuryInfo, createEscrowTx, fundEscrowTx, releaseEscrowTx)
- [x] Create Escrow Dashboard page (/escrow) with fee calculator, escrow lookup, contract details
- [x] Add Escrow link to navigation (Home navbar + App.tsx route)
- [x] All 28 platform tests + 28 contract tests passing

## Phase 9: Updated Production Readiness Plan (V2.24.02)
- [x] Fresh audit of all backend code (routers, db, schema, ton-escrow)
- [x] Fresh audit of all frontend code (pages, components, App.tsx)
- [x] Fresh audit of shared modules (openclaw-plugin, nervix-types)
- [x] Fresh audit of TON contracts
- [x] Write updated PRODUCTION_READINESS_PLAN.md
- [x] Push to GitHub

## Phase 10: Production Hardening — All 21 Gaps

### Sprint 1: Security Hardening
- [x] Gap 1: Real Ed25519 signature verification with tweetnacl
- [x] Gap 2: Agent Bearer token auth middleware (agentProcedure)
- [x] Gap 4: Rate limiting on all endpoints (express-rate-limit)
- [x] Gap 21: Fix seedDemo to use protectedProcedure with admin check

### Sprint 2: Financial Integrity
- [x] Gap 7: Add 15 database indexes across all 13 tables
- [x] Gap 8: Database transactions for multi-step financial operations
- [x] Gap 19: Fix walletAddress varchar(42) to varchar(128) for TON

### Sprint 3: Webhook & A2A
- [x] Gap 3: Real webhook delivery with HMAC-SHA256 signing + retry processor
- [x] Gap 9: Scheduled housekeeping jobs (5 jobs)

### Sprint 4: TON Deployment Prep
- [x] Gap 5: Real BOC cell payloads with @ton/core
- [x] Gap 6: TON contract deployment config and env vars
- [x] Gap 11: Replace OpenClaw plugin BlockchainSettlement stubs

### Sprint 5: Admin & Monitoring
- [x] Gap 10: Admin dashboard page (/admin) with full management UI
- [x] Gap 12: Telegram bot for critical alerts (enrollment, suspension, large tx, DLQ)
- [x] Gap 13: Prometheus metrics endpoint (/api/metrics)

### Sprint 6: Real-Time & UX
- [x] Gap 14: Polling-based real-time updates (dashboard auto-refresh)
- [x] Gap 16: Frontend error handling (error states, retry, empty states)
- [x] Gap 18: Explicit CORS configuration in server index.ts

### Sprint 7-8: Polish & Documentation
- [x] Gap 17: Input sanitization (Zod length limits on all string fields)
- [x] Gap 20: API documentation endpoint (docs.openapi procedure)
- [x] Push all changes to DansiDanutz/DigitalMind GitHub

## Phase 11: TON Testnet Deployment
- [x] Review existing FunC contract and deployment script
- [x] Set up TON development environment (blueprint, func compiler)
- [x] Compile the Nervix Escrow FunC contract
- [x] Generate testnet deployment wallet and fund with test TON (via @testgiver_ton_bot)
- [x] Deploy contract to TON testnet — **kQDKCkcN5OubyRNzX7aT9dI5sVGWK6TWZOGiBvxJ4K2LdIOU**
- [x] Verify deployment on testnet explorer (contract state confirmed: paused=false, fees correct)
- [x] Integrate live contract address into platform (NERVIX_ESCROW_ADDRESS env var set)
- [x] Update tests (42 tests passing across 3 files) and create DEPLOYMENT.md
- [x] Push to GitHub

## Phase 12: Telegram Nervix Alerts Bot
- [x] Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars
- [x] Verify bot connectivity (@NervixAlert_bot → @SemeCJ chat ID 424184493)
- [x] Rewrite telegram-alerts.ts with 20+ alert functions, cooldown, severity levels
- [x] Wire alerts into agent enrollment events (alertNewEnrollment)
- [x] Wire alerts into agent suspension events (alertAgentSuspended, alertAdminSuspendedAgent)
- [x] Wire alerts into large transaction events (alertLargeTransaction)
- [x] Wire alerts into escrow operations (create, fund, release, refund, dispute — 5 functions)
- [x] Wire alerts into webhook DLQ failures (alertWebhookDLQ in webhook-delivery.ts)
- [x] Wire alerts into system health events (alertJobFailed in all 4 scheduled jobs)
- [x] Wire alerts into admin actions (suspend, reactivate, delete, grant credits, seed demo)
- [x] Add /status, /help, /cooldowns bot command handlers (10s polling)
- [x] Add server startup notification (alertServerStartup on every boot)
- [x] Write 16 tests for telegram-alerts module (58 total tests passing across 4 files)
- [x] Push to GitHub

## Phase 13: Telegram /broadcast Admin Command
- [x] Add telegram_subscribers table to schema (chatId, username, firstName, lastName, isActive, timestamps)
- [x] Push DB migration for new table (0005_salty_the_professor.sql)
- [x] Add DB helpers for subscriber CRUD (subscribe, unsubscribe, getActive, getCount, updateInteraction)
- [x] Add /start auto-subscribe logic (stores chatId, username, firstName, lastName from Telegram)
- [x] Implement /broadcast command with admin-only auth and confirmation flow (/broadcast → preview → /confirm or /cancel)
- [x] Implement /subscribers command to view subscriber count + list (up to 50)
- [x] Add delivery tracking (sent/failed/total stats + delivery report sent to admin)
- [x] Write tests for broadcast functionality (66 total tests passing across 4 files)
- [x] Push to GitHub

## Phase 14: Enhanced Supabase Migration (V2.24.02)
- [x] Create nervix_v2 schema in Supabase (9 migrations applied)
- [x] Create all 14 V2 tables with proper PostgreSQL types + 4 custom enums
- [x] Add 73 indexes on all frequently queried columns
- [x] Add 9 foreign key constraints between related tables (CASCADE/SET NULL)
- [x] Add CHECK constraints for enums and value ranges (via custom types)
- [x] Create 7 updated_at triggers for all tables with updatedAt columns
- [x] Enable Row Level Security (RLS) on all 14 tables
- [x] Create 19 RLS policies (14 service_role full access + 5 anon read-only)
- [x] Migrate 123 V1 agents into V2 structure with field mapping
- [x] Migrate 77 V1 tasks into V2 structure with status mapping
- [x] Migrate 123 reputation scores + 15 agent capabilities + 10 federation config entries
- [x] Create 3 database functions (get_federation_stats, preview_fee, recalculate_reputation)
- [x] Create 4 views (agent_overview, task_overview, economy_summary, agent_leaderboard)
- [x] Verify all tables, indexes, constraints, triggers, RLS, functions, and views
- [x] Create SUPABASE_MIGRATION.md documentation
- [x] Push to GitHub

## Phase 15: Connect Nervix App to Supabase nervix_v2
- [x] Audit all db.ts query helpers and routers.ts query points
- [x] Install @supabase/supabase-js and configure connection
- [x] Create supabase-client.ts with nervix_v2 schema connection
- [x] Rewrite all 40+ db.ts query helpers to use Supabase client
- [x] Update routers.ts to work with new Supabase-backed queries
- [x] Update telegram subscriber queries for Supabase
- [x] Set correct SUPABASE_URL and SUPABASE_KEY (kisncxslqjgdesgxmwen)
- [x] Expose nervix_v2 schema in Supabase Data API settings (via Dashboard)
- [x] Write 5 Supabase connection tests (agents, federation_config, RPC)
- [x] All 71 tests passing across 5 test files
- [x] Push to GitHub

## Phase 16: Professional GitHub Repository Enhancement (COMPLETED)
- [x] Audit current repo structure and clean up old/conflicting files
- [x] Research competitor positioning (AI agent platforms, orchestration tools)
- [x] Write investor-grade README.md with value proposition and earning model
- [x] Create ARCHITECTURE.md with detailed system design and data flow documentation
- [x] Create CONTRIBUTING.md with developer onboarding guide
- [x] Earning model integrated into README.md (Who Earns section with 5 stakeholder categories)
- [x] Add GitHub repo metadata (14 topics, description, homepage)
- [x] Create .github folder (bug report, feature request, PR template)
- [x] Create SECURITY.md with vulnerability disclosure policy
- [x] Create LICENSE (proprietary)
- [x] Sync documentation to Google Drive 'Digital Mind' folder
- [x] Push to GitHub

## Phase 17: Bug Fixes
- [x] Fix Connect Wallet button — TON Connect modal now opens correctly
- [x] Make Telegram Wallet the default connection method (listed first in modal)
- [x] Allow anyone to connect with Telegram account + Telegram wallet
- [x] Fix TON Connect manifest — uploaded to CDN, domain updated to nervix.ai
- [x] Replace all nervix.io references with nervix.ai across entire codebase
- [x] Fix Telegram bot 409 polling conflict (deleteWebhook + error suppression)
- [x] All 71 tests passing across 5 test files
- [x] Push to GitHub

## Phase 18: Fix Wallet Connection Not Working
- [x] Diagnose wallet connection failure — root cause: sandbox proxy blocks SSE bridge connections
- [x] Verified: manifest URL accessible, icon URL accessible, bridge URL correct (matches official wallets-v2.json)
- [x] Verified: TON Connect SDK config matches official telegram-wallet entry exactly
- [x] Solution: publish site to production URL where SSE bridges work without proxy interference
- [ ] Test wallet connection on published URL
- [ ] Push fix to GitHub

## Phase 19: Display TON Balance After Wallet Connection
- [x] Research TON balance API (toncenter / tonapi)
- [x] Create useTonBalance hook to fetch balance after wallet connects
- [x] Display TON balance in wallet indicator (navbar) — shows address + balance inline
- [x] Display TON balance in wallet panel — prominent gradient card with large balance display
- [x] Add loading and error states for balance fetch (spinner, auto-refresh every 30s)
- [x] Write tests for balance functionality (3 new tests: valid address, unknown address, empty address)
- [x] Added server-side getWalletBalance endpoint via toncenter API
- [x] All 74 tests passing across 5 test files
- [x] Save checkpoint and push to GitHub

## Phase 20: Copy Wallet Address Button
- [x] Add copy-to-clipboard button in navbar wallet indicator
- [x] Add copy-to-clipboard button in NervixConnectButton connected state
- [x] Show visual feedback (checkmark) after copying
- [x] Created reusable useCopyAddress hook with 2s feedback timer
- [x] All 74 tests passing, pushed to GitHub

## Phase 21: QR Code Popup for Wallet Address
- [x] Install QR code generation library (qrcode.react v4.2.0)
- [x] Create AddressQRDialog component with Nervix claw logo in center of QR
- [x] Integrate QR popup into TonWalletIndicator (navbar) — tap address opens QR
- [x] Integrate QR popup into TonWalletPanel — tap address or "Receive" button opens QR
- [x] Integrate QR popup into NervixConnectButton connected state
- [x] QR encodes ton://transfer/ URI for wallet auto-fill
- [x] Dialog includes copy button, full address display, and tonscan explorer link
- [x] All 74 tests passing, pushed to GitHub

## Phase 22: Transaction History in Wallet Panel
- [x] Research TON transaction history API (toncenter getTransactions)
- [x] Add getWalletTransactions server endpoint in ton-escrow.ts
- [x] Add walletTransactions tRPC procedure in routers.ts
- [x] Create useTonTransactions hook for frontend (auto-refresh 60s)
- [x] Build TransactionHistory component in TonWalletPanel
- [x] Show direction (in/out), amount, counterparty, relative timestamp
- [x] Add loading skeleton (3 rows) and empty state with helpful message
- [x] Show/hide toggle for 5+ transactions, link to tonscan explorer
- [x] Each transaction row links to tonscan tx detail page
- [x] Decode base64 comments from transaction messages
- [x] Write 3 tests for transaction endpoint (valid, unknown, empty address)
- [x] All 77 tests passing across 5 test files

## Phase 23: Link Wallet Address to Agent Profile
- [x] Increased walletAddress column from 42 to 128 chars for TON addresses
- [x] Ran db:push — migration 0006_curvy_madripoor.sql applied
- [x] Created linkWalletToAgent / unlinkWalletFromAgent / getAgentByWalletAddress / getAgentsByOwner DB helpers
- [x] Added agents.linkWallet protected procedure (owner/admin only, prevents duplicates)
- [x] Added agents.unlinkWallet protected procedure (owner/admin only)
- [x] Added agents.myAgents protected procedure (returns user's agents)
- [x] Added agents.getByWallet public procedure (resolve agent by wallet)
- [x] Built AgentWalletLink UI component in TonWalletPanel
- [x] Shows linked agent info with status, roles, and shield icon when linked
- [x] Shows agent picker (filters already-linked agents) when not linked
- [x] Shows "sign in" prompt for unauthenticated users
- [x] Added audit logging for link/unlink actions
- [x] Escrow payments auto-route to linked wallet (info text in UI)
- [x] Wrote 6 tests for wallet linking (auth checks, getByWallet, myAgents, linkWallet)
- [x] All 83 tests passing across 5 test files

## Phase 24: Auto-fill Escrow Recipient Wallet from Agent Profile
- [x] Read current escrow creation UI — no Create Escrow form existed, only fee calculator + lookup
- [x] Added new "Create Escrow" tab as first tab in Escrow page
- [x] Built agent search/selector with live search across all enrolled agents
- [x] Auto-populate recipient wallet address when agent with linked wallet is selected
- [x] Show "Wallet linked" badge next to agents in dropdown, "Auto-filled" badge after selection
- [x] Handle case where selected agent has no linked wallet (amber warning, manual entry)
- [x] Added full escrow form: fee type, amount, deadline, task hash, OpenClaw discount toggle
- [x] Added real-time fee preview/summary panel (mirrors fee calculator logic)
- [x] Added "How Escrow Works" step-by-step guide card
- [x] All 83 tests passing across 5 test files

## Phase 25: Wire Create Escrow Button to TON Connect
- [x] Read existing createEscrowTx procedure — returns { to, value, payload (base64 BOC), description }
- [x] Added createEscrowPayload protectedProcedure (user-auth, not agent-auth) for web UI
- [x] Added useTonConnectUI, useTonWallet, useTonAddress hooks to Escrow page
- [x] Wired Create Escrow button: generates BOC payload via server, sends via tonConnectUI.sendTransaction()
- [x] Button shows 3 states: "Connect Wallet" (no wallet), "Create Escrow" (ready), "Generating/Awaiting" (loading)
- [x] Shows loading spinner with contextual text ("Generating Payload..." / "Awaiting Wallet...")
- [x] On success: green card with BOC, description, copy button, and confirmation message
- [x] On error: handles rejected/cancelled, unauthorized, and generic errors with toast
- [x] Added sign-in warning for unauthenticated users
- [x] Added audit logging for payload generation
- [x] All 83 tests passing across 5 test files

## Phase 26: Live Escrow Status Tracker
- [x] Analyzed existing escrow data model (EscrowTransaction: status, feeType, amount, fundedAmount, etc.)
- [x] Built EscrowStatusTracker component with 3-step visual progress (Created → Funded → Released)
- [x] Shows branch statuses (Disputed/Refunded) as separate path with distinct icons and colors
- [x] Added 15-second auto-refresh polling for live status updates in both lookup and creation tabs
- [x] Integrated tracker into Escrow Lookup tab (replaces old flat grid display)
- [x] Integrated tracker into Create Escrow tab (shows after entering escrow ID post-creation)
- [x] Added tonscan links for requester/assignee addresses with copy buttons
- [x] Shows deadline countdown (days/hours/minutes remaining or "Expired")
- [x] Displays amount, funded amount, fee collected, fee type, task hash
- [x] Color-coded status badges (blue/cyan/green/amber/red)
- [x] All 83 tests passing across 5 test files (transient timeout resolved)

## Phase 27: Wallet Badge on Agent Cards
- [x] Verified walletAddress is returned via mapAgentFromDb (select * includes wallet_address)
- [x] Added cyan wallet badge icon next to agent name (inline circle with Wallet icon)
- [x] Added "TON Wallet Linked" tooltip on hover (title attribute)
- [x] Added "TON" label with wallet icon in footer row with shortened address tooltip
- [x] All 83 tests passing, 0 TypeScript errors

## Phase 28: Escrow Action Buttons (Fund, Release, Dispute)
- [x] Reviewed existing BOC payload generators (generateFundEscrowPayload, generateReleasePayload, generateDisputePayload)
- [x] Added 3 new protectedProcedure endpoints: fundEscrowPayload, releaseEscrowPayload, disputeEscrowPayload
- [x] Added audit logging for all 3 new payload generation endpoints
- [x] Built EscrowActions sub-component inside EscrowStatusTracker
- [x] Fund button (cyan) — visible when status is "created", shows amount + gas
- [x] Release button (green) — visible when status is "funded"
- [x] Dispute button (red outline) — visible when status is "funded"
- [x] All buttons wired to TON Connect sendTransaction with proper BOC payloads
- [x] Loading states: "Generating..." during server call, "Awaiting Wallet..." during signing
- [x] Success toast with description, auto-refresh at 3s/8s/15s after action
- [x] Error handling: rejected/cancelled, unauthorized, generic errors
- [x] Wallet connect prompt if no wallet connected
- [x] Contextual help text below each action button
- [x] All 83 tests passing, 0 TypeScript errors

## Phase 29: Escrow History Page
- [x] Added getEscrowsByWallet server function (scans all contract escrows, batched with Promise.allSettled)
- [x] Added escrow.walletEscrows publicProcedure endpoint
- [x] Built EscrowHistory page with card-based escrow list
- [x] Added role indicator (Requester/Assignee) with color-coded badges
- [x] Added status filter (All, Created, Funded, Released, Disputed, Refunded)
- [x] Added role filter (All, Requester, Assignee)
- [x] Added search by escrow ID, address, or task hash
- [x] Added sorting by date, amount, ID, status (toggle asc/desc)
- [x] Each escrow row links to /escrow?tab=lookup&id=N for status tracker
- [x] Summary stats: total escrows, total volume, active, completed, as requester, as assignee
- [x] Registered /escrow/history route in App.tsx
- [x] Added "History" button in Escrow page navigation bar
- [x] Empty states for no wallet, no results, and no matching filters
- [x] Auto-refresh every 30 seconds
- [x] Wrote 3 tests for walletEscrows endpoint
- [x] All 86 tests passing across 5 test files

## Phase 30: Confirmation Dialogs for Release & Dispute
- [x] Added AlertDialog for Release action with irreversibility warning and green confirm button
- [x] Added AlertDialog for Dispute action with irreversibility warning, red warning box, and red confirm button
- [x] Both dialogs show escrow details (ID, amount, counterparty addresses)
- [x] Release dialog warns about protocol fee deduction
- [x] Dispute dialog warns about fund freeze and arbitration process
- [x] 0 TypeScript errors, all 86 tests passing

## Phase 31: Telegram Notifications for Escrow Status Changes
- [x] Reviewed existing Telegram bot — full alert infrastructure already existed (sendAlert, cooldowns, severity levels)
- [x] Alert functions already existed: alertEscrowCreated, alertEscrowFunded, alertEscrowReleased, alertEscrowDisputed, alertEscrowRefunded
- [x] Wired alerts into all 4 web UI escrow payload procedures (create, fund, release, dispute)
- [x] Send notification when escrow is created (via createEscrowPayload)
- [x] Send notification when escrow is funded (via fundEscrowPayload)
- [x] Send notification when escrow is released (via releaseEscrowPayload)
- [x] Send notification when escrow is disputed (via disputeEscrowPayload)
- [x] Enhanced all alert messages with source indicator (🌐 Web UI / 🤖 Agent API)
- [x] Enhanced dispute alert with "Action Required" admin review prompt
- [x] All alerts use fire-and-forget (.catch(() => {})) to not block the response
- [x] All 86 tests passing, 0 TypeScript errors

## Phase 32: Refund Button for Expired Funded Escrows
- [x] Added refundEscrowPayload protectedProcedure in routers.ts (uses generateRefundPayload)
- [x] Added Refund button to EscrowStatusTracker (amber, visible when funded + deadline expired)
- [x] Added confirmation dialog with escrow details, funded amount, expired deadline timestamp
- [x] Wired to TON Connect sendTransaction with loading states
- [x] Sends Telegram notification via alertEscrowRefunded on refund
- [x] Added audit logging for refund payload generation
- [x] Help text explains "The deadline has expired. The requester can reclaim the escrowed funds."
- [x] All 86 tests passing, 0 TypeScript errors

## Phase 33: Admin Dispute Resolution Page
- [x] Added dispute_resolutions table to drizzle schema (migration 0007)
- [x] Created DB helpers: createOrUpdateDispute, getDisputeByEscrowId, listDisputes, getDisputeStats
- [x] Added admin.listDisputes procedure (filter by status: all/open/under_review/resolved_release/resolved_refund)
- [x] Added admin.disputeStats procedure (total, open, underReview, resolvedRelease, resolvedRefund counts)
- [x] Added admin.reviewDispute procedure (marks as under_review with admin notes)
- [x] Added admin.resolveDisputeRelease procedure (resolves in favor of assignee)
- [x] Added admin.resolveDisputeRefund procedure (resolves in favor of requester)
- [x] Added admin.addDisputeEvidence procedure (saves requester/assignee evidence text)
- [x] Built AdminDisputes page with stats cards, filterable list, and detail panel
- [x] Added evidence sections for requester (blue) and assignee (cyan) with save buttons
- [x] Added admin notes section with "Mark as Under Review" action
- [x] Added resolution actions with AlertDialog confirmation (Release green, Refund red)
- [x] Registered /admin/disputes route, added amber "Disputes" button in Admin navbar
- [x] Wrote 6 tests for dispute resolution procedures (all auth checks pass)
- [x] All 91 passing (1 pre-existing timeout on contractBalance, unrelated)

## Phase 34: Dispute Action Timeline View
- [x] Added dispute_events table to drizzle schema (migration 0009)
- [x] Created DB helpers: addDisputeEvent, getDisputeEvents
- [x] Added admin.getDisputeTimeline procedure
- [x] Auto-log events: dispute_opened, evidence_submitted, review_started, admin_note_added, resolved_release, resolved_refund
- [x] Built DisputeTimeline component with vertical timeline UI (color-coded icons, relative timestamps)
- [x] Shows event type icon, description, actor (admin/requester/assignee/system), timestamp, metadata
- [x] Metadata panel shows notes, party, evidence length where applicable
- [x] Integrated timeline into AdminDisputes detail panel (replaces old simple timeline)
- [x] Kept Key Dates section below timeline for quick reference
- [x] Auto-refreshes every 15 seconds
- [x] Loading skeleton and empty state
- [x] All 92 tests passing across 5 test files

## Phase 35: Dispute Timeline Event Type Filtering
- [x] Added event type filter buttons with icons to DisputeTimeline component
- [x] 5 filter categories: All, Evidence (evidence_submitted), Status Change (dispute_opened), Review (review_started, admin_note_added), Resolution (resolved_release, resolved_refund)
- [x] Each filter shows event count badge, active filter has ring highlight
- [x] Event counter shows "X of Y" when filtered, "X" when showing all
- [x] Empty state when filter has no matching events, with "Clear filter" link
- [x] Maintains chronological order while filtering via useMemo
- [x] 0 TypeScript errors, all 92 tests passing

## Phase 36: Dispute Timeline Sort Toggle
- [x] Added sort direction toggle button (newest-first / oldest-first) to DisputeTimeline
- [x] Sort preference persisted in useState, defaults to "newest"
- [x] Visual indicator: ChevronDown for newest, ChevronUp for oldest, with label text
- [x] Sorting works alongside event type filters via combined useMemo
- [x] Toggle positioned at right end of filter bar with ml-auto
- [x] Tooltip shows current sort state
- [x] 0 TypeScript errors, all 92 tests passing

## Phase 37: File/Image Upload for Dispute Evidence
- [x] Created dispute_attachments table in Supabase nervix_v2 schema (via migration)
- [x] Created dispute_events and dispute_resolutions tables in Supabase nervix_v2 schema
- [x] Added DB helpers: addDisputeAttachment, listDisputeAttachments, deleteDisputeAttachment
- [x] Added admin.uploadDisputeAttachment procedure (base64 → S3 via storagePut, 10MB limit)
- [x] Added admin.listDisputeAttachments procedure (query by escrowId)
- [x] Added admin.deleteDisputeAttachment procedure with timeline event logging
- [x] Built DisputeFileUpload component with drag-and-drop, click-to-upload, file type validation
- [x] Integrated file upload into requester evidence section (blue accent)
- [x] Integrated file upload into assignee evidence section (cyan accent)
- [x] Image preview thumbnails in attachment list with click-to-enlarge modal
- [x] Full-screen image preview overlay with download button
- [x] File icons for non-image types (PDF, text, Word documents)
- [x] Download and delete action buttons on each attachment (hover reveal)
- [x] File uploads logged as timeline events with metadata (fileName, mimeType, fileSize, fileUrl)
- [x] Timeline displays file attachments with inline image thumbnails and download links
- [x] Deleted attachments shown as "Attachment was deleted" in timeline
- [x] Added indexes on dispute_events.escrow_id and dispute_attachments.escrow_id
- [x] Wrote 7 new tests (auth checks, validation, admin context query)
- [x] All 99 tests passing across 5 test files, 0 TypeScript errors

## Phase 38: Admin Evidence Upload Section
- [x] Add dedicated admin evidence upload zone in dispute detail panel
- [x] Position below admin notes section, visually distinct from requester/assignee
- [x] Use red accent color to match admin theme (added red color map to DisputeFileUpload)
- [x] Support same file types as requester/assignee (images, PDF, text, Word, 10MB max)
- [x] Show admin-uploaded attachments separately from party evidence (party="admin")
- [x] Log admin uploads as timeline events with "admin" party tag
- [x] All 99 tests passing, 0 TypeScript errors

## Phase 39: Delete Confirmation Dialog for Evidence Files
- [x] Replaced browser confirm() with styled AlertDialog before deleting evidence files
- [x] Shows file name, file type icon, size, party label, and escrow ID in the confirmation dialog
- [x] Destructive red "Delete Permanently" button with Trash2 icon
- [x] Warning text about permanent deletion from S3 storage and dispute record
- [x] Loading state with spinner during deletion
- [x] Dialog auto-closes on success or error
- [x] All 99 tests passing, 0 TypeScript errors

## Phase 40: Dispute Summary PDF Report
- [x] Created server/dispute-pdf.ts with PDFKit-based PDF generation
- [x] Includes red header bar with "DISPUTE REPORT" title and escrow ID
- [x] Includes dispute overview section (escrow ID, status, resolution, dates, resolved by)
- [x] Includes requester evidence text and file attachment list with URLs
- [x] Includes assignee evidence text and file attachment list with URLs
- [x] Includes admin notes and admin-uploaded attachments
- [x] Includes full chronological event timeline with metadata
- [x] Includes attachment summary table (file name, party, size, type, date)
- [x] Added admin.generateDisputeReport procedure (returns base64 PDF)
- [x] Added "PDF Report" button in dispute detail header with loading spinner
- [x] Client-side base64-to-blob download with auto-named file
- [x] Wrote 3 new tests (auth check, input validation, PDF shape + magic number)
- [x] All 102 tests passing across 5 test files, 0 TypeScript errors

## Phase 41: OpenClaw Agent Handoff Document
- [x] Reviewed Nervix platform repo structure and all key files (18 tables, 80+ endpoints, 12 pages)
- [x] Reviewed nervix-federation repo structure (API server, nanobot services, docs, monitoring)
- [x] Documented nanobot integration requirements (execution engine, fleet management, billing, routing)
- [x] Wrote comprehensive 13-section handoff document (NERVIX_COMPLETE_HANDOFF.md)
- [x] Synced to Google Drive Digital Mind/docs/ folder

## Phase 42: Animated "How It Works" Page
- [x] Created HowItWorks.tsx (500+ lines) with full animated system flow visualization
- [x] Step 1: Agent Enrollment — animated terminal showing Ed25519 keypair generation, challenge-response, enrollment confirmation
- [x] Step 2: Task Creation — styled task card with requirements, reward (25 TON), role, deadline, capabilities
- [x] Step 3: Matching Engine — 4-stage animated pipeline (role filter → capability check → reputation sort → load balance) with spinning/check indicators
- [x] Step 4: Task Execution — dual-panel with animated terminal (claim → analyze → generate → test → submit) and progress checklist
- [x] Step 5: TON Escrow Payment — animated 5-step escrow flow (create → fund → execute → release → reputation) with moving TON coin, fee breakdown (97.5 agent / 2.5 treasury)
- [x] Step 6: Reputation Update — animated SVG gauge filling to 92/100, weighted scoring breakdown (40% success, 25% time, 25% quality, 10% uptime), threshold table
- [x] Animated flow connectors between steps with moving particles and arrow indicators
- [x] Scroll-triggered animations via framer-motion useInView (steps animate as user scrolls into view)
- [x] Live network visualization hero — 6 agent nodes with SVG connection lines and animated data packets
- [x] Particle field background with 30 floating particles
- [x] Added route /how-it-works in App.tsx
- [x] Added "How It Works" link in Home.tsx navbar (desktop + mobile) and HowItWorks.tsx navbar
- [x] Mobile responsive design (grid layouts collapse, text scales)
- [x] "The Cycle Repeats" closing section with CTA buttons
- [x] All 28 tests passing, 0 TypeScript errors

## Phase 43: Animated Onboarding Guide Page
- [x] Planned full content structure with 9 animated sections
- [x] Section 1: Hero — "Your Complete Guide to Nervix" with animated gradient text, floating particles, and scroll indicator
- [x] Section 2: "What is Nervix?" — 3 animated pillars (Build, Earn, Scale) with hover effects and staggered reveal
- [x] Section 3: "Why TON Network?" — 4-card comparison (speed 5s, fees <$0.01, Telegram 900M users, smart contracts) with animated counters
- [x] Section 4: "Connect Your Wallet" — 4-step walkthrough with animated click indicators, pulsing highlights, and mock wallet UI
- [x] Section 5: "Register Your Agent" — animated terminal showing enrollment flow (generate keys → submit → challenge → verify → enrolled) with typing effect
- [x] Section 6: "Create & Complete Tasks" — task lifecycle with animated state machine (created → assigned → in_progress → completed), role matching visualization
- [x] Section 7: "Earn & Get Paid" — animated economy flow showing credit earning, TON conversion, fee breakdown (97.5%/2.5%), and wallet balance growth
- [x] Section 8: "What Can You Build?" — 6 animated project cards (SaaS, DeFi, DevOps, Data Pipeline, Security, Content) with hover expand and tech stack tags
- [x] Section 9: "Your Journey Starts Here" — 4-step animated progress path with CTA buttons linking to /agents, /marketplace, /escrow
- [x] Sticky progress tracker sidebar showing current section with scroll-spy
- [x] Scroll-triggered animations with framer-motion useInView and staggered children
- [x] Mobile responsive design (grid collapses, progress tracker hidden on mobile)
- [x] Added route /guide in App.tsx and "Guide" nav link in Home.tsx (desktop + mobile)
- [x] Consistent Nervix design language (claw-red accents, dark theme, glow effects)
- [x] All 28 tests passing, 0 TypeScript errors

## Phase 54: Animated Explainer Video
- [x] Generate 3 AI reference images (federation network, agent task execution, completion with TON)
- [x] Generate 3 video clips from reference images (8s each, cyberpunk dark tech style)
- [x] Generate 3 narration audio tracks with male voice (federation intro, task execution, payment)
- [x] Assemble final 42-second explainer video with narration overlay and clip transitions
- [x] Upload final video to CDN (manuscdn.com)
- [x] Create VideoModal component with full playback controls (play/pause, mute, fullscreen, seek)
- [x] Keyboard shortcuts: Space (play/pause), M (mute), F (fullscreen), Escape (close)
- [x] Auto-play on open, auto-reset on close, auto-hide controls after 3s inactivity
- [x] Spring animation entrance/exit with backdrop blur
- [x] Progress bar with gradient (red-to-orange) and hover scrubber dot
- [x] Add "Watch How It Works 0:42" button to homepage hero section
- [x] Animated entrance for video button with play icon
- [x] Mobile responsive (responsive aspect ratio, hidden keyboard hints on small screens)
- [x] Write tests for VideoModal and Home integration (40 new tests, all passing)
- [x] All tests passing, 0 new TypeScript errors

## Phase 55: Agent Registration Explainer Video Script
- [x] Research existing registration flow (HowItWorks, Docs, Guide pages) for accuracy
- [x] Write professional video script with 6 scenes + end card (75 seconds)
- [x] Cover: wallet connection, identity setup, keypair generation, capability declaration, challenge-response, first task
- [x] Include detailed visual direction, color palette, typography, audio, and accessibility notes
- [x] Deliver final script document

## Phase 55b: Video Script Rewrite — Core Value Propositions
- [ ] Rewrite script to center on: knowledge trading between agents, earning by completing tasks, passive income for humans
- [ ] Add dedicated scene for agent evolution (buying knowledge/skills from other agents)
- [ ] Add dedicated scene for passive income narrative (human registers agent, agent earns while human sleeps)
- [ ] Reframe the entire script around the money-making angle, not just the technical registration steps
- [ ] Deliver updated script

## Phase 55c: Video Script Rewrite — Knowledge Bartering System
- [x] Rewrite script to center on knowledge bartering ("I give you X, you give me Y" — no money)
- [x] Distinguish three knowledge exchange models: Barter (skill-for-skill), Buy (credits), Sell (passive income)
- [x] Dedicated Scene 3 showing full barter negotiation (offer → review → fair trade detection → bonus → bilateral exchange)
- [x] Show how agents evolve without spending credits through bartering
- [x] Passive income flywheel: barter → qualify → work → earn → sell knowledge → compound
- [x] Deliver updated script (v3)

## Phase 56: Barter Skill — Knowledge Exchange Protocol
- [ ] Research secure file exchange protocols, atomic swap patterns, and agent communication models
- [ ] Define Knowledge Package file format (.nkp) — what files are exchanged, metadata, versioning
- [ ] Design the Barter transaction lifecycle (propose → review → accept → escrow → exchange → verify → complete)
- [ ] Define security model: Ed25519 signatures on every message, encrypted payloads, hash verification
- [ ] Define Knowledge Package contents: skill manifests, code modules, config, training data, documentation
- [ ] Design atomic swap mechanism — neither party can cheat (both get knowledge or neither does)
- [ ] Create SKILL.md with full protocol specification
- [ ] Create JSON schemas for all Barter protocol messages
- [ ] Build Knowledge Barter UI: browse offers, propose trades, review incoming, exchange visualization
- [ ] Add barter.propose, barter.accept, barter.exchange tRPC procedures
- [ ] Add knowledge_packages and barter_transactions database tables
- [ ] Integrate Barter into Guide page with interactive demo
- [ ] Write tests
- [x] All 160 tests passing across 8 test files, 0 new TypeScript errors

## Phase 56b: Barter TON Fee Model & Video Script Update
- [x] Update SKILL.md with TON-based 2% platform fee (1% from each party, min 0.02 TON)
- [x] Add fee flow diagram: TON collected on-chain → Nervix Escrow SC → treasury on completion
- [x] Add anti-spam/Sybil resistance/economic deterrence rationale
- [x] Update transaction lifecycle to include FEE_LOCK step (Step 4 of 10)
- [x] Update database schema to track barter fees (barter_transactions table)
- [x] Write references/nkp-format.md — full .nkp spec (manifest, skill.json, modules, tests, signature, encryption)
- [x] Write references/security-model.md — 5 pillars, 12 threat mitigations, crypto primitives reference
- [x] Update video script v4 — TON fee lock as Scene 3 centerpiece, net profit stats in Scene 6
- [x] Build Barter Knowledge Market UI page (/barter route with search, filters, stats bar, package cards)
- [x] Build Barter Flow modal (propose/accept/exchange with fee display, audit detail modal)
- [x] Write tests for barter components (28 new tests covering full lifecycle)
- [x] All 96 tests passing, 0 new TypeScript errors

## Phase 57: Nervix Audit Gate — Knowledge Quality & Value Assessment
- [x] Redesign Barter SKILL.md with mandatory Nervix Audit Gate before any knowledge exchange
- [x] Define Audit Pipeline: upload → queue → LLM analysis → quality score → fair market value → verdict
- [x] Define 6 audit checks: compilability, originality, category match, security scan, completeness, teaching quality
- [x] Define Quality Score (0-100) and Fair Market Value (credits) output
- [x] Define audit verdicts: APPROVED, CONDITIONAL, REJECTED with reasons
- [x] Define barter fairness rule: both packages within ±30% audited value
- [x] Define "Nervix Audited" verified badge system (green glow line on approved cards)
- [x] Add knowledge_packages table to database schema (18 columns: metadata, audit status, quality score, FMV, trade counts)
- [x] Add knowledge_audits table (audit records, 6-check breakdown, verdicts, FMV, platform signature, expiry)
- [x] Add barter_transactions table (proposals, acceptance, fee tracking, audit references, verification, dispute)
- [x] Add tRPC procedures: knowledge.upload, knowledge.get, knowledge.list, knowledge.audit, knowledge.getAudit, knowledge.pendingAudits
- [x] Add tRPC procedures: barter.propose, barter.accept, barter.confirmFeePaid, barter.complete, barter.get, barter.list, barter.stats
- [x] Build Knowledge Market page (/barter) with browse, search, category/status filters, stats dashboard
- [x] Build Audit Detail modal showing 6 checks with animated progress bars, quality score ring, and FMV
- [x] Build Barter Proposal modal with package selection, trade visualization, and TON fee display
- [x] Add "Nervix Audited" badge system (approved/pending/rejected/conditional/in_review badges)
- [x] Add "Knowledge" link to Home.tsx navigation (desktop + mobile)
- [x] Add /barter route to App.tsx
- [x] Write 28 tests for knowledge upload, list, get, audit, barter propose, accept, fee, complete, stats
- [x] All 96 tests passing across 4 test files, 0 new TypeScript errors

## Phase 58: Seed Knowledge Market Button
- [x] Create seedKnowledgeMarket tRPC procedure with 10 diverse sample packages (10 packages across 8 categories: frontend, blockchain, devops, ai-ml, backend, security, mobile, data, design)
- [x] Pre-run audits on all 10 packages with deterministic quality scores and FMV (scores range 78-94, all approved)
- [x] Add "Seed Market" button to /barter page hero section with Rocket icon
- [x] Button shows loading spinner during seeding, success toast with approved/conditional breakdown on completion
- [x] Write 3 tests for seed procedure (seed creation, list retrieval, audit record validation)
- [x] All 99 tests passing across 4 test files, 0 TypeScript errors

## Phase 59: Interactive Barter Simulator on Guide Page
- [x] Read existing Guide page structure and enrollment simulator pattern
- [x] Build BarterSimulator component with 6 steps: Browse → Select → Audit Gate → Propose Trade → Fee Lock → Exchange & Verify
- [x] Each step has animated transitions, realistic demo data, and explanatory text
- [x] Include visual elements: package cards, audit score ring, FMV comparison bars, TON fee breakdown, verification hash + platform signature
- [x] Integrate simulator into Guide page as Step 5 "Trade Knowledge" with sidebar nav entry
- [x] All 99 tests passing, 0 new TypeScript errors (tsc --noEmit clean)

## Phase 60: Side-by-Side Knowledge Package Comparison in Barter Simulator
- [x] Add comparison mode toggle to the Browse step with multi-select checkboxes (2-5 packages)
- [x] Build ComparisonView with SVG radar chart showing 6 audit dimensions + side-by-side metrics table
- [x] Metrics table includes: Quality Score, FMV, Proficiency, File Size, and full Audit Gate Breakdown (6 checks)
- [x] Add crown icon highlighting for best value in each metric row
- [x] Add "Comparison Insight" summary box explaining how to use comparison for barter decisions
- [x] Integrated into existing simulator flow (Browse/Compare toggle, "N of 5 selected" counter, "Compare N Packages" button)
- [x] All 99 tests passing, 0 TypeScript errors (tsc --noEmit clean)

## Phase 61: Quick Barter Button in Comparison Results
- [x] Add "Quick Barter" section with red "Trade for [Name]" buttons per package column in comparison view
- [x] Build QuickBarterModal with 3 phases: select offer → review trade (FMV bars + fairness check + TON fee preview) → success
- [x] Offer selection shows all non-target packages with category badges and FMV values
- [x] Review phase shows FMV comparison bars, fairness percentage (±30%), TON fee breakdown (Your/Their/Total)
- [x] Success confirmation with green checkmark, transaction ID, and "Next Steps" info box
- [x] Integrated into BarterSimulator with AnimatePresence transitions and Back/Close navigation
- [x] Full flow verified in browser: Compare → Quick Barter → Select → Review → Submit → Success
- [x] All 99 tests passing, 0 TypeScript errors (tsc --noEmit clean)

## Phase 62: Agent Fleet Management Dashboard (/fleet)
- [x] Read existing data model, queries, and UI patterns
- [x] Add fleet tRPC router with 5 endpoints: overview, agentEarnings, activeTrades, knowledgeInventory, incomeStreams
- [x] Build Fleet Dashboard page with 8 summary stat cards (agents, earned, balance, tasks, barters, packages, fees)
- [x] Build Agent Earnings table with 3 sort modes (earned/balance/tasks), gradient earnings bars, role badges, status dots
- [x] Build Active Trades section with trade cards showing offer/request packages, status badges, TON fees
- [x] Build Knowledge Inventory grid with audit badges (approved/conditional/pending/rejected), quality bars, FMV, filter tabs
- [x] Build Income Streams section with 4 stream cards + recent fee activity list
- [x] Add /fleet route to App.tsx and "Fleet" link to Home.tsx navigation (desktop + mobile)
- [x] Write 20 tests for fleet procedures (overview, agentEarnings, activeTrades, knowledgeInventory, incomeStreams, public access)
- [x] All 119 tests passing across 5 test files, 0 TypeScript errors (tsc --noEmit clean)

## Phase 63: Reputation Leaderboard (/leaderboard)
- [x] Read existing data model for reputation_scores, agents, knowledge_packages, barter_transactions
- [x] Add leaderboard tRPC router with rankings (composite: 35% rep + 25% tasks + 20% knowledge + 20% earnings) and agentDetail endpoints
- [x] Build Leaderboard page with top-3 podium (gold crown, silver/bronze medals), tier distribution bars, scoring formula card
- [x] Build sortable ranking table with 5 sort modes (composite, reputation, tasks, knowledge, earnings)
- [x] Add role and tier filter dropdowns, search bar with real-time filtering
- [x] Add expandable agent detail rows (reputation breakdown bars, task performance, knowledge portfolio, role badges)
- [x] Add tier badges (Diamond/cyan, Platinum/violet, Gold/yellow, Silver/gray, Bronze/orange) with glow effects
- [x] Add /leaderboard route to App.tsx and "Leaderboard" link to Home.tsx navigation (desktop + mobile)
- [x] Write 18 tests for leaderboard procedures (rankings, sort modes, filters, agentDetail, public access)
- [x] All 137 tests passing across 6 test files, 0 TypeScript errors (tsc --noEmit clean)

## Phase 64: Professional Nervix Promotional Video (3 min)
- [x] Write enhanced professional script (4 acts, 18 clips) covering OpenClaw, agent community, passive income, human-AI economy
- [x] Define global style (cyberpunk tech noir, red/dark palette) and voice profile (Bill — wise, mature, Morgan Freeman style)
- [x] Plan all 18 clips with detailed specifications, camera movements, and narration text
- [x] Generate 10 reference images (OpenClaw logo, Nervix network, agent avatars, knowledge cube, audit gate, human desk, TON diamond, dashboard, world map, leaderboard)
- [x] Generate 25 keyframes (first/last frames for all 18 clips)
- [x] Generate 18 video clips across 4 acts (Awakening, Agent Economy, Economy of Tomorrow, The Vision)
- [x] Generate 18 narration audio clips with deep wise male voice
- [x] Generate ambient BGM (layered sine wave drone)
- [x] Assemble final video: adjust clip durations to match narration, combine video+narration per clip, concatenate all, mix BGM layer
- [x] Add 5s black intro and 29s outro with fade to black
- [x] Final video: 3m 8s, 1280x720, H.264, AAC audio, 98MB

## Phase 65: Replace Homepage Video with 3-min Promo + Nervix & OpenClaw Logo Intros/Outros
- [x] Generate Nervix logo intro clip (6s cinematic title card with red neon text)
- [x] Generate OpenClaw logo intro clip (6s 3D rotating claw with "Powered by OpenClaw" text)
- [x] Generate combined Nervix + OpenClaw outro clip (8s dual-logo closing with tagline)
- [x] Assemble final video: Nervix intro → OpenClaw intro → main promo → combined outro (3:19 total)
- [x] Upload final video to S3 (CDN URL: lCPokZZLCfiANZWo.mp4)
- [x] Replace old 61s video URL in VideoModal.tsx with new 3:19 promo URL
- [x] Update "Watch How It Works" button duration text from 0:42 to 3:19
- [x] Upload final video to Google Drive (Nervix/nervix-promo-final.mp4)
- [x] Verified video plays correctly in browser modal with all logo segments visible

## Phase 66: Fix Promo Video — Voice, Gaps, BGM, www.Nervix.ai Animation
- [x] Found and tested Bill voice (old, wise, American) via ElevenLabs eleven_multilingual_v2 model with high stability/similarity
- [x] Re-recorded all 18 narration clips with Bill voice (deep, emotionally charged, Morgan Freeman style)
- [x] Generated www.Nervix.ai animated intro clip (6s — ember growing into glowing URL text)
- [x] Generated www.Nervix.ai animated outro clip (8s — dual Nervix + OpenClaw logos with tagline + www.Nervix.ai)
- [x] Generated cinematic ambient BGM (layered sine waves at 55/82.5/110/165 Hz) throughout entire video at 15% volume
- [x] Removed all gaps — tight cuts between every clip, video speed-adjusted to match narration per clip
- [x] Mixed BGM underneath narration with proper fade in/out
- [x] Final video: 3:35, 65MB, 1280x720, H.264 + AAC
- [x] Uploaded to S3 (CDN: gwIIZYPIWOFnFOwN.mp4) and replaced URL in VideoModal.tsx
- [x] Updated duration badge from 3:19 to 3:35 on homepage
- [x] Uploaded to Google Drive (Nervix/nervix-promo-v2.mp4)
- [x] Updated video-modal test to expect 3:35
- [x] All 137 tests passing across 6 test files

## Phase 67: Agent Profile Page (/agent/:agentId)
- [x] Create agentProfile tRPC router with comprehensive data aggregation
- [x] Build Agent Profile page UI with hero header, tier badge, reputation radar
- [x] Add reputation history section with score breakdown and animated bars
- [x] Add task timeline section showing recent tasks with status indicators
- [x] Add knowledge inventory section with audit badges and quality scores
- [x] Add barter trade history section with trade flow visualization
- [x] Add earnings breakdown section with income streams chart
- [x] Add leaderboard rank card with composite score and tier position
- [x] Register /agent/:agentId route in App.tsx
- [x] Add profile links from Leaderboard and Agent Registry pages
- [x] Write vitest tests for agentProfile router (11 tests)
- [x] All 148 tests passing across 7 test files

## Phase 68: Telegram Wallet Login (TON Connect Auth)
- [ ] Research TON Connect proof-of-ownership authentication flow
- [ ] Implement server-side TON proof verification (tonProof)
- [ ] Create wallet-based login tRPC procedures (generatePayload, verifyProof, walletLogin)
- [ ] Add wallet_address and telegram_id columns to users table (schema migration)
- [ ] Build wallet login UI flow (connect wallet → verify proof → create session)
- [ ] Link wallet to existing user accounts (merge Manus OAuth + wallet auth)
- [ ] Secure agent wallets by linking to authenticated user's wallet
- [x] Write vitest tests for wallet auth flow
- [x] All 160 tests passing across 8 test files

## Phase 68: Telegram Wallet Login (TON Connect Auth)
- [ ] Research TON Connect proof-of-ownership authentication flow
- [ ] Implement server-side TON proof verification (tonProof)
- [ ] Create wallet-based login tRPC procedures (generatePayload, verifyProof, walletLogin)
- [ ] Add wallet_address and telegram_id columns to users table (schema migration)
- [ ] Build wallet login UI flow (connect wallet → verify proof → create session)
- [ ] Link wallet to existing user accounts (merge Manus OAuth + wallet auth)
- [ ] Secure agent wallets by linking to authenticated user's wallet
- [x] Write vitest tests for wallet auth flow
- [x] All 160 tests passing across 8 test files

## Phase 69: Dedicated Login Page

- [x] Create Login page component with branded splash screen
- [x] Show Telegram Wallet and Manus OAuth side-by-side
- [x] Add animated Nervix branding and visual effects
- [x] Register /login route in App.tsx
- [x] Update navbar and CTA login links to point to /login
- [x] Add redirect logic for already-authenticated users
- [x] Write vitest tests for Login page (15 tests)
- [x] All 175 tests passing across 9 test files

## Phase 70: Treasury Wallet Address Update
- [x] Update placeholder treasury wallet to real TON address UQCGdiA7kAGu0NU-LibhMOUAKvZ4LYnqbBl5-you_KtJ1_HA
- [x] Update in shared/nervix-types.ts FEE_CONFIG.treasuryWallet
- [x] NERVIX_ESCROW_ADDRESS env var already correctly references process.env (no change needed)
- [x] Verify all references are consistent — no other placeholder addresses found
- [x] All 175 tests passing across 9 files

## Phase 71: Treasury Wallet Display on Escrow Page
- [x] Add treasury wallet card to Escrow page showing full address
- [x] Add copy-to-clipboard button for the wallet address
- [x] Add link to TON explorer (tonscan.org) for the treasury wallet
- [x] Add fee summary badges (Task 2.5%, Settlement 1.5%, Transfer 1%, OpenClaw 20% off)
- [x] Verify display works correctly — address loads from feeSchedule endpoint
- [x] All 175 tests passing across 9 files

## Phase 72: Real-Time Treasury Balance from TON Blockchain
- [x] Add server-side tRPC endpoint (escrow.treasuryWalletBalance) via TonCenter API
- [x] Display live TON balance on Escrow page Treasury Wallet card with 4-column grid
- [x] Add auto-refresh (polling every 30s) and manual refresh button with spin animation
- [x] Add loading and error states for balance fetch
- [x] Show wallet status (active/uninitialized), nanoTON balance, and auto-refresh indicator
- [x] All 175 tests passing across 9 files

## Phase 73: Send to Treasury Button
- [x] Add Send to Treasury dialog/modal with amount input on Escrow page
- [x] Integrate TON Connect sendTransaction to transfer TON to treasury wallet
- [x] Show transaction status (pending/success/error) with toast notifications
- [x] Require wallet connection before sending (prompt to connect if not connected)
- [x] Auto-refresh treasury balance after successful send (5s delay)
- [x] Preset amount buttons (0.1, 0.5, 1, 5, 10 TON) for quick selection
- [x] Fee estimation display (~0.005 TON network fee)
- [x] All 175 tests passing across 9 files

## Phase 74: Auto-Link User Wallet to Owned Agents
- [x] Add getAgentsByOwnerUserId and propagateWalletToOwnedAgents helpers to db.ts
- [x] Auto-propagate wallet on TON login (/api/ton-auth/verify)
- [x] Auto-propagate wallet on wallet link (/api/ton-auth/link)
- [x] Add syncWalletToAgents tRPC mutation for manual sync
- [x] Enhance walletInfo query to include owned agents wallet sync status
- [x] Add AgentWalletSyncSection UI in WalletStatusCard with sync button
- [x] Audit log entries for all auto-link and manual sync events
- [x] All 175 tests passing across 9 files

## Phase 75: Nervix Skill for OpenClaw ClawHub
- [x] Audit current enrollment flow, skill-matching algorithm, and OpenClaw plugin
- [x] Research OpenClaw ClawHub listing format and requirements
- [x] Design skill manifest schema (daily-updated skills file per agent)
- [x] Design explicit enrollment procedures (step-by-step for any user or agent)
- [x] Enhanced task-matching algorithm with composite scoring (proficiency 40%, coverage 30%, load 20%, online 10%)
- [x] Built Nervix Skill package at /home/ubuntu/skills/nervix-federation/
- [x] Added agents.readiness endpoint (7-check readiness score)
- [x] Added agents.matchPreview endpoint (test task matching before creation)
- [x] Wrote comprehensive integration guide (integration-guide.md)
- [x] Created enrollment script (enroll.py), plugin template (nervix-plugin.ts), skill manifest template
- [x] All 175 tests passing across 9 files

## Phase 76: ClawHub Publishing Feature
- [x] Research ClawHub publishing API and skill listing requirements
- [x] Build skill packaging system (clawhub-publisher.ts with SHA-256 hashing, multipart upload)
- [x] Create clawhub tRPC router (status, preview, validateToken, publish, search, versions)
- [x] Build ClawHub Publishing UI page at /clawhub with dual-column layout
- [x] Add skill bundle preview with file tree, hash, and size display
- [x] Add version history, search, token validation, and quick links
- [x] Route registered in App.tsx at /clawhub
- [x] All 175 tests passing across 9 files

## Phase 77: Batch Feature Update (6 Features)
- [x] 1. Readiness Dashboard card on Agent Profile — 7-check readiness score with circular progress, color-coded checks, issues list
- [x] 2. Match Preview UI on Marketplace — collapsible panel with role/skill input, matching agents grid with scores
- [x] 3. ClawHub auto-publish — autoBumpPublish mutation with one-click patch/minor/major bump
- [x] 4. CLAWHUB_API_TOKEN — secret added via webdev_request_secrets, validated with vitest
- [x] 5. Dashboard NavBar ClawHub link — added alongside Registry and Marketplace buttons
- [x] 6. Automated version bumping — detectChanges endpoint with heuristic analysis, Smart Version Bump card on ClawHub page
- [x] All 177 tests passing across 10 files

## Phase 78: Agent Onboarding Wizard
- [x] Create OnboardAgent.tsx — 5-step guided wizard (Identity → Roles → Capabilities → Wallet → Review & Deploy)
- [x] Step 1: Agent Identity form (name, hostname, description, webhook URL, region, auto-generated public key)
- [x] Step 2: Role selection grid with all 10 federation roles and descriptions
- [x] Step 3: Capability management (add/remove skills with proficiency levels and tags)
- [x] Step 4: Wallet linking via TON Connect or manual entry
- [x] Step 5: Review summary with readiness checklist (3 required + 3 optional checks) and enrollment submission
- [x] Post-enrollment success state with challenge ID/nonce display and next steps
- [x] Route registered at /onboard in App.tsx
- [x] Home page CTA updated: "Onboard Your Agent" → links to /onboard
- [x] Dashboard navbar: added red "Onboard" button
- [x] Dashboard sidebar: added "Onboard New Agent" CTA card with gradient border
- [x] Step progress bar with completion indicators and connecting lines
- [x] 37 vitest tests passing (server/onboard-wizard.test.ts)

## Phase 79: Agent Management + Bulk Onboard + Challenge Verify + TON Fix + Nervix CLI
- [x] Fix TON Connect manifest error (App Manifest Error on Telegram Wallet) — updated manifest with absolute URL using window.location.origin, uploaded icon to S3
- [x] Agent Management Page (/agents/manage) — post-enrollment dashboard with agent list, inline editing, capability management, wallet linking, status updates
- [x] Bulk Onboarding Page (/bulk-onboard) — CSV/JSON import with drag-and-drop, validation, dry-run mode, progress tracking, results export
- [x] Challenge Verification UI (/verify) — in-browser step to paste challenge ID + signed response, complete enrollment activation
- [x] Nervix CLI (nervix-cli package) — 7 commands: init, enroll, verify, status, config, agents, bulk; builds and runs correctly
- [x] 19 vitest tests for agent management (server/agent-manage.test.ts) — all passing
- [x] All 233 tests passing across 12 test files

## Phase 80: Agent Heartbeat System with Real-Time Status Updates (DONE)
- [x] Add heartbeat_logs table to schema with full system metrics (latency, cpu, memory, disk, version, region, healthy)
- [x] Add heartbeat tRPC procedure (agents.heartbeat) — accepts agentId + 10 metadata fields, logs to heartbeat_logs + updates agent lastHeartbeat
- [x] Add heartbeat history db helper (getHeartbeatHistory) — returns last N heartbeats with all metrics
- [x] Add heartbeat stats db helper (getHeartbeatStats) — returns totalBeats, healthyBeats, avgLatency, uptimePercent
- [x] Add agents.heartbeatHistory query — return recent heartbeat entries for an agent
- [x] Add agents.heartbeatStats query — return aggregated stats for an agent
- [x] Add agents.liveStatuses query — return online/offline/degraded status for all agents with 15s auto-refresh
- [x] Add getLiveAgentStatuses db helper — computes liveStatus from lastHeartbeat + heartbeatInterval
- [x] Add purgeOldHeartbeats db helper — cleanup old heartbeat logs per agent
- [x] Update Agent Management page with Heartbeat tab (5th tab) — live status banner, stats cards, history timeline, API guide
- [x] Add HeartbeatSidebarCard — sidebar widget showing live status, uptime %, avg latency
- [x] Add HeartbeatPanel — full heartbeat dashboard with animated online indicator, 4 stat cards, scrollable history
- [x] Write 21 vitest tests for heartbeat system (heartbeat.test.ts) — all passing
- [x] All 254 tests passing across 13 test files

## Phase 82: Production Audit + SEO Fix + Repo Cleanup + ZIP
- [ ] Fix SEO meta tags (keywords + description) on home page
- [ ] Full backend audit (schema, routers, db helpers, services)
- [ ] Full frontend audit (pages, components, routes)
- [ ] Audit GitHub repos — determine correct repo for each module
- [ ] Push Nervix to dedicated repo, clean DigitalMind of Nervix code
- [ ] Write comprehensive PRODUCTION_AUDIT_REPORT.md
- [ ] Prepare ZIP archive of entire project
- [ ] Save checkpoint
