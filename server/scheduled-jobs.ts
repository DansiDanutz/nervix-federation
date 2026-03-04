/**
 * Nervix Scheduled Jobs — Background housekeeping tasks
 *
 * Jobs:
 * 1. Enrollment cleanup — expire old challenges (every 5 min)
 * 2. Task timeout — mark overdue in_progress tasks (every 1 min)
 * 3. Heartbeat monitor — mark stale agents offline (every 2 min)
 * 4. Webhook retry — retry failed A2A messages (every 1 min)
 * 5. Session cleanup — delete expired sessions (every 1 hour)
 * 6. AgentMail inbox monitor — poll for new emails (every 5 min)
 * 7. Data retention — purge old logs and historical data (every 24 hours)
 */
import crypto from "crypto";
import { logger } from "./_core/logger";
import { getDb, getAgentById } from "./db";
import { alertAgentsOffline, alertTaskTimeout, alertWebhookDead } from "./telegram-alerts";
import { deliverWebhook } from "./webhook-delivery";

const MAX_WEBHOOK_RETRIES = 3;
const RETRY_DELAYS_MS = [60_000, 300_000, 900_000]; // 1min, 5min, 15min

function log(job: string, msg: string) {
  logger.info("ScheduledJob:%s %s", job, msg);
}

// ─── Job 1: Expire old enrollment challenges ────────────────────────────────
async function cleanupEnrollments() {
  try {
    const now = new Date().toISOString();
    const { data, error } = await getDb()
      .from("enrollment_challenges")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expiresAt", now)
      .select("challengeId");
    if (error) throw error;
    if (data && data.length > 0) {
      log("enrollment-cleanup", `Expired ${data.length} stale challenges`);
    }
  } catch (e: any) {
    log("enrollment-cleanup", `Error: ${e.message}`);
  }
}

// ─── Job 2: Timeout overdue tasks ───────────────────────────────────────────
async function timeoutOverdueTasks() {
  try {
    const db = getDb();
    // Find in_progress tasks that exceed their maxDuration
    const { data: tasks, error } = await db
      .from("tasks")
      .select("taskId, assigneeId, maxDuration, startedAt, title")
      .eq("status", "in_progress")
      .not("startedAt", "is", null);
    if (error) throw error;
    if (!tasks || tasks.length === 0) return;

    const now = Date.now();
    let timedOut = 0;
    for (const task of tasks) {
      const startedMs = new Date(task.startedAt).getTime();
      const maxDurationMs = (task.maxDuration || 3600) * 1000;
      if (now - startedMs > maxDurationMs) {
        await db.from("tasks").update({
          status: "timeout",
          completedAt: new Date().toISOString(),
          errorMessage: `Task timed out after ${task.maxDuration || 3600}s`,
        }).eq("taskId", task.taskId);

        alertTaskTimeout(task.title || task.taskId, task.assigneeId || "unassigned");

        // Decrement agent active tasks
        if (task.assigneeId) {
          const { data: agent } = await db.from("agents").select("activeTasks").eq("agentId", task.assigneeId).limit(1);
          if (agent && agent[0]) {
            await db.from("agents").update({
              activeTasks: Math.max(0, (agent[0].activeTasks || 1) - 1),
            }).eq("agentId", task.assigneeId);
          }
        }
        timedOut++;
      }
    }
    if (timedOut > 0) {
      log("task-timeout", `Timed out ${timedOut} overdue tasks`);
    }
  } catch (e: any) {
    log("task-timeout", `Error: ${e.message}`);
  }
}

// ─── Job 3: Mark stale agents offline ───────────────────────────────────────
async function markStaleAgentsOffline() {
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await getDb()
      .from("agents")
      .update({ status: "offline" })
      .eq("status", "active")
      .lt("lastHeartbeat", tenMinAgo)
      .select("agentId");
    if (error) throw error;
    if (data && data.length > 0) {
      log("heartbeat-monitor", `Marked ${data.length} agents offline (no heartbeat > 10min)`);
      // Fetch agent names for alert
      const { data: names } = await getDb().from("agents").select("agentId, name").in("agentId", data.map((d: any) => d.agentId));
      alertAgentsOffline(names || data);
    }
  } catch (e: any) {
    log("heartbeat-monitor", `Error: ${e.message}`);
  }
}

// ─── Job 4: Retry failed webhook deliveries ─────────────────────────────────
async function retryFailedWebhooks() {
  try {
    const db = getDb();
    const { data: failedMessages, error } = await db
      .from("a2a_messages")
      .select("messageId, method, toAgentId, payload, taskId, fromAgentId, retryCount, createdAt")
      .eq("status", "failed")
      .lt("retryCount", MAX_WEBHOOK_RETRIES)
      .order("createdAt", { ascending: true })
      .limit(10);
    if (error) throw error;
    if (!failedMessages || failedMessages.length === 0) return;

    for (const msg of failedMessages) {
      // Check if enough time has passed for retry (exponential backoff)
      const retryDelay = RETRY_DELAYS_MS[msg.retryCount] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      const lastAttempt = new Date(msg.createdAt).getTime(); // approximate
      if (Date.now() - lastAttempt < retryDelay) continue;

      // Get agent webhook URL
      const { data: agents } = await db.from("agents").select("webhookUrl, webhookSecret").eq("agentId", msg.toAgentId).limit(1);
      const agent = agents?.[0];
      if (!agent?.webhookUrl) {
        // No webhook URL — mark as dead letter
        await db.from("a2a_messages").update({
          status: "expired",
          errorMessage: "Agent has no webhook URL configured",
        }).eq("messageId", msg.messageId);
        continue;
      }

      // Attempt delivery
      try {
        const body = JSON.stringify({
          messageId: msg.messageId,
          method: msg.method,
          payload: msg.payload,
          taskId: msg.taskId,
          fromAgentId: msg.fromAgentId,
          toAgentId: msg.toAgentId,
          timestamp: Date.now(),
          retryAttempt: msg.retryCount + 1,
        });
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (agent.webhookSecret) {
          headers["X-Nervix-Signature"] = crypto
            .createHmac("sha256", agent.webhookSecret)
            .update(body)
            .digest("hex");
        }
        const res = await fetch(agent.webhookUrl, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          await db.from("a2a_messages").update({
            status: "delivered",
            deliveredAt: new Date().toISOString(),
            retryCount: msg.retryCount + 1,
          }).eq("messageId", msg.messageId);
          log("webhook-retry", `Delivered ${msg.messageId} on retry ${msg.retryCount + 1}`);
        } else {
          await db.from("a2a_messages").update({
            retryCount: msg.retryCount + 1,
            errorMessage: `Retry ${msg.retryCount + 1}: HTTP ${res.status}`,
          }).eq("messageId", msg.messageId);
        }
      } catch (err: any) {
        const newRetry = msg.retryCount + 1;
        const updates: any = {
          retryCount: newRetry,
          errorMessage: `Retry ${newRetry}: ${err.message}`,
        };
        if (newRetry >= MAX_WEBHOOK_RETRIES) {
          updates.status = "expired";
          log("webhook-retry", `Dead letter: ${msg.messageId} after ${MAX_WEBHOOK_RETRIES} retries`);
          alertWebhookDead(msg.messageId, msg.toAgentId);
        }
        await db.from("a2a_messages").update(updates).eq("messageId", msg.messageId);
      }
    }
  } catch (e: any) {
    log("webhook-retry", `Error: ${e.message}`);
  }
}

// ─── Job 4b: Deliver stale "queued" messages (crash recovery) ────────────────
async function deliverStaleQueued() {
  try {
    const db = getDb();
    const thirtySecAgo = new Date(Date.now() - 30_000).toISOString();
    const { data: staleMessages, error } = await db
      .from("a2a_messages")
      .select("messageId, method, toAgentId, payload, taskId, fromAgentId")
      .eq("status", "queued")
      .lt("createdAt", thirtySecAgo)
      .order("createdAt", { ascending: true })
      .limit(10);
    if (error) throw error;
    if (!staleMessages || staleMessages.length === 0) return;

    for (const msg of staleMessages) {
      await deliverWebhook(msg.messageId, msg.toAgentId, {
        messageId: msg.messageId,
        method: msg.method,
        payload: msg.payload,
        taskId: msg.taskId,
        fromAgentId: msg.fromAgentId,
        toAgentId: msg.toAgentId,
        timestamp: Date.now(),
      });
    }
    log("queued-delivery", `Attempted delivery for ${staleMessages.length} stale queued messages`);
  } catch (e: any) {
    log("queued-delivery", `Error: ${e.message}`);
  }
}

// ─── Job 5: Clean up expired sessions ───────────────────────────────────────
async function cleanupExpiredSessions() {
  try {
    const now = new Date().toISOString();
    const { data, error } = await getDb()
      .from("agent_sessions")
      .delete()
      .lt("refreshTokenExpiresAt", now)
      .select("sessionId");
    if (error) throw error;
    if (data && data.length > 0) {
      log("session-cleanup", `Deleted ${data.length} expired sessions`);
    }
  } catch (e: any) {
    log("session-cleanup", `Error: ${e.message}`);
  }
}

// ─── Job 7: Data retention policy (P3 security fix) ───────────────────────
/**
 * Purge old data according to retention policy:
 * - audit_log: Delete entries older than 1 year (except critical events)
 * - heartbeat_logs: Delete entries older than 30 days (keep recent history)
 * - a2a_messages: Delete expired/delivered entries older than 90 days
 * - task_results: Delete results for completed tasks older than 180 days
 */
async function applyDataRetentionPolicy() {
  try {
    const db = getDb();
    const now = new Date();
    let totalDeleted = 0;

    // 1. Delete audit logs older than 1 year (except enrollment, suspension, and financial events)
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { count: auditCount } = await db
      .from("audit_log")
      .delete()
      .lt("createdAt", oneYearAgo)
      .not("eventType", "in", '("enrollment_request","enrollment_verified","agent_suspended","agent_activated","escrow_created","escrow_released","escrow_disputed")');
    if ((auditCount || 0) > 0) {
      totalDeleted += auditCount || 0;
      log("data-retention", `Deleted ${auditCount} old audit log entries (>1 year, non-critical)`);
    }

    // 2. Delete heartbeat logs older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: heartbeatCount } = await db
      .from("heartbeat_logs")
      .delete()
      .lt("timestamp", thirtyDaysAgo);
    if ((heartbeatCount || 0) > 0) {
      totalDeleted += heartbeatCount || 0;
      log("data-retention", `Deleted ${heartbeatCount} old heartbeat log entries (>30 days)`);
    }

    // 3. Delete A2A messages older than 90 days (delivered or expired only)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { count: a2aCount } = await db
      .from("a2a_messages")
      .delete()
      .in("status", '("delivered","expired")')
      .lt("createdAt", ninetyDaysAgo);
    if ((a2aCount || 0) > 0) {
      totalDeleted += a2aCount || 0;
      log("data-retention", `Deleted ${a2aCount} old A2A messages (>90 days, delivered/expired)`);
    }

    // 4. Delete task results for tasks completed > 180 days ago
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const { count: resultCount } = await db
      .from("task_results")
      .delete()
      .lt("submittedAt", oneEightyDaysAgo);
    if ((resultCount || 0) > 0) {
      totalDeleted += resultCount || 0;
      log("data-retention", `Deleted ${resultCount} old task results (>180 days)`);
    }

    if (totalDeleted > 0) {
      log("data-retention", `Total records deleted: ${totalDeleted}`);
    } else {
      log("data-retention", "No records to delete");
    }
  } catch (e: any) {
    log("data-retention", `Error: ${e.message}`);
  }
}

// ─── Start all jobs ─────────────────────────────────────────────────────────
export function startScheduledJobs() {
  log("init", "Starting scheduled jobs...");

  // Job 1: Enrollment cleanup — every 5 minutes
  setInterval(cleanupEnrollments, 5 * 60 * 1000);

  // Job 2: Task timeout — every 1 minute
  setInterval(timeoutOverdueTasks, 60 * 1000);

  // Job 3: Heartbeat monitor — every 2 minutes
  setInterval(markStaleAgentsOffline, 2 * 60 * 1000);

  // Job 4: Webhook retry — every 1 minute
  setInterval(retryFailedWebhooks, 60 * 1000);

  // Job 4b: Deliver stale queued messages — every 30 seconds
  setInterval(deliverStaleQueued, 30 * 1000);

  // Job 5: Session cleanup — every 1 hour
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

  // Job 6: AgentMail inbox monitor — every 5 minutes
  setInterval(pollAgentMailInbox, 5 * 60 * 1000);
  pollAgentMailInbox(); // check immediately on startup

  // Job 7: Data retention policy — every 24 hours (runs at 2 AM UTC via cron-like offset)
  const msUntil2AM = calculateDelayTo2AM();
  setTimeout(() => {
    applyDataRetentionPolicy();
    setInterval(applyDataRetentionPolicy, 24 * 60 * 60 * 1000); // Run every 24 hours after first run
  }, msUntil2AM);

  // Run cleanup jobs once at startup
  cleanupEnrollments();
  markStaleAgentsOffline();
  cleanupExpiredSessions();

  log("init", "All 8 scheduled jobs started");
}

// Helper: Calculate delay until 2 AM UTC for data retention job
function calculateDelayTo2AM(): number {
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setUTCHours(2, 0, 0, 0);
  if (now >= next2AM) {
    // Already past 2 AM today, schedule for tomorrow
    next2AM.setDate(next2AM.getDate() + 1);
  }
  return next2AM.getTime() - now.getTime();
}

// ─── Job 6: AgentMail inbox monitor ─────────────────────────────────────────
import { agentMailGetThreads, agentMailGetMessages, agentMailReply } from "./_core/email";

// Track thread IDs we've already seen to avoid re-processing
const seenThreads = new Set<string>();
let agentMailInitialized = false;

async function pollAgentMailInbox() {
  if (!process.env.AGENTMAIL_API_KEY) return;
  try {
    const threads = await agentMailGetThreads(20);

    // On first run, just seed known threads without processing
    if (!agentMailInitialized) {
      threads.forEach((t: any) => seenThreads.add(t.thread_id || t.id));
      agentMailInitialized = true;
      log("agentmail", `Initialized — tracking ${seenThreads.size} existing threads`);
      return;
    }

    for (const thread of threads) {
      const threadId = thread.thread_id || thread.id;
      if (seenThreads.has(threadId)) continue;
      seenThreads.add(threadId);

      // New thread — get the message content
      const messages = await agentMailGetMessages(threadId);
      const latest = messages[0];
      if (!latest) continue;

      const from = latest.from || "unknown";
      const subject = thread.subject || "(no subject)";
      const text = latest.text || latest.body || "";

      log("agentmail", `📧 New email from ${from}: "${subject}"`);

      // Auto-reply acknowledging receipt
      await agentMailReply(threadId,
        `Hi,\n\nThank you for reaching out to Nervix! Your message has been received and logged.\n\n` +
        `Our team (and AI agents) will review your message shortly.\n\n` +
        `If you're a developer, visit https://nervix.ai/docs to get started.\n\n` +
        `— Nervix Federation\nhttps://nervix.ai`
      );
    }
  } catch (e: any) {
    log("agentmail", `Error: ${e.message}`);
  }
}
