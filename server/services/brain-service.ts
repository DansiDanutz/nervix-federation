/**
 * Brain Service — orchestrates thought capture, search, and stats
 * Coordinates between embedder, classifier, and database layer
 */

import { logger } from "../_core/logger";
import { embedText } from "./brain-embedder";
import { classifyThought, type ThoughtMetadata } from "./brain-classifier";
import * as db from "../db";

export interface CaptureResult {
  id: string;
  agentId: string;
  type: string;
  scope: string;
  source: string;
  metadata: ThoughtMetadata;
  hasEmbedding: boolean;
}

export interface SearchResult {
  id: string;
  agentId: string;
  content: string;
  type: string;
  scope: string;
  source: string;
  metadata: Record<string, unknown>;
  qualityScore: number;
  similarity: number;
  createdAt: string;
}

/**
 * Capture a thought: classify it, embed it, store it.
 * Embedding and classification happen in parallel for speed.
 */
export async function captureThought(
  agentId: string,
  content: string,
  source: "task_completion" | "manual" | "a2a" | "telegram" | "mcp" = "manual",
  scope: "private" | "federation" | "marketplace" = "private",
  extraMetadata?: Partial<ThoughtMetadata>
): Promise<CaptureResult> {
  // Run embedding and classification in parallel
  const [embedding, classification] = await Promise.all([
    embedText(content),
    classifyThought(content),
  ]);

  // Merge extra metadata (e.g. related_tasks from task completion)
  const metadata: ThoughtMetadata = {
    ...classification,
    ...extraMetadata,
    // Preserve classified fields if extra doesn't override
    topics: extraMetadata?.topics?.length ? extraMetadata.topics : classification.topics,
    skills: extraMetadata?.skills?.length ? extraMetadata.skills : classification.skills,
  };

  // Store the thought
  const thought = await db.createThought({
    agentId,
    content,
    type: metadata.type,
    scope,
    source,
    metadata: metadata as any,
    qualityScore: metadata.quality_score.toFixed(2),
  });

  // Store embedding separately (vector column handled via RPC)
  const thoughtId = (thought as any).id || (thought as any).agentId;
  if (embedding && thoughtId) {
    // Get the actual ID from the created row
    const rows = await db.listThoughts(agentId, { limit: 1 });
    if (rows.length > 0) {
      try {
        await db.updateThoughtEmbedding(rows[0].id, embedding);
      } catch (err) {
        logger.warn({ err, thoughtId: rows[0].id }, "Failed to store embedding — thought saved without vector");
      }
    }
  }

  logger.info(
    { agentId, type: metadata.type, topics: metadata.topics, source, hasEmbedding: !!embedding },
    "Thought captured"
  );

  return {
    id: thoughtId,
    agentId,
    type: metadata.type,
    scope,
    source,
    metadata,
    hasEmbedding: !!embedding,
  };
}

/**
 * Semantic search across an agent's brain or the federation brain.
 * Returns results ranked by vector similarity.
 */
export async function searchBrain(
  requesterId: string,
  query: string,
  opts: {
    targetAgentId?: string | null;
    scope?: string | null;
    threshold?: number;
    limit?: number;
    filterMetadata?: Record<string, unknown>;
  } = {}
): Promise<SearchResult[]> {
  const embedding = await embedText(query);
  if (!embedding) {
    logger.warn("Cannot search brain — embedding failed");
    return [];
  }

  const results = await db.searchThoughtsRpc(
    embedding,
    opts.targetAgentId ?? null,
    opts.scope ?? null,
    opts.threshold ?? 0.7,
    opts.limit ?? 10,
    opts.filterMetadata ?? {}
  );

  // Brain economy: cross-agent search costs 0.5 credits
  const isOwnBrain = opts.targetAgentId === requesterId;
  const isFederation = !opts.targetAgentId;
  const creditCost = (isOwnBrain || isFederation) ? 0 : 0.5;

  if (creditCost > 0 && opts.targetAgentId) {
    try {
      await db.deductCreditsFromAgent(requesterId, creditCost.toFixed(6));
      await db.addCreditsToAgent(opts.targetAgentId, (creditCost * 0.8).toFixed(6)); // 80% to brain owner
      // 20% goes to platform implicitly (not credited)
      logger.info(
        { requesterId, targetAgentId: opts.targetAgentId, cost: creditCost },
        "Brain access credit charged"
      );
    } catch (err) {
      logger.warn({ err, requesterId }, "Brain access credit deduction failed — allowing search anyway");
    }
  }

  // Log access
  await db.logBrainAccess({
    requesterId,
    targetAgentId: opts.targetAgentId ?? null,
    query,
    resultsCount: results.length,
    creditCost: creditCost.toFixed(2),
  });

  return results.map((r: any) => ({
    id: r.id,
    agentId: r.agent_id,
    content: r.content,
    type: r.type,
    scope: r.scope,
    source: r.source,
    metadata: r.metadata,
    qualityScore: parseFloat(r.quality_score) || 0,
    similarity: r.similarity,
    createdAt: r.created_at,
  }));
}

/**
 * Get brain statistics for an agent or the whole federation.
 */
export async function getBrainStats(agentId: string | null) {
  return db.getBrainStats(agentId);
}

/**
 * Share a private thought to the federation brain.
 * Only thoughts with quality_score >= 0.7 can be shared.
 */
export async function shareToFederation(
  thoughtId: string,
  agentId: string
): Promise<{ shared: boolean; reason?: string }> {
  const thought = await db.getThoughtById(thoughtId);
  if (!thought) return { shared: false, reason: "Thought not found" };
  if (thought.agentId !== agentId) return { shared: false, reason: "Not your thought" };
  if (thought.scope !== "private") return { shared: false, reason: "Already shared" };

  const quality = parseFloat(thought.qualityScore) || 0;
  if (quality < 0.7) {
    return { shared: false, reason: `Quality score ${quality} below 0.7 threshold` };
  }

  await db.updateThoughtScope(thoughtId, agentId, "federation");

  // Reputation boost for quality federation contributions
  if (quality >= 0.7) {
    try {
      const rep = await db.getOrCreateReputation(agentId);
      const boost = 0.01; // +1% for quality contributions
      const newOverall = Math.min(1.0, parseFloat(rep.overallScore as string) + boost);
      await db.updateReputation(agentId, {
        overallScore: newOverall.toFixed(4),
        lastCalculated: new Date(),
      });
      logger.info({ agentId, boost, newOverall }, "Reputation boost for federation contribution");
    } catch (err) {
      logger.warn({ err, agentId }, "Reputation boost failed (non-blocking)");
    }
  }

  logger.info({ thoughtId, agentId, quality }, "Thought shared to federation");
  return { shared: true };
}

/**
 * Auto-capture a learning from a completed task.
 * Called by the task completion handler in routers.ts.
 */
export async function captureFromTaskCompletion(
  agentId: string,
  taskTitle: string,
  taskId: string,
  resultSummary: string,
  artifacts?: Record<string, unknown>
): Promise<CaptureResult> {
  const content = [
    `Task: ${taskTitle}`,
    `Result: ${resultSummary}`,
    artifacts ? `Artifacts: ${JSON.stringify(artifacts).slice(0, 2000)}` : "",
  ].filter(Boolean).join("\n\n");

  return captureThought(agentId, content, "task_completion", "private", {
    related_tasks: [taskId],
  });
}
