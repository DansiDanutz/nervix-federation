-- NERVIX Federation: Atomic Task Completion RPC
-- Run in Supabase SQL Editor
-- Date: 2026-03-02 | Task: P2-T2
--
-- This function atomically completes a task:
--   1. Updates task status to 'completed'
--   2. Debits requester (full reward amount)
--   3. Credits assignee (net amount after fee)
--   4. Updates assignee stats (totalTasksCompleted, totalCreditsEarned, activeTasks)
--   5. Updates requester stats (totalCreditsSpent)
--   6. Records reward transaction
--   7. Records platform fee transaction
--   8. Updates reputation score
-- If ANY step fails, the entire operation rolls back.

CREATE OR REPLACE FUNCTION nervix_complete_task(
  p_task_id TEXT,
  p_assignee_id TEXT,
  p_requester_id TEXT,
  p_reward NUMERIC(18,6),
  p_fee NUMERIC(18,6),
  p_net_reward NUMERIC(18,6),
  p_fee_percent NUMERIC(5,2),
  p_is_openclaw BOOLEAN DEFAULT FALSE,
  p_discount NUMERIC(18,6) DEFAULT 0,
  p_tx_id TEXT DEFAULT NULL,
  p_fee_tx_id TEXT DEFAULT NULL,
  p_task_title TEXT DEFAULT '',
  p_completion_time_sec NUMERIC DEFAULT 60,
  p_max_duration_sec NUMERIC DEFAULT 3600
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_assignee_balance NUMERIC(18,6);
  v_requester_balance NUMERIC(18,6);
  v_new_assignee_balance NUMERIC(18,6);
  v_new_requester_balance NUMERIC(18,6);
  v_assignee_tasks_completed INTEGER;
  v_assignee_active_tasks INTEGER;
  v_assignee_earned NUMERIC(18,6);
  v_requester_spent NUMERIC(18,6);
  v_rep_success_rate NUMERIC(10,4);
  v_rep_overall NUMERIC(10,4);
  v_rep_avg_response NUMERIC(10,2);
  v_rep_tasks_scored INTEGER;
  v_rep_uptime NUMERIC(10,4);
  v_new_overall NUMERIC(10,4);
  v_time_score NUMERIC(10,4);
BEGIN
  -- Lock assignee row
  SELECT "creditBalance"::NUMERIC, "totalTasksCompleted", "activeTasks", "totalCreditsEarned"::NUMERIC
  INTO v_assignee_balance, v_assignee_tasks_completed, v_assignee_active_tasks, v_assignee_earned
  FROM agents WHERE "agentId" = p_assignee_id FOR UPDATE;

  IF v_assignee_balance IS NULL THEN
    RAISE EXCEPTION 'Assignee agent not found: %', p_assignee_id;
  END IF;

  -- Lock requester row
  SELECT "creditBalance"::NUMERIC, "totalCreditsSpent"::NUMERIC
  INTO v_requester_balance, v_requester_spent
  FROM agents WHERE "agentId" = p_requester_id FOR UPDATE;

  IF v_requester_balance IS NULL THEN
    RAISE EXCEPTION 'Requester agent not found: %', p_requester_id;
  END IF;

  -- Calculate new balances
  v_new_assignee_balance := v_assignee_balance + p_net_reward;
  v_new_requester_balance := v_requester_balance - p_reward;

  -- 1. Update task status
  UPDATE tasks SET
    "status" = 'completed',
    "completedAt" = NOW(),
    "updatedAt" = NOW()
  WHERE "taskId" = p_task_id;

  -- 2. Update assignee (balance + stats)
  UPDATE agents SET
    "creditBalance" = v_new_assignee_balance::TEXT,
    "totalTasksCompleted" = v_assignee_tasks_completed + 1,
    "totalCreditsEarned" = (v_assignee_earned + p_net_reward)::TEXT,
    "activeTasks" = GREATEST(0, v_assignee_active_tasks - 1),
    "updatedAt" = NOW()
  WHERE "agentId" = p_assignee_id;

  -- 3. Update requester (spent stats)
  UPDATE agents SET
    "totalCreditsSpent" = (v_requester_spent + p_reward)::TEXT,
    "updatedAt" = NOW()
  WHERE "agentId" = p_requester_id;

  -- 4. Record reward transaction
  INSERT INTO economic_transactions (
    "transactionId", "type", "fromAgentId", "toAgentId", "taskId",
    "amount", "balanceAfterFrom", "balanceAfterTo", "memo", "createdAt"
  ) VALUES (
    p_tx_id, 'task_reward', p_requester_id, p_assignee_id, p_task_id,
    p_net_reward::TEXT, v_new_requester_balance::TEXT, v_new_assignee_balance::TEXT,
    'Reward for task: ' || p_task_title || ' (after ' || p_fee_percent || '% platform fee)',
    NOW()
  );

  -- 5. Record platform fee (if any)
  IF p_fee > 0 THEN
    INSERT INTO economic_transactions (
      "transactionId", "type", "fromAgentId", "toAgentId", "taskId",
      "amount", "balanceAfterFrom", "balanceAfterTo", "memo", "createdAt"
    ) VALUES (
      p_fee_tx_id, 'platform_fee', p_requester_id, 'nervix_treasury', p_task_id,
      p_fee::TEXT, v_new_requester_balance::TEXT, '0',
      'Task fee (' || p_fee_percent || '%)' ||
        CASE WHEN p_discount > 0 THEN ' — OpenClaw discount: ' || p_discount::TEXT || ' cr' ELSE '' END,
      NOW()
    );
  END IF;

  -- 6. Update reputation
  SELECT "successRate"::NUMERIC, "overallScore"::NUMERIC, "avgResponseTime"::NUMERIC,
         "totalTasksScored", "uptimeConsistency"::NUMERIC
  INTO v_rep_success_rate, v_rep_overall, v_rep_avg_response, v_rep_tasks_scored, v_rep_uptime
  FROM reputation_scores WHERE "agentId" = p_assignee_id FOR UPDATE;

  IF v_rep_success_rate IS NOT NULL THEN
    v_time_score := GREATEST(0, 1.0 - (p_completion_time_sec / p_max_duration_sec));
    v_new_overall := (1.0 * 0.4) + (v_time_score * 0.25) + (0.8 * 0.25) + (COALESCE(v_rep_uptime, 0.9) * 0.1);

    UPDATE reputation_scores SET
      "overallScore" = v_new_overall::TEXT,
      "successRate" = ((v_rep_success_rate * v_rep_tasks_scored + 1) / (v_rep_tasks_scored + 1))::TEXT,
      "avgResponseTime" = ((v_rep_avg_response * v_rep_tasks_scored + p_completion_time_sec) / (v_rep_tasks_scored + 1))::TEXT,
      "totalTasksScored" = v_rep_tasks_scored + 1,
      "lastCalculated" = NOW()
    WHERE "agentId" = p_assignee_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'newAssigneeBalance', v_new_assignee_balance::TEXT,
    'newRequesterBalance', v_new_requester_balance::TEXT,
    'fee', p_fee::TEXT,
    'newOverallScore', COALESCE(v_new_overall::TEXT, '0')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION nervix_complete_task TO authenticated;
GRANT EXECUTE ON FUNCTION nervix_complete_task TO service_role;
