-- NERVIX Federation: Database Performance Indexes
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Date: 2026-03-01 | Task: P2-T1
-- Safe to run multiple times (IF NOT EXISTS)

-- ═══════════════════════════════════════════════════════════════════════════════
-- AGENTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
-- Fleet page filters by status, heartbeat monitor scans by status
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents ("status");
-- Lookup by agentId is already covered by UNIQUE constraint, but compound index helps
CREATE INDEX IF NOT EXISTS idx_agents_last_heartbeat ON agents ("lastHeartbeat") WHERE "status" = 'active';

-- ═══════════════════════════════════════════════════════════════════════════════
-- TASKS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
-- Marketplace filters by status, task timeout job scans in_progress tasks
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks ("status");
-- "My tasks" queries filter by requesterId
CREATE INDEX IF NOT EXISTS idx_tasks_requester ON tasks ("requesterId");
-- Agent's assigned tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks ("assigneeId") WHERE "assigneeId" IS NOT NULL;
-- Task timeout job needs status + createdAt for overdue check
CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks ("status", "createdAt") WHERE "status" = 'in_progress';

-- ═══════════════════════════════════════════════════════════════════════════════
-- ECONOMIC TRANSACTIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
-- Agent transaction history
CREATE INDEX IF NOT EXISTS idx_econ_tx_from ON economic_transactions ("fromAgentId");
CREATE INDEX IF NOT EXISTS idx_econ_tx_to ON economic_transactions ("toAgentId");
-- Treasury fee queries
CREATE INDEX IF NOT EXISTS idx_econ_tx_type ON economic_transactions ("type");

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUDIT LOG TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
-- Filter audit by event type (enrollment, transfers, etc.)
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log ("eventType");
-- Filter audit by actor (who did what)
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log ("actorId") WHERE "actorId" IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- A2A MESSAGES TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
-- Webhook delivery targets (agent inbox)
CREATE INDEX IF NOT EXISTS idx_a2a_to_agent ON a2a_messages ("toAgentId");
-- Webhook retry job scans failed messages
CREATE INDEX IF NOT EXISTS idx_a2a_status ON a2a_messages ("status") WHERE "status" IN ('queued', 'failed');

-- ═══════════════════════════════════════════════════════════════════════════════
-- REPUTATION SCORES TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
-- Leaderboard sorts by overallScore
CREATE INDEX IF NOT EXISTS idx_reputation_score ON reputation_scores ("overallScore" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- AGENT SESSIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
-- Token lookup for agentProcedure auth (CRITICAL for every authenticated request)
CREATE INDEX IF NOT EXISTS idx_sessions_token ON agent_sessions ("accessToken") WHERE "isRevoked" = false;
-- Session cleanup job scans by expiry
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_expiry ON agent_sessions ("refreshTokenExpiresAt");

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENROLLMENT CHALLENGES TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
-- Enrollment cleanup job scans pending challenges
CREATE INDEX IF NOT EXISTS idx_enrollment_status ON enrollment_challenges ("status") WHERE "status" = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════════
-- HEARTBEAT LOGS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
-- heartbeat_logs uses "timestamp" column, not "createdAt"
CREATE INDEX IF NOT EXISTS idx_heartbeat_agent ON heartbeat_logs ("agentId", "timestamp" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- Run this after to verify all indexes were created:
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%' ORDER BY tablename;
