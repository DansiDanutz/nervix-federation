#!/usr/bin/env node

/**
 * Seed Task Queue with Test Tasks
 * Creates sample tasks to test nanobot delegation
 *
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// Task templates
const TASK_TEMPLATES = [
  {
    type: 'code-generation',
    priority: 'high',
    base_reward: 50.00,
    parameters: {
      prompt: 'Create a REST API endpoint for user authentication with JWT',
      language: 'javascript',
      framework: 'express',
    },
    requirements: {
      tests: true,
      documentation: true,
      code_quality_threshold: 80,
    },
  },
  {
    type: 'code-generation',
    priority: 'medium',
    base_reward: 40.00,
    parameters: {
      prompt: 'Build a React component for displaying user profiles',
      language: 'javascript',
      framework: 'react',
    },
    requirements: {
      tests: true,
      documentation: true,
      code_quality_threshold: 75,
    },
  },
  {
    type: 'code-generation',
    priority: 'high',
    base_reward: 60.00,
    parameters: {
      prompt: 'Create a Python Flask API for managing product inventory',
      language: 'python',
      framework: 'flask',
    },
    requirements: {
      tests: true,
      documentation: true,
      code_quality_threshold: 80,
    },
  },
  {
    type: 'code-review',
    priority: 'medium',
    base_reward: 30.00,
    parameters: {
      code_url: 'https://github.com/example/repo/pull/123',
      review_criteria: ['security', 'performance', 'style'],
    },
  },
  {
    type: 'code-review',
    priority: 'high',
    base_reward: 45.00,
    parameters: {
      code_url: 'https://github.com/example/repo/pull/456',
      review_criteria: ['security', 'performance', 'style', 'documentation'],
    },
  },
  {
    type: 'testing',
    priority: 'medium',
    base_reward: 35.00,
    parameters: {
      code_url: 'https://github.com/example/repo/blob/main/src/index.js',
      test_framework: 'jest',
      coverage_target: 90,
    },
  },
  {
    type: 'testing',
    priority: 'high',
    base_reward: 50.00,
    parameters: {
      code_url: 'https://github.com/example/repo/blob/main/src/server.js',
      test_framework: 'jest',
      coverage_target: 95,
    },
  },
  {
    type: 'documentation',
    priority: 'low',
    base_reward: 25.00,
    parameters: {
      subject: 'API endpoints',
      format: 'markdown',
      target_audience: 'developers',
    },
  },
  {
    type: 'documentation',
    priority: 'medium',
    base_reward: 30.00,
    parameters: {
      subject: 'Installation and setup guide',
      format: 'markdown',
      target_audience: 'beginners',
    },
  },
  {
    type: 'documentation',
    priority: 'high',
    base_reward: 40.00,
    parameters: {
      subject: 'Security best practices',
      format: 'markdown',
      target_audience: 'developers',
    },
  },
];

// Generate tasks from templates
function generateTasks(count = 20) {
  const tasks = [];

  for (let i = 0; i < count; i++) {
    const template = TASK_TEMPLATES[Math.floor(Math.random() * TASK_TEMPLATES.length)];
    const task = {
      id: uuidv4(),
      ...template,
      metadata: {
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_by: 'system',
      },
    };
    tasks.push(task);
  }

  return tasks;
}

// Create task via API
async function createTask(task) {
  try {
    const response = await fetch(`${BASE_URL}/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify(task),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Failed to create task ${task.id}:`, data.message || data.error);
      return null;
    }

    console.log(`✅ Task created: ${task.id} (${task.type})`);
    return data;
  } catch (error) {
    console.error(`❌ Error creating task ${task.id}:`, error.message);
    return null;
  }
}

// Create multiple tasks in batches
async function createBatch(tasks, batchSize = 5) {
  const results = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} tasks)...`);

    const batchResults = await Promise.all(
      batch.map(task => createTask(task))
    );

    results.push(...batchResults.filter(r => r !== null));

    // Wait between batches
    if (i + batchSize < tasks.length) {
      console.log('⏳ Waiting 2 seconds before next batch...');
      await sleep(2000);
    }
  }

  return results;
}

// Helper function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function main() {
  console.log('🌱 Seeding Nervix Task Queue');
  console.log('==============================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  const taskCount = parseInt(process.env.TASK_COUNT) || 20;
  console.log(`📋 Generating ${taskCount} test tasks...\n`);

  // Generate tasks
  const tasks = generateTasks(taskCount);
  console.log(`✅ ${tasks.length} tasks generated\n`);

  // Create tasks
  console.log('📤 Creating tasks in task queue...\n');
  const createdTasks = await createBatch(tasks);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Task Seeding Summary');
  console.log('='.repeat(50));
  console.log(`Total tasks generated: ${tasks.length}`);
  console.log(`Tasks created: ${createdTasks.length}`);
  console.log(`Failed: ${tasks.length - createdTasks.length}`);

  if (createdTasks.length > 0) {
    console.log('\n✅ Task queue seeded successfully!');
    console.log(`\n📊 Task breakdown:`);

    const breakdown = {};
    createdTasks.forEach(task => {
      const type = task.type || task.type;
      breakdown[type] = (breakdown[type] || 0) + 1;
    });

    Object.entries(breakdown).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    console.log('\n🚀 Nanobots can now start polling for tasks!');
    console.log('\nTo start a nanobot, run:');
    console.log('  cd examples/nanbot && npm start');
  } else {
    console.log('\n❌ No tasks were created. Check your authentication and API configuration.');
  }

  console.log('');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  generateTasks,
  createTask,
  createBatch,
};
