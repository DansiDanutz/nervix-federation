/**
 * Nanobot Task Polling Service
 * Manages task polling from Nervix federation for nanobots
 *
 * @version 1.0.0
 */

const taskQueueService = require('./taskQueueService');

// Task Polling Configuration
const POLL_INTERVAL_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;

/**
 * Poll Nervix API for available tasks
 * @param {string} agentId - Agent ID
 * @param {string} apiEndpoint - Nervix API base URL
 * @param {string} token - Authentication token
 * @returns {Promise<Array>} Available tasks
 */
async function pollAvailableTasks(agentId, apiEndpoint, token) {
  try {
    const response = await fetch(`${apiEndpoint}/api/v1/tasks`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.tasks || [];
  } catch (error) {
    console.error('Polling error:', error.message);
    return [];
  }
}

/**
 * Claim a specific task from Nervix API
 * @param {string} taskId - Task ID
 * @param {string} apiEndpoint - Nervix API base URL
 * @param {string} token - Authentication token
 * @returns {Promise<Object|null>} Claimed task or null
 */
async function claimTask(taskId, apiEndpoint, token) {
  try {
    const response = await fetch(`${apiEndpoint}/api/v1/tasks/${taskId}/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.task || null;
  } catch (error) {
    console.error('Claim task error:', error.message);
    return null;
  }
}

/**
 * Submit task result to Nervix API
 * @param {string} taskId - Task ID
 * @param {Object} result - Task result data
 * @param {string} apiEndpoint - Nervix API base URL
 * @param {string} token - Authentication token
 * @returns {Promise<boolean>} Success
 */
async function submitTaskResult(taskId, result, apiEndpoint, token) {
  try {
    const response = await fetch(`${apiEndpoint}/api/v1/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Submit result error:', error.message);
    return false;
  }
}

/**
 * Start task polling for a nanobot
 * @param {Object} config - Polling configuration
 * @param {string} config.agentId - Agent ID
 * @param {string} config.apiEndpoint - Nervix API URL
 * @param {string} config.token - Auth token
 * @param {Function} config.onTask - Callback when task is claimed
 * @param {Function} config.onError - Callback on error
 * @returns {Function} Stop polling function
 */
function startPolling(config) {
  const {
    agentId,
    apiEndpoint,
    token,
    onTask,
    onError,
  } = config;

  let intervalId = null;
  let isRunning = false;

  const poll = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      // Poll for available tasks
      const tasks = await pollAvailableTasks(agentId, apiEndpoint, token);

      // Claim and process tasks
      for (const task of tasks) {
        const claimed = await claimTask(task.id, apiEndpoint, token);

        if (claimed) {
          console.log(`Task claimed: ${task.id}`);

          // Add to internal task queue
          await taskQueueService.addTask(
            taskQueueService.JobTypes.CODE_GENERATION,
            {
              taskId: task.id,
              agentId,
              task: claimed,
              apiEndpoint,
              token,
            }
          );

          // Notify callback
          if (onTask) {
            onTask(claimed);
          }
        }
      }
    } catch (error) {
      console.error('Polling cycle error:', error);
      if (onError) {
        onError(error);
      }
    } finally {
      isRunning = false;
    }
  };

  // Start polling immediately
  poll();

  // Schedule recurring polls
  intervalId = setInterval(poll, POLL_INTERVAL_MS);

  console.log(`Task polling started for agent: ${agentId}`);

  // Return stop function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    console.log(`Task polling stopped for agent: ${agentId}`);
  };
}

/**
 * Task Poller Manager
 * Manages multiple nanobot pollers
 */
class TaskPollerManager {
  constructor() {
    this.pollers = new Map();
  }

  /**
   * Start polling for a nanobot
   * @param {string} agentId - Agent ID
   * @param {Object} config - Polling configuration
   * @returns {boolean} Success
   */
  startPoller(agentId, config) {
    if (this.pollers.has(agentId)) {
      console.warn(`Poller already running for: ${agentId}`);
      return false;
    }

    const stopPolling = startPolling({
      agentId,
      ...config,
    });

    this.pollers.set(agentId, {
      stop: stopPolling,
      config,
      startedAt: Date.now(),
    });

    return true;
  }

  /**
   * Stop polling for a nanobot
   * @param {string} agentId - Agent ID
   * @returns {boolean} Success
   */
  stopPoller(agentId) {
    const poller = this.pollers.get(agentId);
    if (!poller) {
      console.warn(`No poller found for: ${agentId}`);
      return false;
    }

    poller.stop();
    this.pollers.delete(agentId);
    return true;
  }

  /**
   * Stop all pollers
   */
  stopAll() {
    for (const [agentId] of this.pollers) {
      this.stopPoller(agentId);
    }
  }

  /**
   * Get all active pollers
   * @returns {Array} List of poller info
   */
  getActivePollers() {
    return Array.from(this.pollers.entries()).map(([agentId, data]) => ({
      agentId,
      startedAt: data.startedAt,
      config: data.config,
    }));
  }

  /**
   * Get poller count
   * @returns {number}
   */
  getPollerCount() {
    return this.pollers.size;
  }
}

// Singleton instance
const taskPollerManager = new TaskPollerManager();

module.exports = {
  pollAvailableTasks,
  claimTask,
  submitTaskResult,
  startPolling,
  TaskPollerManager,
  taskPollerManager,
  POLL_INTERVAL_MS,
};
