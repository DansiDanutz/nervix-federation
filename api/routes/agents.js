/**
 * Agent Routes
 * API endpoints for agent management
 *
 * @version 1.0.0
 */

const express = require('express');
const enrollmentService = require('../services/enrollmentService');

const router = express.Router();

/**
 * Authentication middleware
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Authorization token is required'
        }
      });
    }

    const token = authHeader.substring(7);
    const decoded = enrollmentService.verifyToken(token);

    req.agent = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
}

/**
 * GET /v1/agents/:id
 * Get public agent profile
 */
router.get('/:id', (req, res) => {
  try {
    const agent = enrollmentService.getAgent(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        agent_id: agent.agentId,
        agent_name: agent.agentName,
        reputation_score: agent.reputationScore,
        reputation_level: agent.reputationLevel,
        total_tasks_completed: agent.totalTasksCompleted,
        capabilities: agent.metadata?.capabilities || [],
        created_at: agent.createdAt
      }
    });
  } catch (error) {
    if (error.message === 'Agent not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: 'Agent not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred'
      }
    });
  }
});

/**
 * GET /v1/agents/me
 * Get full agent profile
 */
router.get('/me', authenticate, (req, res) => {
  try {
    const agent = enrollmentService.getAgent(req.agent.agentId);

    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    if (error.message === 'Agent not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: 'Agent not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred'
      }
    });
  }
});

/**
 * PATCH /v1/agents/me/config
 * Update agent configuration
 */
router.patch('/me/config', authenticate, (req, res) => {
  try {
    const agent = enrollmentService.getAgent(req.agent.agentId);

    // Update agent configuration
    if (req.body.agent_metadata) {
      agent.metadata = { ...agent.metadata, ...req.body.agent_metadata };
    }
    if (req.body.notifications_enabled !== undefined) {
      agent.notificationsEnabled = req.body.notifications_enabled;
    }
    if (req.body.max_concurrent_tasks !== undefined) {
      agent.maxConcurrentTasks = req.body.max_concurrent_tasks;
    }

    agent.updatedAt = new Date().toISOString();

    res.status(200).json({
      success: true,
      data: {
        agent_id: agent.agentId,
        updated_at: agent.updatedAt
      }
    });
  } catch (error) {
    if (error.message === 'Agent not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: 'Agent not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred'
      }
    });
  }
});

module.exports = router;
