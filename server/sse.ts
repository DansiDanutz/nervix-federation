/**
 * Server-Sent Events (SSE) for live dashboard updates.
 * Broadcasts federation events to connected clients.
 */
import { Router, Request, Response } from "express";
import { EventEmitter } from "events";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

// Event types that trigger client-side query invalidation
export type SSEEventType =
  | "agent.status"     // agent went online/offline
  | "agent.heartbeat"  // heartbeat received
  | "task.updated"     // task created/assigned/completed
  | "economy.transfer" // credit transfer happened
  | "federation.stats" // general stats changed
  ;

interface SSEEvent {
  type: SSEEventType;
  data?: Record<string, unknown>;
}

/** Call this from mutations/jobs to push events to all connected dashboards */
export function broadcastEvent(type: SSEEventType, data?: Record<string, unknown>) {
  emitter.emit("sse", { type, data } satisfies SSEEvent);
}

export function registerSSERoute(app: Router) {
  app.get("/api/events/federation", (_req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // nginx compatibility
    });

    // Send initial keepalive
    res.write(":ok\n\n");

    const onEvent = (evt: SSEEvent) => {
      res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt.data || {})}\n\n`);
    };

    emitter.on("sse", onEvent);

    // Keepalive every 30s to prevent proxy timeouts
    const keepalive = setInterval(() => {
      res.write(":keepalive\n\n");
    }, 30000);

    _req.on("close", () => {
      emitter.off("sse", onEvent);
      clearInterval(keepalive);
    });
  });
}
