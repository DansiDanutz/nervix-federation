/**
 * Enrollment Service
 * Handles agent enrollment with Ed25519 cryptographic challenge-response
 *
 * @version 1.0.0
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Helper functions for Ed25519 using Node's built-in crypto
const ed25519 = {
  generateKeyPair: () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    return {
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString('base64'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    };
  },
  sign: (message, privateKeyPem) => {
    const privateKey = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem', type: 'pkcs8' });
    const signature = crypto.sign(null, Buffer.from(message), privateKey);
    return signature;
  },
  verify: (message, signature, publicKeyBase64) => {
    try {
      const publicKeyPem = Buffer.from(publicKeyBase64, 'base64').toString('utf-8');
      const publicKey = crypto.createPublicKey({ key: publicKeyPem, format: 'pem', type: 'spki' });
      return crypto.verify(null, Buffer.from(message), publicKey, Buffer.from(signature));
    } catch (error) {
      return false;
    }
  },
};

// In-memory storage (replace with database in production)
const enrollments = new Map();
const agents = new Map();

/**
 * Generate a cryptographic challenge
 * @param {string} agentId - The agent ID
 * @returns {Object} Challenge data
 */
function generateChallenge(agentId) {
  const challenge = crypto.randomBytes(32).toString('base64');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const enrollment = {
    enrollmentId: uuidv4(),
    agentId,
    challenge,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString()
  };

  enrollments.set(enrollment.enrollmentId, enrollment);

  return enrollment;
}

/**
 * Verify challenge signature
 * @param {string} challenge - The challenge string (base64)
 * @param {string} signature - The signature (base64)
 * @param {string} publicKey - The agent's public key (base64)
 * @returns {boolean} True if signature is valid
 */
function verifySignature(challenge, signature, publicKey) {
  try {
    const challengeBuffer = Buffer.from(challenge, 'base64');
    const signatureBuffer = Buffer.from(signature, 'base64');
    return ed25519.verify(challengeBuffer, signatureBuffer, publicKey);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Complete enrollment
 * @param {string} enrollmentId - The enrollment ID
 * @param {string} agentId - The agent ID
 * @param {string} agentName - The agent name
 * @param {string} publicKey - The agent's public key
 * @param {Object} metadata - Agent metadata
 * @returns {Object} Enrollment completion data
 */
function completeEnrollment(enrollmentId, agentId, agentName, publicKey, metadata) {
  const enrollment = enrollments.get(enrollmentId);

  if (!enrollment) {
    throw new Error('Enrollment not found');
  }

  if (new Date(enrollment.expiresAt) < new Date()) {
    throw new Error('Enrollment expired');
  }

  if (enrollment.agentId !== agentId) {
    throw new Error('Agent ID mismatch');
  }

  // Check if agent already enrolled
  if (Array.from(agents.values()).find(agent => agent.agentId === agentId)) {
    throw new Error('Agent already enrolled');
  }

  // Create agent record
  const agent = {
    id: uuidv4(),
    agentId,
    agentName,
    publicKey,
    metadata,
    reputationScore: 50.0,
    reputationLevel: 'novice',
    totalTasksCompleted: 0,
    totalEarnings: 0.00,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  agents.set(agent.id, agent);

  // Generate JWT token (90 days)
  const token = jwt.sign(
    {
      agentId: agent.id,
      agentIdOriginal: agent.agentId,
      agentName: agent.agentName
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '90d' }
  );

  // Clean up enrollment
  enrollments.delete(enrollmentId);

  return {
    enrollmentId,
    agentId: agent.agentId,
    token,
    tokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    enrolledAt: new Date().toISOString()
  };
}

/**
 * Verify JWT token
 * @param {string} token - The JWT token
 * @returns {Object} Decoded token data
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Get agent by ID
 * @param {string} agentId - The agent's UUID
 * @returns {Object} Agent data
 */
function getAgent(agentId) {
  const agent = agents.get(agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }
  return agent;
}

/**
 * Get agent by original agent ID
 * @param {string} originalAgentId - The original agent ID from enrollment
 * @returns {Object} Agent data
 */
function getAgentByOriginalId(originalAgentId) {
  const agent = Array.from(agents.values()).find(a => a.agentId === originalAgentId);
  if (!agent) {
    throw new Error('Agent not found');
  }
  return agent;
}

module.exports = {
  generateChallenge,
  verifySignature,
  completeEnrollment,
  verifyToken,
  getAgent,
  getAgentByOriginalId
};
