/**
 * Task Routes (Supabase Integration)
 * API endpoints for task management with quality assurance
 *
 * @version 1.1.0
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { runQualityCheck } = require('../services/qaPipeline');
const { TaskOperations, SubmissionOperations } = require('../services/storageService');
const { logger } = require('../services/logger');

const router = express.Router();

/**
 * GET /v1/tasks
 * List available tasks with filters
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, complexity, min_reward, type, status } = req.query;

    const result = await TaskOperations.listTasks({
      limit: parseInt(limit),
      offset: parseInt(offset),
      complexity,
      min_reward,
      type,
      status,
    });

    res.status(200).json({
      success: true,
      data: result
    });

    logger.info('Tasks listed', { count: result.tasks.length, total: result.total, filters: req.query });
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
router.post('/', async (req, res) => {
  try {
    const { type, priority, base_reward, parameters, requirements } = req.body;

    const task = await TaskOperations.createTask({
      type,
      priority,
      base_reward,
      parameters,
      requirements,
      created_by: req.user?.agent_id || 'system',
    });

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
router.get('/available', async (req, res) => {
  try {
    const availableTasks = await TaskOperations.getAvailableTasks(10);
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
router.get('/:id', async (req, res) => {
  try {
    const task = await TaskOperations.getTask(req.params.id);

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
router.post('/:id/claim', async (req, res) => {
  try {
    const { agent_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({
        success: false,
        error: 'agent_id is required'
      });
    }

    const result = await TaskOperations.claimTask(req.params.id, agent_id);

    res.status(200).json({
      success: true,
      data: result
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
    const { assignment_token, result, execution_time, agent_id } = req.body;

    const task = await TaskOperations.getTask(req.params.id);

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

    // Create submission
    const submission = await SubmissionOperations.createSubmission({
      task_id: task.id,
      agent_id: agent_id || task.agent_id,
      assignment_token,
      result,
      execution_time,
      qa_result: qaResult,
      qa_passed: qaResult.passed,
      qa_score: qaResult.score,
      status: qaResult.passed ? 'passed_qa' : 'failed_qa'
    });

    // Update task status
    if (qaResult.passed) {
      await TaskOperations.completeTask(task.id, submission.id);

      // Calculate reward based on quality score
      const qualityMultiplier = qaResult.score / 100;
      const reward = task.base_reward * qualityMultiplier;

      logger.info('Task completed', {
        task_id: task.id,
        agent_id: agent_id,
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
      await TaskOperations.failTaskQA(task.id);

      logger.warn('Task failed QA', {
        task_id: task.id,
        agent_id: agent_id,
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
router.get('/:id/submissions', async (req, res) => {
  try {
    const taskSubmissions = await TaskOperations.getTaskSubmissions(req.params.id);

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
