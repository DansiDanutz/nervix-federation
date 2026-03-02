-- Password Reset Tokens Table
-- Stores password reset tokens for persistent storage across server restarts
-- Migration: 0007_token_storage_tables.sql
-- Created: 2026-03-02
-- Part of: NERVIX Security Hardening Phase 2

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Email Verification Tokens Table
-- Stores email verification tokens for persistent storage across server restarts
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  open_id VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_email ON email_verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_open_id ON email_verification_tokens(open_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- Function to clean up expired password reset tokens
CREATE OR REPLACE FUNCTION cleanup_expired_password_reset_tokens()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() OR used_at IS NOT NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired email verification tokens
CREATE OR REPLACE FUNCTION cleanup_expired_email_verification_tokens()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM email_verification_tokens
  WHERE expires_at < NOW() OR verified_at IS NOT NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up all expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS JSONB AS $$
DECLARE
  password_reset_count INT;
  email_verification_count INT;
BEGIN
  password_reset_count := cleanup_expired_password_reset_tokens();
  email_verification_count := cleanup_expired_email_verification_tokens();
  
  RETURN jsonb_build_object(
    'password_reset_tokens', password_reset_count,
    'email_verification_tokens', email_verification_count,
    'total', password_reset_count + email_verification_count
  );
END;
$$ LANGUAGE plpgsql;

-- Security Events Table (enhanced)
-- Add security event logging for comprehensive audit trail
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(64) NOT NULL UNIQUE,
  event_type VARCHAR(128) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
  actor_id VARCHAR(64),
  actor_type VARCHAR(50) DEFAULT 'system', -- 'user', 'agent', 'admin', 'system'
  target_id VARCHAR(64),
  target_type VARCHAR(64),
  action VARCHAR(255) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for security event lookups
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_actor_id ON security_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_target_id ON security_events(target_id);

-- Function to create a security event
CREATE OR REPLACE FUNCTION create_security_event(
  p_event_type VARCHAR,
  p_severity VARCHAR DEFAULT 'info',
  p_actor_id VARCHAR DEFAULT NULL,
  p_actor_type VARCHAR DEFAULT 'system',
  p_target_id VARCHAR DEFAULT NULL,
  p_target_type VARCHAR DEFAULT NULL,
  p_action VARCHAR,
  p_details JSONB DEFAULT NULL,
  p_ip_address VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_idempotency_key VARCHAR;
BEGIN
  -- Generate event_id from action and timestamp for idempotency
  v_idempotency_key := substr(md5(p_action || p_event_type || extract(epoch from now())::text), 1, 64);
  
  INSERT INTO security_events (
    event_id, event_type, severity, actor_id, actor_type,
    target_id, target_type, action, details, ip_address, user_agent
  ) VALUES (
    v_idempotency_key, p_event_type, p_severity, p_actor_id, p_actor_type,
    p_target_id, p_target_type, p_action, p_details, p_ip_address, p_user_agent
  )
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old security events (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_security_events()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM security_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE password_reset_tokens IS 'Persistent storage for password reset tokens - replaces in-memory Map';
COMMENT ON TABLE email_verification_tokens IS 'Persistent storage for email verification tokens - replaces in-memory Map';
COMMENT ON TABLE security_events IS 'Comprehensive security event logging for audit trail';
COMMENT ON FUNCTION cleanup_expired_password_reset_tokens() IS 'Clean up expired password reset tokens';
COMMENT ON FUNCTION cleanup_expired_email_verification_tokens() IS 'Clean up expired email verification tokens';
COMMENT ON FUNCTION cleanup_expired_tokens() IS 'Clean up all expired tokens (password reset + email verification)';
COMMENT ON FUNCTION create_security_event() IS 'Create a security event with idempotency check';
COMMENT ON FUNCTION cleanup_old_security_events() IS 'Clean up security events older than 90 days';
