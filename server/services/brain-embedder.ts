/**
 * Brain Embedder — generates vector embeddings via OpenRouter API
 * Model: text-embedding-3-small (1536 dimensions)
 * Cost: ~$0.02 per 1M tokens ($0.0001 per 5K chars)
 */

import { logger } from "../_core/logger";
import { ENV } from "../_core/env";

const OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIMENSIONS = 1536;

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * Generate a 1536-dimensional embedding for the given text.
 * Returns null if the API key is missing or the request fails.
 */
export async function embedText(content: string): Promise<number[] | null> {
  const apiKey = ENV.openrouterApiKey;
  if (!apiKey) {
    logger.warn("OPENROUTER_API_KEY not set — skipping embedding");
    return null;
  }

  // Truncate to ~8K tokens (~32K chars) to stay within model limits
  const truncated = content.slice(0, 32_000);

  try {
    const res = await fetch(OPENROUTER_EMBED_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nervix.ai",
        "X-Title": "NERVIX Brain",
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: truncated,
        dimensions: EMBED_DIMENSIONS,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error({ status: res.status, body: errBody }, "OpenRouter embedding failed");
      return null;
    }

    const json = (await res.json()) as EmbeddingResponse;
    const embedding = json.data?.[0]?.embedding;

    if (!embedding || embedding.length !== EMBED_DIMENSIONS) {
      logger.error({ len: embedding?.length }, "Invalid embedding dimensions");
      return null;
    }

    logger.debug({ tokens: json.usage?.total_tokens }, "Embedding generated");
    return embedding;
  } catch (err) {
    logger.error({ err }, "Embedding request error");
    return null;
  }
}

/**
 * Batch-embed multiple texts in a single API call.
 * Returns array of embeddings (null for any that failed).
 */
export async function embedBatch(contents: string[]): Promise<(number[] | null)[]> {
  const apiKey = ENV.openrouterApiKey;
  if (!apiKey) {
    return contents.map(() => null);
  }

  try {
    const res = await fetch(OPENROUTER_EMBED_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nervix.ai",
        "X-Title": "NERVIX Brain",
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: contents.map((c) => c.slice(0, 32_000)),
        dimensions: EMBED_DIMENSIONS,
      }),
    });

    if (!res.ok) {
      return contents.map(() => null);
    }

    const json = (await res.json()) as EmbeddingResponse;
    return contents.map((_, i) => {
      const emb = json.data?.find((d) => d.index === i)?.embedding;
      return emb && emb.length === EMBED_DIMENSIONS ? emb : null;
    });
  } catch {
    return contents.map(() => null);
  }
}
