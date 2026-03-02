/**
 * Security Middleware
 * Enhanced security measures for Nervix API
 *
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');

/**
 * Request Size Validation Middleware
 * Validates Content-Length before parsing to prevent memory exhaustion
 */
const validateRequestSize = (maxSizeBytes = 10 * 1024 * 1024) => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length'), 10);

    if (contentLength && contentLength > maxSizeBytes) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload exceeds maximum allowed size'
        }
      });
    }

    next();
  };
};

/**
 * Secure JWT Verification with Algorithm Enforcement
 * Prevents algorithm confusion attacks
 */
const secureVerifyToken = (token, secret) => {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'], // Only accept HS256 algorithm
    });
    return {
      status: 'valid',
      decoded,
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        status: 'expired',
        decoded: jwt.decode(token),
        error: error.message,
      };
    }
    if (error.name === 'JsonWebTokenError') {
      // Log algorithm confusion attempts
      if (error.message.includes('algorithm')) {
        console.error('[SECURITY] JWT algorithm confusion attempt detected:', error.message);
      }
    }
    return {
      status: 'invalid',
      decoded: null,
      error: error.message,
    };
  }
};

/**
 * Sanitize Error Messages for Production
 * Returns generic errors in production, detailed in development
 */
const sanitizeError = (err, isProduction) => {
  if (isProduction) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while processing your request'
      }
    };
  }

  return {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An internal error occurred',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };
};

/**
 * Admin API Key Validation Middleware
 * Validates X-API-Key header for admin endpoints
 */
const validateAdminApiKey = (req, res, next) => {
  const apiKey = req.get('X-API-Key');

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required for this endpoint'
      }
    });
  }

  const validApiKeys = process.env.ADMIN_API_KEYS?.split(',') || [];

  if (!validApiKeys.includes(apiKey)) {
    console.warn('[SECURITY] Invalid admin API key attempt from IP:', req.ip);
    return res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key'
      }
    });
  }

  next();
};

/**
 * Per-IP Rate Limiting with Key Generator
 * Creates rate limits per IP address instead of globally
 */
const createPerIpRateLimit = (options = {}) => {
  const rateLimit = require('express-rate-limit');

  return rateLimit({
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || 100,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from your IP, please try again later'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.ip || req.connection.remoteAddress;
    },
    skip: (req) => {
      const trustedIps = process.env.TRUSTED_PROXIES?.split(',') || [];
      return trustedIps.includes(req.ip);
    },
    ...options,
  });
};

/**
 * Global Input Validation Middleware
 * Validates common fields across all requests
 */
const validateCommonFields = (req, res, next) => {
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/gi,
    /(\$\(|\`|\|\|)/g,
  ];

  const bodyStr = JSON.stringify(req.body);

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(bodyStr)) {
      console.warn('[SECURITY] Suspicious input pattern detected from IP:', req.ip);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid request content detected'
        }
      });
    }
  }

  next();
};

/**
 * Security Headers Enhancement
 */
const setSecurityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  next();
};

/**
 * CORS Configuration Helper
 */
const getCorsOptions = () => {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];

  return {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('[CORS] Blocked request from unauthorized origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,
  };
};

/**
 * IP Whitelist Middleware
 */
const ipWhitelist = (allowedIps = []) => {
  const ips = allowedIps.length ? allowedIps : process.env.IP_WHITELIST?.split(',') || [];

  return (req, res, next) => {
    if (ips.length === 0) {
      return next();
    }

    if (ips.includes(req.ip)) {
      next();
    } else {
      console.warn('[SECURITY] Blocked request from non-whitelisted IP:', req.ip);
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied from your IP address'
        }
      });
    }
  };
};

module.exports = {
  validateRequestSize,
  secureVerifyToken,
  sanitizeError,
  validateAdminApiKey,
  createPerIpRateLimit,
  validateCommonFields,
  setSecurityHeaders,
  getCorsOptions,
  ipWhitelist,
};
