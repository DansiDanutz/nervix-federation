import * as Sentry from "@sentry/node";
import "dotenv/config";
// Sentry init (must be before other imports for full instrumentation)
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || "production", tracesSampleRate: 0.05 });
}
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./oauth";
import { apiLimiter, enrollmentLimiter, transferLimiter, a2aLimiter } from "./rateLimit";
import { registerTonAuthRoutes } from "../ton-auth-routes";
import { registerTelegramAuthRoutes } from "./telegram-auth";
import { registerYouTubeRoutes } from "../youtube-routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduledJobs } from "../scheduled-jobs";
import { registerMetricsRoute, incrementRequests, incrementErrors } from "../metrics";
import { registerSSERoute } from "../sse";
import {
  securityHeaders,
  corsConfig,
  enforceHTTPS,
  sanitizeInput,
  detectSuspiciousActivity,
  logSecurityEvent,
} from "./securityMiddleware";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── SECURITY MIDDLEWARE (Applied first, in correct order) ───────────────
  // 1. HTTPS enforcement (production only)
  if (process.env.NODE_ENV === "production") {
    app.use(enforceHTTPS);
    logSecurityEvent("https_enforcement_enabled", {
      message: "HTTPS enforcement active in production",
    });
  }

  // 2. Helmet security headers (X-XSS-Protection, HSTS, CSP, etc.)
  app.use(securityHeaders);
  logSecurityEvent("security_headers_enabled", {
    message: "Helmet security headers configured",
  });

  // 3. CORS configuration with strict origin whitelist
  app.use(corsConfig);
  logSecurityEvent("cors_configured", {
    message: "CORS middleware active",
    mode: process.env.NODE_ENV || "development",
  });

  // 4. Suspicious activity detection (pattern matching)
  app.use(detectSuspiciousActivity);

  // ─── BODY PARSING & INPUT SANITIZATION ──────────────────────────────────
  // Configure body parser with reduced size limit (security hardening)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // 5. Input sanitization (remove dangerous patterns)
  app.use(sanitizeInput);
  logSecurityEvent("input_sanitization_enabled", {
    message: "Input sanitization middleware active",
  });

  // ─── REQUEST METRICS ─────────────────────────────────────────────────────
  // Request counting for metrics
  app.use((_req, res, next) => {
    incrementRequests();
    res.on("finish", () => { if (res.statusCode >= 500) incrementErrors(); });
    next();
  });

  // ─── ENDPOINTS (No rate limiting needed) ────────────────────────────────
  // Prometheus metrics endpoint (no rate limit)
  registerMetricsRoute(app);

  // SSE endpoint for live dashboard updates
  registerSSERoute(app);

  // Health check endpoint for Docker HEALTHCHECK (no rate limit)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  // ─── RATE LIMITING ───────────────────────────────────────────────────────
  // Global API rate limiter
  app.use("/api", apiLimiter);

  // Route-specific rate limiters for sensitive endpoints
  app.use("/api/trpc/enrollment", enrollmentLimiter);
  app.use("/api/trpc/economy.transfer", transferLimiter);
  app.use("/api/trpc/a2a.send", a2aLimiter);

  // ─── API ROUTES ───────────────────────────────────────────────────────────
  // Auth routes (register + login)
  registerAuthRoutes(app);

  // TON wallet authentication routes
  registerTonAuthRoutes(app);

  // Telegram Login Widget routes
  registerTelegramAuthRoutes(app);

  // YouTube multi-tenant routes
  registerYouTubeRoutes(app);

  // ─── tRPC API ────────────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ─── STATIC FILES / VITE ───────────────────────────────────────────────
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ─── SERVER STARTUP ─────────────────────────────────────────────────────
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Start all scheduled background jobs (heartbeat monitor, webhook retry, cleanup, etc.)
  startScheduledJobs();

  // Sentry error handler (must be after all routes)
  if (process.env.SENTRY_DSN) { app.use(Sentry.expressErrorHandler()); }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    logSecurityEvent("server_started", {
      port,
      environment: process.env.NODE_ENV || "development",
      message: "NERVIX Federation API started successfully",
    });
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  logSecurityEvent("server_start_failed", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
