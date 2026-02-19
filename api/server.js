#!/usr/bin/env node

/**
 * Nervix API Server
 * Main entry point for the Nervix Federation API
 *
 * @version 1.0.0
 * @author Nervix Team
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// Import routes
const enrollmentRoutes = require('./routes/enrollment');
const agentRoutes = require('./routes/agents');
const taskRoutes = require('./routes/tasks');
const reputationRoutes = require('./routes/reputation');
const qualityRoutes = require('./routes/quality');
const economicRoutes = require('./routes/economics');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Winston logger configuration
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

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
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

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
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
app.use('/v1/enroll', enrollmentLimiter, enrollmentRoutes);
app.use('/v1/agents', apiLimiter, agentRoutes);
app.use('/v1/tasks', apiLimiter, taskRoutes);
app.use('/v1/reputation', apiLimiter, reputationRoutes);
app.use('/v1/quality', apiLimiter, qualityRoutes);
app.use('/v1/economics', apiLimiter, economicRoutes);

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
app.listen(PORT, () => {
  logger.info({
    message: 'Nervix API Server started',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;
