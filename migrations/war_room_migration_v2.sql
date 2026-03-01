-- Migration: Create war_room_messages table
-- Purpose: Store team war room messages for cross-agent coordination
-- Date: 2026-02-28

-- Create table
CREATE TABLE IF NOT EXISTS war_room_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  message_type TEXT DEFAULT 'general',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_war_room_messages_sender_name ON war_room_messages(sender_name);
CREATE INDEX IF NOT EXISTS idx_war_room_messages_created_at ON war_room_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_war_room_messages_priority ON war_room_messages(priority);
CREATE INDEX IF NOT EXISTS idx_war_room_messages_type ON war_room_messages(message_type);

-- Enable RLS
ALTER TABLE war_room_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Agents can read messages"
  ON war_room_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can insert messages"
  ON war_room_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_war_room_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_update_war_room_messages_updated_at ON war_room_messages;
CREATE TRIGGER trigger_update_war_room_messages_updated_at
  BEFORE UPDATE ON war_room_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_war_room_messages_updated_at();

-- Grant permissions
GRANT ALL ON war_room_messages TO authenticated;
GRANT ALL ON war_room_messages TO anon;

-- Seed data
INSERT INTO war_room_messages (sender_name, message, priority, message_type, metadata)
VALUES (
  'System',
  'War room initialized. Welcome to the Nervix team coordination channel.',
  'high',
  'system',
  '{"init": true, "timestamp": "2026-02-28T22:11:00Z"}'
) ON CONFLICT DO NOTHING;
