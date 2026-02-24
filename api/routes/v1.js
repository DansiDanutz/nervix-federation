const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Insert agent into Supabase agents table via REST API.
 * @param {Object} payload - Agent data to insert
 * @returns {Promise<Object>} Inserted agent record
 * @throws {Error} If Supabase request fails
 */
async function supabaseInsertAgent(payload) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/agents`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const details =
      typeof data === 'string'
        ? data
        : data?.message || data?.error_description || data?.error || 'Unknown Supabase error';
    throw new Error(`Supabase insert failed (${response.status}): ${details}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Supabase insert returned no rows');
  }

  return data[0];
}

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

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Missing required Supabase configuration',
      });
    }

    // Generate challenge and timestamps
    const challenge = generateChallenge();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Insert into Supabase
    const insertedAgent = await supabaseInsertAgent({
      agent_id,
      agent_name,
      agent_public_key,
      agent_metadata: agent_metadata || {},
      challenge,
      status: 'pending',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    console.log('Enrollment request received:', insertedAgent.id);

    res.status(201).json({
      message: 'Enrollment request submitted',
      enrollment_id: insertedAgent.id,
      challenge: insertedAgent.challenge,
      expires_at: insertedAgent.expires_at,
      instructions: [
        '1. Sign the challenge with your agent\'s private key',
        '2. Submit the signature via POST /api/v1/enroll/:id/respond',
        '3. Your signature will be verified against your public key',
        '4. If valid, you will receive an enrollment token',
      ],
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    const isSupabaseError = error.message.includes('Supabase');
    res.status(isSupabaseError ? 502 : 500).json({
      error: isSupabaseError ? 'Bad Gateway' : 'Internal Server Error',
      message: isSupabaseError
        ? `Supabase enrollment failed: ${error.message}`
        : 'Failed to process enrollment request',
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
 * Build Supabase PostgREST URL for agents listing with search/filters/pagination.
 * @param {Object} options - Query options.
 * @param {string} [options.search] - Search string.
 * @param {string} [options.category] - Category filter.
 * @param {string} [options.status] - Status filter.
 * @param {string} [options.availabilityStatus] - Availability status filter.
 * @param {number} options.offset - Row offset.
 * @param {number} options.limit - Max rows to return.
 * @returns {string} Supabase REST URL.
 */
function buildAgentsSupabaseUrl({ search, category, status, availabilityStatus, offset, limit }) {
  const params = new URLSearchParams();
  // Updated to match real database schema (using 'id' not 'agent_id', 'name' not 'agent_name')
  params.set(
    'select',
    'id,name,reputation_score,rating_avg,tasks_completed,total_earned,success_rate,skills,specializations,created_at,updated_at,category,status,availability_status,bio'
  );

  if (category) params.set('category', `eq.${category}`);
  if (status) params.set('status', `eq.${status}`);
  if (availabilityStatus) params.set('availability_status', `eq.${availabilityStatus}`);

  if (search) {
    const escaped = search.replace(/,/g, '\\,');
    params.set(
      'or',
      `(name.ilike.*${escaped}*,skills.ilike.*${escaped}*,bio.ilike.*${escaped}*)`
    );
  }

  params.set('offset', String(offset));
  params.set('limit', String(limit));
  return `${process.env.SUPABASE_URL}/rest/v1/agents?${params.toString()}`;
}

/**
 * @route   GET /api/v1/agents
 * @desc    List agents with search, filters, and pagination
 * @access  Public
 */
router.get('/agents', async (req, res) => {
  try {
    const {
      search,
      category,
      status,
      availability_status: availabilityStatus,
      page: rawPage,
      limit: rawLimit,
      offset: rawOffset,
    } = req.query;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Missing required Supabase configuration',
      });
    }

    const page = rawPage === undefined ? DEFAULT_PAGE : Number(rawPage);
    const limit = rawLimit === undefined ? DEFAULT_LIMIT : Number(rawLimit);
    const offset = rawOffset === undefined ? (page - 1) * limit : Number(rawOffset);

    if (
      Number.isNaN(page) || Number.isNaN(limit) || Number.isNaN(offset) ||
      page < 1 || limit < 1 || limit > MAX_LIMIT || offset < 0
    ) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid pagination parameters. page >= 1, limit 1-100, offset >= 0',
      });
    }

    if (
      req.query.category === '' ||
      req.query.status === '' ||
      req.query.availability_status === '' ||
      req.query.search === ''
    ) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provided query parameters cannot be empty',
      });
    }

    const url = buildAgentsSupabaseUrl({
      search,
      category,
      status,
      availabilityStatus,
      offset,
      limit,
    });

    const supabaseResponse = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'count=exact',
      },
    });

    const text = await supabaseResponse.text();
    const agents = text ? JSON.parse(text) : [];

    if (!supabaseResponse.ok) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch agents from Supabase',
        details: agents,
      });
    }

    const contentRange = supabaseResponse.headers.get('content-range');
    const total = contentRange ? Number(contentRange.split('/')[1]) : agents.length;

    return res.status(200).json({
      agents,
      total,
      pagination: {
        page,
        limit,
        offset,
        total_pages: Math.ceil(total / limit),
        has_next: offset + limit < total,
        has_prev: offset > 0,
      },
    });
  } catch (error) {
    console.error('Agents list error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve agents',
    });
  }
});

// ============================================================================
// Federation API Routes
// ============================================================================

/**
 * Update agent in Supabase agents table via REST API.
 * @param {string} agentId - Agent ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated agent record
 * @throws {Error} If Supabase request fails
 */
async function supabaseUpdateAgent(agentId, updates) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}`; // Fixed: 'id' not 'agent_id'

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Supabase update failed (${response.status}): ${data?.message || data || 'Unknown error'}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Agent not found');
  }

  return data[0];
}

/**
 * Query agent from Supabase agents table via REST API.
 * @param {string} agentId - Agent ID
 * @returns {Promise<Object|null>} Agent record or null if not found
 */
async function supabaseGetAgent(agentId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}&limit=1`; // Fixed: 'id' not 'agent_id'

  const response = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  const text = await response.text();
  const agents = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(`Supabase query failed (${response.status}): ${agents?.message || agents || 'Unknown error'}`);
  }

  return agents.length > 0 ? agents[0] : null;
}

/**
 * Query multiple agents from Supabase agents table via REST API.
 * @param {Object} filters - Query filters
 * @param {number} limit - Maximum results
 * @param {number} offset - Pagination offset
 * @returns {Promise<{agents: Array, total: number}>}
 */
async function supabaseQueryAgents(filters = {}, limit = 20, offset = 0) {
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  for (const [key, value] of Object.entries(filters)) {
    params.set(key, `eq.${value}`);
  }

  const url = `${process.env.SUPABASE_URL}/rest/v1/agents?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'count=exact',
    },
  });

  const text = await response.text();
  const agents = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(`Supabase query failed (${response.status}): ${agents?.message || agents || 'Unknown error'}`);
  }

  const contentRange = response.headers.get('content-range');
  const total = contentRange ? Number(contentRange.split('/')[1]) : agents.length;

  return { agents, total };
}

/**
 * @route   POST /api/v1/federation/register
 * @desc    Agent registers its presence with the federation
 * @access  Public (requires agent_id from enrollment)
 */
router.post('/federation/register', async (req, res) => {
  try {
    const { agent_id, endpoint_url, capabilities, status, availability_status } = req.body;

    if (!agent_id || !endpoint_url) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: agent_id, endpoint_url',
      });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Missing required Supabase configuration',
      });
    }

    // Validate URL format
    try {
      new URL(endpoint_url);
    } catch {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'endpoint_url must be a valid URL',
      });
    }

    // Check if agent exists
    const existingAgent = await supabaseGetAgent(agentId);
    if (!existingAgent) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found. Please enroll first.',
      });
    }

    // Update agent with federation info
    const updatedAgent = await supabaseUpdateAgent(agentId, {
      agent_metadata: {
        ...existingAgent.agent_metadata,
        endpoint_url,
        capabilities: capabilities || [],
      },
      status: status || 'active',
      availability_status: availability_status || 'available',
    });

    console.log('Federation registration:', agent_id);

    res.status(200).json({
      message: 'Agent registered with federation',
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        endpoint_url: updatedAgent.endpoint_url,
        capabilities: updatedAgent.capabilities,
        status: updatedAgent.status,
        availability_status: updatedAgent.availability_status,
        registered_at: updatedAgent.updated_at,
      },
    });
  } catch (error) {
    console.error('Federation registration error:', error);
    const isSupabaseError = error.message.includes('Supabase');
    res.status(isSupabaseError ? 502 : 500).json({
      error: isSupabaseError ? 'Bad Gateway' : 'Internal Server Error',
      message: isSupabaseError ? error.message : 'Failed to register agent',
    });
  }
});

/**
 * @route   GET /api/v1/federation/agents
 * @desc    List all registered federation agents with filters
 * @access  Public
 */
router.get('/federation/agents', async (req, res) => {
  try {
    const {
      status,
      availability_status,
      category,
      page: rawPage,
      limit: rawLimit,
      offset: rawOffset,
    } = req.query;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Missing required Supabase configuration',
      });
    }

    const page = rawPage === undefined ? DEFAULT_PAGE : Number(rawPage);
    const limit = rawLimit === undefined ? DEFAULT_LIMIT : Number(rawLimit);
    const offset = rawOffset === undefined ? (page - 1) * limit : Number(rawOffset);

    if (
      Number.isNaN(page) || Number.isNaN(limit) || Number.isNaN(offset) ||
      page < 1 || limit < 1 || limit > MAX_LIMIT || offset < 0
    ) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid pagination parameters',
      });
    }

    // Build filters
    const filters = {};
    if (status) filters.status = status;
    if (availability_status) filters.availability_status = availability_status;
    if (category) filters.category = category;

    const { agents, total } = await supabaseQueryAgents(filters, limit, offset);

    // Filter for agents with endpoint_url (federation registered)
    const federationAgents = agents.filter(
      (agent) => agent.endpoint_url
    );

    res.status(200).json({
      agents: federationAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        endpoint_url: agent.endpoint_url,
        capabilities: agent.skills || [],
        status: agent.status,
        availability_status: agent.availability_status,
        reputation_score: agent.reputation_score,
        category: agent.category,
        last_seen: agent.updated_at,
      })),
      total: federationAgents.length,
      pagination: {
        page,
        limit,
        offset,
        total_pages: Math.ceil(total / limit),
        has_next: offset + limit < total,
        has_prev: offset > 0,
      },
    });
  } catch (error) {
    console.error('Federation agents list error:', error);
    const isSupabaseError = error.message.includes('Supabase');
    res.status(isSupabaseError ? 502 : 500).json({
      error: isSupabaseError ? 'Bad Gateway' : 'Internal Server Error',
      message: isSupabaseError ? error.message : 'Failed to retrieve federation agents',
    });
  }
});

/**
 * @route   GET /api/v1/federation/agents/:agentId
 * @desc    Get specific federation agent details
 * @access  Public
 */
router.get('/federation/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Missing required Supabase configuration',
      });
    }

    const agent = await supabaseGetAgent(agentId);

    if (!agent) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
    }

    if (!agent.agent_metadata?.endpoint_url) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent not registered with federation',
      });
    }

    res.status(200).json({
      agent: {
        id: agent.id,
        name: agent.name,
        endpoint_url: agent.endpoint_url,
        capabilities: agent.skills || [],
        status: agent.status,
        availability_status: agent.availability_status,
        reputation_score: agent.reputation_score,
        rating_avg: agent.rating_avg,
        tasks_completed: agent.tasks_completed,
        total_earned: agent.total_earned,
        category: agent.category,
        skills: agent.skills,
        bio: agent.bio,
        last_seen: agent.updated_at,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      },
    });
  } catch (error) {
    console.error('Federation agent get error:', error);
    const isSupabaseError = error.message.includes('Supabase');
    res.status(isSupabaseError ? 502 : 500).json({
      error: isSupabaseError ? 'Bad Gateway' : 'Internal Server Error',
      message: isSupabaseError ? error.message : 'Failed to retrieve agent',
    });
  }
});

/**
 * @route   POST /api/v1/federation/heartbeat
 * @desc    Agent sends heartbeat to update status and availability
 * @access  Public (requires agent_id)
 */
router.post('/federation/heartbeat', async (req, res) => {
  try {
    const { agent_id, status, availability_status, capabilities } = req.body;

    if (!agent_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: agent_id',
      });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Missing required Supabase configuration',
      });
    }

    const updates = {
      agent_metadata: {
        last_seen: new Date().toISOString(),
      },
    };

    if (status) updates.status = status;
    if (availability_status) updates.availability_status = availability_status;
    if (capabilities) updates.agent_metadata.capabilities = capabilities;

    const updatedAgent = await supabaseUpdateAgent(agent_id, updates);

    console.log('Federation heartbeat:', agent_id);

    res.status(200).json({
      message: 'Heartbeat received',
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        status: updatedAgent.status,
        availability_status: updatedAgent.availability_status,
        last_seen: updatedAgent.updated_at,
      },
    });
  } catch (error) {
    console.error('Federation heartbeat error:', error);
    const isSupabaseError = error.message.includes('Supabase');
    res.status(isSupabaseError ? 502 : 500).json({
      error: isSupabaseError ? 'Bad Gateway' : 'Internal Server Error',
      message: isSupabaseError ? error.message : 'Failed to process heartbeat',
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

/**
 * Generate a challenge using current timestamp + cryptographic random bytes.
 * @returns {string} Base64 encoded challenge string.
 */
function generateChallenge() {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
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
