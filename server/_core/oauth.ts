import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { createSessionToken } from "./sdk";
import { nanoid } from "nanoid";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function registerAuthRoutes(app: Express) {
  // Register
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password required" });
      return;
    }
    try {
      const openId = nanoid(32);
      await db.upsertUser({
        openId,
        name: name || null,
        email,
        loginMethod: "email",
        lastSignedIn: new Date(),
      });
      const token = await createSessionToken(openId, { name: name || "" });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, openId });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "email required" });
      return;
    }
    try {
      // For now, look up by email - password auth can be added later
      // TON wallet is the primary auth method
      const user = await db.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }
      const token = await createSessionToken(user.openId, { name: user.name || "" });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
}
