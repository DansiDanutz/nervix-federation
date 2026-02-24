/**
 * Health Check Service
 * Comprehensive health checks for system monitoring
 *
 * @version 1.0.0
 */

// Health Status
const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
};

/**
 * Health Check Class
 */
class HealthCheck {
  constructor(name, checker, options = {}) {
    this.name = name;
    this.checker = checker;
    this.critical = options.critical !== false; // Default critical
    this.timeout = options.timeout || 5000; // 5 seconds
    this.lastResult = null;
    this.lastCheck = null;
  }

  /**
   * Run health check
   * @returns {Promise<Object>} Health check result
   */
  async check() {
    const startTime = Date.now();

    try {
      // Timeout check
      const result = await Promise.race([
        this.checker(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        ),
      ]);

      const duration = Date.now() - startTime;

      this.lastResult = {
        name: this.name,
        status: result.healthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: result.message || 'OK',
        duration,
        critical: this.critical,
        timestamp: new Date().toISOString(),
      };

      this.lastCheck = Date.now();

      return this.lastResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.lastResult = {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        message: error.message || 'Check failed',
        duration,
        critical: this.critical,
        timestamp: new Date().toISOString(),
      };

      this.lastCheck = Date.now();

      return this.lastResult;
    }
  }

  /**
   * Get last result without re-checking
   * @returns {Object|null>} Last health check result
   */
  getLastResult() {
    return this.lastResult;
  }
}

/**
 * Health Check Manager
 */
class HealthCheckManager {
  constructor() {
    this.checks = new Map();
    this.setupDefaultChecks();
  }

  /**
   * Setup default health checks
   * @returns {void}
   */
  setupDefaultChecks() {
    // Memory check
    this.register('memory', async () => {
      const used = process.memoryUsage();
      const total = require('os').totalmem();
      const usagePercent = (used.heapUsed / total) * 100;

      return {
        healthy: usagePercent < 90,
        message: `${Math.round(usagePercent)}% memory usage`,
        data: {
          heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
        },
      };
    }, { critical: true });

    // Disk check
    this.register('disk', async () => {
      // Check if we can write to log directory
      const fs = require('fs');
      const path = require('path');

      try {
        const testFile = path.join(process.cwd(), 'logs', '.healthcheck');
        fs.writeFileSync(testFile, Date.now().toString());
        fs.unlinkSync(testFile);

        return {
          healthy: true,
          message: 'Disk write OK',
        };
      } catch (error) {
        return {
          healthy: false,
          message: `Disk write failed: ${error.message}`,
        };
      }
    }, { critical: true });

    // CPU check
    this.register('cpu', async () => {
      const cpuUsage = process.cpuUsage();
      const cores = require('os').cpus().length;

      return {
        healthy: true,
        message: `${cores} CPU cores available`,
        data: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
      };
    }, { critical: false });
  }

  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {Function} checker - Check function
   * @param {Object} options - Check options
   * @returns {void}
   */
  register(name, checker, options = {}) {
    const healthCheck = new HealthCheck(name, checker, options);
    this.checks.set(name, healthCheck);
  }

  /**
   * Unregister a health check
   * @param {string} name - Check name
   * @returns {boolean}
   */
  unregister(name) {
    return this.checks.delete(name);
  }

  /**
   * Run all health checks
   * @returns {Promise<Object>} Overall health status
   */
  async checkAll() {
    const results = [];

    for (const [name, healthCheck] of this.checks) {
      const result = await healthCheck.check();
      results.push(result);
    }

    // Determine overall status
    const criticalChecks = results.filter(r => r.critical);
    const criticalFailed = criticalChecks.filter(r => r.status === HealthStatus.UNHEALTHY);
    const anyFailed = results.some(r => r.status === HealthStatus.UNHEALTHY);

    let overallStatus;
    if (criticalFailed.length > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (anyFailed) {
      overallStatus = HealthStatus.DEGRADED;
    } else {
      overallStatus = HealthStatus.HEALTHY;
    }

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      checks: results,
      summary: {
        total: results.length,
        healthy: results.filter(r => r.status === HealthStatus.HEALTHY).length,
        degraded: results.filter(r => r.status === HealthStatus.DEGRADED).length,
        unhealthy: results.filter(r => r.status === HealthStatus.UNHEALTHY).length,
      },
    };
  }

  /**
   * Run specific health check
   * @param {string} name - Check name
   * @returns {Promise<Object>} Health check result
   */
  async check(name) {
    const healthCheck = this.checks.get(name);

    if (!healthCheck) {
      throw new Error(`Health check not found: ${name}`);
    }

    return await healthCheck.check();
  }

  /**
   * Get list of registered checks
   * @returns {Array>} List of check names
   */
  listChecks() {
    return Array.from(this.checks.keys());
  }
}

// Singleton instance
const healthCheckManager = new HealthCheckManager();

module.exports = {
  HealthStatus,
  HealthCheck,
  HealthCheckManager,
  healthCheckManager,
};
