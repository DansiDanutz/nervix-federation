-- Token Revocation Table
-- Stores revoked tokens for persistent revocation across server restarts
-- Migration: 005_token_revocation_table.sql
-- Created: 2026-02-28

CREATE TABLE IF NOT EXISTS token_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_jti VARCHAR(255) NOT NULL UNIQUE, -- JWT ID
  agent_id UUID NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_token_revocations_jti ON token_revocations(token_jti);
CREATE INDEX IF NOT EXISTS idx_token_revocations_agent_id ON token_revocations(agent_id);
CREATE INDEX IF NOT EXISTS idx_token_revocations_expires_at ON token_revocations(expires_at);

-- Function to clean up expired revocations
CREATE OR REPLACE FUNCTION cleanup_expired_token_revocations()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM token_revocations
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically clean up expired revocations occasionally
CREATE OR REPLACE FUNCTION trigger_cleanup_token_revocations()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run cleanup 1% of the time to avoid frequent database operations
  IF RANDOM() < 0.01 THEN
    PERFORM cleanup_expired_token_revocations();
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a dummy table for the trigger to fire on
CREATE TABLE IF NOT EXISTS token_revocation_trigger (
  id SERIAL PRIMARY KEY,
  last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER tr_cleanup_token_revocations
AFTER INSERT ON token_revocation_trigger
FOR EACH ROW
EXECUTE FUNCTION trigger_cleanup_token_revocations();

-- Periodic cleanup via cron or scheduled task
-- This can be called by a cron job:
-- SELECT cleanup_expired_token_revocations();

COMMENT ON TABLE token_revocations IS 'Persistent storage for revoked JWT tokens';
COMMENT ON FUNCTION cleanup_expired_token_revocations() IS 'Clean up expired token revocations';
