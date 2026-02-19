/**
 * Task Routes (Updated with QA Pipeline)
 * API endpoints for task management with quality assurance
 *
 * @version 1.0.0
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { runQualityCheck } = require('../services/qaPipeline');
const logger = require('../services/logger');

const router = express.Router();

// In-memory task storage (replace with database in production)
const tasks = new Map();
const submissions = new Map();

/**
 * GET /v1/tasks
 * List available tasks with filters
 */
router.get('/', (req, res) => {
  try {
    const { limit = 20, offset = 0, complexity, min_reward, type } = req.query;

    let availableTasks = Array.from(tasks.values()).filter(task => task.status === 'available');

    // Apply filters
    if (complexity) {
      availableTasks = availableTasks.filter(task => task.complexity === complexity);
    }
    if (min_reward) {
      availableTasks = availableTasks.filter(task => task.base_reward >= parseFloat(min_reward));
    }
    if (type) {
      availableTasks = availableTasks.filter(task => task.type === type);
    }

    // Sort by reward (descending)
    availableTasks.sort((a, b) => b.base_reward - a.base_reward);

    // Apply pagination
    const total = availableTasks.length;
    const paginatedTasks = availableTasks.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        tasks: paginatedTasks,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

    logger.info('Tasks listed', { count: paginatedTasks.length, total, filters: req.query });
  } catch (error) {
    logger.error('Failed to list tasks', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list tasks'
    });
  }
});

/**
 * POST /v1/tasks
 * Submit a new task
 */
router.post('/', (req, res) => {
  try {
    const { type, priority, base_reward, parameters, requirements } = req.body;

    const task = {
      id: uuidv4(),
      type,
      priority: priority || 'medium',
      base_reward: base_reward || 50,
      parameters: parameters || {},
      requirements: requirements || {},
      status: 'available',
      metadata: {
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_by: req.user?.agent_id || 'system',
      },
    };

    tasks.set(task.id, task);

    logger.info('Task created', { task_id: task.id, type, priority });

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    logger.error('Failed to create task', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create task'
    });
  }
});

/**
 * GET /v1/tasks/available
 * Get available tasks for polling
 */
router.get('/available', (req, res) => {
  try {
    const availableTasks = Array.from(tasks.values())
      .filter(task => task.status === 'available')
      .sort((a, b) => b.base_reward - a.base_reward)
      .slice(0, 10);

    res.status(200).json(availableTasks);
  } catch (error) {
    logger.error('Failed to get available tasks', { error: error.message });
    res.status(500).json([]);
  }
});

/**
 * GET /v1/tasks/:id
 * Get task details
 */
router.get('/:id', (req, res) => {
  try {
    const task = tasks.get(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    logger.error('Failed to get task', { error: error.message, task_id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to get task'
    });
  }
});

/**
 * POST /v1/tasks/:id/claim
 * Claim a task
 */
router.post('/:id/claim', (req, res) => {
  try {
    const task = tasks.get(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    if (task.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'Task is not available'
      });
    }

    const assignmentToken = uuidv4();

    // Update task status
    task.status = 'in_progress';
    task.agent_id = req.body.agent_id;
    task.assigned_at = new Date().toISOString();
    task.assignment_token = assignmentToken;

    logger.info('Task claimed', {
      task_id: task.id,
      agent_id: req.body.agent_id,
      assigned_at: task.assigned_at
    });

    res.status(200).json({
      success: true,
      data: {
        task_id: task.id,
        assignment_token: assignmentToken,
        status: 'in_progress',
        assigned_at: task.assigned_at
      }
    });
  } catch (error) {
    logger.error('Failed to claim task', { error: error.message, task_id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to claim task'
    });
  }
});

/**
 * POST /v1/tasks/:id/submit
 * Submit task completion with QA
 */
router.post('/:id/submit', async (req, res) => {
  try {
    const { assignment_token, result, execution_time } = req.body;
    const task = tasks.get(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    if (task.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Task is not in progress'
      });
    }

    if (task.assignment_token !== assignment_token) {
      return res.status(401).json({
        success: false,
        error: 'Invalid assignment token'
      });
    }

    // Run QA pipeline
    logger.info('Running QA pipeline', { task_id: task.id });

    const qaResult = await runQualityCheck(task, result);

    const submission = {
      id: uuidv4(),
      task_id: task.id,
      agent_id: task.agent_id,
      assignment_token,
      result,
      execution_time,
      submitted_at: new Date().toISOString(),
      qa_result: qaResult,
      status: qaResult.passed ? 'completed' : 'failed_qa'
    };

    submissions.set(submission.id, submission);

    // Update task status
    if (qaResult.passed) {
      task.status = 'completed';
      task.completed_at = new Date().toISOString();
      task.submission_id = submission.id;

      // Calculate reward based on quality score
      const qualityMultiplier = qaResult.score / 100;
      const reward = task.base_reward * qualityMultiplier;

      logger.info('Task completed', {
        task_id: task.id,
        agent_id: task.agent_id,
        qa_score: qaResult.score,
        reward
      });

      res.status(200).json({
        success: true,
        data: {
          submission_id: submission.id,
          task_id: task.id,
          status: 'completed',
          reward,
          qa_result: qaResult
        }
      });
    } else {
      task.status = 'failed_qa';
      task.failed_at = new Date().toISOString();

      logger.warn('Task failed QA', {
        task_id: task.id,
        agent_id: task.agent_id,
        qa_score: qaResult.score,
        issues: qaResult.checks.filter(c => !c.passed).map(c => c.name)
      });

      res.status(200).json({
        success: false,
        data: {
          submission_id: submission.id,
          task_id: task.id,
          status: 'failed_qa',
          qa_result: qaResult,
          message: 'Task failed quality assurance check'
        }
      });
    }
  } catch (error) {
    logger.error('Failed to submit task', { error: error.message, task_id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to submit task'
    });
  }
});

/**
 * GET /v1/tasks/:id/submissions
 * Get task submissions
 */
router.get('/:id/submissions', (req, res) => {
  try {
    const taskSubmissions = Array.from(submissions.values())
      .filter(sub => sub.task_id === req.params.id);

    res.status(200).json({
      success: true,
      data: {
        submissions: taskSubmissions,
        total: taskSubmissions.length
      }
    });
  } catch (error) {
    logger.error('Failed to get submissions', { error: error.message, task_id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to get submissions'
    });
  }
});

module.exports = router;
