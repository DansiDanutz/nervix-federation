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
import { apiLimiter } from "./rateLimit";
import { registerTonAuthRoutes } from "../ton-auth-routes";
import { registerTelegramAuthRoutes } from "./telegram-auth";
import { registerYouTubeRoutes } from "../youtube-routes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    // Auto-mark agents offline after 10min no heartbeat
  setInterval(async () => {
    try {
      const { getDb } = await import("../db");
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await getDb().from("agents").update({ status: "offline" }).eq("status", "active").lt("lastHeartbeat", tenMinAgo);
    } catch(e) { /* ignore */ }
  }, 5 * 60 * 1000);

  // Sentry error handler (must be after all routes)
  if (process.env.SENTRY_DSN) { app.use(Sentry.expressErrorHandler()); }

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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Global API rate limiter
  app.use("/api", apiLimiter);
  // Auth routes (register + login)
  registerAuthRoutes(app);
  // TON wallet authentication routes
  registerTonAuthRoutes(app);
  // Telegram Login Widget routes
  registerTelegramAuthRoutes(app);
  // YouTube multi-tenant routes
  registerYouTubeRoutes(app);
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
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Auto-mark agents offline after 10min no heartbeat
  setInterval(async () => {
    try {
      const { getDb } = await import("../db");
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await getDb().from("agents").update({ status: "offline" }).eq("status", "active").lt("lastHeartbeat", tenMinAgo);
    } catch(e) { /* ignore */ }
  }, 5 * 60 * 1000);

  // Sentry error handler (must be after all routes)
  if (process.env.SENTRY_DSN) { app.use(Sentry.expressErrorHandler()); }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
