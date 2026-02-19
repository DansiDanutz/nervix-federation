/**
 * Enhanced Logging Service
 * Structured logging with multiple transports and filtering
 *
 * @version 1.0.0
 */

const winston = require('winston');
const path = require('path');

// Log Levels
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};

/**
 * Custom format for JSON logs
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'iso8601' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  })
);

/**
 * Custom format for console logs
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata
    if (Object.keys(meta).length > 0) {
      msg += ' ' + JSON.stringify(meta);
    }

    return msg;
  })
);

/**
 * Logger Class
 */
class Logger {
  constructor(options = {}) {
    const {
      name = 'nervix-api',
      level = process.env.LOG_LEVEL || 'info',
      logDir = path.join(process.cwd(), 'logs'),
    } = options;

    this.name = name;
    this.logDir = logDir;

    // Create logger
    this.logger = winston.createLogger({
      level,
      format: jsonFormat,
      defaultMeta: { service: name },
      transports: [
        // Error log
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),

        // Combined log
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    });

    // Add console transport in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: consoleFormat,
      }));
    }
  }

  /**
   * Log error
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   * @returns {void}
   */
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  /**
   * Log warning
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   * @returns {void}
   */
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  /**
   * Log info
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   * @returns {void}
   */
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  /**
   * Log debug
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   * @returns {void}
   */
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  /**
   * Log HTTP request
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {number} duration - Request duration in ms
   * @returns {void}
   */
  logRequest(req, res, duration) {
    this.logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  /**
   * Log error with stack trace
   * @param {Error} error - Error object
   * @param {Object} meta - Additional metadata
   * @returns {void}
   */
  logError(error, meta = {}) {
    this.logger.error(error.message, {
      stack: error.stack,
      ...meta,
    });
  }

  /**
   * Create child logger with additional default metadata
   * @param {Object} defaultMeta - Default metadata for child logger
   * @returns {Logger} Child logger
   */
  child(defaultMeta) {
    const childLogger = new Logger({
      name: this.name,
    });

    childLogger.logger = this.logger.child(defaultMeta);

    return childLogger;
  }
}

// Singleton instance
const logger = new Logger();

module.exports = {
  LOG_LEVELS,
  Logger,
  logger,
};
