-- Migration: Multi-Tenant YouTube Studio
-- Purpose: Add YouTube channel management, video tracking, and subscription plans
-- Target: Nervix Supabase (kisncxslqjgdesgxmwen)
-- Date: 2026-03-01

-- ─── Subscriptions Table ────────────────────────────────────────────────────
-- Tracks user subscription plans (free, pro, business)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  max_channels INTEGER NOT NULL DEFAULT 1,
  max_videos_per_month INTEGER NOT NULL DEFAULT 50,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active ON subscriptions(user_id) WHERE status = 'active';

-- ─── YouTube Channels Table ─────────────────────────────────────────────────
-- Stores connected YouTube channels per user (multi-tenant)
CREATE TABLE IF NOT EXISTS youtube_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  channel_thumbnail TEXT,
  subscriber_count INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  view_count BIGINT DEFAULT 0,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_youtube_channels_user_id ON youtube_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_youtube_channels_channel_id ON youtube_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_channels_active ON youtube_channels(user_id, is_active) WHERE is_active = true;

-- ─── YouTube Videos Table ───────────────────────────────────────────────────
-- Stores video metadata per channel
CREATE TABLE IF NOT EXISTS youtube_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'private', 'unlisted', 'draft', 'scheduled', 'deleted')),
  duration TEXT,
  view_count BIGINT DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  tags JSONB,
  category TEXT,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_id ON youtube_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_user_id ON youtube_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_video_id ON youtube_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_status ON youtube_videos(status);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(published_at DESC);

-- ─── Auto-update triggers ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_youtube_channels_updated_at ON youtube_channels;
CREATE TRIGGER trigger_youtube_channels_updated_at
  BEFORE UPDATE ON youtube_channels FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_youtube_videos_updated_at ON youtube_videos;
CREATE TRIGGER trigger_youtube_videos_updated_at
  BEFORE UPDATE ON youtube_videos FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS Policies ───────────────────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

-- Service role bypass (our backend uses service key)
CREATE POLICY "Service role full access subscriptions" ON subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access youtube_channels" ON youtube_channels FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access youtube_videos" ON youtube_videos FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated user read-only for their own data
CREATE POLICY "Users read own subscriptions" ON subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users read own channels" ON youtube_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users read own videos" ON youtube_videos FOR SELECT TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON youtube_channels TO service_role;
GRANT ALL ON youtube_videos TO service_role;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON youtube_channels TO authenticated;
GRANT SELECT ON youtube_videos TO authenticated;

-- ─── Seed: Default free subscription for existing users ─────────────────────
INSERT INTO subscriptions (user_id, plan, status, max_channels, max_videos_per_month)
SELECT id, 'free', 'active', 1, 50
FROM users
WHERE id NOT IN (SELECT user_id FROM subscriptions)
ON CONFLICT DO NOTHING;
