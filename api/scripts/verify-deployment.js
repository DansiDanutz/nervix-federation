#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Tests the full Nervix deployment end-to-end
 *
 * @version 1.0.0
 */

const http = require('http');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Configuration
const CONFIG = {
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  TIMEOUT_MS: 30000,
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Test results
const RESULTS = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Make HTTP request
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const startTime = Date.now();

    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body,
        duration: Date.now() - startTime,
      }));
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Run a test
 */
async function runTest(name, testFn) {
  RESULTS.total++;

  console.log(`\n${colors.blue}🧪 Testing: ${name}${colors.reset}`);

  try {
    const result = await testFn();
    RESULTS.passed++;

    console.log(`${colors.green}✅ PASSED${colors.reset} ${result.message || ''}`);
    RESULTS.tests.push({ name, passed: true, duration: result.duration || 0 });
  } catch (error) {
    RESULTS.failed++;

    console.log(`${colors.red}❌ FAILED${colors.reset} ${error.message}`);
    RESULTS.tests.push({ name, passed: false, error: error.message });
  }
}

/**
 * Test 1: Health Check
 */
async function testHealthCheck() {
  const response = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/health',
    method: 'GET',
  });

  if (response.statusCode !== 200) {
    throw new Error(`Health check returned ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  if (data.status !== 'healthy') {
    throw new Error('Health status is not healthy');
  }

  return { message: `Status: ${data.status}`, duration: response.duration };
}

/**
 * Test 2: API Root
 */
async function testApiRoot() {
  const response = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/v1',
    method: 'GET',
  });

  if (response.statusCode !== 200) {
    throw new Error(`API root returned ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  if (!data.message || !data.version) {
    throw new Error('Invalid API response');
  }

  return { message: `Version: ${data.version}`, duration: response.duration };
}

/**
 * Test 3: List Agents
 */
async function testListAgents() {
  const response = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/v1/agents',
    method: 'GET',
  });

  if (response.statusCode !== 200) {
    throw new Error(`List agents returned ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  if (!data.success || !Array.isArray(data.data.agents)) {
    throw new Error('Invalid agents response');
  }

  return { message: `Found ${data.data.agents.length} agents`, duration: response.duration };
}

/**
 * Test 4: List Available Tasks
 */
async function testListAvailableTasks() {
  const response = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/v1/tasks/available',
    method: 'GET',
  });

  if (response.statusCode !== 200) {
    throw new Error(`List available tasks returned ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  if (!Array.isArray(data)) {
    throw new Error('Invalid tasks response');
  }

  return { message: `Found ${data.length} available tasks`, duration: response.duration };
}

/**
 * Test 5: Create Task
 */
async function testCreateTask() {
  const taskData = {
    type: 'code-generation',
    priority: 'high',
    base_reward: 50.00,
    parameters: {
      prompt: 'Create a test function',
      language: 'javascript',
    },
    requirements: {
      tests: true,
    },
  };

  const response = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/v1/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });

  if (response.statusCode !== 201) {
    throw new Error(`Create task returned ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  if (!data.success || !data.data.id) {
    throw new Error('Invalid create task response');
  }

  return { message: `Task created: ${data.data.id}`, duration: response.duration };
}

/**
 * Test 6: Get Task Details
 */
async function testGetTaskDetails() {
  // First create a task
  const taskData = {
    type: 'code-generation',
    priority: 'medium',
    base_reward: 30.00,
    parameters: {
      prompt: 'Test task',
      language: 'javascript',
    },
  };

  const createResponse = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/v1/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });

  const createData = JSON.parse(createResponse.body);
  const taskId = createData.data.id;

  // Get task details
  const response = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: `/v1/tasks/${taskId}`,
    method: 'GET',
  });

  if (response.statusCode !== 200) {
    throw new Error(`Get task details returned ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  if (!data.success || data.data.id !== taskId) {
    throw new Error('Invalid task details response');
  }

  return { message: `Task retrieved: ${taskId}`, duration: response.duration };
}

/**
 * Test 7: Agent Enrollment
 */
async function testAgentEnrollment() {
  const enrollmentData = {
    agent_id: `test-agent-${uuidv4()}`,
    agent_name: 'Test Agent',
    agent_public_key: 'mock-public-key',
    agent_metadata: {
      endpoint_url: 'https://test-agent.nervix.ai',
      capabilities: ['coding'],
      skills: ['javascript'],
    },
  };

  const response = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/v1/enroll',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enrollmentData),
  });

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`Agent enrollment returned ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  if (!data.agent_id && !data.enrollment_id) {
    throw new Error('Invalid enrollment response');
  }

  return { message: `Enrollment started: ${data.agent_id || data.enrollment_id}`, duration: response.duration };
}

/**
 * Test 8: Metrics Endpoint
 */
async function testMetricsEndpoint() {
  const response = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/v1/metrics',
    method: 'GET',
  });

  if (response.statusCode !== 200) {
    throw new Error(`Metrics endpoint returned ${response.statusCode}`);
  }

  const data = JSON.parse(response.body);
  if (!data.success || !data.data) {
    throw new Error('Invalid metrics response');
  }

  return { message: 'Metrics retrieved', duration: response.duration };
}

/**
 * Test 9: Federation Registration
 */
async function testFederationRegistration() {
  const fedData = {
    federation_id: uuidv4(),
    federation_name: 'Test Federation',
    federation_public_key: 'mock-federation-key',
    endpoint_url: 'https://test-federation.nervix.ai',
  };

  const response = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/v1/federation/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fedData),
  });

  if (response.statusCode !== 201 && response.statusCode !== 200) {
    throw new Error(`Federation registration returned ${response.statusCode}`);
  }

  return { message: 'Federation registered', duration: response.duration };
}

/**
 * Test 10: Task Claim Flow
 */
async function testTaskClaimFlow() {
  // Create task
  const taskData = {
    type: 'code-generation',
    priority: 'low',
    base_reward: 25.00,
    parameters: {
      prompt: 'Claim test',
      language: 'javascript',
    },
  };

  const createResponse = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: '/v1/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });

  const createData = JSON.parse(createResponse.body);
  const taskId = createData.data.id;

  // Claim task
  const claimData = {
    agent_id: `test-agent-${uuidv4()}`,
  };

  const claimResponse = await makeRequest({
    hostname: new URL(CONFIG.BASE_URL).hostname,
    port: new URL(CONFIG.BASE_URL).port || 80,
    path: `/v1/tasks/${taskId}/claim`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(claimData),
  });

  if (claimResponse.statusCode !== 200) {
    throw new Error(`Task claim returned ${claimResponse.statusCode}`);
  }

  const claimResult = JSON.parse(claimResponse.body);
  if (!claimResult.success || !claimResult.data.assignment_token) {
    throw new Error('Invalid claim response');
  }

  return { message: `Task claimed: ${taskId}`, duration: createResponse.duration + claimResponse.duration };
}

/**
 * Print summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('DEPLOYMENT VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  console.log(`\nTotal Tests: ${RESULTS.total}`);
  console.log(`${colors.green}Passed: ${RESULTS.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${RESULTS.failed}${colors.reset}`);
  console.log(`Success Rate: ${((RESULTS.passed / RESULTS.total) * 100).toFixed(1)}%`);

  if (RESULTS.failed > 0) {
    console.log('\n' + colors.red + 'Failed Tests:' + colors.reset);
    console.log(''.padEnd(60, '-'));

    RESULTS.tests.filter(t => !t.passed).forEach(test => {
      console.log(`\n❌ ${test.name}`);
      console.log(`   ${test.error}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Nervix Deployment Verification');
  console.log('==================================');
  console.log(`Base URL: ${CONFIG.BASE_URL}`);
  console.log(`Timeout: ${CONFIG.TIMEOUT_MS}ms\n`);

  // Run all tests
  await runTest('Health Check', testHealthCheck);
  await runTest('API Root', testApiRoot);
  await runTest('List Agents', testListAgents);
  await runTest('List Available Tasks', testListAvailableTasks);
  await runTest('Create Task', testCreateTask);
  await runTest('Get Task Details', testGetTaskDetails);
  await runTest('Agent Enrollment', testAgentEnrollment);
  await runTest('Metrics Endpoint', testMetricsEndpoint);
  await runTest('Federation Registration', testFederationRegistration);
  await runTest('Task Claim Flow', testTaskClaimFlow);

  // Print summary
  printSummary();

  // Exit with error if any tests failed
  if (RESULTS.failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}❌ Fatal error:${colors.reset}`, error.message);
    process.exit(1);
  });
}

module.exports = {
  runTest,
  testHealthCheck,
  testApiRoot,
  testListAgents,
  testListAvailableTasks,
  testCreateTask,
  testGetTaskDetails,
  testAgentEnrollment,
  testMetricsEndpoint,
  testFederationRegistration,
  testTaskClaimFlow,
};
