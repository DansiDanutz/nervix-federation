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
