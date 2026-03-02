-- NERVIX Federation: Fix RPC functions for NUMERIC columns
-- Run in Supabase SQL Editor
-- Date: 2026-03-02
--
-- Fix: Remove ::TEXT casts when assigning to NUMERIC columns
-- (creditBalance, totalCreditsEarned, totalCreditsSpent, amount, etc. are all NUMERIC)

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX 1: nervix_complete_task — remove ::TEXT casts on NUMERIC columns
-- ═══════════════════════════════════════════════════════════════════════════════
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
  SELECT "creditBalance", "totalTasksCompleted", "activeTasks", "totalCreditsEarned"
  INTO v_assignee_balance, v_assignee_tasks_completed, v_assignee_active_tasks, v_assignee_earned
  FROM agents WHERE "agentId" = p_assignee_id FOR UPDATE;

  IF v_assignee_balance IS NULL THEN
    RAISE EXCEPTION 'Assignee agent not found: %', p_assignee_id;
  END IF;

  -- Lock requester row
  SELECT "creditBalance", "totalCreditsSpent"
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
    "creditBalance" = v_new_assignee_balance,
    "totalTasksCompleted" = v_assignee_tasks_completed + 1,
    "totalCreditsEarned" = v_assignee_earned + p_net_reward,
    "activeTasks" = GREATEST(0, v_assignee_active_tasks - 1),
    "updatedAt" = NOW()
  WHERE "agentId" = p_assignee_id;

  -- 3. Update requester (balance + spent stats)
  UPDATE agents SET
    "creditBalance" = v_new_requester_balance,
    "totalCreditsSpent" = v_requester_spent + p_reward,
    "updatedAt" = NOW()
  WHERE "agentId" = p_requester_id;

  -- 4. Record reward transaction
  INSERT INTO economic_transactions (
    "transactionId", "type", "fromAgentId", "toAgentId", "taskId",
    "amount", "balanceAfterFrom", "balanceAfterTo", "memo", "createdAt"
  ) VALUES (
    p_tx_id, 'task_reward', p_requester_id, p_assignee_id, p_task_id,
    p_net_reward, v_new_requester_balance, v_new_assignee_balance,
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
      p_fee, v_new_requester_balance, 0,
      'Task fee (' || p_fee_percent || '%)' ||
        CASE WHEN p_discount > 0 THEN ' — OpenClaw discount: ' || p_discount || ' cr' ELSE '' END,
      NOW()
    );
  END IF;

  -- 6. Update reputation
  SELECT "successRate", "overallScore", "avgResponseTime",
         "totalTasksScored", "uptimeConsistency"
  INTO v_rep_success_rate, v_rep_overall, v_rep_avg_response, v_rep_tasks_scored, v_rep_uptime
  FROM reputation_scores WHERE "agentId" = p_assignee_id FOR UPDATE;

  IF v_rep_success_rate IS NOT NULL THEN
    v_time_score := GREATEST(0, 1.0 - (p_completion_time_sec / p_max_duration_sec));
    v_new_overall := (1.0 * 0.4) + (v_time_score * 0.25) + (0.8 * 0.25) + (COALESCE(v_rep_uptime, 0.9) * 0.1);

    UPDATE reputation_scores SET
      "overallScore" = v_new_overall,
      "successRate" = (v_rep_success_rate * v_rep_tasks_scored + 1) / (v_rep_tasks_scored + 1),
      "avgResponseTime" = (v_rep_avg_response * v_rep_tasks_scored + p_completion_time_sec) / (v_rep_tasks_scored + 1),
      "totalTasksScored" = v_rep_tasks_scored + 1,
      "lastCalculated" = NOW()
    WHERE "agentId" = p_assignee_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'newAssigneeBalance', v_new_assignee_balance,
    'newRequesterBalance', v_new_requester_balance,
    'fee', p_fee,
    'newOverallScore', COALESCE(v_new_overall, 0)
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX 2: nervix_transfer_credits — remove ::TEXT casts on NUMERIC columns
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION nervix_transfer_credits(
  p_from_agent_id TEXT,
  p_to_agent_id TEXT,
  p_amount NUMERIC(18,6),
  p_fee NUMERIC(18,6),
  p_net_amount NUMERIC(18,6),
  p_tx_id TEXT,
  p_fee_tx_id TEXT,
  p_memo TEXT DEFAULT NULL,
  p_fee_memo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_balance NUMERIC(18,6);
  v_to_balance NUMERIC(18,6);
  v_new_from_balance NUMERIC(18,6);
  v_new_to_balance NUMERIC(18,6);
BEGIN
  -- Lock sender row
  SELECT "creditBalance" INTO v_from_balance
  FROM agents WHERE "agentId" = p_from_agent_id FOR UPDATE;

  IF v_from_balance IS NULL THEN
    RAISE EXCEPTION 'Sender agent not found: %', p_from_agent_id;
  END IF;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: has %, needs %', v_from_balance, p_amount;
  END IF;

  -- Lock receiver row
  SELECT "creditBalance" INTO v_to_balance
  FROM agents WHERE "agentId" = p_to_agent_id FOR UPDATE;

  IF v_to_balance IS NULL THEN
    RAISE EXCEPTION 'Receiver agent not found: %', p_to_agent_id;
  END IF;

  -- Calculate new balances
  v_new_from_balance := v_from_balance - p_amount;
  v_new_to_balance := v_to_balance + p_net_amount;

  -- Debit sender
  UPDATE agents SET
    "creditBalance" = v_new_from_balance,
    "totalCreditsSpent" = "totalCreditsSpent" + p_amount,
    "updatedAt" = NOW()
  WHERE "agentId" = p_from_agent_id;

  -- Credit receiver
  UPDATE agents SET
    "creditBalance" = v_new_to_balance,
    "totalCreditsEarned" = "totalCreditsEarned" + p_net_amount,
    "updatedAt" = NOW()
  WHERE "agentId" = p_to_agent_id;

  -- Record transfer transaction
  INSERT INTO economic_transactions (
    "transactionId", "type", "fromAgentId", "toAgentId",
    "amount", "balanceAfterFrom", "balanceAfterTo", "memo", "createdAt"
  ) VALUES (
    p_tx_id, 'transfer', p_from_agent_id, p_to_agent_id,
    p_net_amount, v_new_from_balance, v_new_to_balance,
    p_memo, NOW()
  );

  -- Record platform fee (if fee > 0)
  IF p_fee > 0 THEN
    INSERT INTO economic_transactions (
      "transactionId", "type", "fromAgentId", "toAgentId",
      "amount", "balanceAfterFrom", "balanceAfterTo", "memo", "createdAt"
    ) VALUES (
      p_fee_tx_id, 'platform_fee', p_from_agent_id, 'nervix_treasury',
      p_fee, v_new_from_balance, 0, p_fee_memo, NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'newFromBalance', v_new_from_balance,
    'newToBalance', v_new_to_balance,
    'fee', p_fee
  );
END;
$$;

GRANT EXECUTE ON FUNCTION nervix_complete_task TO authenticated;
GRANT EXECUTE ON FUNCTION nervix_complete_task TO service_role;
GRANT EXECUTE ON FUNCTION nervix_transfer_credits TO authenticated;
GRANT EXECUTE ON FUNCTION nervix_transfer_credits TO service_role;
