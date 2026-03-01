-- NERVIX Federation: Atomic Credit Transfer RPC
-- Run in Supabase SQL Editor BEFORE deploying the server update
-- Date: 2026-03-01 | Task: P2-T2
--
-- This function atomically:
--   1. Checks sender balance (SELECT FOR UPDATE — row lock)
--   2. Debits sender
--   3. Credits receiver
--   4. Records transfer transaction
--   5. Records platform fee transaction (if fee > 0)
-- If ANY step fails, the entire operation rolls back.

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
  -- Lock sender row to prevent concurrent transfers
  SELECT "creditBalance"::NUMERIC INTO v_from_balance
  FROM agents
  WHERE "agentId" = p_from_agent_id
  FOR UPDATE;

  IF v_from_balance IS NULL THEN
    RAISE EXCEPTION 'Sender agent not found: %', p_from_agent_id;
  END IF;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: has %, needs %', v_from_balance, p_amount;
  END IF;

  -- Lock receiver row
  SELECT "creditBalance"::NUMERIC INTO v_to_balance
  FROM agents
  WHERE "agentId" = p_to_agent_id
  FOR UPDATE;

  IF v_to_balance IS NULL THEN
    RAISE EXCEPTION 'Receiver agent not found: %', p_to_agent_id;
  END IF;

  -- Calculate new balances
  v_new_from_balance := v_from_balance - p_amount;
  v_new_to_balance := v_to_balance + p_net_amount;

  -- Debit sender
  UPDATE agents
  SET "creditBalance" = v_new_from_balance::TEXT,
      "totalCreditsSpent" = ("totalCreditsSpent"::NUMERIC + p_amount)::TEXT,
      "updatedAt" = NOW()
  WHERE "agentId" = p_from_agent_id;

  -- Credit receiver
  UPDATE agents
  SET "creditBalance" = v_new_to_balance::TEXT,
      "totalCreditsEarned" = ("totalCreditsEarned"::NUMERIC + p_net_amount)::TEXT,
      "updatedAt" = NOW()
  WHERE "agentId" = p_to_agent_id;

  -- Record transfer transaction
  INSERT INTO economic_transactions (
    "transactionId", "type", "fromAgentId", "toAgentId",
    "amount", "balanceAfterFrom", "balanceAfterTo", "memo", "createdAt"
  ) VALUES (
    p_tx_id, 'transfer', p_from_agent_id, p_to_agent_id,
    p_net_amount::TEXT, v_new_from_balance::TEXT, v_new_to_balance::TEXT,
    p_memo, NOW()
  );

  -- Record platform fee transaction (if fee > 0)
  IF p_fee > 0 THEN
    INSERT INTO economic_transactions (
      "transactionId", "type", "fromAgentId", "toAgentId",
      "amount", "balanceAfterFrom", "balanceAfterTo", "memo", "createdAt"
    ) VALUES (
      p_fee_tx_id, 'platform_fee', p_from_agent_id, 'nervix_treasury',
      p_fee::TEXT, v_new_from_balance::TEXT, '0', p_fee_memo, NOW()
    );
  END IF;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'newFromBalance', v_new_from_balance::TEXT,
    'newToBalance', v_new_to_balance::TEXT,
    'fee', p_fee::TEXT
  );
END;
$$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION nervix_transfer_credits TO authenticated;
GRANT EXECUTE ON FUNCTION nervix_transfer_credits TO service_role;
