import rateLimit from "express-rate-limit";

// Auth endpoints: 10 attempts per 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API: 200 req per minute
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: "Too many requests. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/api/trpc/federation.health"),
});

// Enrollment: 20 per hour
export const enrollmentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: "Enrollment limit reached. Try again in 1 hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset: 3 per hour per IP
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many password reset attempts. Try again in 1 hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Economy transfers: 20 per minute per IP
export const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many transfer requests. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// A2A messaging: 50 per minute per IP
export const a2aLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { error: "Too many A2A messages. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// TON Wallet Auth: 10 per 15 min per IP (prevent brute force attacks)
export const tonAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many TON auth attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Escrow operations: 5 per minute per IP (financial operations)
export const escrowLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many escrow operations. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Task creation: 10 per minute per IP (prevent spam)
export const taskCreationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many task creations. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// YouTube operations: 20 per minute per IP (API cost control)
export const youtubeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many YouTube API requests. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
