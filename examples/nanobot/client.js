#!/usr/bin/env node

/**
 * Nervix Nanobot Polling Client
 * Connects to Nervix Federation and polls for tasks
 *
 * @version 1.0.0
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// Configuration
const CONFIG = {
  NERVIX_FEDERATION_URL: process.env.NERVIX_FEDERATION_URL || 'http://localhost:3000',
  NERVIX_WS_URL: process.env.NERVIX_WS_URL || 'ws://localhost:3001/ws',
  AGENT_ID: process.env.AGENT_ID || generateAgentId(),
  AGENT_TOKEN: process.env.AGENT_TOKEN || '',
  POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL) || 10000,
  MAX_CONCURRENT_TASKS: parseInt(process.env.MAX_CONCURRENT_TASKS) || 3,
  AGENT_NAME: process.env.AGENT_NAME || 'Nano Bot',
  AGENT_SKILLS: (process.env.AGENT_SKILLS || 'javascript,typescript,python').split(','),
};

// State
let activeTasks = new Map();
let isRunning = false;
let wsConnection = null;

// Generate agent ID
function generateAgentId() {
  return `agent-${uuidv4()}`;
}

// Generate ED25519 key pair
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// Agent registration
async function registerAgent() {
  try {
    console.log('🤖 Registering agent with Nervix Federation...');

    const keyPair = generateKeyPair();

    const response = await fetch(`${CONFIG.NERVIX_FEDERATION_URL}/v1/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: CONFIG.AGENT_ID,
        agent_name: CONFIG.AGENT_NAME,
        agent_public_key: keyPair.publicKey,
        agent_metadata: {
          endpoint_url: `${CONFIG.NERVIX_FEDERATION_URL}/agents/${CONFIG.AGENT_ID}`,
          capabilities: ['code-generation', 'testing', 'documentation'],
          skills: CONFIG.AGENT_SKILLS,
          max_concurrent_tasks: CONFIG.MAX_CONCURRENT_TASKS,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Registration failed: ${data.message || data.error}`);
    }

    console.log('✅ Agent registered:', data.agent_id);
    console.log('📋 Enrollment challenge received, completing enrollment...');

    // Sign challenge
    const challenge = Buffer.from(data.challenge, 'base64');
    const privateKey = crypto.createPrivateKey({ key: keyPair.privateKey, format: 'pem', type: 'pkcs8' });
    const signature = crypto.sign(null, challenge, privateKey);

    // Complete enrollment
    const completeResponse = await fetch(`${CONFIG.NERVIX_FEDERATION_URL}/v1/enroll/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enrollment_id: data.enrollment_id,
        signature: signature.toString('base64'),
      }),
    });

    const completeData = await completeResponse.json();

    if (!completeResponse.ok) {
      throw new Error(`Enrollment completion failed: ${completeData.message || completeData.error}`);
    }

    console.log('✅ Enrollment complete!');
    console.log('🔑 Agent token received');

    return completeData.agent_token;
  } catch (error) {
    console.error('❌ Agent registration failed:', error.message);
    throw error;
  }
}

// Poll for available tasks
async function pollForTasks() {
  try {
    if (activeTasks.size >= CONFIG.MAX_CONCURRENT_TASKS) {
      console.log(`⏳ Max concurrent tasks reached (${activeTasks.size})`);
      return;
    }

    console.log('🔍 Polling for tasks...');

    const response = await fetch(`${CONFIG.NERVIX_FEDERATION_URL}/v1/tasks/available`, {
      headers: {
        'Authorization': `Bearer ${CONFIG.AGENT_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Task poll failed: ${response.status}`);
    }

    const tasks = await response.json();

    if (!tasks || tasks.length === 0) {
      console.log('📭 No tasks available');
      return;
    }

    console.log(`📥 Found ${tasks.length} available tasks`);

    for (const task of tasks) {
      if (activeTasks.size >= CONFIG.MAX_CONCURRENT_TASKS) break;

      await processTask(task);
    }
  } catch (error) {
    console.error('❌ Task poll failed:', error.message);
  }
}

// Process a task
async function processTask(task) {
  try {
    console.log(`📋 Processing task ${task.id}: ${task.type}`);

    // Claim task
    const claimResponse = await fetch(
      `${CONFIG.NERVIX_FEDERATION_URL}/v1/tasks/${task.id}/claim`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.AGENT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: CONFIG.AGENT_ID,
        }),
      }
    );

    const claimData = await claimResponse.json();

    if (!claimResponse.ok) {
      throw new Error(`Task claim failed: ${claimData.message || claimData.error}`);
    }

    console.log(`✅ Task ${task.id} claimed`);

    // Track task
    activeTasks.set(task.id, {
      task,
      assignmentToken: claimData.assignment_token,
      startedAt: Date.now(),
    });

    // Execute task
    executeTask(task, claimData.assignment_token);
  } catch (error) {
    console.error(`❌ Task ${task.id} claim failed:`, error.message);
  }
}

// Execute a task
async function executeTask(task, assignmentToken) {
  const startTime = Date.now();

  try {
    console.log(`⚙️ Executing task ${task.id}: ${task.type}`);

    let result;

    switch (task.type) {
      case 'code-generation':
        result = await executeCodeGeneration(task);
        break;
      case 'code-review':
        result = await executeCodeReview(task);
        break;
      case 'testing':
        result = await executeTesting(task);
        break;
      case 'documentation':
        result = await executeDocumentation(task);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ Task ${task.id} completed in ${executionTime}ms`);

    // Submit result
    await submitResult(task.id, assignmentToken, result, executionTime);

    // Remove from active tasks
    activeTasks.delete(task.id);
  } catch (error) {
    console.error(`❌ Task ${task.id} execution failed:`, error.message);

    // Remove from active tasks
    activeTasks.delete(task.id);
  }
}

// Execute code generation task
async function executeCodeGeneration(task) {
  const { prompt, language, framework, requirements } = task.parameters;

  console.log(`  📝 Prompt: ${prompt.substring(0, 100)}...`);
  console.log(`  🌐 Language: ${language}`);
  console.log(`  📦 Framework: ${framework}`);

  // Simulate code generation (replace with real AI call)
  await sleep(2000);

  const code = generateMockCode(language, framework, prompt);

  // Run tests if required
  let testResults = null;
  if (requirements?.tests) {
    testResults = await runTests(code, language);
  }

  return {
    code,
    test_results: testResults,
    language,
    framework,
    metadata: {
      generated_at: new Date().toISOString(),
      lines_of_code: code.split('\n').length,
    },
  };
}

// Execute code review task
async function executeCodeReview(task) {
  const { code_url, review_criteria } = task.parameters;

  console.log(`  🔍 Reviewing code from: ${code_url}`);
  console.log(`  📋 Criteria: ${review_criteria.join(', ')}`);

  // Simulate code review
  await sleep(1500);

  return {
    review_id: uuidv4(),
    findings: [
      {
        severity: 'low',
        line: 42,
        message: 'Consider using const instead of let',
        suggestion: 'Replace let with const for immutable variables',
      },
      {
        severity: 'medium',
        line: 87,
        message: 'Missing error handling',
        suggestion: 'Add try-catch block for async operations',
      },
    ],
    summary: {
      critical: 0,
      high: 0,
      medium: 1,
      low: 1,
      info: 0,
    },
  };
}

// Execute testing task
async function executeTesting(task) {
  const { code, test_framework, coverage_target } = task.parameters;

  console.log(`  🧪 Running tests`);
  console.log(`  📦 Framework: ${test_framework}`);
  console.log(`  📊 Coverage target: ${coverage_target}%`);

  // Simulate testing
  await sleep(3000);

  return {
    test_results: {
      total: 42,
      passed: 40,
      failed: 2,
      skipped: 0,
      coverage: coverage_target - 5,
    },
    failed_tests: [
      {
        name: 'should handle edge case',
        error: 'Expected true, got false',
        line: 123,
      },
    ],
  };
}

// Execute documentation task
async function executeDocumentation(task) {
  const { subject, format, target_audience } = task.parameters;

  console.log(`  📚 Writing documentation`);
  console.log(`  📋 Subject: ${subject}`);
  console.log(`  📄 Format: ${format}`);
  console.log(`  👥 Target audience: ${target_audience}`);

  // Simulate documentation
  await sleep(1000);

  return {
    documentation: generateMockDocumentation(subject, format, target_audience),
    metadata: {
      format,
      target_audience,
      word_count: Math.floor(Math.random() * 500) + 200,
    },
  };
}

// Submit task result
async function submitResult(taskId, assignmentToken, result, executionTime) {
  try {
    const response = await fetch(
      `${CONFIG.NERVIX_FEDERATION_URL}/v1/tasks/${taskId}/submit`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.AGENT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignment_token: assignmentToken,
          result,
          execution_time: executionTime,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Result submission failed: ${data.message || data.error}`);
    }

    console.log(`✅ Task ${taskId} result submitted`);
    console.log(`💰 Reward earned: ${data.reward || 0}`);

    return data;
  } catch (error) {
    console.error(`❌ Result submission failed:`, error.message);
    throw error;
  }
}

// WebSocket connection for real-time updates
function connectWebSocket() {
  const ws = new WebSocket(CONFIG.NERVIX_WS_URL);

  ws.on('open', () => {
    console.log('🔌 WebSocket connected');

    // Authenticate
    ws.send(JSON.stringify({
      type: 'auth',
      agent_id: CONFIG.AGENT_ID,
      token: CONFIG.AGENT_TOKEN,
    }));
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'task_assigned':
          console.log(`📥 Task assigned via WebSocket: ${message.task.id}`);
          processTask(message.task);
          break;
        case 'task_update':
          console.log(`📊 Task update: ${message.task.id} - ${message.status}`);
          break;
        case 'notification':
          console.log(`🔔 Notification: ${message.message}`);
          break;
        default:
          console.log(`📩 Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ WebSocket message parse error:', error.message);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket disconnected, reconnecting in 5s...');
    setTimeout(connectWebSocket, 5000);
  });

  wsConnection = ws;
}

// Helper functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateMockCode(language, framework, prompt) {
  const templates = {
    javascript: {
      express: `const express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => {\n  res.json({ message: 'Hello from ${prompt}' });\n});\n\napp.listen(3000, () => {\n  console.log('Server running on port 3000');\n});`,
      react: `import React, { useState } from 'react';\n\nfunction ${prompt.replace(/\s+/g, '')}() {\n  const [data, setData] = useState(null);\n\n  return (\n    <div>\n      <h1>${prompt}</h1>\n    </div>\n  );\n}\n\nexport default ${prompt.replace(/\s+/g, '')};`,
    },
    python: {
      flask: `from flask import Flask\napp = Flask(__name__)\n\n@app.route('/')\ndef home():\n    return {'message': 'Hello from ${prompt}'}\n\nif __name__ == '__main__':\n    app.run(port=5000)`,
      django: `# ${prompt}\nfrom django.http import JsonResponse\n\ndef ${prompt.replace(/\s+/g, '_').toLowerCase()}_view(request):\n    return JsonResponse({'message': 'Hello from ${prompt}'})`,
    },
  };

  return templates[language]?.[framework] || `// ${prompt}\n// Generated code for ${language}/${framework}`;
}

async function runTests(code, language) {
  // Simulate running tests
  await sleep(500);

  return {
    total: 10,
    passed: 9,
    failed: 1,
    coverage: 85,
  };
}

function generateMockDocumentation(subject, format, target_audience) {
  return `# ${subject}\n\n## Overview\nThis documentation is intended for ${target_audience}.\n\n## Introduction\n${subject} is a comprehensive guide designed to help you understand and implement the concepts discussed here.\n\n## Getting Started\nTo get started with ${subject}, follow these steps:\n\n1. Install the required dependencies\n2. Configure your environment\n3. Run the example code\n\n## API Reference\nDetailed API documentation will be added here.\n\n## Examples\nSee the examples directory for practical implementations.\n\n## FAQ\n\n### Q: How do I get started?\nA: Follow the Getting Started section above.\n\n### Q: Is this suitable for ${target_audience}?\nA: Yes, this documentation is specifically written for ${target_audience}.\n\n## Conclusion\nFor more information, refer to the additional resources provided.\n`;
}

// Main function
async function main() {
  console.log('🤖 Nervix Nanobot Polling Client');
  console.log('================================');
  console.log(`Agent ID: ${CONFIG.AGENT_ID}`);
  console.log(`Agent Name: ${CONFIG.AGENT_NAME}`);
  console.log(`Skills: ${CONFIG.AGENT_SKILLS.join(', ')}`);
  console.log(`Max Concurrent Tasks: ${CONFIG.MAX_CONCURRENT_TASKS}`);
  console.log('');

  try {
    // Register agent if no token
    if (!CONFIG.AGENT_TOKEN) {
      CONFIG.AGENT_TOKEN = await registerAgent();
      console.log(`🔑 Agent Token: ${CONFIG.AGENT_TOKEN.substring(0, 20)}...\n`);
    } else {
      console.log('🔑 Using existing agent token\n');
    }

    // Connect WebSocket
    connectWebSocket();

    // Start polling
    isRunning = true;

    async function poll() {
      while (isRunning) {
        await pollForTasks();
        await sleep(CONFIG.POLL_INTERVAL);
      }
    }

    poll();

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down...');
      isRunning = false;
      if (wsConnection) {
        wsConnection.close();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  registerAgent,
  pollForTasks,
  processTask,
  executeTask,
};
