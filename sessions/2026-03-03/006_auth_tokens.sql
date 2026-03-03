-- Migration: auth_tokens table for persistent reset/verify tokens
-- Replaces in-memory Maps in oauth.ts (BUG-003)

CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('reset', 'verify')),
  email TEXT NOT NULL,
  open_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX idx_auth_tokens_email ON auth_tokens(email);
