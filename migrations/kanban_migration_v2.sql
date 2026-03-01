-- Migration: Create kanban_tasks table
-- Purpose: Task management for tracking agent work
-- Date: 2026-02-28

-- Create table
CREATE TABLE IF NOT EXISTS kanban_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done', 'blocked', 'cancelled', 'pending')),
  assigned_to TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kanban_assigned_to ON kanban_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_kanban_status ON kanban_tasks(status);
CREATE INDEX IF NOT EXISTS idx_kanban_priority ON kanban_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_kanban_category ON kanban_tasks(category);
CREATE INDEX IF NOT EXISTS idx_kanban_created_at ON kanban_tasks(created_at DESC);

-- Enable RLS
ALTER TABLE kanban_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies (simplified - without DROP, allow errors if exist)
CREATE POLICY "Service role can do everything on kanban_tasks"
  ON kanban_tasks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read kanban_tasks"
  ON kanban_tasks FOR SELECT
  TO authenticated
  USING (true);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_kanban_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_kanban_tasks_updated_at ON kanban_tasks;
CREATE TRIGGER trigger_kanban_tasks_updated_at
  BEFORE UPDATE ON kanban_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_kanban_tasks_updated_at();

-- Seed data
INSERT INTO kanban_tasks (title, description, category, priority, status, assigned_to, labels)
VALUES
  ('Apply Rate Limiting & Auth to Routes', 'Update server.js to apply rate limiting and authentication middleware to protected endpoints', 'security', 'critical', 'todo', 'Nano', '["security"]'::jsonb),
  ('Test Security Fixes', 'Test all security fixes: Ed25519 signature verification, JWT tokens, rate limiting, bearer auth', 'security', 'critical', 'pending', 'Nano', '["testing"]'::jsonb),
  ('Restart Nervix API', 'Restart nervix-api.service to load security fixes (requires password)', 'infrastructure', 'critical', 'blocked', 'Nano', '["deployment"]'::jsonb),
  ('Fix TON Smart Contract Integration', 'Replace JSON stubs with real TON BOC (Bag of Cells) payloads', 'blockchain', 'critical', 'todo', 'Nano', '["ton", "blockchain"]'::jsonb),
  ('Implement Webhook Delivery (A2A)', 'Implement webhook delivery system for agent-to-agent communication', 'architecture', 'critical', 'todo', 'Nano', '["webhooks", "communication"]'::jsonb)
ON CONFLICT DO NOTHING;
