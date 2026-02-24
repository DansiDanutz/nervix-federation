/**
 * Task Routes (Supabase Version)
 * API endpoints for task management with quality assurance
 *
 * @version 2.0.0 - Uses Supabase for persistent storage
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { runQualityCheck } = require('../services/qaPipeline');
const { logger } = require('../services/logger');

const router = express.Router();

/**
 * Create a task in Supabase
 */
async function createTaskInSupabase(taskData) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/tasks`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(taskData),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(`Supabase error (${response.status}): ${data?.message || 'Unknown error'}`);
  }

  return data[0];
}

/**
 * Query tasks from Supabase
 */
async function queryTasksFromSupabase(filters = {}, limit = 20, offset = 0) {
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  params.set('order', 'created_at.desc');

  for (const [key, value] of Object.entries(filters)) {
    params.set(key, `eq.${value}`);
  }

  const url = `${process.env.SUPABASE_URL}/rest/v1/tasks?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'count=exact',
    },
  });

  const text = await response.text();
  const tasks = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(`Supabase error (${response.status}): ${tasks?.message || 'Unknown error'}`);
  }

  const contentRange = response.headers.get('content-range');
  const total = contentRange ? Number(contentRange.split('/')[1]) : tasks.length;

  return { tasks, total };
}

/**
 * Update task in Supabase
 */
async function updateTaskInSupabase(taskId, updates) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(updates),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(`Supabase error (${response.status}): ${data?.message || 'Unknown error'}`);
  }

  return data[0];
}

/**
 * Create submission in Supabase
 */
async function createSubmissionInSupabase(submissionData) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/task_submissions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(submissionData),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(`Supabase error (${response.status}): ${data?.message || 'Unknown error'}`);
  }

  return data[0];
}

/**
 * GET /v1/tasks
 * List available tasks with filters
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, complexity, min_reward, type, status = 'available' } = req.query;

    const filters = { status };
    if (complexity) filters.complexity = complexity;
    if (type) filters.type = type;

    const { tasks, total } = await queryTasksFromSupabase(filters, parseInt(limit), parseInt(offset));

    // Apply additional filters in code
    let filteredTasks = tasks;
    if (min_reward) {
      filteredTasks = tasks.filter(task => task.base_reward >= parseFloat(min_reward));
    }

    // Sort by reward (descending)
    filteredTasks.sort((a, b) => b.base_reward - a.base_reward);

    res.status(200).json({
      success: true,
      data: {
        tasks: filteredTasks,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

    logger.info('Tasks listed', { count: filteredTasks.length, total, filters: req.query });
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
    const { type, priority, base_reward, parameters, requirements, complexity, description, tags } = req.body;

    const task = {
      type,
      priority: priority || 'medium',
      base_reward: base_reward || 50,
      parameters: parameters || {},
      requirements: requirements || {},
      complexity: complexity || 'medium',
      description: description || parameters?.description || '',
      tags: tags || [],
      status: 'available',
      created_by: req.user?.agent_id || 'system',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const createdTask = await createTaskInSupabase(task);

    logger.info('Task created', { task_id: createdTask.id, type, priority });

    res.status(201).json({
      success: true,
      data: createdTask
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
    const { limit = 10 } = req.query;

    const filters = { status: 'available' };
    const { tasks } = await queryTasksFromSupabase(filters, parseInt(limit), 0);

    // Filter out expired tasks
    const availableTasks = tasks.filter(task => {
      if (!task.expires_at) return true;
      return new Date(task.expires_at) > new Date();
    });

    // Sort by reward descending
    availableTasks.sort((a, b) => b.base_reward - a.base_reward);

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
    const { id } = req.params;
    const filters = { id };
    const { tasks } = await queryTasksFromSupabase(filters, 1, 0);

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.status(200).json({
      success: true,
      data: tasks[0]
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
    const { id } = req.params;
    const { agent_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({
        success: false,
        error: 'agent_id is required'
      });
    }

    // Get task
    const filters = { id };
    const { tasks } = await queryTasksFromSupabase(filters, 1, 0);

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const task = tasks[0];

    if (task.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'Task is not available'
      });
    }

    const assignmentToken = uuidv4();

    // Update task in Supabase
    const updatedTask = await updateTaskInSupabase(id, {
      status: 'in_progress',
      agent_id,
      assignment_token: assignmentToken,
      assigned_at: new Date().toISOString(),
    });

    logger.info('Task claimed', {
      task_id: id,
      agent_id,
      assigned_at: updatedTask.assigned_at
    });

    res.status(200).json({
      success: true,
      data: {
        task_id: id,
        assignment_token: assignmentToken,
        status: 'in_progress',
        assigned_at: updatedTask.assigned_at
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
    const { id } = req.params;
    const { assignment_token, result, execution_time } = req.body;

    // Get task
    const filters = { id };
    const { tasks } = await queryTasksFromSupabase(filters, 1, 0);

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const task = tasks[0];

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
    logger.info('Running QA pipeline', { task_id: id });

    const qaResult = await runQualityCheck(task, result);

    // Calculate reward based on quality score
    const qualityMultiplier = qaResult.score / 100;
    const reward = task.base_reward * qualityMultiplier;

    // Create submission in Supabase
    const submission = await createSubmissionInSupabase({
      task_id: id,
      agent_id: task.agent_id,
      assignment_token,
      result,
      execution_time,
      qa_result: qaResult,
      qa_passed: qaResult.passed,
      qa_score: qaResult.score,
      status: qaResult.passed ? 'passed_qa' : 'failed_qa',
      reward_amount: qaResult.passed ? reward : 0,
    });

    // Task status will be updated automatically by the database trigger

    if (qaResult.passed) {
      logger.info('Task completed', {
        task_id: id,
        agent_id: task.agent_id,
        qa_score: qaResult.score,
        reward
      });

      res.status(200).json({
        success: true,
        data: {
          submission_id: submission.id,
          task_id: id,
          status: 'completed',
          reward,
          qa_result: qaResult
        }
      });
    } else {
      logger.warn('Task failed QA', {
        task_id: id,
        agent_id: task.agent_id,
        qa_score: qaResult.score,
        issues: qaResult.checks.filter(c => !c.passed).map(c => c.name)
      });

      res.status(200).json({
        success: false,
        data: {
          submission_id: submission.id,
          task_id: id,
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
    const { id } = req.params;

    const url = `${process.env.SUPABASE_URL}/rest/v1/task_submissions?task_id=eq.${id}&order=submitted_at.desc`;
    const response = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    const text = await response.text();
    const submissions = text ? JSON.parse(text) : [];

    if (!response.ok) {
      throw new Error(`Supabase error (${response.status}): ${submissions?.message || 'Unknown error'}`);
    }

    res.status(200).json({
      success: true,
      data: {
        submissions,
        total: submissions.length
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
