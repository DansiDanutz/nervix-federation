/**
 * CSRF Protection Middleware
 *
 * Provides CSRF (Cross-Site Request Forgery) protection for web endpoints.
 * Uses double-submit cookie pattern with encrypted tokens.
 *
 * @module server/_core/csrf
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { isProduction } from "./env";

/**
 * CSRF configuration
 */
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;
const CSRF_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Token cache (in production, use Redis)
 */
const tokenCache = new Map<string, { createdAt: number }>();

/**
 * Generate a cryptographically secure CSRF token
 */
function generateToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Create CSRF middleware factory
 */
export function createCSRFMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for:
    // - GET, HEAD, OPTIONS (safe methods)
    // - /health, /metrics (public endpoints)
    // - /api/trpc (tRPC uses Bearer auth, not cookies)
    // - /api/stripe/webhook (external webhook, signature verified separately)
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    const skipPaths = ["/health", "/metrics", "/api/trpc", "/api/stripe/webhook"];

    if (safeMethods.includes(req.method) || skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Only apply CSRF in production
    if (!isProduction()) {
      return next();
    }

    // Check for existing token
    const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME] as string;

    if (!existingToken) {
      // Generate new token and set cookie
      const token = generateToken();
      tokenCache.set(token, { createdAt: Date.now() });

      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        secure: true, // HTTPS only in production
        sameSite: "strict",
        maxAge: CSRF_MAX_AGE,
        path: "/",
      });

      return next();
    }

    // Validate CSRF token for state-changing methods
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      if (!headerToken || headerToken !== existingToken) {
        // Remove invalid token
        res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
        tokenCache.delete(existingToken);

        return res.status(403).json({
          error: "CSRF token validation failed",
          message: "Invalid or missing CSRF token. Please refresh the page and try again.",
        });
      }

      // Check token age
      const tokenData = tokenCache.get(existingToken);
      if (!tokenData || Date.now() - tokenData.createdAt > CSRF_MAX_AGE) {
        tokenCache.delete(existingToken);
        res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });

        return res.status(403).json({
          error: "CSRF token expired",
          message: "Your session has expired. Please refresh the page.",
        });
      }
    }

    next();
  };
}

/**
 * Middleware to regenerate CSRF token (after login, etc.)
 */
export function regenerateCSRFToken(req: Request, res: Response, next: NextFunction) {
  const oldToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (oldToken) {
    tokenCache.delete(oldToken);
    res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
  }

  const newToken = generateToken();
  tokenCache.set(newToken, { createdAt: Date.now() });

  res.cookie(CSRF_COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    maxAge: CSRF_MAX_AGE,
    path: "/",
  });

  next();
}

/**
 * Cleanup expired tokens (run periodically)
 */
export function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of tokenCache.entries()) {
    if (now - data.createdAt > CSRF_MAX_AGE) {
      tokenCache.delete(token);
    }
  }
}

// Cleanup every hour
if (isProduction()) {
  setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
}
