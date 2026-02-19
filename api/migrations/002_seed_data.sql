-- Nervix Seed Data
-- Sample data for development and testing

-- Insert sample agents
INSERT INTO agents (id, agent_id, agent_name, agent_public_key, agent_metadata, reputation_score, reputation_level, total_tasks_completed, total_earnings, status, availability_status, created_at, updated_at) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'agent-nano',
  'Nano 🦞',
  'dGVzdC1wdWJsaWMta2V5',
  '{
    "endpoint_url": "https://nano.nervix.ai",
    "capabilities": ["coding", "orchestration", "security"],
    "skills": ["JavaScript", "TypeScript", "Node.js", "Docker", "Kubernetes"]
  }'::jsonb,
  85.5,
  'expert',
  150,
  1500.00,
  'active',
  'available',
  NOW() - INTERVAL '30 days',
  NOW()
),
(
  '00000000-0000-0000-0000-000000000002',
  'agent-dexter',
  'Dexter 🤖',
  'dGVzdC1wdWJsaWMta2V5LTI',
  '{
    "endpoint_url": "https://dexter.nervix.ai",
    "capabilities": ["coding", "testing", "automation"],
    "skills": ["Python", "React", "Jest", "GitHub Actions", "CI/CD"]
  }'::jsonb,
  75.0,
  'advanced',
  120,
  1200.00,
  'active',
  'available',
  NOW() - INTERVAL '25 days',
  NOW()
),
(
  '00000000-0000-0000-0000-000000000003',
  'agent-memo',
  'Memo 📝',
  'dGVzdC1wdWJsaWMta2V5LTM',
  '{
    "endpoint_url": "https://memo.nervix.ai",
    "capabilities": ["documentation", "research", "writing"],
    "skills": ["Technical Writing", "API Documentation", "Markdown", "GitBook"]
  }'::jsonb,
  90.0,
  'expert',
  200,
  2000.00,
  'active',
  'available',
  NOW() - INTERVAL '20 days',
  NOW()
),
(
  '00000000-0000-0000-0000-000000000004',
  'agent-sienna',
  'Sienna 💬',
  'dGVzdC1wdWJsaWMta2V5LTQ',
  '{
    "endpoint_url": "https://sienna.nervix.ai",
    "capabilities": ["communications", "community", "outreach"],
    "skills": ["Community Management", "Discord", "Telegram", "Content Creation"]
  }'::jsonb,
  70.0,
  'advanced',
  80,
  800.00,
  'active',
  'available',
  NOW() - INTERVAL '15 days',
  NOW()
);

-- Insert sample tasks
INSERT INTO tasks (id, title, description, type, priority, base_reward, status, required_capabilities, created_at, updated_at) VALUES
(
  '10000000-0000-0000-0000-000000000001',
  'Build Agent Catalog API',
  'Implement REST API endpoints for agent catalog with search, filters, and pagination',
  'code-generation',
  'high',
  50.00,
  'completed',
  '["coding", "api-design", "express"]'::jsonb,
  NOW() - INTERVAL '1 day',
  NOW()
),
(
  '10000000-0000-0000-0000-000000000002',
  'Setup Task Queue with Redis',
  'Configure BullMQ for distributed task processing',
  'infrastructure',
  'high',
  40.00,
  'completed',
  '["devops", "redis", "queue"]'::jsonb,
  NOW() - INTERVAL '2 days',
  NOW()
),
(
  '10000000-0000-0000-0000-000000000003',
  'Write Documentation for API',
  'Create comprehensive API documentation with examples',
  'documentation',
  'medium',
  30.00,
  'pending',
  '["documentation", "writing", "api"]'::jsonb,
  NOW(),
  NOW()
),
(
  '10000000-0000-0000-0000-000000000004',
  'Implement Code Validation Pipeline',
  'Build automated code quality checks with ESLint and Jest',
  'testing',
  'high',
  45.00,
  'pending',
  '["testing", "quality", "ci-cd"]'::jsonb,
  NOW(),
  NOW()
);

-- Insert sample task assignments
INSERT INTO task_assignments (id, task_id, agent_id, assigned_at, completed_at, status) VALUES
(
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '23 hours',
  'completed'
),
(
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '46 hours',
  'completed'
);

-- Insert sample transactions
INSERT INTO transactions (id, type, task_id, agent_id, amount, status, created_at, completed_at) VALUES
(
  '30000000-0000-0000-0000-000000000001',
  'task_payment',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  50.00,
  'completed',
  NOW() - INTERVAL '23 hours',
  NOW() - INTERVAL '23 hours'
),
(
  '30000000-0000-0000-0000-000000000002',
  'task_payment',
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  40.00,
  'completed',
  NOW() - INTERVAL '46 hours',
  NOW() - INTERVAL '46 hours'
),
(
  '30000000-0000-0000-0000-000000000003',
  'bonus',
  NULL,
  '00000000-0000-0000-0000-000000000001',
  10.00,
  'completed',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
);

-- Insert sample reputation events
INSERT INTO reputation_events (id, agent_id, event_type, score_change, reason, created_at) VALUES
(
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'task_completed',
  2.0,
  'Completed task: Build Agent Catalog API',
  NOW() - INTERVAL '23 hours'
),
(
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'task_completed',
  2.0,
  'Completed task: Setup Task Queue with Redis',
  NOW() - INTERVAL '46 hours'
),
(
  '40000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'bonus_received',
  1.0,
  'Performance bonus for high-quality code',
  NOW() - INTERVAL '1 day'
);
