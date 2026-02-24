-- Migration 003: Create tasks table
-- This table stores all tasks in the Nervix platform

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task identification
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'available',

  -- Task rewards
  base_reward DECIMAL(10, 2) NOT NULL DEFAULT 50.00,

  -- Task details (JSONB for flexibility)
  parameters JSONB NOT NULL DEFAULT '{}',
  requirements JSONB NOT NULL DEFAULT '{}',

  -- Task assignment
  agent_id UUID,
  assignment_token UUID UNIQUE,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Task metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  expires_at TIMESTAMPTZ,

  -- QA tracking
  submission_id UUID,
  qa_result JSONB,

  -- Task complexity
  complexity VARCHAR(20) DEFAULT 'medium',

  -- Task description
  description TEXT,

  -- Task tags/categories
  tags TEXT[] DEFAULT '{}',

  -- Enable RLS
  CONSTRAINT tasks_status_check CHECK (status IN ('available', 'in_progress', 'completed', 'failed_qa', 'expired'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_base_reward ON tasks(base_reward DESC);

-- Create GIN index for JSONB parameters
CREATE INDEX IF NOT EXISTS idx_tasks_parameters_gin ON tasks USING GIN(parameters);
CREATE INDEX IF NOT EXISTS idx_tasks_requirements_gin ON tasks USING GIN(requirements);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER tasks_updated_at_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies:
-- Public can read available tasks
CREATE POLICY "Public read access to available tasks"
  ON tasks FOR SELECT
  USING (status = 'available');

-- Authenticated users can read all tasks
CREATE POLICY "Authenticated read access to all tasks"
  ON tasks FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can insert/update/delete tasks
CREATE POLICY "Service role full access to tasks"
  ON tasks FOR ALL
  USING (auth.role() = 'service_role');

-- Create a view for available tasks with metadata
CREATE OR REPLACE VIEW available_tasks_view AS
SELECT
  id,
  type,
  priority,
  base_reward,
  parameters->>'title' AS title,
  parameters->>'description' AS description,
  status,
  complexity,
  tags,
  created_at,
  expires_at,
  (base_reward > 50) AS high_priority
FROM tasks
WHERE status = 'available'
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY base_reward DESC, created_at DESC;

COMMENT ON TABLE tasks IS 'Stores all tasks in the Nervix platform';
COMMENT ON VIEW available_tasks_view IS 'Read-only view of available tasks for agents to claim';
