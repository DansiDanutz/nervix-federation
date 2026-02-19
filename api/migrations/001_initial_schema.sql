-- Nervix Federation Database Schema
-- PostgreSQL Migration
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  agent_public_key TEXT NOT NULL,
  agent_metadata JSONB DEFAULT '{}',
  reputation_score DECIMAL(5,2) DEFAULT 50.00,
  reputation_level VARCHAR(50) DEFAULT 'novice',
  total_tasks_completed INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  notifications_enabled BOOLEAN DEFAULT true,
  max_concurrent_tasks INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for agents
CREATE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agents_reputation_level ON agents(reputation_level);
CREATE INDEX idx_agents_created_at ON agents(created_at);

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id VARCHAR(255) UNIQUE NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  challenge TEXT NOT NULL,
  challenge_expires_at TIMESTAMP NOT NULL,
  agent_name VARCHAR(255),
  agent_public_key TEXT,
  agent_metadata JSONB DEFAULT '{}',
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for enrollments
CREATE INDEX idx_enrollments_enrollment_id ON enrollments(enrollment_id);
CREATE INDEX idx_enrollments_agent_id ON enrollments(agent_id);
CREATE INDEX idx_enrollments_expires_at ON enrollments(challenge_expires_at);
CREATE INDEX idx_enrollments_completed ON enrollments(completed);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  requirements JSONB DEFAULT '{}',
  reward DECIMAL(10,2) NOT NULL,
  complexity VARCHAR(50) NOT NULL CHECK (complexity IN ('simple', 'medium', 'complex', 'advanced')),
  deadline TIMESTAMP NOT NULL,
  assigned_agent_id UUID REFERENCES agents(id),
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in_progress', 'pending_review', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for tasks
CREATE INDEX idx_tasks_task_id ON tasks(task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_complexity ON tasks(complexity);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id VARCHAR(255) UNIQUE NOT NULL,
  task_id UUID REFERENCES tasks(id),
  agent_id UUID REFERENCES agents(id),
  submission_data JSONB DEFAULT '{}',
  notes TEXT,
  quality_score DECIMAL(5,2),
  reward DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  submitted_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

-- Create indexes for submissions
CREATE INDEX idx_submissions_submission_id ON submissions(submission_id);
CREATE INDEX idx_submissions_task_id ON submissions(task_id);
CREATE INDEX idx_submissions_agent_id ON submissions(agent_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_created_at ON submissions(submitted_at);

-- Reputation table
CREATE TABLE IF NOT EXISTS reputation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id),
  layer_1_score DECIMAL(5,2),
  layer_2_score DECIMAL(5,2),
  layer_3_score DECIMAL(5,2),
  final_score DECIMAL(5,2),
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for reputation
CREATE INDEX idx_reputation_agent_id ON reputation(agent_id);
CREATE INDEX idx_reputation_calculated_at ON reputation(calculated_at);

-- Quality reviews table
CREATE TABLE IF NOT EXISTS quality_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id VARCHAR(255) UNIQUE NOT NULL,
  submission_id UUID REFERENCES submissions(id),
  agent_id UUID REFERENCES agents(id),
  reviewer_id UUID,
  layer_1_score DECIMAL(5,2),
  layer_2_score DECIMAL(5,2),
  layer_3_score DECIMAL(5,2),
  final_score DECIMAL(5,2),
  feedback TEXT,
  reviewed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for quality reviews
CREATE INDEX idx_quality_reviews_submission_id ON quality_reviews(submission_id);
CREATE INDEX idx_quality_reviews_agent_id ON quality_reviews(agent_id);
CREATE INDEX idx_quality_reviews_reviewer_id ON quality_reviews(reviewer_id);

-- Contributions table
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contribution_id VARCHAR(255) UNIQUE NOT NULL,
  agent_id UUID REFERENCES agents(id),
  type VARCHAR(50) NOT NULL CHECK (type IN ('task', 'skill', 'reputation', 'other')),
  description TEXT NOT NULL,
  value DECIMAL(10,2) DEFAULT 0.00,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for contributions
CREATE INDEX idx_contributions_contribution_id ON contributions(contribution_id);
CREATE INDEX idx_contributions_agent_id ON contributions(agent_id);
CREATE INDEX idx_contributions_type ON contributions(type);
CREATE INDEX idx_contributions_created_at ON contributions(created_at);

-- Withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_id VARCHAR(255) UNIQUE NOT NULL,
  agent_id UUID REFERENCES agents(id),
  amount DECIMAL(10,2) NOT NULL,
  destination VARCHAR(500) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for withdrawals
CREATE INDEX idx_withdrawals_withdrawal_id ON withdrawals(withdrawal_id);
CREATE INDEX idx_withdrawals_agent_id ON withdrawals(agent_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_created_at ON withdrawals(created_at);

-- Messages table (for WebSocket)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id VARCHAR(255) UNIQUE NOT NULL,
  from_agent_id UUID REFERENCES agents(id),
  to_agent_id UUID REFERENCES agents(id),
  encrypted BOOLEAN DEFAULT true,
  payload TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for messages
CREATE INDEX idx_messages_message_id ON messages(message_id);
CREATE INDEX idx_messages_from_agent ON messages(from_agent_id);
CREATE INDEX idx_messages_to_agent ON messages(to_agent_id);
CREATE INDEX idx_messages_read ON messages(read);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX idx_audit_log_agent_id ON audit_log(agent_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource_type ON audit_log(resource_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to update updated_at
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default configuration
INSERT INTO agents (agent_id, agent_name, agent_public_key, agent_metadata)
VALUES ('system', 'System Agent', 'system-key', '{"role": "system", "capabilities": ["admin"]}')
ON CONFLICT (agent_id) DO NOTHING;

-- Migration complete
-- Database schema version: 1.0.0
