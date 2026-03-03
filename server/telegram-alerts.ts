/**
 * Telegram alert notifications for Nervix federation.
 * Sends critical alerts to Dan via @NervixAlert_bot.
 */

import { logger } from "./_core/logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_ALERT_CHAT_ID || "424184493";

async function sendTelegram(text: string) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: any) {
    logger.warn("TelegramAlert: Failed to send: %s", err.message);
  }
}

/** Alert when agents go offline (called from heartbeat monitor) */
export async function alertAgentsOffline(agents: { agentId: string; name?: string }[]) {
  if (agents.length === 0) return;
  const names = agents.map(a => a.name || a.agentId).join(", ");
  await sendTelegram(
    `🔴 <b>Agents Offline</b>\n` +
    `${names}\n` +
    `<i>No heartbeat for 10+ minutes</i>`
  );
}

/** Alert when a task times out */
export async function alertTaskTimeout(taskTitle: string, assigneeName: string) {
  await sendTelegram(
    `⏰ <b>Task Timed Out</b>\n` +
    `"${taskTitle}"\n` +
    `Assigned to: ${assigneeName}`
  );
}

/** Alert on large credit transfer (> threshold) */
export async function alertLargeTransfer(from: string, to: string, amount: string) {
  await sendTelegram(
    `💰 <b>Large Transfer</b>\n` +
    `${from} → ${to}\n` +
    `Amount: <b>${amount} credits</b>`
  );
}

/** Alert on webhook delivery failure (dead letter) */
export async function alertWebhookDead(messageId: string, agentName: string) {
  await sendTelegram(
    `📭 <b>Webhook Dead Letter</b>\n` +
    `Message: ${messageId}\n` +
    `Agent: ${agentName} — delivery failed after 3 retries`
  );
}

/** Alert on server error spike */
export async function alertErrorSpike(errorCount: number, window: string) {
  await sendTelegram(
    `🚨 <b>Error Spike</b>\n` +
    `${errorCount} server errors in ${window}`
  );
}
