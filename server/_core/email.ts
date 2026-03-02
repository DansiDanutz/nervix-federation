import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
  return _resend;
}

const FROM = "Nervix <noreply@nervix.ai>";
const REPLY_TO = "nervix@agentmail.to"; // AgentMail inbox — all replies land here

// ─── AgentMail ───────────────────────────────────────────────────────────────

const AGENTMAIL_API = "https://api.agentmail.to/v0";
const AGENTMAIL_INBOX = "nervix@agentmail.to";

function agentMailHeaders(): Record<string, string> | null {
  const key = process.env.AGENTMAIL_API_KEY;
  if (!key) return null;
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function agentMailGetThreads(limit = 10): Promise<any[]> {
  const headers = agentMailHeaders();
  if (!headers) return [];
  try {
    const res = await fetch(`${AGENTMAIL_API}/inboxes/${AGENTMAIL_INBOX}/threads?limit=${limit}`, { headers });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return data.threads || [];
  } catch { return []; }
}

export async function agentMailGetMessages(threadId: string): Promise<any[]> {
  const headers = agentMailHeaders();
  if (!headers) return [];
  try {
    const res = await fetch(`${AGENTMAIL_API}/inboxes/${AGENTMAIL_INBOX}/threads/${threadId}/messages`, { headers });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return data.messages || [];
  } catch { return []; }
}

export async function agentMailSend(to: string, subject: string, body: string): Promise<boolean> {
  const headers = agentMailHeaders();
  if (!headers) { console.log(`[AgentMail] No key — would send to ${to}: ${subject}`); return false; }
  try {
    const res = await fetch(`${AGENTMAIL_API}/inboxes/${AGENTMAIL_INBOX}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ to, subject, text: body }),
    });
    return res.ok;
  } catch { return false; }
}

export async function agentMailReply(threadId: string, body: string): Promise<boolean> {
  const headers = agentMailHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(`${AGENTMAIL_API}/inboxes/${AGENTMAIL_INBOX}/threads/${threadId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: body }),
    });
    return res.ok;
  } catch { return false; }
}

// ─── Resend Email Senders ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string, resetToken: string, name?: string) {
  const resetUrl = `${process.env.APP_URL || "https://nervix.ai"}/reset-password?token=${resetToken}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Password reset for ${email}: ${resetUrl}`);
    return { success: true, dev: true };
  }

  const { data, error } = await getResend().emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to: email,
    subject: "Reset your Nervix password",
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;padding:40px 20px;"><div style="max-width:480px;margin:0 auto;background:#111;border:1px solid #222;border-radius:16px;padding:40px;"><div style="text-align:center;margin-bottom:32px;"><span style="font-size:28px;font-weight:800;color:#e53e3e;">NERVIX</span></div><h2>Reset your password</h2><p style="color:#888;font-size:14px;line-height:1.6;">Hi ${name || "there"}, click below to reset your password. Expires in <strong style="color:#fff">1 hour</strong>.</p><a href="${resetUrl}" style="display:block;background:#e53e3e;color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:24px 0;">Reset Password →</a><p style="color:#555;font-size:12px;text-align:center;">If you didn't request this, ignore this email.</p></div></body></html>`,
  });

  if (error) throw new Error(error.message);
  return { success: true, id: data?.id };
}

export async function sendWelcomeEmail(email: string, name?: string) {
  if (!process.env.RESEND_API_KEY) return { success: true, dev: true };

  const { data, error } = await getResend().emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to: email,
    subject: "Welcome to the Nervix Federation 🤖",
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;padding:40px 20px;"><div style="max-width:480px;margin:0 auto;background:#111;border:1px solid #222;border-radius:16px;padding:40px;"><div style="text-align:center;margin-bottom:32px;"><span style="font-size:28px;font-weight:800;color:#e53e3e;">NERVIX</span></div><h2>Welcome, ${name || "Agent"}! 🎉</h2><p style="color:#888;font-size:14px;line-height:1.6;">You've joined the Nervix Federation — the first AI agent economy on TON blockchain.</p><div style="background:#0d0d0d;border:1px solid #1a1a1a;border-radius:10px;padding:20px;margin:24px 0;"><p style="margin:0 0 8px;font-size:13px;color:#888;">🚀 Get started:</p><ul style="margin:0;padding:0 0 0 16px;color:#ccc;font-size:13px;line-height:2;"><li>Install: <code style="color:#e53e3e;">npm i -g nervix-cli</code></li><li>Enroll: <code style="color:#e53e3e;">nervix enroll</code></li><li>Browse the marketplace</li></ul></div><a href="${process.env.APP_URL || "https://nervix.ai"}/dashboard" style="display:block;background:#e53e3e;color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Open Dashboard →</a><p style="color:#555;font-size:12px;margin:24px 0 0;text-align:center;">Questions? Reply to this email — an AI agent monitors this inbox 24/7. 🤖</p></div></body></html>`,
  });

  if (error) console.error("[Email] Welcome email failed:", error);
  return { success: !error, id: data?.id };
}

export async function sendVerificationEmail(email: string, token: string, name?: string) {
  const verifyUrl = `${process.env.APP_URL || "https://nervix.ai"}/verify-email?token=${token}`;
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Verify email for ${email}: ${verifyUrl}`);
    return { success: true, dev: true };
  }
  const { data, error } = await getResend().emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to: email,
    subject: "Verify your Nervix email address",
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;padding:40px 20px;"><div style="max-width:480px;margin:0 auto;background:#111;border:1px solid #222;border-radius:16px;padding:40px;"><div style="text-align:center;margin-bottom:32px;"><span style="font-size:28px;font-weight:800;color:#e53e3e;">NERVIX</span></div><h2>Verify your email</h2><p style="color:#888;font-size:14px;line-height:1.6;">Hi ${name || "there"}, click below to verify. Expires in <strong style="color:#fff">24 hours</strong>.</p><a href="${verifyUrl}" style="display:block;background:#e53e3e;color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:24px 0;">Verify Email →</a><p style="color:#555;font-size:12px;text-align:center;">Didn't create a Nervix account? Ignore this email.</p></div></body></html>`,
  });
  if (error) throw new Error(error.message);
  return { success: true, id: data?.id };
}
