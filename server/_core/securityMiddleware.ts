/**
 * Security Middleware for NERVIX Federation API
 *
 * This module implements critical security middleware:
 * - Helmet (security headers)
 * - CORS configuration
 * - HTTPS enforcement
 * - Input sanitization
 * - Request logging
 */

import helmet from "helmet";
import cors from "cors";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/**
 * Configure Helmet for security headers
 */
export const securityHeaders = helmet({
  // Content Security Policy - restrict sources of scripts, styles, etc.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },

  // HSTS - force HTTPS for 1 year
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },

  // No Sniff - prevent MIME type sniffing
  noSniff: true,

  // Frameguard - prevent clickjacking
  frameguard: {
    action: "deny",
  },

  // X-Content-Type-Options
  xContentTypeOptions: true,

  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: {
    permittedPolicies: "none",
  },

  // Referrer Policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },

  // X-XSS-Protection
  xssFilter: true,

  // Disable X-Powered-By header
  hidePoweredBy: true,
});

/**
 * Configure CORS with strict whitelist
 */
export const corsConfig = cors({
  // In development, allow local origins
  // In production, configure specific allowed origins via environment variable
  origin: process.env.NODE_ENV === "production"
    ? (process.env.ALLOWED_ORIGINS?.split(",") || ["https://nervix.ai", "https://www.nervix.ai"])
    : true, // Allow all in development

  // Only allow specific HTTP methods
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  // Allow specific headers
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],

  // Expose specific headers
  exposedHeaders: ["Content-Length", "Content-Type"],

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Cache preflight requests for 1 hour
  maxAge: 3600,

  // Set to true for production
  optionsSuccessStatus: 204,
});

/**
 * Enforce HTTPS in production
 */
export function enforceHTTPS(req: Request, res: Response, next: NextFunction): void {
  // Only enforce HTTPS in production
  if (process.env.NODE_ENV === "production" && !req.secure) {
    // If not using HTTPS, redirect to HTTPS
    const httpsUrl = `https://${req.headers.host}${req.originalUrl}`;
    return res.redirect(301, httpsUrl);
  }
  next();
}

/**
 * Input sanitization middleware
 * Removes potentially dangerous characters from input
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === "string") {
        // Remove potentially dangerous characters
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
          .replace(/javascript:/gi, "") // Remove javascript: protocol
          .replace(/on\w+\s*=/gi, ""); // Remove event handlers (onclick=, onload=, etc.)
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
  }
  return sanitized;
}

/**
 * Security event logger
 */
export function logSecurityEvent(eventType: string, details: any): void {
  // In production, this would log to a security audit table
  // For now, log to console with structured format
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    level: "security",
    details,
  };

  logger.info(logEntry, "Security event: %s", eventType);

  // TODO: Add to Supabase audit log table
  // await db.createAuditEntry({ eventType: `security.${eventType}`, ... });
}

/**
 * IP-based rate limit exceeded handler
 */
export function handleRateLimitExceeded(req: Request, res: Response, next: NextFunction): void {
  logSecurityEvent("rate_limit_exceeded", {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get("user-agent"),
  });

  // Response is handled by rate-limit middleware, this is for logging
  next();
}

/**
 * Suspicious activity detector
 */
export function detectSuspiciousActivity(req: Request, res: Response, next: NextFunction): void {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /eval\(/i,
    /document\./i,
    /window\./i,
    /\.\./i, // Path traversal
    /etc\/passwd/i,
    /union.*select/i, // SQL injection
  ];

  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      logSecurityEvent("suspicious_input_detected", {
        ip: req.ip,
        path: req.path,
        method: req.method,
        pattern: pattern.toString(),
      });

      // Block request with suspicious input
      return res.status(400).json({
        error: "Invalid request detected",
        code: "SUSPICIOUS_INPUT",
      });
    }
  }

  next();
}
