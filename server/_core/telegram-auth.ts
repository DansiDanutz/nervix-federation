/**
 * Telegram Login Widget Authentication
 * 
 * Verifies the HMAC-SHA256 hash from Telegram Login Widget.
 * Docs: https://core.telegram.org/widgets/login
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { nanoid } from "nanoid";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { createSessionToken } from "./sdk";
import { sendWelcomeEmail } from "./email";
import { authLimiter } from "./rateLimit";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Verify Telegram Login Widget data integrity.
 * The hash must be HMAC-SHA256(data_check_string, SHA256(bot_token))
 */
export function verifyTelegramHash(data: TelegramUser, botToken: string): boolean {
  const { hash, ...rest } = data;
  
  // Build data_check_string: sorted key=value pairs joined by \n
  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // Secret key = SHA256(bot_token)
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  
  // Compute expected hash
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Check hash matches + auth_date is fresh (within 1 day)
  const isHashValid = expectedHash === hash;
  const isDateFresh = Date.now() / 1000 - data.auth_date < 86400;
  
  return isHashValid && isDateFresh;
}

export function registerTelegramAuthRoutes(app: Express) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  /**
   * POST /api/auth/telegram
   * Receives Telegram user data from the Login Widget callback.
   * Verifies HMAC hash, finds/creates user, sets session.
   */
  app.post("/api/auth/telegram", authLimiter, async (req: Request, res: Response) => {
    if (!botToken) {
      res.status(503).json({ error: "Telegram login not configured" });
      return;
    }

    const tgData = req.body as TelegramUser;
    
    if (!tgData.id || !tgData.hash || !tgData.auth_date) {
      res.status(400).json({ error: "Invalid Telegram auth data" });
      return;
    }

    // Verify the hash
    if (!verifyTelegramHash(tgData, botToken)) {
      res.status(401).json({ error: "Invalid Telegram authentication. Possible tampering detected." });
      return;
    }

    try {
      const telegramId = `tg_${tgData.id}`;
      const displayName = [tgData.first_name, tgData.last_name].filter(Boolean).join(" ");
      const email = tgData.username ? `${tgData.username}@telegram.user` : null;

      // Find existing user by telegramId (stored in openId) or by email
      let user = await db.getUserByOpenId(telegramId) as any;
      const isNew = !user;

      if (!user) {
        await db.upsertUser({
          openId: telegramId,
          name: displayName,
          email: email,
          avatarUrl: tgData.photo_url || null,
          loginMethod: "telegram",
          lastSignedIn: new Date(),
          telegramId: tgData.id,
          telegramUsername: tgData.username || null,
        } as any);
        user = await db.getUserByOpenId(telegramId);
        
        // Welcome email if they have a real email
        if (isNew && tgData.username) {
          sendWelcomeEmail(email!, displayName).catch(() => {});
        }
      } else {
        // Update last seen + avatar
        await db.upsertUser({
          openId: telegramId,
          avatarUrl: tgData.photo_url || user.avatarUrl,
          lastSignedIn: new Date(),
          telegramUsername: tgData.username || user.telegramUsername,
        } as any);
      }

      if (!user) {
        res.status(500).json({ error: "Failed to create user" });
        return;
      }

      const sessionToken = await createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        success: true,
        isNew,
        user: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          telegramUsername: tgData.username,
          walletLinked: !!user.walletAddress,
          walletAddress: user.walletAddress || null,
        },
      });
    } catch (error) {
      console.error("[TelegramAuth] Failed:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  /**
   * GET /api/auth/telegram/bot-info
   * Returns the bot username for the frontend widget config.
   */
  app.get("/api/auth/telegram/bot-info", (_req: Request, res: Response) => {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (!botToken || !botUsername) {
      res.json({ configured: false });
      return;
    }
    res.json({ configured: true, botUsername });
  });
}
