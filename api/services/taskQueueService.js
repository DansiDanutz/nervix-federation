/**
 * Simple In-Memory Task Queue (fallback when Redis unavailable)
 * For development and testing without Redis dependency
 *
 * @version 1.0.0
 */

const EventEmitter = require('events');

// Job Types
const JobTypes = {
  CODE_GENERATION: 'code-generation',
  TESTING: 'testing',
  DOCUMENTATION: 'documentation',
  RESEARCH: 'research',
  ANALYSIS: 'analysis',
};

// Task Status
const TaskStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
};

/**
 * Simple Job class
 */
class SimpleJob {
  constructor(id, type, data, options = {}) {
    this.id = id;
    this.name = type;
    this.data = data;
    this.status = TaskStatus.PENDING;
    this.attemptsMade = 0;
    this.attempts = options.attempts || 3;
    this.delay = options.delay || 0;
    this.created = Date.now();
    this.updated = Date.now();
    this.result = null;
    this.failedReason = null;
    this.returnvalue = null;
  }

  update(data) {
    this.data = { ...this.data, ...data };
    this.updated = Date.now();
  }
}

/**
 * Simple In-Memory Queue
 */
class SimpleQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.jobs = new Map();
    this.pending = [];
    this.processing = new Map();
    this.completed = [];
    this.failed = [];
    this.jobCounter = 0;
    this.isProcessing = false;
  }

  /**
   * Add a job to the queue
   */
  async add(type, data, options = {}) {
    const jobId = `job_${++this.jobCounter}_${Date.now()}`;
    const job = new SimpleJob(jobId, type, data, options);

    this.jobs.set(jobId, job);

    if (options.delay && options.delay > 0) {
      job.status = TaskStatus.DELAYED;
      setTimeout(() => {
        this.pending.push(jobId);
        this.processQueue();
      }, options.delay);
    } else {
      this.pending.push(jobId);
      this.processQueue();
    }

    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get jobs by state
   */
  async getJobs(states, start = 0, end = 50) {
    const results = [];

    for (const state of states) {
      let source;
      switch (state) {
        case 'waiting':
        case 'pending':
          source = this.pending;
          break;
        case 'active':
          source = Array.from(this.processing.keys());
          break;
        case 'completed':
          source = this.completed;
          break;
        case 'failed':
          source = this.failed;
          break;
        default:
          continue;
      }

      for (const id of source.slice(start, end)) {
        const job = this.jobs.get(id);
        if (job && !results.find(j => j.id === job.id)) {
          results.push(job);
        }
      }
    }

    return results;
  }

  /**
   * Get job counts by state
   */
  async getJobCounts(...states) {
    const counts = {};

    for (const state of states) {
      switch (state) {
        case 'waiting':
        case 'pending':
          counts[state] = this.pending.length;
          break;
        case 'active':
          counts[state] = this.processing.size;
          break;
        case 'completed':
          counts[state] = this.completed.length;
          break;
        case 'failed':
          counts[state] = this.failed.length;
          break;
        default:
          counts[state] = 0;
      }
    }

    return counts;
  }

  /**
   * Remove job
   */
  async remove(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.jobs.delete(jobId);
    this.pending = this.pending.filter(id => id !== jobId);
    this.processing.delete(jobId);
    this.completed = this.completed.filter(id => id !== jobId);
    this.failed = this.failed.filter(id => id !== jobId);
  }

  /**
   * Process next job in queue
   */
  processQueue() {
    if (this.isProcessing || this.pending.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.pending.length > 0 && this.processing.size < 5) {
      const jobId = this.pending.shift();
      const job = this.jobs.get(jobId);

      if (job) {
        this.processJob(job);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    job.status = TaskStatus.ACTIVE;
    job.updated = Date.now();
    this.processing.set(job.id, job);

    this.emit('active', job);

    // Job processing is handled by the worker
    // This just manages state
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId, result) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = TaskStatus.COMPLETED;
    job.updated = Date.now();
    job.result = result;
    job.returnvalue = result;

    this.processing.delete(jobId);
    this.completed.push(jobId);

    // Keep only last 100 completed jobs
    if (this.completed.length > 100) {
      const removed = this.completed.shift();
      this.jobs.delete(removed);
    }

    this.emit('completed', job);
    this.processQueue();
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId, error) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.attemptsMade++;

    if (job.attemptsMade >= job.attempts) {
      job.status = TaskStatus.FAILED;
      job.updated = Date.now();
      job.failedReason = error?.message || error;

      this.processing.delete(jobId);
      this.failed.push(jobId);

      // Keep only last 50 failed jobs
      if (this.failed.length > 50) {
        const removed = this.failed.shift();
        this.jobs.delete(removed);
      }

      this.emit('failed', job, error);
    } else {
      // Retry
      job.status = TaskStatus.PENDING;
      job.updated = Date.now();
      this.processing.delete(jobId);
      this.pending.push(jobId);

      this.emit('retry', job);
    }

    this.processQueue();
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const counts = await this.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );

    return {
      ...counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  }
}

// Task Queue instance
const taskQueue = new SimpleQueue('nervix-tasks');

/**
 * Add a new task to the queue
 */
async function addTask(type, data, options = {}) {
  const job = await taskQueue.add(type, data, options);
  console.log(`Task added: ${job.id} (${type})`);
  return job;
}

/**
 * Get task by ID
 */
async function getTask(taskId) {
  return await taskQueue.getJob(taskId);
}

/**
 * Get all tasks with optional filters
 */
async function getTasks(filters = {}) {
  const { status, start = 0, end = 50 } = filters;

  const states = status ? [status] : [
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed',
  ];

  return await taskQueue.getJobs(states, start, end);
}

/**
 * Cancel a task
 */
async function cancelTask(taskId) {
  const job = await getTask(taskId);
  if (!job) return false;

  await taskQueue.remove(taskId);
  return true;
}

/**
 * Retry a failed task
 */
async function retryTask(taskId) {
  const job = await getTask(taskId);
  if (!job || job.status !== TaskStatus.FAILED) return null;

  job.status = TaskStatus.PENDING;
  job.attemptsMade = 0;
  job.failedReason = null;
  taskQueue.failed = taskQueue.failed.filter(id => id !== taskId);
  taskQueue.pending.push(taskId);
  taskQueue.processQueue();

  return job;
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  return await taskQueue.getStats();
}

/**
 * Create a worker to process tasks
 */
function createWorker(processor, options = {}) {
  const concurrency = options.concurrency || 5;
  let activeCount = 0;

  const processNext = async () => {
    if (activeCount >= concurrency) return;

    const jobs = await taskQueue.getJobs(['active'], 0, concurrency - activeCount);

    for (const job of jobs) {
      if (!taskQueue.processing.has(job.id)) continue;

      activeCount++;

      try {
        const result = await processor(job);

        await taskQueue.completeJob(job.id, result);
      } catch (error) {
        await taskQueue.failJob(job.id, error);
      } finally {
        activeCount--;
        processNext();
      }
    }
  };

  // Start processing
  setInterval(processNext, 1000);

  // Monitor queue for new jobs
  taskQueue.on('active', () => {
    processNext();
  });

  return {
    close: () => {},
    on: (event, handler) => taskQueue.on(event, handler),
  };
}

module.exports = {
  taskQueue,
  JobTypes,
  TaskStatus,
  addTask,
  getTask,
  getTasks,
  cancelTask,
  retryTask,
  getQueueStats,
  createWorker,
};
