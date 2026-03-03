import { logger } from "./logger";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { createSessionToken } from "./sdk";
import { nanoid } from "nanoid";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { authLimiter, passwordResetLimiter } from "./rateLimit";
import { sendPasswordResetEmail, sendWelcomeEmail, sendVerificationEmail } from "./email";

const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Legacy SHA256 hash — only used for migration check */
function legacySha256(password: string): string {
  return crypto.createHash("sha256").update(password + process.env.JWT_SECRET).digest("hex");
}

/** Verify password: try bcrypt first, fall back to legacy SHA256 + auto-rehash */
async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  // bcrypt hashes start with $2a$ or $2b$
  if (storedHash.startsWith("$2")) {
    return { valid: await bcrypt.compare(password, storedHash), needsRehash: false };
  }
  // Legacy SHA256 check + flag for rehash
  const legacyHash = legacySha256(password);
  return { valid: legacyHash === storedHash, needsRehash: true };
}

// Auth tokens persisted in Supabase auth_tokens table (migrated from in-memory Maps)

export function registerAuthRoutes(app: Express) {

  // ─── Register ────────────────────────────────────────────────────────────
  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }
    if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: "Invalid email address" }); return; }
    try {
      const existing = await db.getUserByEmail(email);
      if (existing) { res.status(409).json({ error: "Email already registered" }); return; }
      const openId = nanoid(32);
      const passwordHash = await hashPassword(password);
      await db.upsertUser({ openId, name: name || null, email, loginMethod: "email", lastSignedIn: new Date(), passwordHash } as any);
      const token = await createSessionToken(openId, { name: name || "" });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      // Fire-and-forget welcome email
      sendWelcomeEmail(email, name).catch(() => {});
      // Send email verification
      const vToken = "vt_" + nanoid(32);
      await db.saveAuthToken(vToken, "verify", email, openId, new Date(Date.now() + 24 * 60 * 60 * 1000));
      sendVerificationEmail(email, vToken, name).catch(() => {});
      res.json({ success: true, openId });
    } catch (error) { logger.error({ err: error }, "Auth: Register failed"); res.status(500).json({ error: "Registration failed" }); }
  });

  // ─── Login ───────────────────────────────────────────────────────────────
  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }
    try {
      const user = await db.getUserByEmail(email) as any;
      if (!user) { res.status(401).json({ error: "Invalid email or password" }); return; }
      if (!user.passwordHash) { res.status(401).json({ error: "Invalid email or password" }); return; }
      const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
      if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }
      // Auto-migrate legacy SHA256 hashes to bcrypt on successful login
      if (needsRehash) {
        const newHash = await hashPassword(password);
        await db.upsertUser({ ...user, passwordHash: newHash } as any);
      }
      const token = await createSessionToken(user.openId, { name: user.name || "" });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.json({ success: true });
    } catch (error) { logger.error({ err: error }, "Auth: Login failed"); res.status(500).json({ error: "Login failed" }); }
  });

  // ─── Logout ──────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ success: true });
  });

  // ─── Forgot Password ─────────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", passwordResetLimiter, async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "Email required" }); return; }
    try {
      const user = await db.getUserByEmail(email) as any;
      // Always return success (don't reveal if email exists)
      if (user) {
        const token = nanoid(48);
        await db.saveAuthToken(token, "reset", email, null, new Date(Date.now() + 60 * 60 * 1000)); // 1 hour
        await sendPasswordResetEmail(email, token, user.name).catch(err => {
          logger.error({ err }, "Auth: Failed to send reset email");
        });
      }
      res.json({ success: true, message: "If that email is registered, you'll receive a reset link shortly." });
    } catch (error) { logger.error({ err: error }, "Auth: Forgot password failed"); res.status(500).json({ error: "Request failed" }); }
  });

  // ─── Reset Password ──────────────────────────────────────────────────────
  app.post("/api/auth/reset-password", authLimiter, async (req: Request, res: Response) => {
    const { token, password } = req.body;
    if (!token || !password) { res.status(400).json({ error: "Token and password required" }); return; }
    if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }
    const entry = await db.getAuthToken(token);
    if (!entry) {
      res.status(400).json({ error: "Reset link is invalid or expired. Please request a new one." });
      return;
    }
    try {
      const user = await db.getUserByEmail(entry.email) as any;
      if (!user) { res.status(400).json({ error: "User not found" }); return; }
      const passwordHash = await hashPassword(password);
      await db.upsertUser({ ...user, passwordHash } as any);
      await db.markTokenUsed(token);
      // Auto-login after reset
      const sessionToken = await createSessionToken(user.openId, { name: user.name || "" });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.json({ success: true, message: "Password updated! You're now logged in." });
    } catch (error) { logger.error({ err: error }, "Auth: Reset password failed"); res.status(500).json({ error: "Reset failed" }); }
  });

  // ─── Email Verification ─────────────────────────────────────────────────────
  app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) { res.redirect("/dashboard?verified=error"); return; }
    const entry = await db.getAuthToken(token);
    if (!entry) {
      res.redirect("/verify-email?error=expired");
      return;
    }
    try {
      await (db.getDb() as any).from("users").update({ emailVerified: true }).eq("openId", entry.open_id);
      await db.markTokenUsed(token);
      res.redirect("/verify-email?success=1");
    } catch(err) {
      logger.error({ err }, "Auth: Email verify failed");
      res.redirect("/verify-email?error=failed");
    }
  });

  app.post("/api/auth/resend-verification", authLimiter, async (req: Request, res: Response) => {
    const cookie = req.cookies?.[process.env.COOKIE_NAME || "NERVIX_SESSION"] || req.headers["authorization"]?.replace("Bearer ", "");
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "Email required" }); return; }
    try {
      const recentlySent = await db.hasRecentToken(email, "verify", 60_000);
      if (recentlySent) { res.status(429).json({ error: "Please wait 1 minute before resending" }); return; }
      const user = await db.getUserByEmail(email) as any;
      if (!user) { res.json({ success: true }); return; } // don't reveal
      if (user.emailVerified) { res.json({ success: true, alreadyVerified: true }); return; }
      const token = "vt_" + nanoid(32);
      await db.saveAuthToken(token, "verify", email, user.openId, new Date(Date.now() + 24 * 60 * 60 * 1000));
      await sendVerificationEmail(email, token, user.name).catch((err) => logger.error({ err }, "Auth: Failed to send verification email"));
      res.json({ success: true });
    } catch(err) {
      logger.error({ err }, "Auth: Resend verify failed");
      res.status(500).json({ error: "Failed to send" });
    }
  });

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) { res.status(500).json({ error: "Google OAuth not configured" }); return; }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${process.env.APP_URL || "https://nervix.ai"}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const { code, error } = req.query as Record<string, string>;
    if (error || !code) { res.redirect("/login?error=google_cancelled"); return; }
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      const appUrl = process.env.APP_URL || "https://nervix.ai";
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${appUrl}/api/auth/google/callback`, grant_type: "authorization_code" }),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) throw new Error("No access token from Google");
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      const profile = await profileRes.json() as any;
      if (!profile.email) throw new Error("No email from Google profile");
      let user = await db.getUserByEmail(profile.email) as any;
      const isNew = !user;
      if (!user) {
        const openId = nanoid(32);
        await db.upsertUser({ openId, name: profile.name || profile.email.split("@")[0], email: profile.email, loginMethod: "google", avatarUrl: profile.picture || null, lastSignedIn: new Date() } as any);
        user = await db.getUserByEmail(profile.email) as any;
        if (isNew) sendWelcomeEmail(profile.email, profile.name).catch(() => {});
      }
      const token = await createSessionToken(user.openId, { name: user.name || "" });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect("/dashboard");
    } catch (err) { logger.error({ err }, "Auth: Google callback failed"); res.redirect("/login?error=google_failed"); }
  });
}
