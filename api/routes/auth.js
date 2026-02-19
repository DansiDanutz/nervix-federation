/**
 * Authentication Routes
 * API endpoints for agent authentication and enrollment
 *
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const crypto = require('crypto');

/**
 * @route   POST /api/v1/auth/enrollment-token
 * @desc    Generate enrollment token for new agent
 * @access  Public
 */
router.post('/enrollment-token', async (req, res) => {
  try {
    const { agent_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: agent_id',
      });
    }

    // Validate agent_id format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(agent_id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'agent_id must be a valid UUID v4',
      });
    }

    const tokenData = authService.generateEnrollmentToken(agent_id);

    res.status(200).json({
      message: 'Enrollment token generated',
      token: tokenData.token,
      type: tokenData.type,
      expires_in: tokenData.expires_in,
      expires_at: tokenData.expires_at,
    });
  } catch (error) {
    console.error('Enrollment token error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate enrollment token',
    });
  }
});

/**
 * @route   POST /api/v1/auth/verify
 * @desc    Verify agent token
 * @access  Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: token',
      });
    }

    const verification = authService.verifyAgentToken(token);

    if (!verification.valid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: verification.error,
        status: verification.status,
      });
    }

    res.status(200).json({
      valid: true,
      agent_id: verification.agent_id,
      decoded: verification.decoded,
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify token',
    });
  }
});

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh agent token
 * @access  Public
 */
router.post('/refresh', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: token',
      });
    }

    const newTokenData = authService.refreshAgentToken(token);

    if (!newTokenData) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    res.status(200).json({
      message: 'Token refreshed',
      token: newTokenData.token,
      type: newTokenData.type,
      expires_in: newTokenData.expires_in,
      expires_at: newTokenData.expires_at,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh token',
    });
  }
});

/**
 * @route   POST /api/v1/auth/revoke
 * @desc    Revoke agent token
 * @access  Public (or require auth in production)
 */
router.post('/revoke', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: token',
      });
    }

    const revoked = authService.revokeAgentToken(token);

    if (!revoked) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token or already revoked',
      });
    }

    res.status(200).json({
      message: 'Token revoked successfully',
    });
  } catch (error) {
    console.error('Token revoke error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to revoke token',
    });
  }
});

module.exports = router;
