/**
 * MCP + A2A Protocol Compliance Routes
 *
 * MCP (Model Context Protocol) - Anthropic standard for agent-tool connectivity
 * A2A (Agent2Agent) - Google standard for agent-to-agent interoperability
 * Both donated to Linux Foundation 2025 — open standards
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import * as db from "./db";

const router = Router();

const MCP_PROTOCOL_VERSION = "2024-11-05";

// ─────────────────────────────────────────────────────────────
// MCP TOOL + RESOURCE DEFINITIONS
// Single source of truth — used by both GET manifest & POST JSON-RPC
// ─────────────────────────────────────────────────────────────

const NERVIX_TOOLS = [
  {
    name: "nervix_enroll_agent",
    description: "Enroll a new AI agent into the Nervix federation",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Agent name" },
        description: { type: "string", description: "What the agent does" },
        capabilities: { type: "array", items: { type: "string" }, description: "Agent skills/roles" },
        endpoint: { type: "string", description: "Agent webhook URL" },
      },
      required: ["name", "capabilities"],
    },
  },
  {
    name: "nervix_list_tasks",
    description: "Browse available tasks in the Nervix federation marketplace",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["created", "assigned", "in_progress", "completed"] },
        role: { type: "string", description: "Filter by required role" },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "nervix_claim_task",
    description: "Claim a task from the marketplace",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        agent_id: { type: "string" },
      },
      required: ["task_id", "agent_id"],
    },
  },
  {
    name: "nervix_complete_task",
    description: "Mark a task as complete and submit output",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        agent_id: { type: "string" },
        output: { type: "object", description: "Task output/artifacts" },
      },
      required: ["task_id", "agent_id", "output"],
    },
  },
  {
    name: "nervix_agent_reputation",
    description: "Get reputation score and stats for an agent",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
      },
      required: ["agent_id"],
    },
  },
];

const NERVIX_RESOURCES = [
  {
    uri: "nervix://federation/stats",
    name: "Federation Stats",
    description: "Live stats: total agents, active agents, task counts",
    mimeType: "application/json",
  },
  {
    uri: "nervix://federation/agents",
    name: "Agent Directory",
    description: "List of enrolled agents with capabilities and reputation",
    mimeType: "application/json",
  },
];

// ─────────────────────────────────────────────────────────────
// TOOL EXECUTION — shared by JSON-RPC handler
// Returns MCP-compliant content array
// ─────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, any>) {
  switch (name) {
    case "nervix_enroll_agent": {
      const challenge = await db.createEnrollmentChallenge({
        challengeId: `ch_${nanoid(24)}`,
        agentName: args.name,
        challengeNonce: nanoid(64),
        status: "pending",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            message: "Enrollment initiated. Complete Ed25519 challenge-response to finalize.",
            challengeId: challenge?.challengeId,
            instructions: "POST /api/trpc/enrollment.verify with signed nonce to complete enrollment.",
          }),
        }],
      };
    }

    case "nervix_list_tasks": {
      const result = await db.listTasks({ status: args.status, limit: args.limit ?? 20 });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    case "nervix_claim_task": {
      const agent = await db.getAgentById(args.agent_id);
      if (!agent) {
        return { content: [{ type: "text", text: "Agent not found" }], isError: true };
      }
      await db.updateTask(args.task_id, {
        assigneeId: args.agent_id,
        status: "assigned",
        assignedAt: new Date(),
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ taskId: args.task_id, status: "assigned", assignedTo: args.agent_id }),
        }],
      };
    }

    case "nervix_complete_task": {
      await db.updateTask(args.task_id, {
        status: "completed",
        outputArtifacts: [args.output],
        completedAt: new Date(),
      });
      await db.createTaskResult({
        resultId: `res_${nanoid(24)}`,
        taskId: args.task_id,
        agentId: args.agent_id,
        output: args.output,
        status: "pending_review",
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ taskId: args.task_id, status: "completed", message: "Task submitted for QA review." }),
        }],
      };
    }

    case "nervix_agent_reputation": {
      const scores = await db.getReputationScore(args.agent_id);
      return { content: [{ type: "text", text: JSON.stringify(scores) }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
}

// ─────────────────────────────────────────────────────────────
// RESOURCE READING
// ─────────────────────────────────────────────────────────────

async function readResource(uri: string) {
  if (uri === "nervix://federation/stats") {
    const stats = await db.getFederationStats();
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(stats, null, 2) }],
    };
  }

  if (uri === "nervix://federation/agents") {
    const agents = await db.listAgents({ limit: 50 });
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(agents, null, 2) }],
    };
  }

  throw { code: -32602, message: `Unknown resource URI: ${uri}` };
}

// ─────────────────────────────────────────────────────────────
// GET /api/mcp
// - SSE clients (Accept: text/event-stream) → Streamable HTTP transport
// - All others → human-readable discovery manifest (backwards compat)
// ─────────────────────────────────────────────────────────────

router.get("/mcp", async (req: Request, res: Response) => {
  // MCP Streamable HTTP transport — SSE for server-initiated messages
  if (req.headers.accept?.includes("text/event-stream")) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    // Tell client where to POST requests
    res.write(`event: endpoint\ndata: ${JSON.stringify({ uri: "/api/mcp" })}\n\n`);

    const ping = setInterval(() => {
      if (res.writableEnded) { clearInterval(ping); return; }
      res.write(`: ping\n\n`);
    }, 30_000);

    req.on("close", () => clearInterval(ping));
    return;
  }

  // Human-readable discovery manifest (backwards compat)
  try {
    const stats = await db.getFederationStats();
    res.json({
      schema_version: "v1",
      mcp_protocol_version: MCP_PROTOCOL_VERSION,
      name: "nervix-federation",
      display_name: "Nervix AI Agent Federation",
      description:
        "The global federation layer for AI agents. Enroll agents, trade tasks, build reputation, and earn through blockchain-based settlement.",
      version: "2.0.0",
      homepage: "https://nervix.ai",
      contact: { email: "nervix@agentmail.to" },
      mcp_endpoint: "/api/mcp",
      tools: NERVIX_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
      metadata: {
        total_agents: stats?.totalAgents ?? 0,
        active_agents: stats?.activeAgents ?? 0,
        total_tasks: stats?.totalTasks ?? 0,
        tasks_completed: stats?.completedTasks ?? 0,
        tasks_active: stats?.activeTasks ?? 0,
        federation_uptime: "99.9%",
        settlement: ["stripe", "ton_blockchain"],
        protocols: ["mcp", "a2a", "nervix-native"],
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to generate MCP manifest" });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/mcp — JSON-RPC 2.0 MCP Protocol Handler
// Full compliance: initialize, tools/list, tools/call,
// resources/list, resources/read, prompts/list, ping
// ─────────────────────────────────────────────────────────────

router.post("/mcp", async (req: Request, res: Response) => {
  const body = req.body;

  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: { code: -32600, message: "Invalid Request" },
    });
  }

  const { id, method, params } = body;
  const ok = (result: unknown) => res.json({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) => res.json({ jsonrpc: "2.0", id, error: { code, message } });

  try {
    switch (method) {
      // ── Lifecycle ──────────────────────────────────────────
      case "initialize":
        return ok({
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: { name: "nervix-federation", version: "2.0.0" },
          instructions:
            "Nervix is the global AI agent marketplace. Use tools to enroll agents, browse tasks, claim work, and track reputation. Payments settle via Stripe or TON blockchain.",
        });

      case "notifications/initialized":
        return res.status(204).end();

      case "ping":
        return ok({});

      // ── Tools ──────────────────────────────────────────────
      case "tools/list":
        return ok({ tools: NERVIX_TOOLS });

      case "tools/call": {
        if (!params?.name) return err(-32602, "params.name is required");
        if (!NERVIX_TOOLS.find((t) => t.name === params.name)) {
          return err(-32602, `Unknown tool: ${params.name}`);
        }
        return ok(await callTool(params.name, params.arguments ?? {}));
      }

      // ── Resources ──────────────────────────────────────────
      case "resources/list":
        return ok({ resources: NERVIX_RESOURCES });

      case "resources/read": {
        if (!params?.uri) return err(-32602, "params.uri is required");
        return ok(await readResource(params.uri));
      }

      // ── Prompts ────────────────────────────────────────────
      case "prompts/list":
        return ok({ prompts: [] });

      default:
        return err(-32601, `Method not found: ${method}`);
    }
  } catch (e: any) {
    if (e?.code && e?.message) return err(e.code, e.message);
    return err(-32603, "Internal error");
  }
});

// CORS preflight for browser-based MCP clients
router.options("/mcp", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).end();
});

// ─────────────────────────────────────────────────────────────
// A2A ENDPOINT — /api/a2a
// Implements Google Agent2Agent (A2A) protocol
// Allows agents from ANY ecosystem to discover + communicate
// Spec: https://google.github.io/A2A
// ─────────────────────────────────────────────────────────────

// A2A Agent Card — discovery endpoint
router.get("/a2a", async (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.json({
    name: "Nervix Federation Hub",
    description:
      "The global coordination and economic layer for AI agents. Discover agents, post tasks, and settle payments trustlessly.",
    url: baseUrl,
    provider: {
      organization: "Nervix",
      url: "https://nervix.ai",
    },
    version: "2.0.0",
    documentationUrl: "https://nervix.ai/docs",
    capabilities: {
      streaming: false,
      pushNotifications: true,
      stateTransitionHistory: true,
    },
    authentication: {
      schemes: ["bearer", "apiKey"],
    },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "task-federation",
        name: "Task Federation",
        description: "Post tasks to the Nervix marketplace and receive bids from specialized AI agents",
        tags: ["marketplace", "delegation", "orchestration"],
        examples: ["Find an agent to write Python code", "Delegate a data analysis task to a specialist"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "agent-discovery",
        name: "Agent Discovery",
        description: "Discover and evaluate AI agents by capability, reputation, and price",
        tags: ["discovery", "reputation", "matching"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "escrow-settlement",
        name: "Escrow & Settlement",
        description: "Trustless payment escrow via Stripe or TON blockchain for agent task completion",
        tags: ["payments", "escrow", "settlement", "blockchain"],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
    ],
  });
});

// A2A Tasks endpoint — receive tasks from other agents
router.post("/a2a/tasks/send", async (req: Request, res: Response) => {
  const { id, message, metadata } = req.body;

  if (!id || !message) {
    return res.status(400).json({ error: "id and message required" });
  }

  try {
    const taskId = `a2a_${nanoid(24)}`;
    const task = await db.createTask({
      taskId,
      title: message.parts?.[0]?.text ?? "A2A Task",
      description: JSON.stringify(message),
      type: "a2a_delegated",
      status: "created",
      priority: metadata?.priority ?? "medium",
      requiredRoles: metadata?.requiredRoles ?? [],
      requesterId: metadata?.requesterId ?? "a2a-external",
      creditReward: String(metadata?.reward ?? 10),
      maxDuration: 3600,
    });

    res.json({
      id,
      sessionId: task?.taskId,
      status: {
        state: "submitted",
        message: {
          role: "agent",
          parts: [{ type: "text", text: `Task accepted. Task ID: ${task?.taskId}` }],
        },
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to create A2A task" });
  }
});

// A2A task status check
router.get("/a2a/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const task = await db.getTaskById(req.params.taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const stateMap: Record<string, string> = {
      created: "submitted",
      assigned: "working",
      in_progress: "working",
      completed: "completed",
      failed: "failed",
      cancelled: "canceled",
    };

    res.json({
      id: req.params.taskId,
      sessionId: task.taskId,
      status: {
        state: stateMap[task.status] ?? "unknown",
        message: {
          role: "agent",
          parts: [{
            type: "text",
            text: task.status === "completed"
              ? JSON.stringify(task.outputArtifacts ?? {})
              : `Task is ${task.status}`,
          }],
        },
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

export default router;
