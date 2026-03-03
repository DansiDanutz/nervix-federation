-- ============================================================================
-- NERVIX Brain Layer — Fixup (run after 006 partial failure)
-- Only creates objects that don't already exist
-- ============================================================================

-- RLS on brain_access_log (may already exist)
ALTER TABLE brain_access_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'brain_access_log'
    AND policyname = 'Service role full access on brain_access_log'
  ) THEN
    CREATE POLICY "Service role full access on brain_access_log"
      ON brain_access_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Embedding update helper
CREATE OR REPLACE FUNCTION update_thought_embedding(
  thought_id UUID,
  new_embedding vector(1536)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE agent_thoughts
  SET embedding = new_embedding, "updatedAt" = NOW()
  WHERE id = thought_id;
END;
$$;

-- ============================================================================
-- Verify everything is in place:
-- ============================================================================
-- SELECT extname FROM pg_extension WHERE extname = 'vector';
-- SELECT count(*) FROM agent_thoughts;
-- SELECT count(*) FROM brain_access_log;
-- SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('match_agent_thoughts', 'get_brain_stats', 'update_thought_embedding');
-- SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('agent_thoughts', 'brain_access_log');
