/**
 * Shared webhook delivery logic — used by both a2a.send and task creation.
 * Sends HTTP POST to agent webhookUrl with HMAC-SHA256 signature.
 */
import crypto from "crypto";
import * as db from "./db";

export interface WebhookPayload {
  messageId: string;
  method: string;
  payload: unknown;
  taskId: string | null;
  fromAgentId: string;
  toAgentId: string;
  timestamp: number;
  retryAttempt?: number;
}

/** Block SSRF: reject private/reserved IPs and non-http(s) schemes */
function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname;
    // Block private/reserved ranges
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (host.startsWith("10.")) return false;
    if (host.startsWith("192.168.")) return false;
    if (host.startsWith("169.254.")) return false;
    if (host.startsWith("0.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    // Block metadata endpoints (cloud providers)
    if (host === "metadata.google.internal") return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt to deliver a webhook message to an agent.
 * Updates the a2a_message status to "delivered" or "failed".
 * Returns true if delivery succeeded.
 */
export async function deliverWebhook(
  messageId: string,
  toAgentId: string,
  webhookBody: WebhookPayload,
): Promise<boolean> {
  const agent = await db.getAgentById(toAgentId);
  if (!agent?.webhookUrl) {
    await db.updateA2AMessage(messageId, {
      status: "failed",
      errorMessage: "Agent has no webhook URL configured",
    });
    return false;
  }

  if (!isUrlSafe(agent.webhookUrl)) {
    await db.updateA2AMessage(messageId, {
      status: "failed",
      errorMessage: "Webhook URL blocked: private/reserved address",
    });
    return false;
  }

  try {
    const body = JSON.stringify(webhookBody);
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
      await db.updateA2AMessage(messageId, { status: "delivered", deliveredAt: new Date() });
      return true;
    } else {
      await db.updateA2AMessage(messageId, {
        status: "failed",
        errorMessage: `Webhook returned HTTP ${res.status}`,
      });
      return false;
    }
  } catch (err: any) {
    await db.updateA2AMessage(messageId, {
      status: "failed",
      errorMessage: err.message || "Webhook delivery failed",
    });
    return false;
  }
}
