-- ============================================================================
-- NERVIX Brain Layer Migration
-- Date: 2026-03-03
-- Purpose: Add persistent agent memory (Open Brain) with pgvector
--          for semantic search across agent and federation knowledge
-- Sprint: S1 (GSD Plan: NERVIX Open Brain Integration)
-- ============================================================================

-- ─── Step 1: Enable pgvector extension ────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Step 2: Enums ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE thought_type AS ENUM (
    'learning', 'pattern', 'solution', 'insight', 'reference', 'debug_note'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE thought_scope AS ENUM ('private', 'federation', 'marketplace');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE thought_source AS ENUM (
    'task_completion', 'manual', 'a2a', 'telegram', 'mcp'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Step 3: Agent Thoughts Table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_thoughts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentId"       VARCHAR(64) NOT NULL,
  content         TEXT NOT NULL,
  embedding       vector(1536),
  type            thought_type DEFAULT 'learning' NOT NULL,
  scope           thought_scope DEFAULT 'private' NOT NULL,
  source          thought_source DEFAULT 'manual' NOT NULL,
  metadata        JSONB DEFAULT '{}' NOT NULL,
  -- metadata schema:
  --   topics:         string[]
  --   related_tasks:  string[]  (taskId references)
  --   skills:         string[]  (maps to agent_capabilities)
  --   quality_score:  number    (0.0 - 1.0)
  --   people:         string[]
  --   action_items:   string[]
  --   dates_mentioned: string[] (YYYY-MM-DD)
  "qualityScore"  NUMERIC(3, 2) DEFAULT 0.50 NOT NULL,
  "createdAt"     TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt"     TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ─── Step 4: Indexes ──────────────────────────────────────────────────────────

-- HNSW index for fast vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_thoughts_embedding
  ON agent_thoughts
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index for JSONB metadata filtering (topics, skills, etc.)
CREATE INDEX IF NOT EXISTS idx_thoughts_metadata
  ON agent_thoughts USING gin (metadata);

-- Agent timeline queries
CREATE INDEX IF NOT EXISTS idx_thoughts_agent_created
  ON agent_thoughts ("agentId", "createdAt" DESC);

-- Scope filtering (private vs federation vs marketplace)
CREATE INDEX IF NOT EXISTS idx_thoughts_scope
  ON agent_thoughts (scope);

-- Type filtering
CREATE INDEX IF NOT EXISTS idx_thoughts_type
  ON agent_thoughts (type);

-- Quality score for federation curation
CREATE INDEX IF NOT EXISTS idx_thoughts_quality
  ON agent_thoughts ("qualityScore" DESC)
  WHERE scope = 'federation';

-- ─── Step 5: Brain Access Log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain_access_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId"       VARCHAR(64) NOT NULL,
  "targetAgentId"     VARCHAR(64),        -- null = federation search
  query               TEXT NOT NULL,
  "resultsCount"      INTEGER DEFAULT 0 NOT NULL,
  "creditCost"        NUMERIC(10, 2) DEFAULT 0 NOT NULL,
  "createdAt"         TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brain_access_requester
  ON brain_access_log ("requesterId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_brain_access_target
  ON brain_access_log ("targetAgentId")
  WHERE "targetAgentId" IS NOT NULL;

-- ─── Step 6: Semantic Search Function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_agent_thoughts(
  query_embedding     vector(1536),
  target_agent_id     TEXT DEFAULT NULL,
  target_scope        TEXT DEFAULT NULL,
  match_threshold     FLOAT DEFAULT 0.7,
  match_count         INT DEFAULT 10,
  filter_metadata     JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id              UUID,
  agent_id        VARCHAR(64),
  content         TEXT,
  type            thought_type,
  scope           thought_scope,
  source          thought_source,
  metadata        JSONB,
  quality_score   NUMERIC(3, 2),
  similarity      FLOAT,
  created_at      TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t."agentId" AS agent_id,
    t.content,
    t.type,
    t.scope,
    t.source,
    t.metadata,
    t."qualityScore" AS quality_score,
    1 - (t.embedding <=> query_embedding) AS similarity,
    t."createdAt" AS created_at
  FROM agent_thoughts t
  WHERE
    -- Must have an embedding
    t.embedding IS NOT NULL
    -- Similarity threshold
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
    -- Agent filter: if target_agent_id provided, only that agent's thoughts
    AND (target_agent_id IS NULL OR t."agentId" = target_agent_id)
    -- Scope filter: if target_scope provided, only that scope
    AND (target_scope IS NULL OR t.scope = target_scope::thought_scope)
    -- Metadata filter: if filter_metadata has keys, check containment
    AND (filter_metadata = '{}' OR t.metadata @> filter_metadata)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- ─── Step 7: Brain Stats Function ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_brain_stats(target_agent_id TEXT DEFAULT NULL)
RETURNS TABLE (
  total_thoughts      BIGINT,
  thoughts_by_type    JSONB,
  thoughts_by_scope   JSONB,
  top_topics          JSONB,
  avg_quality         NUMERIC,
  oldest_thought      TIMESTAMP,
  newest_thought      TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_thoughts,
    (
      SELECT jsonb_object_agg(t.type::TEXT, t.cnt)
      FROM (
        SELECT at2.type, COUNT(*)::BIGINT AS cnt
        FROM agent_thoughts at2
        WHERE target_agent_id IS NULL OR at2."agentId" = target_agent_id
        GROUP BY at2.type
      ) t
    ) AS thoughts_by_type,
    (
      SELECT jsonb_object_agg(s.scope::TEXT, s.cnt)
      FROM (
        SELECT at3.scope, COUNT(*)::BIGINT AS cnt
        FROM agent_thoughts at3
        WHERE target_agent_id IS NULL OR at3."agentId" = target_agent_id
        GROUP BY at3.scope
      ) s
    ) AS thoughts_by_scope,
    '[]'::JSONB AS top_topics,  -- populated via application layer (JSONB array extraction)
    AVG(at1."qualityScore") AS avg_quality,
    MIN(at1."createdAt") AS oldest_thought,
    MAX(at1."createdAt") AS newest_thought
  FROM agent_thoughts at1
  WHERE target_agent_id IS NULL OR at1."agentId" = target_agent_id;
END;
$$;

-- ─── Step 8: RLS Policies ────────────────────────────────────────────────────

-- Enable RLS on agent_thoughts
ALTER TABLE agent_thoughts ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by server-side tRPC)
CREATE POLICY "Service role full access on agent_thoughts"
  ON agent_thoughts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on brain_access_log
ALTER TABLE brain_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on brain_access_log"
  ON brain_access_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── Step 9: Embedding Update Helper ──────────────────────────────────────────

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
-- DONE: Run via Supabase SQL Editor
-- After running:
--   1. Verify: SELECT * FROM pg_extension WHERE extname = 'vector';
--   2. Verify: SELECT count(*) FROM agent_thoughts;  (should be 0)
--   3. Test search fn: SELECT * FROM match_agent_thoughts(
--        '[0.1,0.2,...]'::vector(1536), NULL, NULL, 0.5, 5, '{}');
-- ============================================================================
