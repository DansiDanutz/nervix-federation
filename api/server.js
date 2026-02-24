#!/usr/bin/env node

/**
 * Nervix API Server
 * Main entry point for the Nervix Federation API
 *
 * @version 1.0.0
 * @author Nervix Team
 */

require('dotenv').config();
console.log('[SERVER] dotenv loaded');
const express = require('express');
console.log('[SERVER] express loaded');
const cors = require('cors');
console.log('[SERVER] cors loaded');
const helmet = require('helmet');
console.log('[SERVER] helmet loaded');
const rateLimit = require('express-rate-limit');
console.log('[SERVER] rateLimit loaded');
const winston = require('winston');
console.log('[SERVER] winston loaded');

// Import routes
console.log('[SERVER] Importing routes...');
const v1Routes = require('./routes/v1');
console.log('[SERVER] v1Routes loaded');
const metricsRoutes = require('./routes/metrics');
console.log('[SERVER] metricsRoutes loaded');
const authRoutes = require('./routes/auth');
console.log('[SERVER] authRoutes loaded');
const skillsRoutes = require('./routes/skills');
console.log('[SERVER] skillsRoutes loaded');
const teamRoutes = require('./routes/team');
console.log('[SERVER] teamRoutes loaded');
const enrollmentRoutes = require('./routes/enrollment');
console.log('[SERVER] enrollmentRoutes loaded');
const agentRoutes = require('./routes/agents-db');
console.log('[SERVER] agentRoutes loaded');
const taskRoutes = require('./routes/tasks');
console.log('[SERVER] taskRoutes loaded');
const reputationRoutes = require('./routes/reputation');
console.log('[SERVER] reputationRoutes loaded');
const qualityRoutes = require('./routes/quality');
console.log('[SERVER] qualityRoutes loaded');
const economicRoutes = require('./routes/economics');
console.log('[SERVER] economicRoutes loaded');

// Services
console.log('[SERVER] Importing metricsService...');
const { metricsService } = require('./services/metricsService');
console.log('[SERVER] metricsService loaded');

// Initialize Express app
console.log('[SERVER] Creating Express app...');
const app = express();
const PORT = process.env.PORT || 3000;
console.log('[SERVER] Express app created, PORT:', PORT);

// Winston logger configuration
console.log('[SERVER] Creating Winston logger...');
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
console.log('[SERVER] Winston logger created');

if (process.env.NODE_ENV !== 'production') {
  console.log('[SERVER] Adding console transport to logger...');
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
  console.log('[SERVER] Console transport added');
}

// Security middleware
console.log('[SERVER] Adding helmet middleware...');
app.use(helmet());
console.log('[SERVER] helmet middleware added');
console.log('[SERVER] Adding cors middleware...');
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
console.log('[SERVER] cors middleware added');

// Rate limiting
console.log('[SERVER] Creating rate limiters...');
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.RATE_LIMIT_MAX || 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});
console.log('[SERVER] apiLimiter created');

const enrollmentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Stricter limit for enrollment
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many enrollment requests, please try again later'
    }
  }
});
console.log('[SERVER] enrollmentLimiter created');

// Body parsing
console.log('[SERVER] Adding body parsing middleware...');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
console.log('[SERVER] Body parsing middleware added');

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: res.statusCode,
      duration,
    });

    // Record metrics for API requests
    if (req.path.startsWith('/v1/') || req.path.startsWith('/health')) {
      metricsService.recordFederationRequest(
        req.path.replace('/v1/', '').split('/')[0],
        duration,
        res.statusCode
      );
    }
  });

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// API routes
console.log('[SERVER] Registering API routes...');
app.use('/v1', v1Routes);
app.use('/v1/metrics', apiLimiter, metricsRoutes);
app.use('/v1/auth', apiLimiter, authRoutes);
app.use('/v1', apiLimiter, skillsRoutes);
app.use('/v1', apiLimiter, teamRoutes);
app.use('/v1/enroll', enrollmentLimiter, enrollmentRoutes);
app.use('/v1/agents', apiLimiter, agentRoutes);
app.use('/v1/tasks', taskRoutes);
app.use('/v1/reputation', apiLimiter, reputationRoutes);
app.use('/v1/quality', apiLimiter, qualityRoutes);
app.use('/v1/economics', apiLimiter, economicRoutes);
console.log('[SERVER] API routes registered');

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint was not found'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An internal error occurred'
    }
  });
});

// Start server
console.log('[SERVER] About to call app.listen on port', PORT, '...');
try {
  app.listen(PORT, () => {
    console.log('[SERVER] app.listen callback triggered!');
    logger.info({
      message: 'Nervix API Server started',
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
    console.log('[SERVER] Nervix API Server started on port', PORT);
    console.log('[SERVER] Server is now listening and ready to accept connections');
  });
  console.log('[SERVER] app.listen called successfully');
} catch (error) {
  console.error('[SERVER] ERROR in app.listen:', error);
  process.exit(1);
}
console.log('[SERVER] app.listen called');

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Keep the process alive - don't export the app
// This is an entry point, not a library module

// Keep process alive - prevent Node.js from exiting
setInterval(() => {}, 60000);
