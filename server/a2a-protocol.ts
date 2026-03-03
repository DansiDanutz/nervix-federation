/**
 * A2A Protocol Endpoint — Google Agent2Agent Interoperability
 * 
 * REST endpoint implementing Google's Agent2Agent (A2A) protocol for
 * cross-platform agent communication. Provides standard /a2a endpoint
 * for external agents to discover, send, and manage tasks.
 * 
 * Specification: https://agents.google.com/a2a
 */

import express from "express";
import { z } from "zod";
import { A2A_METHODS } from "../shared/nervix-types";
import * as db from "./db";
import { logger } from "./_core/logger";
import { deliverWebhook } from "./webhook-delivery";

// ─── A2A Protocol Schemas ────────────────────────────────────────────────

const A2ARequestSchema = z.object({
  version: z.string().default("1.0"),
  method: z.enum(A2A_METHODS),
  params: z.record(z.string(), z.unknown()).optional(),
  id: z.string().optional(), // Request ID for correlation
});

const A2AResponseSchema = z.object({
  version: z.string().default("1.0"),
  result: z.unknown().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }).optional(),
  id: z.string().optional(),
});

// ─── A2A Method Handlers ────────────────────────────────────────────────

/**
 * tasks/send — Send a task to another agent
 */
async function handleTasksSend(params: any): Promise<any> {
  const { toAgentId, taskId, payload, method } = params;
  
  if (!toAgentId) {
    throw { code: -32602, message: "Missing required parameter: toAgentId" };
  }
  
  if (!method) {
    throw { code: -32602, message: "Missing required parameter: method" };
  }

  // Verify the target agent exists
  const targetAgent = await db.getAgentById(toAgentId);
  if (!targetAgent) {
    throw { code: -32602, message: "Target agent not found" };
  }

  if (targetAgent.status !== "active") {
    throw { code: -32603, message: "Target agent is not active" };
  }

  // Create A2A message
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.createA2AMessage({
    messageId,
    method: method || "tasks/send",
    fromAgentId: params.fromAgentId || "unknown",
    toAgentId,
    taskId: taskId || null,
    payload: payload || {},
    status: "queued",
  });

  // Deliver via webhook if configured
  if (targetAgent.webhookUrl) {
    deliverWebhook(messageId, toAgentId, {
      messageId,
      method: method || "tasks/send",
      payload: payload || {},
      taskId: taskId || null,
      fromAgentId: params.fromAgentId,
      toAgentId,
      timestamp: Date.now(),
    }).catch((err) => {
      logger.error({ err }, "A2A: Webhook delivery failed for agent %s", toAgentId);
    });
  }

  return {
    messageId,
    status: "queued",
    method: method || "tasks/send",
    toAgentId,
  };
}

/**
 * tasks/get — Get task details by ID
 */
async function handleTasksGet(params: any): Promise<any> {
  const { taskId } = params;
  
  if (!taskId) {
    throw { code: -32602, message: "Missing required parameter: taskId" };
  }

  const task = await db.getTaskById(taskId);
  if (!task) {
    throw { code: -32601, message: "Task not found" };
  }

  return {
    taskId: task.taskId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    requesterId: task.requesterId,
    assigneeId: task.assigneeId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/**
 * tasks/cancel — Cancel a task
 */
async function handleTasksCancel(params: any): Promise<any> {
  const { taskId, agentId } = params;
  
  if (!taskId) {
    throw { code: -32602, message: "Missing required parameter: taskId" };
  }
  if (!agentId) {
    throw { code: -32602, message: "Missing required parameter: agentId" };
  }

  const task = await db.getTaskById(taskId);
  if (!task) {
    throw { code: -32601, message: "Task not found" };
  }

  // Verify the agent is authorized to cancel (requester or assignee)
  if (task.requesterId !== agentId && task.assigneeId !== agentId) {
    throw { code: -32603, message: "Not authorized to cancel this task" };
  }

  // Only allow cancellation for certain statuses
  const cancelableStatuses = ["created", "assigned", "in_progress"];
  if (!cancelableStatuses.includes(task.status)) {
    throw { code: -32602, message: `Cannot cancel task with status: ${task.status}` };
  }

  // Update task status
  await db.updateTask(taskId, { status: "cancelled" });

  return {
    taskId,
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
  };
}

/**
 * tasks/pushNotification — Send a push notification to an agent
 */
async function handleTasksPushNotification(params: any): Promise<any> {
  const { toAgentId, notification } = params;
  
  if (!toAgentId) {
    throw { code: -32602, message: "Missing required parameter: toAgentId" };
  }
  if (!notification || typeof notification !== "object") {
    throw { code: -32602, message: "Missing or invalid parameter: notification" };
  }

  // Verify the target agent exists
  const targetAgent = await db.getAgentById(toAgentId);
  if (!targetAgent) {
    throw { code: -32602, message: "Target agent not found" };
  }

  // Create A2A message for notification
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.createA2AMessage({
    messageId,
    method: "tasks/pushNotification",
    fromAgentId: params.fromAgentId || "system",
    toAgentId,
    taskId: null,
    payload: notification,
    status: "queued",
  });

  // Deliver via webhook if configured
  if (targetAgent.webhookUrl) {
    deliverWebhook(messageId, toAgentId, {
      messageId,
      method: "tasks/pushNotification",
      payload: notification,
      fromAgentId: params.fromAgentId || "system",
      toAgentId,
      timestamp: Date.now(),
    }).catch((err) => {
      logger.error({ err }, "A2A: Push notification delivery failed for agent %s", toAgentId);
    });
  }

  return {
    messageId,
    status: "queued",
    toAgentId,
  };
}

/**
 * tasks/sendSubscribe — Subscribe to task updates
 */
async function handleTasksSendSubscribe(params: any): Promise<any> {
  const { agentId, taskId, callbackUrl } = params;
  
  if (!agentId) {
    throw { code: -32602, message: "Missing required parameter: agentId" };
  }
  if (!taskId) {
    throw { code: -32602, message: "Missing required parameter: taskId" };
  }
  if (!callbackUrl || typeof callbackUrl !== "string") {
    throw { code: -32602, message: "Missing or invalid parameter: callbackUrl" };
  }

  // Verify the task exists
  const task = await db.getTaskById(taskId);
  if (!task) {
    throw { code: -32601, message: "Task not found" };
  }

  // Create subscription record (stored as A2A message)
  const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.createA2AMessage({
    messageId: subscriptionId,
    method: "tasks/sendSubscribe",
    fromAgentId: agentId,
    toAgentId: "system",
    taskId,
    payload: {
      callbackUrl,
      subscribedAt: new Date().toISOString(),
    },
    status: "delivered",
  });

  return {
    subscriptionId,
    taskId,
    status: "subscribed",
    subscribedAt: new Date().toISOString(),
  };
}

/**
 * tasks/resubscribe — Renew an existing subscription
 */
async function handleTasksResubscribe(params: any): Promise<any> {
  const { subscriptionId, agentId } = params;
  
  if (!subscriptionId) {
    throw { code: -32602, message: "Missing required parameter: subscriptionId" };
  }
  if (!agentId) {
    throw { code: -32602, message: "Missing required parameter: agentId" };
  }

  // Find the subscription
  const messages = await db.getA2AInbox(agentId, undefined, 100);
  const subscription = messages.find((m: any) => m.messageId === subscriptionId);
  
  if (!subscription) {
    throw { code: -32601, message: "Subscription not found" };
  }

  if (subscription.fromAgentId !== agentId) {
    throw { code: -32603, message: "Not authorized to resubscribe" };
  }

  // Update subscription timestamp
  const updatedPayload = {
    ...(subscription.payload as any),
    resubscribedAt: new Date().toISOString(),
  };

  await db.updateA2AMessage(subscriptionId, {
    payload: updatedPayload,
    status: "delivered",
  });

  return {
    subscriptionId,
    status: "resubscribed",
    resubscribedAt: new Date().toISOString(),
  };
}

// ─── Main Request Router ────────────────────────────────────────────────

/**
 * Handle A2A protocol requests
 */
async function handleA2ARequest(req: express.Request, res: express.Response) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request
    const body = req.body;
    const validation = A2ARequestSchema.safeParse(body);
    
    if (!validation.success) {
      logger.warn({ errors: validation.error.errors }, "A2A: Invalid request format");
      return res.status(400).json({
        version: "1.0",
        error: {
          code: -32700,
          message: "Parse error: Invalid request format",
          data: validation.error.errors,
        },
      });
    }

    const { version, method, params, id } = validation.data;
    logger.info("A2A: %s request (id: %s)", method, id);

    // Route to appropriate handler
    let result: any;
    switch (method) {
      case "tasks/send":
        result = await handleTasksSend(params);
        break;
      case "tasks/get":
        result = await handleTasksGet(params);
        break;
      case "tasks/cancel":
        result = await handleTasksCancel(params);
        break;
      case "tasks/pushNotification":
        result = await handleTasksPushNotification(params);
        break;
      case "tasks/sendSubscribe":
        result = await handleTasksSendSubscribe(params);
        break;
      case "tasks/resubscribe":
        result = await handleTasksResubscribe(params);
        break;
      default:
        throw { code: -32601, message: `Method not found: ${method}` };
    }

    const duration = Date.now() - startTime;
    logger.info("A2A: %s completed in %dms", method, duration);

    // Success response
    return res.json({
      version: version || "1.0",
      result,
      id,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Handle structured errors
    if (error.code && error.message) {
      logger.warn({ error, duration }, "A2A: Error response for method %s", req.body.method);
      return res.status(400).json({
        version: "1.0",
        error: {
          code: error.code,
          message: error.message,
          data: error.data,
        },
        id: req.body.id,
      });
    }

    // Handle unexpected errors
    logger.error({ error, duration }, "A2A: Unexpected error");
    return res.status(500).json({
      version: "1.0",
      error: {
        code: -32603,
        message: "Internal error",
        data: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      id: req.body.id,
    });
  }
}

// ─── A2A Discovery Endpoint ───────────────────────────────────────────────

/**
 * GET /a2a — Discover A2A protocol capabilities
 */
function handleA2ADiscovery(req: express.Request, res: express.Response) {
  res.json({
    version: "1.0",
    name: "Nervix A2A Protocol Endpoint",
    description: "Agent-to-Agent communication protocol for Nervix federation",
    methods: A2A_METHODS,
    endpoint: req.protocol + "://" + req.get("host") + "/a2a",
    documentation: "https://nervix.io/docs/a2a",
    federation: {
      name: "Nervix Federation",
      version: "2.0.0",
      homepage: "https://nervix.io",
    },
  });
}

// ─── Express Router Export ────────────────────────────────────────────────

export function registerA2ARoutes(app: express.Application) {
  // POST /a2a — Handle A2A protocol requests
  app.post("/a2a", express.json({ limit: "10mb" }), handleA2ARequest);
  
  // GET /a2a — Discovery endpoint
  app.get("/a2a", handleA2ADiscovery);
  
  logger.info("A2A Protocol routes registered: POST /a2a, GET /a2a (discovery)");
}
