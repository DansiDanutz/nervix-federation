#!/usr/bin/env node

/**
 * Load Testing Script
 * Simulate high load to test system resilience
 *
 * @version 1.0.0
 */

const autocannon = require('autocannon');
const http = require('http');

// Load test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MAX_CONNECTIONS = 1000;
const DURATION = 60; // seconds

/**
 * Stress test
 * Gradually increase load until failure or max connections
 */
async function stressTest() {
  console.log('\n🔥 Starting Stress Test');
  console.log('   This will gradually increase load until system limits are reached.');
  console.log('   Press Ctrl+C to stop.\n');

  const connections = 10;
  let lastSuccessfulConnections = 0;

  for (let c = 10; c <= MAX_CONNECTIONS; c *= 2) {
    console.log(`\n📊 Testing with ${c} concurrent connections...`);

    try {
      const result = await runLoadTest({
        connections: c,
        duration: 10,
      });

      console.log(`   ✅ Passed: ${result.requests.average.toFixed(2)} req/s`);
      console.log(`   Latency: ${result.latency.mean.toFixed(2)}ms (avg)`);
      console.log(`   Errors: ${result.errors}`);

      // If too many errors, stop
      if (result.errors > result.requests.total * 0.1) {
        console.log(`\n   ❌ Too many errors (>10%), stopping stress test.`);
        break;
      }

      lastSuccessfulConnections = c;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Stress test completed.`);
  console.log(`   Max successful connections: ${lastSuccessfulConnections}`);
}

/**
 * Soak test
 * Sustained load over long period
 */
async function soakTest() {
  console.log('\n💧 Starting Soak Test');
  console.log(`   Running at ${MAX_CONNECTIONS / 2} connections for ${DURATION} seconds...\n`);

  try {
    const result = await runLoadTest({
      connections: MAX_CONNECTIONS / 2,
      duration: DURATION,
    });

    console.log('\n✅ Soak test completed.');
    console.log(`   Total requests: ${result.requests.total}`);
    console.log(`   Throughput: ${result.requests.average.toFixed(2)} req/s`);
    console.log(`   Latency (avg): ${result.latency.mean.toFixed(2)}ms`);
    console.log(`   Errors: ${result.errors}`);

    if (result.errors > 0) {
      console.log('\n   ⚠️  Errors occurred during soak test.');
    }
  } catch (error) {
    console.error('❌ Soak test failed:', error);
  }
}

/**
 * Spike test
 * Sudden increase in load
 */
async function spikeTest() {
  console.log('\n📈 Starting Spike Test');
  console.log('   Simulating sudden traffic spike...\n');

  const phases = [
    { connections: 10, duration: 10 },
    { connections: 500, duration: 10 },
    { connections: 10, duration: 10 },
  ];

  for (const phase of phases) {
    console.log(`\n📊 Phase: ${phase.connections} connections for ${phase.duration}s...`);

    try {
      const result = await runLoadTest({
        connections: phase.connections,
        duration: phase.duration,
      });

      console.log(`   ✅ ${result.requests.average.toFixed(2)} req/s`);
      console.log(`   Latency: ${result.latency.mean.toFixed(2)}ms (avg)`);
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n✅ Spike test completed.');
}

/**
 * Run load test
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Results
 */
async function runLoadTest(options) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: BASE_URL + '/v1/agents',
      connections: options.connections,
      duration: options.duration,
      amount: options.amount,
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });

    // Show progress
    instance.on('tick', () => {
      process.stdout.write('.');
    });
  });
}

/**
 * Simulate realistic traffic
 */
async function realisticTraffic() {
  console.log('\n🌐 Starting Realistic Traffic Test');
  console.log('   Simulating mixed traffic patterns...\n');

  const scenarios = [
    {
      name: 'Agent Catalog Browse',
      weight: 0.4,
      path: '/v1/agents',
      connections: 20,
    },
    {
      name: 'Agent Search',
      weight: 0.3,
      path: '/v1/agents?search=javascript',
      connections: 15,
    },
    {
      name: 'Federation Query',
      weight: 0.2,
      path: '/v1/federation/agents',
      connections: 10,
    },
    {
      name: 'Metrics',
      weight: 0.1,
      path: '/v1/metrics',
      connections: 5,
    },
  ];

  // Calculate concurrent connections per scenario
  const totalConnections = 100;
  const connections = scenarios.map(s => Math.floor(totalConnections * s.weight));

  console.log('Traffic distribution:');
  scenarios.forEach((s, i) => {
    console.log(`   ${s.name}: ${connections[i]} connections (${(s.weight * 100).toFixed(0)}%)`);
  });

  // Run all scenarios simultaneously
  const promises = scenarios.map((s, i) => runLoadTest({
    path: s.path,
    connections: connections[i],
    duration: 30,
  }));

  try {
    const results = await Promise.all(promises);

    console.log('\n✅ Realistic traffic test completed.\n');
    console.log('Results:');

    results.forEach((r, i) => {
      console.log(`\n${scenarios[i].name}:`);
      console.log(`   Requests: ${r.requests.total}`);
      console.log(`   Throughput: ${r.requests.average.toFixed(2)} req/s`);
      console.log(`   Latency: ${r.latency.mean.toFixed(2)}ms (avg)`);
    });
  } catch (error) {
    console.error('❌ Realistic traffic test failed:', error);
  }
}

/**
 * Concurrent user test
 * Simulate multiple concurrent users
 */
async function concurrentUsers() {
  console.log('\n👥 Starting Concurrent User Test');
  console.log('   Simulating user sessions with think time...\n');

  const userCount = 50;
  const requestsPerUser = 10;

  console.log(`   Users: ${userCount}`);
  console.log(`   Requests per user: ${requestsPerUser}\n`);

  // Simulate user sessions
  const users = Array(userCount).fill(null).map((_, i) => {
    return new Promise(async (resolve) => {
      const sessionResults = [];

      for (let r = 0; r < requestsPerUser; r++) {
        const start = Date.now();

        try {
          await http.get(`${BASE_URL}/v1/agents`, (res) => {
            sessionResults.push({
              statusCode: res.statusCode,
              duration: Date.now() - start,
            });

            // Think time (random between 100-1000ms)
            setTimeout(() => {}, Math.random() * 900 + 100);
          }).on('error', (err) => {
            sessionResults.push({
              error: err.message,
              duration: Date.now() - start,
            });
          });
        } catch (error) {
          sessionResults.push({
            error: error.message,
          });
        }
      }

      resolve({
        user: i,
        results: sessionResults,
      });
    });
  });

  try {
    const results = await Promise.all(users);

    const totalRequests = results.reduce((sum, u) => sum + u.results.length, 0);
    const errors = results.reduce((sum, u) => sum + u.results.filter(r => r.error).length, 0);
    const durations = results.flatMap(u => u.results.filter(r => r.duration).map(r => r.duration));

    const avgLatency = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95Latency = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];

    console.log('\n✅ Concurrent user test completed.\n');
    console.log('Results:');
    console.log(`   Total requests: ${totalRequests}`);
    console.log(`   Successful: ${totalRequests - errors}`);
    console.log(`   Errors: ${errors} (${((errors / totalRequests) * 100).toFixed(2)}%)`);
    console.log(`   Avg latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`   P95 latency: ${p95Latency.toFixed(2)}ms`);
  } catch (error) {
    console.error('❌ Concurrent user test failed:', error);
  }
}

/**
 * Main function
 */
async function main() {
  const testType = process.argv[2] || 'stress';

  console.log('\n🚀 Load Testing');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Test type: ${testType}\n`);

  switch (testType) {
    case 'stress':
      await stressTest();
      break;

    case 'soak':
      await soakTest();
      break;

    case 'spike':
      await spikeTest();
      break;

    case 'realistic':
      await realisticTraffic();
      break;

    case 'concurrent':
      await concurrentUsers();
      break;

    case 'all':
      await stressTest();
      await spikeTest();
      await realisticTraffic();
      break;

    default:
      console.log('\nUsage:');
      console.log('  node load-test.js [test-type]');
      console.log('');
      console.log('Test types:');
      console.log('  stress    - Gradually increase load until failure');
      console.log('  soak      - Sustained load over long period');
      console.log('  spike     - Sudden increase in load');
      console.log('  realistic - Mixed traffic patterns');
      console.log('  concurrent- Concurrent users with think time');
      console.log('  all       - Run all tests');
      process.exit(1);
  }

  console.log('\n✅ Load testing completed!\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  });
}

module.exports = {
  stressTest,
  soakTest,
  spikeTest,
  realisticTraffic,
  concurrentUsers,
};
