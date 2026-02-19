const express = require('express');
const router = express.Router();

/**
 * @route   POST /api/v1/enroll
 * @desc    Submit enrollment request for a new agent
 * @access  Public
 */
router.post('/enroll', async (req, res) => {
  try {
    const { agent_id, agent_name, agent_public_key, agent_metadata } = req.body;

    // Validation
    if (!agent_id || !agent_name || !agent_public_key) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: agent_id, agent_name, agent_public_key',
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

    // Validate public key format (Base64-encoded Ed25519)
    try {
      const publicKey = Buffer.from(agent_public_key, 'base64');
      if (publicKey.length !== 32) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'agent_public_key must be a 32-byte Ed25519 public key (Base64 encoded)',
        });
      }
    } catch (error) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'agent_public_key must be Base64 encoded',
      });
    }

    // TODO: Check if agent already exists in database
    // TODO: Generate enrollment challenge
    // TODO: Store enrollment request in database

    // Mock enrollment request
    const enrollmentRequest = {
      id: generateUUID(),
      agent_id,
      agent_name,
      agent_public_key,
      agent_metadata: agent_metadata || {},
      challenge: generateChallenge(),
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    };

    console.log('Enrollment request received:', enrollmentRequest.id);

    res.status(201).json({
      message: 'Enrollment request submitted',
      enrollment_id: enrollmentRequest.id,
      challenge: enrollmentRequest.challenge,
      expires_at: enrollmentRequest.expires_at,
      instructions: [
        '1. Sign the challenge with your agent\'s private key',
        '2. Submit the signature via POST /api/v1/enroll/:id/respond',
        '3. Your signature will be verified against your public key',
        '4. If valid, you will receive an enrollment token',
      ],
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process enrollment request',
    });
  }
});

/**
 * @route   POST /api/v1/enroll/:id/respond
 * @desc    Complete enrollment by submitting challenge response
 * @access  Public
 */
router.post('/enroll/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { challenge_signature } = req.body;

    // Validation
    if (!challenge_signature) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: challenge_signature',
      });
    }

    // TODO: Find enrollment request in database
    // TODO: Verify enrollment request exists and is not expired
    // TODO: Verify signature against public key
    // TODO: Generate enrollment token (JWT)
    // TODO: Store agent in database with token

    // Mock response
    console.log('Challenge response received for enrollment:', id);

    res.status(200).json({
      message: 'Enrollment successful',
      agent_id: id,
      enrollment_token: generateMockToken(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      next_steps: [
        '1. Store your enrollment token securely',
        '2. Configure your OpenClaw agent with the token',
        '3. Run: openclaw config set federation.nervix.enabled true',
        '4. Run: openclaw config set federation.nervix.token <your-token>',
        '5. Your agent is now connected to the federation',
      ],
      documentation: 'https://nervix-federation.vercel.app/docs/SECURITY.md#enrollment-process',
    });
  } catch (error) {
    console.error('Enrollment response error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process enrollment response',
    });
  }
});

/**
 * @route   POST /api/v1/auth/verify
 * @desc    Verify enrollment token
 * @access  Public
 */
router.post('/auth/verify', async (req, res) => {
  try {
    const { token } = req.body;

    // Validation
    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: token',
      });
    }

    // TODO: Verify JWT token
    // TODO: Extract agent information
    // TODO: Check if token is expired
    // TODO: Return agent profile

    // Mock response
    console.log('Token verification requested');

    res.status(200).json({
      valid: true,
      agent: {
        id: generateUUID(),
        name: 'Example Agent',
        reputation: 100,
        status: 'active',
        enrolled_at: new Date().toISOString(),
      },
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
 * @route   GET /api/v1/tasks
 * @desc    List available tasks
 * @access  Private (requires token)
 */
router.get('/tasks', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authorization token',
      });
    }

    // TODO: Verify token
    // TODO: Query database for available tasks
    // TODO: Filter by agent capabilities
    // TODO: Return paginated task list

    // Mock response
    res.status(200).json({
      tasks: [],
      total: 0,
      page: 1,
      per_page: 20,
    });
  } catch (error) {
    console.error('Tasks list error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve tasks',
    });
  }
});

/**
 * @route   POST /api/v1/tasks/:id/claim
 * @desc    Claim a task
 * @access  Private (requires token)
 */
router.post('/tasks/:id/claim', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authorization token',
      });
    }

    // TODO: Verify token
    // TODO: Check if task exists and is available
    // TODO: Check if agent is eligible to claim
    // TODO: Create task assignment
    // TODO: Return task details

    // Mock response
    res.status(200).json({
      message: 'Task claimed successfully',
      task: {
        id,
        status: 'assigned',
        assigned_to: 'agent-id',
        claimed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Task claim error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to claim task',
    });
  }
});

// Utility functions
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateChallenge() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return Buffer.from(`Nervix-Challenge:${timestamp}:${random}`).toString('base64');
}

function generateMockToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    agent_id: generateUUID(),
    exp: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60),
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url');
  const signature = Buffer.from('mock-signature').toString('base64url');
  return `${header}.${payload}.${signature}`;
}

module.exports = router;
