/**
 * Metrics Dashboard Service
 * Real-time metrics and analytics for Nervix
 *
 * @version 1.0.0
 */

class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.history = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Record a metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {Object} tags - Metric tags
   * @returns {void}
   */
  record(name, value, tags = {}) {
    const timestamp = Date.now();

    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
        tags: {},
      });
    }

    const metric = this.metrics.get(name);

    metric.count++;
    metric.sum += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.avg = metric.sum / metric.count;

    // Update tag counts
    for (const [key, val] of Object.entries(tags)) {
      const tagKey = `${key}:${val}`;
      if (!metric.tags[tagKey]) {
        metric.tags[tagKey] = 0;
      }
      metric.tags[tagKey]++;
    }

    // Add to history
    this.history.push({
      name,
      value,
      tags,
      timestamp,
    });

    // Trim history
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Get metric statistics
   * @param {string} name - Metric name
   * @returns {Object|null>} Metric stats or null
   */
  get(name) {
    return this.metrics.get(name) || null;
  }

  /**
   * Get all metrics
   * @returns {Array>} List of metrics
   */
  getAll() {
    return Array.from(this.metrics.values());
  }

  /**
   * Reset metric
   * @param {string} name - Metric name
   * @returns {void}
   */
  reset(name) {
    this.metrics.delete(name);
  }

  /**
   * Reset all metrics
   * @returns {void}
   */
  resetAll() {
    this.metrics.clear();
    this.history = [];
  }
}

/**
 * Metrics Service
 */
class MetricsService {
  constructor() {
    this.collector = new MetricsCollector();
    this.start();
  }

  /**
   * Start metrics collection
   * @returns {void}
   */
  start() {
    this.startTime = Date.now();
    console.log('Metrics service started');
  }

  /**
   * Get uptime in seconds
   * @returns {number}
   */
  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  // ============================================================================
  // Task Metrics
  // ============================================================================

  /**
   * Record task created
   * @param {string} type - Task type
   * @param {string} priority - Task priority
   * @returns {void}
   */
  recordTaskCreated(type, priority) {
    this.collector.record('tasks.created', 1, { type, priority });
  }

  /**
   * Record task completed
   * @param {string} type - Task type
   * @param {number} duration - Task duration in ms
   * @param {string} agentId - Agent ID
   * @returns {void}
   */
  recordTaskCompleted(type, duration, agentId) {
    this.collector.record('tasks.completed', 1, { type });
    this.collector.record('tasks.duration', duration, { type });
    this.collector.record('tasks.completed_by_agent', 1, { agentId });
  }

  /**
   * Record task failed
   * @param {string} type - Task type
   * @param {string} reason - Failure reason
   * @returns {void}
   */
  recordTaskFailed(type, reason) {
    this.collector.record('tasks.failed', 1, { type, reason });
  }

  /**
   * Get task metrics
   * @returns {Object}
   */
  getTaskMetrics() {
    return {
      created: this.collector.get('tasks.created'),
      completed: this.collector.get('tasks.completed'),
      failed: this.collector.get('tasks.failed'),
      duration: this.collector.get('tasks.duration'),
    };
  }

  // ============================================================================
  // Agent Metrics
  // ============================================================================

  /**
   * Record agent heartbeat
   * @param {string} agentId - Agent ID
   * @param {string} status - Agent status
   * @returns {void}
   */
  recordAgentHeartbeat(agentId, status) {
    this.collector.record('agents.heartbeat', 1, { agentId, status });
  }

  /**
   * Record agent registered
   * @param {string} agentId - Agent ID
   * @returns {void}
   */
  recordAgentRegistered(agentId) {
    this.collector.record('agents.registered', 1);
    this.collector.record('agents.registered_unique', 1, { agentId });
  }

  /**
   * Get agent metrics
   * @returns {Object}
   */
  getAgentMetrics() {
    return {
      registered: this.collector.get('agents.registered'),
      heartbeat: this.collector.get('agents.heartbeat'),
    };
  }

  // ============================================================================
  // Federation Metrics
  // ============================================================================

  /**
   * Record federation request
   * @param {string} endpoint - Endpoint name
   * @param {number} duration - Request duration in ms
   * @param {number} statusCode - HTTP status code
   * @returns {void}
   */
  recordFederationRequest(endpoint, duration, statusCode) {
    this.collector.record('federation.requests', 1, { endpoint, status: statusCode });
    this.collector.record('federation.duration', duration, { endpoint });
  }

  /**
   * Get federation metrics
   * @returns {Object}
   */
  getFederationMetrics() {
    return {
      requests: this.collector.get('federation.requests'),
      duration: this.collector.get('federation.duration'),
    };
  }

  // ============================================================================
  // Queue Metrics
  // ============================================================================

  /**
   * Update queue metrics
   * @param {Object} stats - Queue statistics
   * @returns {void}
   */
  updateQueueMetrics(stats) {
    this.collector.record('queue.waiting', stats.waiting || 0);
    this.collector.record('queue.active', stats.active || 0);
    this.collector.record('queue.completed', stats.completed || 0);
    this.collector.record('queue.failed', stats.failed || 0);
    this.collector.record('queue.delayed', stats.delayed || 0);
  }

  /**
   * Get queue metrics
   * @returns {Object}
   */
  getQueueMetrics() {
    return {
      waiting: this.collector.get('queue.waiting'),
      active: this.collector.get('queue.active'),
      completed: this.collector.get('queue.completed'),
      failed: this.collector.get('queue.failed'),
      delayed: this.collector.get('queue.delayed'),
    };
  }

  // ============================================================================
  // System Metrics
  // ============================================================================

  /**
   * Get system metrics
   * @returns {Object}
   */
  getSystemMetrics() {
    const used = process.memoryUsage();
    const total = require('os').totalmem();
    const free = require('os').freemem();

    return {
      uptime: this.getUptime(),
      memory: {
        rss: Math.round(used.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(used.external / 1024 / 1024) + ' MB',
        system: {
          total: Math.round(total / 1024 / 1024 / 1024) + ' GB',
          free: Math.round(free / 1024 / 1024 / 1024) + ' GB',
          usedPercent: Math.round(((total - free) / total) * 100) + '%',
        },
      },
      cpu: {
        usage: process.cpuUsage(),
        cores: require('os').cpus().length,
      },
      metrics: {
        count: this.collector.metrics.size,
        history: this.collector.history.length,
      },
    };
  }

  // ============================================================================
  // Dashboard Data
  // ============================================================================

  /**
   * Get complete dashboard data
   * @returns {Object}
   */
  getDashboardData() {
    return {
      system: this.getSystemMetrics(),
      tasks: this.getTaskMetrics(),
      agents: this.getAgentMetrics(),
      federation: this.getFederationMetrics(),
      queue: this.getQueueMetrics(),
    };
  }

  /**
   * Get metrics history
   * @param {string} name - Metric name
   * @param {number} limit - Limit number of entries
   * @returns {Array>}
   */
  getHistory(name, limit = 100) {
    const history = this.collector.history.filter(h => h.name === name);
    return history.slice(-limit);
  }
}

// Singleton instance
const metricsService = new MetricsService();

module.exports = {
  MetricsCollector,
  MetricsService,
  metricsService,
};
