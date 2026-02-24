-- Migration 004: Create task_submissions table
-- This table stores all task submissions from agents

CREATE TABLE IF NOT EXISTS task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to task
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Agent who submitted
  agent_id UUID NOT NULL,

  -- Assignment token for verification
  assignment_token UUID NOT NULL,

  -- Submission details
  result JSONB NOT NULL DEFAULT '{}',
  execution_time INTEGER, -- milliseconds

  -- QA results
  qa_result JSONB,
  qa_passed BOOLEAN DEFAULT FALSE,
  qa_score INTEGER,

  -- Submission status
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(255),

  -- Payment tracking
  reward_paid BOOLEAN DEFAULT FALSE,
  reward_amount DECIMAL(10, 2),
  paid_at TIMESTAMPTZ,

  -- Feedback
  feedback TEXT,
  feedback_rating INTEGER,

  -- Enable RLS
  CONSTRAINT task_submissions_status_check CHECK (status IN ('pending', 'passed_qa', 'failed_qa', 'accepted', 'rejected', 'paid')),
  CONSTRAINT task_submissions_rating_check CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_agent_id ON task_submissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_task_submissions_submitted_at ON task_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_submissions_qa_passed ON task_submissions(qa_passed);

-- Create GIN index for JSONB result
CREATE INDEX IF NOT EXISTS idx_task_submissions_result_gin ON task_submissions USING GIN(result);

-- Enable Row Level Security
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- Policies:
-- Agents can read their own submissions
CREATE POLICY "Agents read own submissions"
  ON task_submissions FOR SELECT
  USING (agent_id = auth.uid());

-- Public can read completed submissions for transparency
CREATE POLICY "Public read access to completed submissions"
  ON task_submissions FOR SELECT
  USING (status IN ('passed_qa', 'accepted', 'paid'));

-- Service role full access
CREATE POLICY "Service role full access to task_submissions"
  ON task_submissions FOR ALL
  USING (auth.role() = 'service_role');

-- Create function to update task status based on submission
CREATE OR REPLACE FUNCTION update_task_from_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- If submission passed QA, update task status to completed
  IF NEW.qa_passed = TRUE AND NEW.status = 'passed_qa' THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = NEW.submitted_at,
      submission_id = NEW.id,
      updated_at = NOW()
    WHERE id = NEW.task_id;

  -- If submission failed QA, update task status to failed_qa
  ELSIF NEW.qa_passed = FALSE AND NEW.status = 'failed_qa' THEN
    UPDATE tasks
    SET
      status = 'failed_qa',
      failed_at = NEW.submitted_at,
      updated_at = NOW()
    WHERE id = NEW.task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update task status on submission
CREATE TRIGGER task_submission_status_trigger
  AFTER INSERT OR UPDATE OF qa_passed, status
  ON task_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_task_from_submission();

-- Create view for submission statistics
CREATE OR REPLACE VIEW agent_submission_stats AS
SELECT
  agent_id,
  COUNT(*) AS total_submissions,
  SUM(CASE WHEN qa_passed = TRUE THEN 1 ELSE 0 END) AS passed_submissions,
  SUM(CASE WHEN status = 'paid' THEN reward_amount ELSE 0 END) AS total_earnings,
  AVG(qa_score) AS avg_qa_score,
  AVG(execution_time) AS avg_execution_time,
  MAX(submitted_at) AS last_submission_at
FROM task_submissions
GROUP BY agent_id;

COMMENT ON TABLE task_submissions IS 'Stores all task submissions from agents';
COMMENT ON VIEW agent_submission_stats IS 'Aggregated statistics for agent submissions';
