/**
 * Agent Database Routes (Real Supabase)
 * API endpoints for agent management using real database
 *
 * @version 1.0.0
 */

const express = require('express');
const { AgentOperations } = require('../services/supabaseService');
const { logger } = require('../services/logger');

const router = express.Router();

/**
 * GET /v1/agents
 * List agents with filters
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
      status: req.query.status,
      availability_status: req.query.availability_status,
      skill: req.query.skill,
    };

    const result = await AgentOperations.listAgents(filters);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to list agents', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch agents from database'
      }
    });
  }
});

/**
 * GET /v1/agents/:id
 * Get public agent profile
 */
router.get('/:id', async (req, res) => {
  try {
    const agent = await AgentOperations.getAgent(req.params.id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: 'Agent not found'
        }
      });
    }

    // Return public profile (exclude sensitive data)
    res.status(200).json({
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        availability_status: agent.availability_status,
        reputation_score: agent.reputation_score,
        rating_avg: agent.rating_avg,
        tasks_completed: agent.tasks_completed,
        total_earned: agent.total_earned,
        success_rate: agent.success_rate,
        skills: agent.skills || [],
        specializations: agent.specializations || [],
        created_at: agent.created_at,
      }
    });
  } catch (error) {
    logger.error('Failed to get agent', { error: error.message, agent_id: req.params.id });
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
 * GET /v1/agents/online
 * Get all online agents
 */
router.get('/online/list', async (req, res) => {
  try {
    const agents = await AgentOperations.getOnlineAgents();

    // Return simplified list
    const agentList = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      availability_status: agent.availability_status,
      skills: agent.skills || [],
    }));

    res.status(200).json({
      success: true,
      data: {
        agents: agentList,
        total: agentList.length
      }
    });
  } catch (error) {
    logger.error('Failed to get online agents', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch online agents'
      }
    });
  }
});


/**
 * POST /v1/agents/enroll-batch
 * Bulk enroll multiple NanoBot agents into Nervix marketplace
 */
router.post('/enroll-batch', async (req, res) => {
  try {
    const { agents } = req.body;

    if (!agents || !Array.isArray(agents)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'agents array is required'
        }
      });
    }

    const { supabase } = require('../services/supabaseService');
    const { v4: uuidv4 } = require('uuid');
    const enrolled = [];
    const errors = [];

    for (const agent of agents) {
      try {
        const agentId = agent.id || uuidv4();
        const newAgent = {
          id: agentId,
          name: agent.name,
          category: agent.category || 'unclassified',
          status: agent.status || 'online',
          availability_status: agent.availability_status || 'available',
          hourly_rate: agent.hourly_rate || 0.50,
          bio: agent.bio || 'Nanobot ' + agent.category + ' specialist - Ultra-lightweight AI worker',
          skills: agent.skills || [],
          specializations: agent.specializations || [agent.category],
          rating: 0,
          rating_avg: 0,
          total_tasks: 0,
          tasks_completed: 0,
          total_earned: 0,
          strikes: 0,
          reputation_score: agent.reputation_score || 50,
          success_rate: 0,
          max_concurrent: agent.max_concurrent || 3,
          verification_status: agent.verification_status || 'self-declared',
          api_key: agent.api_key || 'nbk_' + agentId.substring(0, 8),
          endpoint_url: agent.endpoint_url || 'ws://nano.nervix.ai/' + agentId.substring(0, 8),
          manifest: agent.manifest || 'nano-' + agent.category,
          type: agent.type || 'nanobot',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from('agents')
          .insert([newAgent])
          .select();

        if (error) {
          errors.push({
            agent: agent.name,
            error: error.message
          });
        } else {
          enrolled.push(data[0]);
        }
      } catch (err) {
        errors.push({
          agent: agent.name,
          error: err.message
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        enrolled: enrolled.length,
        errors: errors.length,
        agents: enrolled
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to enroll agents batch'
      }
    });
  }
});

module.exports = router;
