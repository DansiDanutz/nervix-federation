/**
 * Authentication Service
 * JWT-based authentication for Nervix agents
 *
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Token Types
const TokenType = {
  ENROLLMENT: 'enrollment',
  AGENT: 'agent',
  API: 'api',
  REFRESH: 'refresh',
};

// Token Status
const TokenStatus = {
  VALID: 'valid',
  EXPIRED: 'expired',
  INVALID: 'invalid',
  REVOKED: 'revoked',
};

/**
 * Token Manager
 */
class TokenManager {
  constructor() {
    this.secret = process.env.JWT_SECRET || 'change-this-secret-in-production';
    this.tokens = new Map(); // Token blacklist/revocation tracking
  }

  /**
   * Generate JWT token
   * @param {Object} payload - Token payload
   * @param {string} type - Token type
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {string} JWT token
   */
  generateToken(payload, type, expiresIn) {
    const tokenPayload = {
      ...payload,
      type,
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(tokenPayload, this.secret, {
      expiresIn,
      algorithm: 'HS256',
    });

    return token;
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object>} Decoded token or null
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret);

      // Check if token is revoked
      if (this.tokens.has(token)) {
        return {
          status: TokenStatus.REVOKED,
          decoded: null,
        };
      }

      return {
        status: TokenStatus.VALID,
        decoded,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          status: TokenStatus.EXPIRED,
          decoded: jwt.decode(token),
          error: error.message,
        };
      }

      return {
        status: TokenStatus.INVALID,
        decoded: null,
        error: error.message,
      };
    }
  }

  /**
   * Revoke token
   * @param {string} token - JWT token
   * @returns {boolean} Success
   */
  revokeToken(token) {
    const verification = this.verifyToken(token);

    if (verification.status === TokenStatus.VALID) {
      this.tokens.set(token, {
        revokedAt: Date.now(),
        expiresAt: verification.decoded.exp * 1000,
      });
      return true;
    }

    return false;
  }

  /**
   * Clean up expired revoked tokens
   * @returns {number} Number of tokens cleaned
   */
  cleanupRevokedTokens() {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, data] of this.tokens) {
      if (data.expiresAt < now) {
        this.tokens.delete(token);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Authentication Service
 */
class AuthService {
  constructor() {
    this.tokenManager = new TokenManager();

    // Clean up revoked tokens every hour
    setInterval(() => {
      this.tokenManager.cleanupRevokedTokens();
    }, 3600000);
  }

  /**
   * Generate enrollment token
   * @param {string} agentId - Agent ID
   * @returns {Object>} Token data or null
   */
  generateEnrollmentToken(agentId) {
    const payload = {
      agent_id: agentId,
      type: TokenType.ENROLLMENT,
    };

    const token = this.tokenManager.generateToken(payload, TokenType.ENROLLMENT, 15 * 60); // 15 minutes

    return {
      token,
      type: TokenType.ENROLLMENT,
      expires_in: 15 * 60,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Generate agent token
   * @param {string} agentId - Agent ID
   * @param {number} duration - Duration in days (default 90)
   * @returns {Object>} Token data or null
   */
  generateAgentToken(agentId, duration = 90) {
    const payload = {
      agent_id: agentId,
      type: TokenType.AGENT,
    };

    const token = this.tokenManager.generateToken(
      payload,
      TokenType.AGENT,
      duration * 24 * 60 * 60
    );

    return {
      token,
      type: TokenType.AGENT,
      expires_in: duration * 24 * 60 * 60,
      expires_at: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Verify agent token
   * @param {string} token - JWT token
   * @returns {Object>} Verification result
   */
  verifyAgentToken(token) {
    const verification = this.tokenManager.verifyToken(token);

    if (verification.status === TokenStatus.VALID) {
      const { decoded } = verification;

      if (decoded.type !== TokenType.AGENT) {
        return {
          valid: false,
          status: TokenStatus.INVALID,
          error: 'Invalid token type',
        };
      }

      return {
        valid: true,
        agent_id: decoded.agent_id,
        decoded,
      };
    }

    return {
      valid: false,
      status: verification.status,
      error: verification.error || 'Invalid token',
    };
  }

  /**
   * Verify enrollment token
   * @param {string} token - JWT token
   * @returns {Object>} Verification result
   */
  verifyEnrollmentToken(token) {
    const verification = this.tokenManager.verifyToken(token);

    if (verification.status === TokenStatus.VALID) {
      const { decoded } = verification;

      if (decoded.type !== TokenType.ENROLLMENT) {
        return {
          valid: false,
          status: TokenStatus.INVALID,
          error: 'Invalid token type',
        };
      }

      return {
        valid: true,
        agent_id: decoded.agent_id,
        decoded,
      };
    }

    return {
      valid: false,
      status: verification.status,
      error: verification.error || 'Invalid token',
    };
  }

  /**
   * Revoke agent token
   * @param {string} token - JWT token
   * @returns {boolean} Success
   */
  revokeAgentToken(token) {
    return this.tokenManager.revokeToken(token);
  }

  /**
   * Refresh agent token
   * @param {string} token - Current token
   * @returns {Object>} New token data or null
   */
  refreshAgentToken(token) {
    const verification = this.verifyAgentToken(token);

    if (verification.valid) {
      const { agent_id } = verification;

      // Revoke old token
      this.revokeAgentToken(token);

      // Generate new token
      return this.generateAgentToken(agent_id);
    }

    return null;
  }

  /**
   * Middleware to verify agent token
   * @returns {Function} Express middleware
   */
  authenticateAgent() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const verification = this.verifyAgentToken(token);

      if (!verification.valid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: verification.error,
          status: verification.status,
        });
      }

      req.agent = {
        id: verification.agent_id,
        token,
        decoded: verification.decoded,
      };

      next();
    };
  }

  /**
   * Middleware to verify enrollment token
   * @returns {Function} Express middleware
   */
  authenticateEnrollment() {
    return (req, res, next) => {
      const { token } = req.body;

      if (!token) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing token',
        });
      }

      const verification = this.verifyEnrollmentToken(token);

      if (!verification.valid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: verification.error,
          status: verification.status,
        });
      }

      req.enrollment = {
        agent_id: verification.agent_id,
        token,
        decoded: verification.decoded,
      };

      next();
    };
  }
}

// Singleton instance
const authService = new AuthService();

module.exports = {
  TokenType,
  TokenStatus,
  TokenManager,
  AuthService,
  authService,
};
