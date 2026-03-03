/**
 * NERVIX Telegram Bot — Command Webhook Handler
 *
 * Receives updates from @NervixAlert_bot and responds to admin commands.
 * Gives Dan real-time control over the federation via Telegram.
 *
 * Commands:
 *   /start   — Welcome + command list
 *   /status  — Federation health + uptime
 *   /stats   — Live agent/task/economy stats
 *   /agents  — Top active agents
 *   /tasks   — Recent pending tasks
 *   /approve <taskId> — Approve a QA-pending task result
 */

import type { Express, Request, Response } from "express";
import * as db from "./db";
import { logger } from "./_core/logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_IDS = new Set([
  424184493,  // Dan
]);

// ─── Telegram API ───────────────────────────────────────────────────────────

async function reply(chatId: number, text: string, parseMode: "HTML" | "Markdown" = "HTML") {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: any) {
    logger.warn("TelegramBot: Failed to send reply: %s", err.message);
  }
}

// ─── Command Handlers ───────────────────────────────────────────────────────

async function handleStart(chatId: number, name: string) {
  await reply(chatId,
    `👋 <b>Hey ${name}!</b> Welcome to the Nervix Federation control panel.\n\n` +
    `<b>Commands:</b>\n` +
    `/status — Federation health + uptime\n` +
    `/stats — Live agent &amp; task counts\n` +
    `/agents — Top active agents\n` +
    `/tasks — Pending task queue\n` +
    `/approve &lt;taskId&gt; — Approve a QA result\n\n` +
    `<i>nervix.ai — the AI agent economy</i>`
  );
}

async function handleStatus(chatId: number) {
  try {
    const stats = await db.getFederationStats();
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);

    await reply(chatId,
      `🟢 <b>Nervix Federation — ONLINE</b>\n\n` +
      `🤖 Agents: <b>${stats.totalAgents}</b> total, <b>${stats.activeAgents}</b> active\n` +
      `📋 Tasks: <b>${stats.totalTasks}</b> total, <b>${stats.activeTasks}</b> active\n` +
      `✅ Completed: <b>${stats.completedTasks}</b>\n` +
      `⏱ Uptime: <b>${h}h ${m}m</b>\n\n` +
      `<code>nervix.ai/api/mcp — MCP 2024-11-05</code>`
    );
  } catch (err: any) {
    await reply(chatId, `🔴 <b>Error fetching status</b>\n${err.message}`);
  }
}

async function handleStats(chatId: number) {
  try {
    const stats = await db.getFederationStats();
    const econStats = await db.getEconomyStats();

    await reply(chatId,
      `📊 <b>Federation Stats</b>\n\n` +
      `<b>Agents</b>\n` +
      `  Total: ${stats.totalAgents}\n` +
      `  Active: ${stats.activeAgents}\n\n` +
      `<b>Tasks</b>\n` +
      `  Total: ${stats.totalTasks}\n` +
      `  Active: ${stats.activeTasks}\n` +
      `  Completed: ${stats.completedTasks}\n` +
      `  Failed: ${stats.failedTasks}\n\n` +
      `<b>Economy</b>\n` +
      `  Total credits: ${econStats?.totalCredits ?? "—"}\n` +
      `  Transfers: ${econStats?.totalTransfers ?? "—"}\n\n` +
      `<i>Updated: ${new Date().toUTCString()}</i>`
    );
  } catch (err: any) {
    await reply(chatId, `🔴 <b>Error</b>: ${err.message}`);
  }
}

async function handleAgents(chatId: number) {
  try {
    const agents = await db.listAgents({ limit: 10 });
    if (!agents || agents.length === 0) {
      await reply(chatId, "No agents enrolled yet.");
      return;
    }

    const lines = (agents as any[]).map((a, i) => {
      const status = a.status === "active" ? "🟢" : "⚫";
      const roles = Array.isArray(a.roles) ? a.roles.slice(0, 2).join(", ") : "—";
      return `${status} <b>${a.name}</b> — ${roles}`;
    });

    await reply(chatId,
      `🤖 <b>Active Agents (top ${agents.length})</b>\n\n` +
      lines.join("\n") + "\n\n" +
      `<a href="https://nervix.ai/agents">View all →</a>`
    );
  } catch (err: any) {
    await reply(chatId, `🔴 <b>Error</b>: ${err.message}`);
  }
}

async function handleTasks(chatId: number) {
  try {
    const pending = await db.listTasks({ status: "created", limit: 5 });
    const inProgress = await db.listTasks({ status: "in_progress", limit: 5 });

    const formatTask = (t: any) =>
      `  📋 <code>${t.taskId?.slice(0, 12)}</code> ${t.title?.slice(0, 40)}`;

    let text = `📋 <b>Task Queue</b>\n\n`;

    if (pending && (pending as any[]).length > 0) {
      text += `<b>Pending (${(pending as any[]).length})</b>\n`;
      text += (pending as any[]).map(formatTask).join("\n") + "\n\n";
    }
    if (inProgress && (inProgress as any[]).length > 0) {
      text += `<b>In Progress (${(inProgress as any[]).length})</b>\n`;
      text += (inProgress as any[]).map(formatTask).join("\n");
    }
    if ((!pending || (pending as any[]).length === 0) && (!inProgress || (inProgress as any[]).length === 0)) {
      text += "No active tasks right now.";
    }

    text += `\n\n<a href="https://nervix.ai/marketplace">Open Marketplace →</a>`;
    await reply(chatId, text);
  } catch (err: any) {
    await reply(chatId, `🔴 <b>Error</b>: ${err.message}`);
  }
}

async function handleApprove(chatId: number, taskId: string) {
  if (!taskId) {
    await reply(chatId, "Usage: <code>/approve &lt;taskId&gt;</code>");
    return;
  }
  try {
    const task = await db.getTaskById(taskId);
    if (!task) {
      await reply(chatId, `❌ Task not found: <code>${taskId}</code>`);
      return;
    }
    await db.updateTask(taskId, { status: "completed" });
    await reply(chatId,
      `✅ <b>Task Approved</b>\n\n` +
      `ID: <code>${taskId}</code>\n` +
      `Title: ${task.title}\n` +
      `Status: completed`
    );
  } catch (err: any) {
    await reply(chatId, `🔴 <b>Error approving task</b>: ${err.message}`);
  }
}

// ─── Webhook Router ─────────────────────────────────────────────────────────

async function handleUpdate(update: any) {
  const message = update.message || update.edited_message;
  if (!message?.text) return;

  const chatId: number = message.chat.id;
  const text: string = message.text.trim();
  const firstName: string = message.from?.first_name || "there";

  // Security: only allow whitelisted chat IDs
  if (!ALLOWED_CHAT_IDS.has(chatId)) {
    logger.warn("TelegramBot: Unauthorized chatId %d tried: %s", chatId, text);
    return;
  }

  logger.info("TelegramBot: [%d] %s", chatId, text);

  const [cmd, ...args] = text.split(/\s+/);
  const command = cmd.toLowerCase().replace(/^\//, "").split("@")[0]; // strip @botname suffix

  switch (command) {
    case "start":
    case "help":
      await handleStart(chatId, firstName);
      break;
    case "status":
      await handleStatus(chatId);
      break;
    case "stats":
      await handleStats(chatId);
      break;
    case "agents":
      await handleAgents(chatId);
      break;
    case "tasks":
      await handleTasks(chatId);
      break;
    case "approve":
      await handleApprove(chatId, args[0]);
      break;
    default:
      await reply(chatId,
        `❓ Unknown command: <code>${cmd}</code>\n\nType /start for help.`
      );
  }
}

// ─── Express Route Registration ─────────────────────────────────────────────

export function registerTelegramBotWebhook(app: Express) {
  if (!BOT_TOKEN) {
    logger.warn("TelegramBot: TELEGRAM_BOT_TOKEN not set — bot webhook disabled");
    return;
  }

  // POST /api/telegram/bot — Telegram sends updates here
  app.post("/api/telegram/bot", async (req: Request, res: Response) => {
    // Respond immediately so Telegram doesn't retry
    res.status(200).end();

    try {
      await handleUpdate(req.body);
    } catch (err: any) {
      logger.error({ err }, "TelegramBot: unhandled error processing update");
    }
  });

  logger.info("TelegramBot: Webhook registered at POST /api/telegram/bot");
}

/**
 * Register the Telegram webhook URL with Telegram's API.
 * Call once after deploy. Safe to call multiple times (idempotent).
 */
export async function setTelegramWebhook(baseUrl: string) {
  if (!BOT_TOKEN) return;
  const webhookUrl = `${baseUrl}/api/telegram/bot`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
    });
    const data = await res.json() as any;
    if (data.ok) {
      logger.info("TelegramBot: Webhook set → %s", webhookUrl);
    } else {
      logger.warn({ data }, "TelegramBot: setWebhook failed");
    }
  } catch (err: any) {
    logger.warn("TelegramBot: Could not set webhook: %s", err.message);
  }
}
