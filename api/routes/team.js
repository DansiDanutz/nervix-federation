/**
 * Team Routes
 * API endpoints for team management and orchestration
 *
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { teamOrchestrationManager } = require('../services/teamOrchestration');

/**
 * @route   POST /api/v1/team/agents/register
 * @desc    Register a new agent to the team
 * @access  Public (or require auth in production)
 */
router.post('/team/agents/register', async (req, res) => {
  try {
    const { agent_id, name, role, capabilities, status } = req.body;

    if (!agent_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: agent_id',
      });
    }

    const { AgentRole, AgentStatus } = require('../services/teamOrchestration');

    const config = {
      name: name || `Agent ${agent_id}`,
      role: role || AgentRole.DEVELOPER,
      capabilities: capabilities || [],
      status: status || AgentStatus.IDLE,
    };

    const agent = teamOrchestrationManager.registerAgent(agent_id, config);

    res.status(201).json({
      message: 'Agent registered successfully',
      agent: agent.toJSON(),
    });
  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register agent',
    });
  }
});

/**
 * @route   GET /api/v1/team/agents
 * @desc    Get all team agents
 * @access  Public
 */
router.get('/team/agents', async (req, res) => {
  try {
    const { status, role, available } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (role) filters.role = role;
    if (available === 'true') filters.available = true;

    const agents = teamOrchestrationManager.getAgents(filters);

    res.status(200).json({
      agents: agents.map(a => a.toJSON()),
      count: agents.length,
    });
  } catch (error) {
    console.error('Agents list error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve agents',
    });
  }
});

/**
 * @route   GET /api/v1/team/agents/:agentId
 * @desc    Get specific agent details
 * @access  Public
 */
router.get('/team/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = teamOrchestrationManager.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
    }

    res.status(200).json({
      agent: agent.toJSON(),
    });
  } catch (error) {
    console.error('Agent get error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve agent',
    });
  }
});

/**
 * @route   DELETE /api/v1/team/agents/:agentId
 * @desc    Unregister agent from team
 * @access  Private (requires admin auth)
 */
router.delete('/team/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const success = teamOrchestrationManager.unregisterAgent(agentId);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
    }

    res.status(200).json({
      message: 'Agent unregistered successfully',
      agent_id: agentId,
    });
  } catch (error) {
    console.error('Agent unregister error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to unregister agent',
    });
  }
});

/**
 * @route   POST /api/v1/team/tasks
 * @desc    Create a new task
 * @access  Private (requires auth)
 */
router.post('/team/tasks', async (req, res) => {
  try {
    const {
      id,
      type,
      description,
      priority = 'medium',
      requiredCapabilities = [],
      baseReward = 10,
    } = req.body;

    if (!id || !type) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: id, type',
      });
    }

    const task = {
      id,
      type,
      description: description || '',
      priority,
      requiredCapabilities,
      baseReward,
      assigned: false,
      createdAt: Date.now(),
    };

    // Add to task queue
    teamOrchestrationManager.tasks.set(id, task);
    teamOrchestrationManager.taskQueue.push(task);
    teamOrchestrationManager.stats.totalTasks++;

    res.status(201).json({
      message: 'Task created successfully',
      task,
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create task',
    });
  }
});

/**
 * @route   POST /api/v1/team/tasks/:taskId/assign/:agentId
 * @desc    Assign task to agent
 * @access  Private (requires admin auth)
 */
router.post('/team/tasks/:taskId/assign/:agentId', async (req, res) => {
  try {
    const { taskId, agentId } = req.params;
    const success = teamOrchestrationManager.assignTask(taskId, agentId);

    if (!success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Failed to assign task (agent unavailable or task not found)',
      });
    }

    const agent = teamOrchestrationManager.getAgent(agentId);
    const task = teamOrchestrationManager.tasks.get(taskId);

    res.status(200).json({
      message: 'Task assigned successfully',
      task_id: taskId,
      agent_id: agentId,
      agent: agent?.toJSON(),
    });
  } catch (error) {
    console.error('Task assignment error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to assign task',
    });
  }
});

/**
 * @route   POST /api/v1/team/tasks/:taskId/complete
 * @desc    Mark task as completed
 * @access  Private (requires agent auth)
 */
router.post('/team/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reward } = req.body;

    const success = teamOrchestrationManager.completeTask(taskId, reward);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task assignment not found',
      });
    }

    res.status(200).json({
      message: 'Task completed successfully',
      task_id: taskId,
      reward: reward || 10,
    });
  } catch (error) {
    console.error('Task completion error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to complete task',
    });
  }
});

/**
 * @route   POST /api/v1/team/tasks/:taskId/fail
 * @desc    Mark task as failed
 * @access  Private (requires agent auth)
 */
router.post('/team/tasks/:taskId/fail', async (req, res) => {
  try {
    const { taskId } = req.params;
    const success = teamOrchestrationManager.failTask(taskId);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task assignment not found',
      });
    }

    res.status(200).json({
      message: 'Task marked as failed',
      task_id: taskId,
    });
  } catch (error) {
    console.error('Task failure error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to mark task as failed',
    });
  }
});

/**
 * @route   GET /api/v1/team/stats
 * @desc    Get team statistics
 * @access  Public
 */
router.get('/team/stats', async (req, res) => {
  try {
    const stats = teamOrchestrationManager.getStats();

    res.status(200).json(stats);
  } catch (error) {
    console.error('Team stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve team statistics',
    });
  }
});

/**
 * @route   GET /api/v1/team/report
 * @desc    Generate team report
 * @access  Public
 */
router.get('/team/report', async (req, res) => {
  try {
    const report = teamOrchestrationManager.generateReport();

    res.status(200).json({
      report,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Team report error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate team report',
    });
  }
});

module.exports = router;
