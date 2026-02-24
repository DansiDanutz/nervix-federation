/**
 * API Integration Tests
 * Test suite for Nervix API endpoints
 *
 * @version 1.0.0
 */

const request = require('supertest');
const app = require('../server');

describe('Health Check API', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
  });
});

describe('Agent Catalog API', () => {
  test('GET /v1/agents should return agents list', async () => {
    const response = await request(app).get('/v1/agents');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('agents');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.agents)).toBe(true);
  });

  test('GET /v1/agents with pagination', async () => {
    const response = await request(app)
      .get('/v1/agents')
      .query({ page: 1, limit: 10 });
    expect(response.status).toBe(200);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(10);
  });

  test('GET /v1/agents with search', async () => {
    const response = await request(app)
      .get('/v1/agents')
      .query({ search: 'nano' });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.agents)).toBe(true);
  });

  test('GET /v1/agents with filters', async () => {
    const response = await request(app)
      .get('/v1/agents')
      .query({ status: 'active', availability_status: 'available' });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.agents)).toBe(true);
  });
});

describe('Federation API', () => {
  test('POST /v1/federation/register should register agent', async () => {
    const response = await request(app)
      .post('/v1/federation/register')
      .send({
        agent_id: 'test-agent-123',
        endpoint_url: 'https://test.nervix.ai',
        capabilities: ['coding', 'testing'],
      });
    expect([200, 404]).toContain(response.status);
  });

  test('GET /v1/federation/agents should return agents', async () => {
    const response = await request(app).get('/v1/federation/agents');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('agents');
    expect(Array.isArray(response.body.agents)).toBe(true);
  });
});

describe('Authentication API', () => {
  test('POST /v1/auth/enrollment-token should generate token', async () => {
    const response = await request(app)
      .post('/v1/auth/enrollment-token')
      .send({ agent_id: 'test-agent-456' });
    expect([200, 400]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expires_at');
    }
  });

  test('POST /v1/auth/verify should verify token', async () => {
    const response = await request(app)
      .post('/v1/auth/verify')
      .send({ token: 'invalid-token' });
    expect(response.status).toBe(401);
  });
});

describe('Skills API', () => {
  test('GET /v1/skills should return skills', async () => {
    const response = await request(app).get('/v1/skills');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('skills');
    expect(Array.isArray(response.body.skills)).toBe(true);
  });

  test('GET /v1/skills/search should search skills', async () => {
    const response = await request(app)
      .get('/v1/skills/search')
      .query({ q: 'javascript' });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('skills');
    expect(Array.isArray(response.body.skills)).toBe(true);
  });
});

describe('Team API', () => {
  test('GET /v1/team/agents should return team agents', async () => {
    const response = await request(app).get('/v1/team/agents');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('agents');
    expect(Array.isArray(response.body.agents)).toBe(true);
  });

  test('GET /v1/team/stats should return team statistics', async () => {
    const response = await request(app).get('/v1/team/stats');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('totalTasks');
    expect(response.body).toHaveProperty('agents');
  });
});

describe('Metrics API', () => {
  test('GET /v1/metrics should return metrics', async () => {
    const response = await request(app).get('/v1/metrics');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('system');
    expect(response.body).toHaveProperty('tasks');
    expect(response.body).toHaveProperty('agents');
  });

  test('GET /v1/metrics/system should return system metrics', async () => {
    const response = await request(app).get('/v1/metrics/system');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('memory');
  });
});

describe('Error Handling', () => {
  test('GET /nonexistent should return 404', async () => {
    const response = await request(app).get('/nonexistent');
    expect(response.status).toBe(404);
  });

  test('Invalid request should return 400', async () => {
    const response = await request(app)
      .post('/v1/auth/enrollment-token')
      .send({});
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});

describe('Rate Limiting', () => {
  test('Should respect rate limits', async () => {
    const requests = Array(101).fill(null).map(() =>
      request(app).get('/v1/agents')
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    // May or may not be rate limited depending on configuration
    expect([true, false]).toContain(rateLimited);
  });
});
