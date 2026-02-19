/**
 * Environment Validator
 * Validates required environment variables
 *
 * @version 1.0.0
 */

/**
 * Environment Schema
 */
const ENV_SCHEMA = {
  // Server
  NODE_ENV: {
    required: true,
    default: 'development',
    values: ['development', 'production', 'test'],
  },
  PORT: {
    required: false,
    default: 3000,
    type: 'number',
  },

  // JWT
  JWT_SECRET: {
    required: true,
    type: 'string',
    minLength: 32,
  },

  // CORS
  CORS_ORIGIN: {
    required: false,
    default: '*',
    type: 'string',
  },

  // Rate Limiting
  RATE_LIMIT_MAX: {
    required: false,
    default: 100,
    type: 'number',
  },

  // Database (Supabase)
  SUPABASE_URL: {
    required: true,
    type: 'url',
  },
  SUPABASE_ANON_KEY: {
    required: true,
    type: 'string',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    type: 'string',
  },

  // Redis
  REDIS_URL: {
    required: false,
    type: 'url',
    default: 'redis://localhost:6379',
  },

  // Logging
  LOG_LEVEL: {
    required: false,
    default: 'info',
    values: ['error', 'warn', 'info', 'debug'],
  },
};

/**
 * Environment Validator
 */
class EnvValidator {
  constructor(schema = ENV_SCHEMA) {
    this.schema = schema;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate environment
   * @returns {Object> Validation result
   */
  validate() {
    this.errors = [];
    this.warnings = [];

    for (const [key, config] of Object.entries(this.schema)) {
      this.validateVariable(key, config);
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Validate single environment variable
   * @param {string} key - Variable name
   * @param {Object} config - Validation config
   * @returns {void}
   */
  validateVariable(key, config) {
    const value = process.env[key];

    // Check if required
    if (config.required && (value === undefined || value === null || value === '')) {
      this.errors.push({
        key,
        message: `Required environment variable is missing`,
        fix: `Set ${key} in .env file`,
      });
      return;
    }

    // Use default if not set
    if ((value === undefined || value === null || value === '') && config.default !== undefined) {
      process.env[key] = String(config.default);
      return;
    }

    // Skip further validation if not set
    if (value === undefined || value === null || value === '') {
      return;
    }

    // Type validation
    if (config.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) {
        this.errors.push({
          key,
          message: `Value must be a number, got: ${value}`,
          fix: `Set ${key} to a valid number`,
        });
        return;
      }
    }

    if (config.type === 'url') {
      try {
        new URL(value);
      } catch {
        this.errors.push({
          key,
          message: `Value must be a valid URL, got: ${value}`,
          fix: `Set ${key} to a valid URL (e.g., https://...)`,
        });
        return;
      }
    }

    // Values validation
    if (config.values && !config.values.includes(value)) {
      this.errors.push({
        key,
        message: `Value must be one of: ${config.values.join(', ')}, got: ${value}`,
        fix: `Set ${key} to one of: ${config.values.join(', ')}`,
      });
      return;
    }

    // Min length validation
    if (config.minLength && value.length < config.minLength) {
      this.errors.push({
        key,
        message: `Value must be at least ${config.minLength} characters, got: ${value.length}`,
        fix: `Set ${key} to a value with at least ${config.minLength} characters`,
      });
    }

    // Warnings for development
    if (process.env.NODE_ENV === 'production') {
      if (key === 'JWT_SECRET' && value === 'change-this-secret-in-production') {
        this.warnings.push({
          key,
          message: `Using default JWT secret in production`,
          fix: `Set ${key} to a strong, unique secret`,
        });
      }

      if (key === 'CORS_ORIGIN' && value === '*') {
        this.warnings.push({
          key,
          message: `Using wildcard CORS origin in production`,
          fix: `Set ${key} to specific origins only`,
        });
      }
    }
  }

  /**
   * Print validation report
   * @returns {void}
   */
  printReport() {
    const result = this.validate();

    console.log('\n=== Environment Validation ===\n');

    if (result.valid) {
      console.log('✅ All environment variables are valid\n');
    } else {
      console.log('❌ Environment validation failed\n');
    }

    if (result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.key}`);
        console.log(`     ${error.message}`);
        console.log(`     Fix: ${error.fix}\n`);
      });
    }

    if (result.warnings.length > 0) {
      console.log('Warnings:');
      result.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning.key}`);
        console.log(`     ${warning.message}`);
        console.log(`     Fix: ${warning.fix}\n`);
      });
    }

    console.log('============================\n');

    return result.valid;
  }
}

/**
 * Validate environment on startup
 */
function validateEnv() {
  const validator = new EnvValidator();
  return validator.printReport();
}

module.exports = {
  ENV_SCHEMA,
  EnvValidator,
  validateEnv,
};
