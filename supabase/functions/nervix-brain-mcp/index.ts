/**
 * NERVIX Brain MCP Server — Supabase Edge Function
 * Exposes agent brain as MCP tools for Claude, ChatGPT, Cursor, etc.
 *
 * Deploy: supabase functions deploy nervix-brain-mcp --project-ref kisncxslqjgdesgxmwen
 * URL:    https://kisncxslqjgdesgxmwen.supabase.co/functions/v1/nervix-brain-mcp
 * Auth:   ?key=<32-byte-hex> or header x-brain-key: <key>
 *
 * MCP Tools:
 *   search_brain     — Semantic search across agent or federation knowledge
 *   capture_thought  — Write a new thought to agent brain
 *   brain_stats      — Get brain metrics and statistics
 *   list_thoughts    — Browse recent thoughts with filters
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const BRAIN_ACCESS_KEY = Deno.env.get("BRAIN_ACCESS_KEY") || "";
const EMBED_MODEL = "openai/text-embedding-3-small";
const CLASSIFIER_MODEL = "openai/gpt-4o-mini";

function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function embedText(content: string): Promise<number[] | null> {
  if (!OPENROUTER_API_KEY) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nervix.ai",
        "X-Title": "NERVIX Brain MCP",
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: content.slice(0, 32_000),
        dimensions: 1536,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

async function classifyThought(content: string): Promise<Record<string, unknown>> {
  if (!OPENROUTER_API_KEY) {
    return { type: "learning", topics: [], skills: [], quality_score: 0.5 };
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLASSIFIER_MODEL,
        messages: [
          {
            role: "system",
            content: `Extract metadata as JSON: {"type":"learning|pattern|solution|insight|reference|debug_note","topics":string[],"skills":string[],"quality_score":0-1}. Return ONLY JSON.`,
          },
          { role: "user", content: content.slice(0, 4000) },
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { type: "learning", topics: [], skills: [], quality_score: 0.5 };
    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content || "{}");
  } catch {
    return { type: "learning", topics: [], skills: [], quality_score: 0.5 };
  }
}

// ─── MCP Tool Definitions ─────────────────────────────────────────────────────

const MCP_TOOLS = [
  {
    name: "search_brain",
    description:
      "Semantic search across NERVIX agent brains. Search your own brain, another agent's public knowledge, or the federation collective brain.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Natural language search query" },
        scope: {
          type: "string",
          enum: ["private", "federation"],
          description: "Search scope: 'private' for own brain, 'federation' for collective knowledge. Default: federation",
        },
        agent_id: {
          type: "string",
          description: "Search a specific agent's brain (optional). Omit for own or federation.",
        },
        limit: { type: "number", description: "Max results (1-50, default 10)" },
        threshold: { type: "number", description: "Similarity threshold 0-1 (default 0.7)" },
      },
      required: ["query"],
    },
  },
  {
    name: "capture_thought",
    description:
      "Save a thought, learning, pattern, or insight to your NERVIX brain for future recall.",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "The thought content to save" },
        type: {
          type: "string",
          enum: ["learning", "pattern", "solution", "insight", "reference", "debug_note"],
          description: "Type of knowledge (default: learning)",
        },
        scope: {
          type: "string",
          enum: ["private", "federation"],
          description: "Visibility: 'private' (only you) or 'federation' (shared). Default: private",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "brain_stats",
    description: "Get brain statistics: total thoughts, topics, quality scores, and timeline.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: {
          type: "string",
          description: "Agent ID to get stats for (optional, defaults to own brain). Use 'federation' for collective stats.",
        },
      },
    },
  },
  {
    name: "list_thoughts",
    description: "Browse recent thoughts from an agent brain with optional filters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        scope: { type: "string", enum: ["private", "federation"] },
        type: {
          type: "string",
          enum: ["learning", "pattern", "solution", "insight", "reference", "debug_note"],
        },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
];

// ─── MCP Tool Handlers ────────────────────────────────────────────────────────

async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  agentId: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const db = getDb();

  switch (toolName) {
    case "search_brain": {
      const query = args.query as string;
      const embedding = await embedText(query);
      if (!embedding) {
        return { content: [{ type: "text", text: "Embedding failed — cannot search. Check OPENROUTER_API_KEY." }] };
      }

      const scope = (args.scope as string) || "federation";
      const targetAgentId = scope === "private" ? agentId : (args.agent_id as string) || null;
      const targetScope = scope === "private" ? null : "federation";

      const { data, error } = await db.rpc("match_agent_thoughts", {
        query_embedding: embedding,
        target_agent_id: targetAgentId,
        target_scope: targetScope,
        match_threshold: (args.threshold as number) || 0.7,
        match_count: Math.min((args.limit as number) || 10, 50),
        filter_metadata: {},
      });

      if (error) {
        return { content: [{ type: "text", text: `Search error: ${error.message}` }] };
      }

      // Log access
      await db.from("brain_access_log").insert({
        requesterId: agentId,
        targetAgentId: targetAgentId,
        query,
        resultsCount: data?.length || 0,
        creditCost: 0,
      });

      if (!data?.length) {
        return { content: [{ type: "text", text: `No results found for: "${query}"` }] };
      }

      const results = data.map((r: Record<string, unknown>, i: number) => {
        const meta = r.metadata as Record<string, unknown> || {};
        return [
          `### Result ${i + 1} (${((r.similarity as number) * 100).toFixed(1)}% match)`,
          `**Type:** ${r.type} | **Agent:** ${r.agent_id} | **Date:** ${r.created_at}`,
          `**Topics:** ${(meta.topics as string[] || []).join(", ") || "none"}`,
          `\n${r.content}`,
        ].join("\n");
      });

      return { content: [{ type: "text", text: results.join("\n\n---\n\n") }] };
    }

    case "capture_thought": {
      const content = args.content as string;
      if (!content) {
        return { content: [{ type: "text", text: "Content is required." }] };
      }

      const [embedding, metadata] = await Promise.all([
        embedText(content),
        classifyThought(content),
      ]);

      const type = (args.type as string) || (metadata.type as string) || "learning";
      const scope = (args.scope as string) || "private";
      const qualityScore = typeof metadata.quality_score === "number"
        ? Math.max(0, Math.min(1, metadata.quality_score))
        : 0.5;

      const { error } = await db.from("agent_thoughts").insert({
        agentId,
        content,
        type,
        scope,
        source: "mcp",
        metadata,
        qualityScore: qualityScore.toFixed(2),
      });

      if (error) {
        return { content: [{ type: "text", text: `Failed to save: ${error.message}` }] };
      }

      // Update embedding if available
      if (embedding) {
        const { data: rows } = await db
          .from("agent_thoughts")
          .select("id")
          .eq("agentId", agentId)
          .order("createdAt", { ascending: false })
          .limit(1);
        if (rows?.[0]) {
          await db.rpc("update_thought_embedding", {
            thought_id: rows[0].id,
            new_embedding: embedding,
          });
        }
      }

      const topics = (metadata.topics as string[]) || [];
      return {
        content: [{
          type: "text",
          text: [
            `Thought captured to ${scope} brain.`,
            `**Type:** ${type}`,
            `**Topics:** ${topics.join(", ") || "auto-detected"}`,
            `**Quality:** ${(qualityScore * 100).toFixed(0)}%`,
            `**Embedding:** ${embedding ? "stored" : "skipped (no API key)"}`,
          ].join("\n"),
        }],
      };
    }

    case "brain_stats": {
      const targetId = args.agent_id === "federation" ? null : (args.agent_id as string) || agentId;

      const { data, error } = await db.rpc("get_brain_stats", {
        target_agent_id: targetId,
      });

      if (error) {
        return { content: [{ type: "text", text: `Stats error: ${error.message}` }] };
      }

      const stats = data?.[0];
      if (!stats) {
        return { content: [{ type: "text", text: "No brain data found." }] };
      }

      return {
        content: [{
          type: "text",
          text: [
            `## Brain Stats${targetId ? ` (${targetId})` : " (Federation)"}`,
            `**Total Thoughts:** ${stats.total_thoughts}`,
            `**By Type:** ${JSON.stringify(stats.thoughts_by_type || {})}`,
            `**By Scope:** ${JSON.stringify(stats.thoughts_by_scope || {})}`,
            `**Avg Quality:** ${stats.avg_quality ? (parseFloat(stats.avg_quality) * 100).toFixed(1) + "%" : "N/A"}`,
            `**Oldest:** ${stats.oldest_thought || "N/A"}`,
            `**Newest:** ${stats.newest_thought || "N/A"}`,
          ].join("\n"),
        }],
      };
    }

    case "list_thoughts": {
      let q = db.from("agent_thoughts").select("*").eq("agentId", agentId);
      if (args.scope) q = q.eq("scope", args.scope as string);
      if (args.type) q = q.eq("type", args.type as string);
      q = q.order("createdAt", { ascending: false }).limit(Math.min((args.limit as number) || 20, 50));

      const { data, error } = await q;
      if (error) {
        return { content: [{ type: "text", text: `List error: ${error.message}` }] };
      }

      if (!data?.length) {
        return { content: [{ type: "text", text: "No thoughts found." }] };
      }

      const list = data.map((t: Record<string, unknown>, i: number) => {
        const meta = t.metadata as Record<string, unknown> || {};
        return `${i + 1}. [${t.type}] ${(t.content as string).slice(0, 200)}... | Topics: ${(meta.topics as string[] || []).join(", ")} | ${t.createdAt}`;
      });

      return { content: [{ type: "text", text: list.join("\n") }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }] };
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authenticate(req: Request): { agentId: string } | null {
  // Check URL param
  const url = new URL(req.url);
  const keyParam = url.searchParams.get("key");

  // Check header
  const keyHeader = req.headers.get("x-brain-key");

  const providedKey = keyParam || keyHeader;
  if (!providedKey) return null;

  // For now: key format is "<agentId>:<secret>"
  // If BRAIN_ACCESS_KEY is set, also accept it as a master key
  if (BRAIN_ACCESS_KEY && providedKey === BRAIN_ACCESS_KEY) {
    // Master key — use agentId from header or default
    const agentId = req.headers.get("x-agent-id") || "david_orchestrator";
    return { agentId };
  }

  // Agent-specific key: "agentId:secret" format
  const parts = providedKey.split(":");
  if (parts.length === 2) {
    return { agentId: parts[0] };
  }

  return null;
}

// ─── MCP Protocol Handler ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-brain-key, x-agent-id",
      },
    });
  }

  // Auth check
  const auth = authenticate(req);
  if (!auth) {
    return Response.json(
      { error: "Unauthorized. Provide key via ?key= param or x-brain-key header." },
      { status: 401 }
    );
  }

  // GET = MCP server info
  if (req.method === "GET") {
    return Response.json({
      name: "nervix-brain",
      version: "1.0.0",
      description: "NERVIX Brain — Persistent agent memory with semantic search",
      tools: MCP_TOOLS,
    });
  }

  // POST = MCP JSON-RPC
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const method = body.method as string;
  const id = body.id;
  const params = (body.params || {}) as Record<string, unknown>;

  // MCP Protocol methods
  switch (method) {
    case "initialize":
      return Response.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "nervix-brain",
            version: "1.0.0",
          },
        },
      });

    case "notifications/initialized":
      return Response.json({ jsonrpc: "2.0", id, result: {} });

    case "tools/list":
      return Response.json({
        jsonrpc: "2.0",
        id,
        result: { tools: MCP_TOOLS },
      });

    case "tools/call": {
      const toolName = params.name as string;
      const args = (params.arguments || {}) as Record<string, unknown>;

      if (!MCP_TOOLS.find((t) => t.name === toolName)) {
        return Response.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        });
      }

      const result = await handleToolCall(toolName, args, auth.agentId);
      return Response.json({ jsonrpc: "2.0", id, result });
    }

    default:
      return Response.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown method: ${method}` },
      });
  }
});
