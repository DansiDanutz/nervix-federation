import * as Sentry from "@sentry/node";
import "dotenv/config";
// Sentry init (must be before other imports for full instrumentation)
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || "production", tracesSampleRate: 0.05 });
}
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { logger } from "./logger";
import { validateEnv, isProduction } from "./env";
import { registerAuthRoutes } from "./oauth";
import { apiLimiter, enrollmentLimiter, transferLimiter, a2aLimiter, tonAuthLimiter, escrowLimiter, taskCreationLimiter, youtubeLimiter } from "./rateLimit";
import { registerTonAuthRoutes } from "../ton-auth-routes";
import { registerTelegramAuthRoutes } from "./telegram-auth";
import { registerYouTubeRoutes } from "../youtube-routes";
import mcpA2aRouter from "../mcp-a2a-routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduledJobs } from "../scheduled-jobs";
import { registerMetricsRoute, incrementRequests, incrementErrors } from "../metrics";
import { registerSSERoute } from "../sse";
import { handleStripeWebhook } from "../stripe-webhooks";
import { registerTelegramBotWebhook, setTelegramWebhook } from "../telegram-bot";
import { createCSRFMiddleware } from "./csrf";

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
  // Validate environment variables before starting server (P0 security fix)
  try {
    validateEnv();
    logger.info("✅ Environment validation passed");
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const app = express();
  app.set("trust proxy", 1); // Trust first proxy (nginx) for correct client IP in rate limiter
  const server = createServer(app);
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://nervix.ai", "wss://nervix.ai", "https://*.sentry.io", "https://api.stripe.com"],
        frameSrc: ["https://js.stripe.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CSRF protection for state-changing web endpoints (P0 security fix)
  app.use(createCSRFMiddleware());
  // Stripe webhook needs raw body for signature verification — must be before json parser
  app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "10kb" }), handleStripeWebhook);
  // Configure body parser with reduced size limit (security hardening - P0 fix)
  app.use(express.json({
    limit: "1mb",  // Reduced from 10mb to prevent DoS attacks
    strict: true,  // Reject invalid JSON
  }));
  app.use(express.urlencoded({
    limit: "10kb",
    extended: false,
  }));
  // Request counting for metrics
  app.use((_req, res, next) => {
    incrementRequests();
    res.on("finish", () => { if (res.statusCode >= 500) incrementErrors(); });
    next();
  });
  // Prometheus metrics endpoint (no rate limit)
  registerMetricsRoute(app);
  // SSE endpoint for live dashboard updates
  registerSSERoute(app);
  // Health check endpoint for Docker HEALTHCHECK (no rate limit)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });
  // Global API rate limiter
  app.use("/api", apiLimiter);
  // Auth routes (register + login)
  registerAuthRoutes(app);
  // TON wallet authentication routes (with rate limiting)
  app.use("/api/ton-auth", tonAuthLimiter);
  registerTonAuthRoutes(app);
  // TON wallet authentication routes
  registerTonAuthRoutes(app);
  // Telegram Login Widget routes
  registerTelegramAuthRoutes(app);
  // Telegram bot webhook (inbound commands from Dan)
  registerTelegramBotWebhook(app);
  // YouTube multi-tenant routes (with rate limiting)
  app.use("/api/youtube", youtubeLimiter);
  registerYouTubeRoutes(app);
  app.use("/api", mcpA2aRouter); // MCP + A2A protocol compliance
  // Route-specific rate limiters for sensitive tRPC endpoints
  app.use("/api/trpc/enrollment", enrollmentLimiter);
  app.use("/api/trpc/economy.transfer", transferLimiter);
  app.use("/api/trpc/a2a.send", a2aLimiter);
  app.use("/api/trpc/escrow", escrowLimiter);
  app.use("/api/trpc/tasks.create", taskCreationLimiter);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info("Port %d is busy, using port %d instead", preferredPort, port);
  }

  // Start all scheduled background jobs (heartbeat monitor, webhook retry, cleanup, etc.)
  startScheduledJobs();
  // Register Telegram bot webhook URL with Telegram (no-op if BOT_TOKEN not set)
  const publicUrl = process.env.PUBLIC_URL || `https://nervix.ai`;
  setTelegramWebhook(publicUrl).catch(() => {});

  // Sentry error handler (must be after all routes)
  if (process.env.SENTRY_DSN) { app.use(Sentry.expressErrorHandler()); }

  server.listen(port, () => {
    logger.info("Server running on http://localhost:%d/", port);
  });
}

startServer().catch((err) => logger.error({ err }, "Failed to start server"));
