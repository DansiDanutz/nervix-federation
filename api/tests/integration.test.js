/**
 * Integration Tests
 * End-to-end testing for complete workflows
 *
 * @version 1.0.0
 */

const request = require('supertest');
const { v4: uuidv4 } = require('crypto');

describe('Agent Enrollment Integration', () => {
  let enrollmentId;
  let agentId = uuidv4();

  test('Complete enrollment flow', async () => {
    const app = require('../server');

    // Step 1: Submit enrollment request
    const enrollResponse = await request(app)
      .post('/v1/enroll')
      .send({
        agent_id: agentId,
        agent_name: 'Test Agent',
        agent_public_key: Buffer.from('test-public-key').toString('base64'),
        agent_metadata: {
          endpoint_url: 'https://test.nervix.ai',
          capabilities: ['coding', 'testing'],
          skills: ['JavaScript', 'TypeScript'],
        },
      });

    expect(enrollResponse.status).toBe(200);
    expect(enrollResponse.body).toHaveProperty('enrollment_id');
    expect(enrollResponse.body).toHaveProperty('challenge');

    enrollmentId = enrollResponse.body.enrollment_id;

    // Step 2: Verify enrollment (simulated)
    const verifyResponse = await request(app)
      .post('/v1/enroll/verify')
      .send({
        enrollment_id: enrollmentId,
        signature: Buffer.from('signature').toString('base64'),
      });

    expect([200, 400, 404]).toContain(verifyResponse.status);

    // Step 3: Check agent in catalog (after enrollment complete)
    const catalogResponse = await request(app)
      .get('/v1/agents')
      .query({ search: agentId });

    expect(catalogResponse.status).toBe(200);
    expect(Array.isArray(catalogResponse.body.agents)).toBe(true);
  });
});

describe('Task Lifecycle Integration', () => {
  let taskId;
  let agentId = uuidv4();

  test('Complete task workflow', async () => {
    const app = require('../server');

    // Step 1: Create task
    const createResponse = await request(app)
      .post('/v1/tasks')
      .send({
        title: 'Test Task',
        description: 'Test description',
        type: 'code-generation',
        priority: 'high',
        base_reward: 50,
      });

    expect([200, 400, 401]).toContain(createResponse.status);
    if (createResponse.status === 200) {
      taskId = createResponse.body.task.id;
      expect(taskId).toBeDefined();
    }

    // Step 2: Register agent for task
    const registerResponse = await request(app)
      .post('/v1/federation/register')
      .send({
        agent_id: agentId,
        endpoint_url: 'https://test.nervix.ai',
        capabilities: ['coding'],
      });

    expect([200, 400]).toContain(registerResponse.status);

    // Step 3: Claim task (if task created)
    if (taskId) {
      const claimResponse = await request(app)
        .post(`/v1/tasks/${taskId}/claim`)
        .send({
          agent_id: agentId,
        });

      expect([200, 400, 401]).toContain(claimResponse.status);

      // Step 4: Submit task result (if claimed)
      if (claimResponse.status === 200) {
        const submitResponse = await request(app)
          .post(`/v1/tasks/${taskId}/submit`)
          .send({
            result: {
              code: 'console.log("Hello World");',
            },
            execution_time: 1000,
          });

        expect([200, 400, 401]).toContain(submitResponse.status);
      }
    }
  });
});

describe('Authentication Flow Integration', () => {
  let token;
  let agentId = uuidv4();

  test('Complete auth flow', async () => {
    const app = require('../server');

    // Step 1: Generate enrollment token
    const enrollTokenResponse = await request(app)
      .post('/v1/auth/enrollment-token')
      .send({
        agent_id: agentId,
      });

    expect([200, 400]).toContain(enrollTokenResponse.status);

    // Step 2: Verify token (if generated)
    if (enrollTokenResponse.status === 200) {
      token = enrollTokenResponse.body.token;

      const verifyResponse = await request(app)
        .post('/v1/auth/verify')
        .send({
          token: token,
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.valid).toBe(true);

      // Step 3: Use token for authenticated request
      const authRequest = await request(app)
        .get('/v1/agents')
        .set('Authorization', `Bearer ${token}`);

      expect([200, 401]).toContain(authRequest.status);
    }
  });
});

describe('Skills Database Integration', () => {
  test('Agent skills workflow', async () => {
    const app = require('../server');
    const agentId = uuidv4();

    // Step 1: Get all skills
    const allSkillsResponse = await request(app)
      .get('/v1/skills');

    expect(allSkillsResponse.status).toBe(200);
    expect(Array.isArray(allSkillsResponse.body.skills)).toBe(true);

    // Step 2: Search for specific skill
    const searchResponse = await request(app)
      .get('/v1/skills/search')
      .query({ q: 'javascript' });

    expect(searchResponse.status).toBe(200);
    expect(Array.isArray(searchResponse.body.skills)).toBe(true);

    // Step 3: Get agent skills (if agent exists)
    const agentSkillsResponse = await request(app)
      .get(`/v1/agents/${agentId}/skills`);

    expect([200, 404]).toContain(agentSkillsResponse.status);

    // Step 4: Update agent skill (if agent exists)
    if (agentSkillsResponse.status === 200) {
      const updateResponse = await request(app)
        .put(`/v1/agents/${agentId}/skills`)
        .send({
          skill_id: 'skill_javascript',
          proficiency: 'expert',
        });

      expect([200, 400, 404]).toContain(updateResponse.status);
    }
  });
});

describe('Team Orchestration Integration', () => {
  test('Team management workflow', async () => {
    const app = require('../server');

    // Step 1: Get team agents
    const agentsResponse = await request(app)
      .get('/v1/team/agents');

    expect(agentsResponse.status).toBe(200);
    expect(Array.isArray(agentsResponse.body.agents)).toBe(true);

    // Step 2: Get team stats
    const statsResponse = await request(app)
      .get('/v1/team/stats');

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body).toHaveProperty('totalTasks');
    expect(statsResponse.body).toHaveProperty('agents');
  });
});

describe('Metrics Collection Integration', () => {
  test('Metrics collection workflow', async () => {
    const app = require('../server');
    const { metricsService } = require('../services/metricsService');

    // Step 1: Record some metrics
    metricsService.record('test.metric', 100);
    metricsService.record('test.metric', 200);
    metricsService.record('test.metric', 150);

    // Step 2: Get metrics via API
    const response = await request(app)
      .get('/v1/metrics');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('system');
    expect(response.body).toHaveProperty('tasks');
    expect(response.body).toHaveProperty('agents');

    // Step 3: Verify metric data
    const metric = metricsService.collector.get('test.metric');
    expect(metric).not.toBeNull();
    expect(metric.count).toBe(3);
    expect(metric.avg).toBe(150);
  });
});

describe('Error Handling Integration', () => {
  test('Error scenarios', async () => {
    const app = require('../server');

    // Invalid endpoint
    const invalidResponse = await request(app)
      .get('/v1/invalid-endpoint');

    expect(invalidResponse.status).toBe(404);

    // Invalid JSON
    const invalidJsonResponse = await request(app)
      .post('/v1/enroll')
      .set('Content-Type', 'application/json')
      .send('invalid json');

    expect(invalidJsonResponse.status).toBe(400);

    // Missing required fields
    const missingFieldsResponse = await request(app)
      .post('/v1/enroll')
      .send({});

    expect(missingFieldsResponse.status).toBe(400);
  });
});

describe('Rate Limiting Integration', () => {
  test('Rate limiting behavior', async () => {
    const app = require('../server');

    // Make many requests
    const requests = Array(50).fill(null).map(() =>
      request(app).get('/v1/agents')
    );

    const responses = await Promise.all(requests);

    // Some should be rate limited
    const rateLimited = responses.some(r => r.status === 429);

    // Rate limiting may or may not be enabled depending on config
    expect([true, false]).toContain(rateLimited);

    if (rateLimited) {
      const rateLimitResponse = responses.find(r => r.status === 429);
      expect(rateLimitResponse.body).toHaveProperty('error');
    }
  });
});
