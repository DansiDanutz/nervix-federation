import bcrypt from "bcrypt";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { createSessionToken } from "./sdk";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { authLimiter, passwordResetLimiter } from "./rateLimit";
import { sendPasswordResetEmail, sendWelcomeEmail, sendVerificationEmail } from "./email";
import { validatePassword, calculatePasswordStrength, DEFAULT_PASSWORD_REQUIREMENTS } from "./passwordValidation";
import { logSecurityEvent } from "./securityMiddleware";

const BCRYPT_COST = 12;

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_COST);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Try bcrypt first (new format)
  try {
    const valid = await bcrypt.compare(password, hash);
    if (valid) return true;
  } catch (err) {
    // If bcrypt fails, fall back to legacy SHA256
    console.warn("[Auth] Bcrypt compare failed, trying legacy SHA256:", err);
  }

  // Legacy SHA256 verification for migrating existing users
  const legacyHash = crypto.createHash("sha256").update(password + process.env.JWT_SECRET).digest("hex");
  return hash === legacyHash;
}

// In-memory reset token store (fine for MVP — use DB/Redis in v3)
const resetTokens = new Map<string, { email: string; expires: number }>();

// Email verification token store
const verifyTokens = new Map<string, { email: string; openId: string; expires: number }>();
const resendLimiter = new Map<string, number>(); // email -> last resend timestamp

export function registerAuthRoutes(app: Express) {

  // ─── Register ────────────────────────────────────────────────────────────
  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    if (!email || !password) {
      logSecurityEvent("register_missing_fields", { email, hasPassword: !!password });
      res.status(400).json({ error: "email and password required" });
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logSecurityEvent("register_invalid_email", { email });
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    // Validate password with stronger requirements
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      logSecurityEvent("register_weak_password", { email, errors: passwordValidation.errors });
      res.status(400).json({
        error: "Password does not meet security requirements",
        requirements: {
          minLength: DEFAULT_PASSWORD_REQUIREMENTS.minLength,
          requireUppercase: DEFAULT_PASSWORD_REQUIREMENTS.requireUppercase,
          requireLowercase: DEFAULT_PASSWORD_REQUIREMENTS.requireLowercase,
          requireNumbers: DEFAULT_PASSWORD_REQUIREMENTS.requireNumbers,
          requireSpecialChars: DEFAULT_PASSWORD_REQUIREMENTS.requireSpecialChars,
        },
        errors: passwordValidation.errors,
      });
      return;
    }

    try {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        logSecurityEvent("register_email_exists", { email });
        res.status(409).json({ error: "Email already registered" });
        return;
      }

      const openId = nanoid(32);
      const passwordHash = await hashPassword(password);

      await db.upsertUser({
        openId,
        name: name || null,
        email,
        loginMethod: "email",
        lastSignedIn: new Date(),
        passwordHash
      } as any);

      const token = await createSessionToken(openId, { name: name || "" });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });

      // Fire-and-forget welcome email
      sendWelcomeEmail(email, name).catch(() => {});

      // Send email verification
      const vToken = "vt_" + nanoid(32);
      verifyTokens.set(vToken, { email, openId, expires: Date.now() + 24 * 60 * 60 * 1000 });
      sendVerificationEmail(email, vToken, name).catch(() => {});

      // Log successful registration
      const passwordStrength = calculatePasswordStrength(password);
      logSecurityEvent("register_success", {
        email,
        openId,
        passwordStrength: passwordStrength.label,
        passwordScore: passwordStrength.score,
      });

      res.json({ success: true, openId });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      logSecurityEvent("register_failed", {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ─── Login ───────────────────────────────────────────────────────────────
  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      logSecurityEvent("login_missing_fields", { email });
      res.status(400).json({ error: "email and password required" });
      return;
    }

    try {
      const user = await db.getUserByEmail(email) as any;
      if (!user) {
        logSecurityEvent("login_user_not_found", { email });
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const isValid = await verifyPassword(password, user.passwordHash || "");
      if (!isValid) {
        logSecurityEvent("login_invalid_password", { email, userId: user.openId });
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // If password was verified using legacy SHA256, migrate to bcrypt
      const legacyHash = crypto.createHash("sha256").update(password + process.env.JWT_SECRET).digest("hex");
      if (user.passwordHash === legacyHash) {
        console.log("[Auth] Migrating legacy SHA256 password to bcrypt for:", email);
        const newHash = await hashPassword(password);
        await db.upsertUser({ ...user, passwordHash: newHash } as any);
        logSecurityEvent("password_migrated", { email, userId: user.openId });
      }

      const token = await createSessionToken(user.openId, { name: user.name || "" });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });

      logSecurityEvent("login_success", { email, userId: user.openId });
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      logSecurityEvent("login_failed", {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Login failed" });
    }
  });

  // ─── Logout ──────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookie = req.cookies?.[process.env.COOKIE_NAME || "NERVIX_SESSION"];
    logSecurityEvent("logout", { hasSession: !!cookie });
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ success: true });
  });

  // ─── Forgot Password ─────────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", passwordResetLimiter, async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    logSecurityEvent("forgot_password_requested", { email });

    try {
      const user = await db.getUserByEmail(email) as any;
      // Always return success (don't reveal if email exists)
      if (user) {
        const token = nanoid(48);
        resetTokens.set(token, { email, expires: Date.now() + 60 * 60 * 1000 }); // 1 hour
        await sendPasswordResetEmail(email, token, user.name).catch(err => {
          console.error("[Auth] Failed to send reset email:", err);
        });
      }
      res.json({ success: true, message: "If that email is registered, you'll receive a reset link shortly." });
    } catch (error) {
      console.error("[Auth] Forgot password failed:", error);
      logSecurityEvent("forgot_password_failed", {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Request failed" });
    }
  });

  // ─── Reset Password ──────────────────────────────────────────────────────
  app.post("/api/auth/reset-password", authLimiter, async (req: Request, res: Response) => {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: "Token and password required" });
      return;
    }

    // Validate password with stronger requirements
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      logSecurityEvent("reset_password_weak_password", { errors: passwordValidation.errors });
      res.status(400).json({
        error: "Password does not meet security requirements",
        requirements: {
          minLength: DEFAULT_PASSWORD_REQUIREMENTS.minLength,
          requireUppercase: DEFAULT_PASSWORD_REQUIREMENTS.requireUppercase,
          requireLowercase: DEFAULT_PASSWORD_REQUIREMENTS.requireLowercase,
          requireNumbers: DEFAULT_PASSWORD_REQUIREMENTS.requireNumbers,
          requireSpecialChars: DEFAULT_PASSWORD_REQUIREMENTS.requireSpecialChars,
        },
        errors: passwordValidation.errors,
      });
      return;
    }

    const entry = resetTokens.get(token);
    if (!entry || Date.now() > entry.expires) {
      resetTokens.delete(token);
      logSecurityEvent("reset_password_invalid_token", { email: entry?.email });
      res.status(400).json({ error: "Reset link is invalid or expired. Please request a new one." });
      return;
    }

    try {
      const user = await db.getUserByEmail(entry.email) as any;
      if (!user) {
        res.status(400).json({ error: "User not found" });
        return;
      }

      const passwordHash = await hashPassword(password);
      await db.upsertUser({ ...user, passwordHash } as any);
      resetTokens.delete(token);

      // Auto-login after reset
      const sessionToken = await createSessionToken(user.openId, { name: user.name || "" });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });

      logSecurityEvent("reset_password_success", { email: entry.email, userId: user.openId });
      res.json({ success: true, message: "Password updated! You're now logged in." });
    } catch (error) {
      console.error("[Auth] Reset password failed:", error);
      logSecurityEvent("reset_password_failed", {
        email: entry?.email,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Reset failed" });
    }
  });

  // ─── Email Verification ─────────────────────────────────────────────────────
  app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) {
      res.redirect("/dashboard?verified=error");
      return;
    }

    const entry = verifyTokens.get(token);
    if (!entry || Date.now() > entry.expires) {
      verifyTokens.delete(token);
      logSecurityEvent("email_verify_invalid_token", { token });
      res.redirect("/verify-email?error=expired");
      return;
    }

    try {
      await (db.getDb() as any).from("users").update({ emailVerified: true }).eq("openId", entry.openId);
      verifyTokens.delete(token);
      logSecurityEvent("email_verify_success", { email: entry.email, userId: entry.openId });
      res.redirect("/verify-email?success=1");
    } catch(err) {
      console.error("[Auth] Email verify failed:", err);
      logSecurityEvent("email_verify_failed", {
        email: entry?.email,
        error: err instanceof Error ? err.message : String(err),
      });
      res.redirect("/verify-email?error=failed");
    }
  });

  app.post("/api/auth/resend-verification", authLimiter, async (req: Request, res: Response) => {
    const cookie = req.cookies?.[process.env.COOKIE_NAME || "NERVIX_SESSION"] || req.headers["authorization"]?.replace("Bearer ", "");
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const now = Date.now();
    const lastSent = resendLimiter.get(email) || 0;
    if (now - lastSent < 60 * 1000) {
      res.status(429).json({ error: "Please wait 1 minute before resending" });
      return;
    }

    logSecurityEvent("resend_verification", { email });

    try {
      const user = await db.getUserByEmail(email) as any;
      if (!user) {
        res.json({ success: true }); // don't reveal
        return;
      }

      if (user.emailVerified) {
        res.json({ success: true, alreadyVerified: true });
        return;
      }

      const token = "vt_" + nanoid(32);
      verifyTokens.set(token, { email, openId: user.openId, expires: Date.now() + 24 * 60 * 60 * 1000 });
      resendLimiter.set(email, now);
      await sendVerificationEmail(email, token, user.name).catch(console.error);
      res.json({ success: true });
    } catch(err) {
      console.error("[Auth] Resend verify failed:", err);
      logSecurityEvent("resend_verification_failed", {
        email,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Failed to send" });
    }
  });

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ error: "Google OAuth not configured" });
      return;
    }

    logSecurityEvent("google_oauth_init", {});

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
    if (error || !code) {
      logSecurityEvent("google_oauth_failed", { error });
      res.redirect("/login?error=google_cancelled");
      return;
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      const appUrl = process.env.APP_URL || "https://nervix.ai";

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${appUrl}/api/auth/google/callback`,
          grant_type: "authorization_code"
        }),
      });

      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) throw new Error("No access token from Google");

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const profile = await profileRes.json() as any;
      if (!profile.email) throw new Error("No email from Google profile");

      let user = await db.getUserByEmail(profile.email) as any;
      const isNew = !user;

      if (!user) {
        const openId = nanoid(32);
        await db.upsertUser({
          openId,
          name: profile.name || profile.email.split("@")[0],
          email: profile.email,
          loginMethod: "google",
          avatarUrl: profile.picture || null,
          lastSignedIn: new Date()
        } as any);
        user = await db.getUserByEmail(profile.email) as any;
        if (isNew) sendWelcomeEmail(profile.email, profile.name).catch(() => {});
      }

      const token = await createSessionToken(user.openId, { name: user.name || "" });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });

      logSecurityEvent("google_oauth_success", {
        email: profile.email,
        userId: user.openId,
        isNew,
      });

      res.redirect("/dashboard");
    } catch (err) {
      console.error("[Auth] Google callback failed:", err);
      logSecurityEvent("google_oauth_callback_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.redirect("/login?error=google_failed");
    }
  });
}
