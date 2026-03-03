/**
 * Brain Classifier — extracts structured metadata from thought content
 * Uses OpenRouter (gpt-4o-mini) for fast, cheap classification
 * Cost: ~$0.15 per 1M input tokens
 */

import { logger } from "../_core/logger";
import { ENV } from "../_core/env";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const CLASSIFIER_MODEL = "openai/gpt-4o-mini";

export interface ThoughtMetadata {
  type: "learning" | "pattern" | "solution" | "insight" | "reference" | "debug_note";
  topics: string[];
  skills: string[];
  related_tasks: string[];
  people: string[];
  action_items: string[];
  dates_mentioned: string[];
  quality_score: number;
}

const CLASSIFICATION_PROMPT = `You are a metadata extractor for an AI agent knowledge system called NERVIX Brain.
Given a thought/note from an AI agent, extract structured metadata.

Return ONLY valid JSON with these fields:
{
  "type": one of "learning"|"pattern"|"solution"|"insight"|"reference"|"debug_note",
  "topics": string[] (2-5 topic tags, lowercase, e.g. ["nodejs", "memory-leak", "debugging"]),
  "skills": string[] (relevant technical skills, e.g. ["typescript", "docker", "postgresql"]),
  "related_tasks": string[] (any task IDs mentioned, empty if none),
  "people": string[] (any person names mentioned, empty if none),
  "action_items": string[] (any follow-up actions, empty if none),
  "dates_mentioned": string[] (any dates in YYYY-MM-DD format, empty if none),
  "quality_score": number (0.0-1.0, rate how useful/actionable this knowledge is)
}

Rules:
- "type" classification: "learning" = general knowledge gained, "pattern" = reusable code/architecture pattern, "solution" = specific fix for a problem, "insight" = strategic/high-level observation, "reference" = link/doc/resource, "debug_note" = debugging steps/findings
- Keep topics concise and lowercase
- quality_score: 0.9+ = highly actionable/reusable, 0.7-0.9 = useful, 0.5-0.7 = context-dependent, <0.5 = marginal value
- Return ONLY the JSON object, no markdown, no explanation`;

/**
 * Classify a thought and extract structured metadata.
 * Returns default metadata if API key is missing or classification fails.
 */
export async function classifyThought(content: string): Promise<ThoughtMetadata> {
  const defaults: ThoughtMetadata = {
    type: "learning",
    topics: [],
    skills: [],
    related_tasks: [],
    people: [],
    action_items: [],
    dates_mentioned: [],
    quality_score: 0.5,
  };

  const apiKey = ENV.openrouterApiKey;
  if (!apiKey) {
    logger.warn("OPENROUTER_API_KEY not set — using default classification");
    return defaults;
  }

  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nervix.ai",
        "X-Title": "NERVIX Brain Classifier",
      },
      body: JSON.stringify({
        model: CLASSIFIER_MODEL,
        messages: [
          { role: "system", content: CLASSIFICATION_PROMPT },
          { role: "user", content: content.slice(0, 4000) },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error({ status: res.status, body: errBody }, "Classification request failed");
      return defaults;
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);

    // Validate and merge with defaults
    const validTypes = ["learning", "pattern", "solution", "insight", "reference", "debug_note"] as const;
    return {
      type: validTypes.includes(parsed.type) ? parsed.type : defaults.type,
      topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 10) : defaults.topics,
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 10) : defaults.skills,
      related_tasks: Array.isArray(parsed.related_tasks) ? parsed.related_tasks : defaults.related_tasks,
      people: Array.isArray(parsed.people) ? parsed.people : defaults.people,
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : defaults.action_items,
      dates_mentioned: Array.isArray(parsed.dates_mentioned) ? parsed.dates_mentioned : defaults.dates_mentioned,
      quality_score: typeof parsed.quality_score === "number"
        ? Math.max(0, Math.min(1, parsed.quality_score))
        : defaults.quality_score,
    };
  } catch (err) {
    logger.error({ err }, "Classification parse error");
    return defaults;
  }
}
