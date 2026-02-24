/**
 * Enrollment Routes
 * API endpoints for agent enrollment
 *
 * @version 1.0.0
 */

const express = require('express');
const Joi = require('joi');
const enrollmentService = require('../services/enrollmentService');

const router = express.Router();

/**
 * Validation schemas
 */
const enrollSchema = Joi.object({
  agent_id: Joi.string().uuid().required(),
  agent_name: Joi.string().min(1).max(255).required(),
  agent_public_key: Joi.string().base64().required(),
  agent_metadata: Joi.object({
    version: Joi.string(),
    capabilities: Joi.array().items(Joi.string()),
    description: Joi.string()
  }).optional()
});

const respondSchema = Joi.object({
  challenge_signature: Joi.string().base64().required()
});

/**
 * POST /v1/enroll
 * Submit enrollment request
 */
router.post('/', (req, res) => {
  try {
    // Validate request body
    const { error, value } = enrollSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.details[0].message
        }
      });
    }

    const { agent_id, agent_name, agent_public_key, agent_metadata } = value;

    // Check if agent already enrolled
    try {
      enrollmentService.getAgentByOriginalId(agent_id);
      return res.status(400).json({
        success: false,
        error: {
          code: 'AGENT_ALREADY_ENROLLED',
          message: 'Agent is already enrolled'
        }
      });
    } catch (error) {
      // Agent not enrolled, continue
    }

    // Generate challenge
    const enrollment = enrollmentService.generateChallenge(agent_id);

    res.status(200).json({
      success: true,
      data: {
        enrollment_id: enrollment.enrollmentId,
        agent_id: enrollment.agentId,
        challenge: enrollment.challenge,
        challenge_expires_at: enrollment.expiresAt,
        created_at: enrollment.createdAt
      }
    });
  } catch (error) {
    console.error('Enrollment error:', error);
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
 * POST /v1/enroll/:id/respond
 * Complete enrollment challenge-response
 */
router.post('/:id/respond', (req, res) => {
  try {
    const { id } = req.params;

    // Validate request body
    const { error, value } = respondSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.details[0].message
        }
      });
    }

    const { challenge_signature } = value;

    // TODO: Retrieve enrollment data from database
    // For now, we'll use a simplified approach
    // In production, store enrollment data with agent details

    // For demo purposes, we'll complete enrollment directly
    // In production, verify signature first
    const result = enrollmentService.completeEnrollment(
      id,
      'demo-agent-id',
      'Demo Agent',
      'demo-public-key',
      {}
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Enrollment response error:', error);

    if (error.message === 'Enrollment not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ENROLLMENT_NOT_FOUND',
          message: 'Enrollment not found or expired'
        }
      });
    }

    if (error.message === 'Enrollment expired') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ENROLLMENT_EXPIRED',
          message: 'Enrollment has expired'
        }
      });
    }

    if (error.message === 'Agent already enrolled') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ENROLLMENT_ALREADY_COMPLETED',
          message: 'Enrollment has already been completed'
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
 * GET /v1/auth/verify
 * Verify enrollment token
 */
router.get('/auth/verify', (req, res) => {
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

    // Verify token
    const decoded = enrollmentService.verifyToken(token);

    // Get agent details
    const agent = enrollmentService.getAgent(decoded.agentId);

    res.status(200).json({
      success: true,
      data: {
        agent_id: agent.agentId,
        agent_name: agent.agentName,
        reputation_score: agent.reputationScore,
        reputation_level: agent.reputationLevel,
        token_expires_at: decoded.exp
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);

    if (error.message === 'Invalid or expired token') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

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
