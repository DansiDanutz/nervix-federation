-- Migration 003: Update tasks table schema
-- This adds missing columns to the existing tasks table

-- Add missing columns to tasks table (each with IF NOT EXISTS)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'code-generation',
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS base_reward DECIMAL(10, 2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS agent_id UUID,
  ADD COLUMN IF NOT EXISTS assignment_token UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_id UUID,
  ADD COLUMN IF NOT EXISTS qa_result JSONB,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS task_title VARCHAR(500),
  ADD COLUMN IF NOT EXISTS task_description TEXT;

-- Update status constraint to include new statuses
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('available', 'in_progress', 'completed', 'failed_qa', 'expired', 'pending_review', 'cancelled'));

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_base_reward ON tasks(base_reward DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_at ON tasks(assigned_at DESC);

-- Create GIN index for JSONB parameters (only if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'parameters') THEN
    CREATE INDEX IF NOT EXISTS idx_tasks_parameters_gin ON tasks USING GIN(parameters);
  END IF;
END $$;

-- Create GIN index for requirements (only if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'requirements') THEN
    CREATE INDEX IF NOT EXISTS idx_tasks_requirements_gin ON tasks USING GIN(requirements);
  END IF;
END $$;

-- Update the existing trigger to use the correct function
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (if not already enabled)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access to available tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated read access to all tasks" ON tasks;
DROP POLICY IF EXISTS "Service role full access to tasks" ON tasks;

-- Create new policies
CREATE POLICY "Public read access to available tasks"
  ON tasks FOR SELECT
  USING (status = 'available');

CREATE POLICY "Authenticated read access to all tasks"
  ON tasks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access to tasks"
  ON tasks FOR ALL
  USING (auth.role() = 'service_role');

-- Create or replace view for available tasks with metadata
DROP VIEW IF EXISTS available_tasks_view;

CREATE OR REPLACE VIEW available_tasks_view AS
SELECT
  id,
  type,
  priority,
  base_reward,
  COALESCE(parameters->>'title', task_title) AS title,
  COALESCE(parameters->>'description', task_description) AS description,
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
