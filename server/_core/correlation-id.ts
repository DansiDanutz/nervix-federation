import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

// Header name for correlation ID (client can provide, or we generate)
const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Middleware to add correlation ID to every request
 *
 * - Reads x-correlation-id from request headers if provided
 * - Generates a new UUID if not present
 * - Adds to response headers for client-side tracking
 * - Attaches to request object for downstream use
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Use client-provided ID or generate new one
  const correlationId = (req.header(CORRELATION_ID_HEADER) as string) || randomUUID();

  // Attach to request for downstream use
  req.correlationId = correlationId;

  // Add to response headers for client tracking
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  next();
}

// Extend Express Request type to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}
