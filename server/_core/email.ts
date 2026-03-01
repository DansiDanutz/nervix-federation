import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
  return _resend;
}
const FROM = "Nervix <noreply@nervix.ai>";

export async function sendPasswordResetEmail(email: string, resetToken: string, name?: string) {
  const resetUrl = `${process.env.APP_URL || "https://nervix.ai"}/reset-password?token=${resetToken}`;
  
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback — log to console
    console.log(`[Email] Password reset for ${email}: ${resetUrl}`);
    return { success: true, dev: true };
  }

  const { data, error } = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Reset your Nervix password",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, sans-serif; background: #0a0a0a; color: #fff; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #111; border: 1px solid #222; border-radius: 16px; padding: 40px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 28px; font-weight: 800; color: #e53e3e;">NERVIX</span>
            <span style="font-size: 10px; background: rgba(229,62,62,0.15); color: #e53e3e; border: 1px solid rgba(229,62,62,0.3); padding: 2px 8px; border-radius: 99px; margin-left: 8px;">v2</span>
          </div>
          <h2 style="margin: 0 0 8px; font-size: 20px;">Reset your password</h2>
          <p style="color: #888; margin: 0 0 32px; font-size: 14px; line-height: 1.6;">
            Hi ${name || "there"}, we received a request to reset your password. 
            Click the button below — this link expires in <strong style="color:#fff">1 hour</strong>.
          </p>
          <a href="${resetUrl}" style="display: block; background: #e53e3e; color: white; text-align: center; padding: 14px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; margin-bottom: 24px;">
            Reset Password →
          </a>
          <p style="color: #555; font-size: 12px; margin: 0; text-align: center;">
            If you didn't request this, ignore this email. Your password won't change.<br/>
            <a href="${resetUrl}" style="color: #666; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
      </body>
      </html>
    `,
  });

  if (error) throw new Error(error.message);
  return { success: true, id: data?.id };
}

export async function sendWelcomeEmail(email: string, name?: string) {
  if (!process.env.RESEND_API_KEY) return { success: true, dev: true };

  const { data, error } = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Welcome to the Nervix Federation 🤖",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, sans-serif; background: #0a0a0a; color: #fff; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #111; border: 1px solid #222; border-radius: 16px; padding: 40px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <span style="font-size: 28px; font-weight: 800; color: #e53e3e;">NERVIX</span>
            <span style="font-size: 10px; background: rgba(229,62,62,0.15); color: #e53e3e; border: 1px solid rgba(229,62,62,0.3); padding: 2px 8px; border-radius: 99px; margin-left: 8px;">v2</span>
          </div>
          <h2 style="margin: 0 0 8px; font-size: 20px;">Welcome, ${name || "Agent"}! 🎉</h2>
          <p style="color: #888; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
            You've joined the Nervix Federation — the first AI agent economy on TON blockchain.
          </p>
          <div style="background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #888;">🚀 Get started:</p>
            <ul style="margin: 0; padding: 0 0 0 16px; color: #ccc; font-size: 13px; line-height: 2;">
              <li>Install the CLI: <code style="color: #e53e3e;">npm i -g nervix-cli</code></li>
              <li>Enroll your agent: <code style="color: #e53e3e;">nervix enroll</code></li>
              <li>Browse the marketplace</li>
            </ul>
          </div>
          <a href="${process.env.APP_URL || "https://nervix.ai"}/dashboard" style="display: block; background: #e53e3e; color: white; text-align: center; padding: 14px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
            Open Dashboard →
          </a>
        </div>
      </body>
      </html>
    `,
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
    to: email,
    subject: "Verify your Nervix email address",
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;padding:40px 20px;"><div style="max-width:480px;margin:0 auto;background:#111;border:1px solid #222;border-radius:16px;padding:40px;"><div style="text-align:center;margin-bottom:32px;"><span style="font-size:28px;font-weight:800;color:#e53e3e;">NERVIX</span></div><h2 style="margin:0 0 8px;font-size:20px;">Verify your email</h2><p style="color:#888;margin:0 0 32px;font-size:14px;line-height:1.6;">Hi ${name || "there"}, click below to verify your email. Link expires in <strong style="color:#fff">24 hours</strong>.</p><a href="${verifyUrl}" style="display:block;background:#e53e3e;color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:24px;">Verify Email →</a><p style="color:#555;font-size:12px;margin:0;text-align:center;">If you didn't create a Nervix account, ignore this email.</p></div></body></html>`,
  });
  if (error) throw new Error(error.message);
  return { success: true, id: data?.id };
}
