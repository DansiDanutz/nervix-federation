#!/usr/bin/env node

/**
 * Performance Benchmarks
 * Measure API and service performance
 *
 * @version 1.0.0
 */

const autocannon = require('autocannon');
const http = require('http');

// Benchmark configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 10;
const DURATION = parseInt(process.env.DURATION) || 10;

/**
 * Run benchmark
 * @param {Object} options - Benchmark options
 * @returns {Promise<Object>} Results
 */
async function runBenchmark(options) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      ...options,
      url: BASE_URL + options.path,
      connections: CONCURRENCY,
      duration: DURATION,
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });

    // Progress updates
    instance.on('done', (result) => {
      console.log(`\n✅ Benchmark completed: ${options.name}`);
      console.log(`   Requests: ${result.requests.total}`);
      console.log(`   Latency: ${result.latency.mean.toFixed(2)}ms (avg)`);
      console.log(`   Throughput: ${result.requests.average.toFixed(2)} req/s`);
    });
  });
}

/**
 * Print benchmark result
 * @param {string} name - Benchmark name
 * @param {Object} result - Benchmark result
 */
function printResult(name, result) {
  console.log('\n' + '='.repeat(60));
  console.log(`BENCHMARK: ${name}`);
  console.log('='.repeat(60));

  console.log('\n📊 Statistics:');
  console.log(`  Requests:        ${result.requests.total}`);
  console.log(`  Throughput:      ${result.requests.average.toFixed(2)} req/s`);
  console.log(`  Latency (mean):  ${result.latency.mean.toFixed(2)}ms`);
  console.log(`  Latency (p99):   ${result.latency.p99.toFixed(2)}ms`);
  console.log(`  Latency (p999):  ${result.latency.p999.toFixed(2)}ms`);

  console.log('\n⚡ Performance:');
  console.log(`  Min:            ${result.latency.min.toFixed(2)}ms`);
  console.log(`  Max:            ${result.latency.max.toFixed(2)}ms`);
  console.log(`  Std Dev:        ${result.latency.standardDeviation.toFixed(2)}ms`);

  console.log('\n💾 Bytes:');
  console.log(`  Sent:           ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Received:       ${(result.throughput.mean / 1024 / 1024).toFixed(2)} MB/s`);

  console.log('\n🔢 Errors:');
  console.log(`  Timeouts:       ${result.timeouts}`);
  console.log(`  Errors:         ${result.errors}`);

  console.log('='.repeat(60) + '\n');
}

/**
 * Main benchmarks
 */
async function main() {
  console.log('\n🚀 Starting Performance Benchmarks');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Duration: ${DURATION}s`);
  console.log(''.padEnd(60, '='));

  // Benchmark 1: Health Check
  try {
    const result = await runBenchmark({
      name: 'Health Check',
      path: '/health',
    });
    printResult('Health Check', result);

    // Assertion: Health check should be fast
    if (result.latency.mean > 50) {
      console.warn('⚠️  WARNING: Health check latency > 50ms');
    }
  } catch (error) {
    console.error('❌ Health check benchmark failed:', error.message);
  }

  // Benchmark 2: Agent Catalog
  try {
    const result = await runBenchmark({
      name: 'Agent Catalog',
      path: '/v1/agents',
    });
    printResult('Agent Catalog', result);

    // Assertion: Catalog should handle good throughput
    if (result.requests.average < 100) {
      console.warn('⚠️  WARNING: Agent catalog throughput < 100 req/s');
    }
  } catch (error) {
    console.error('❌ Agent catalog benchmark failed:', error.message);
  }

  // Benchmark 3: Agent Search
  try {
    const result = await runBenchmark({
      name: 'Agent Search',
      path: '/v1/agents?search=javascript&limit=10',
    });
    printResult('Agent Search', result);

    // Assertion: Search should be reasonably fast
    if (result.latency.mean > 100) {
      console.warn('⚠️  WARNING: Agent search latency > 100ms');
    }
  } catch (error) {
    console.error('❌ Agent search benchmark failed:', error.message);
  }

  // Benchmark 4: Federation Agents
  try {
    const result = await runBenchmark({
      name: 'Federation Agents',
      path: '/v1/federation/agents',
    });
    printResult('Federation Agents', result);
  } catch (error) {
    console.error('❌ Federation agents benchmark failed:', error.message);
  }

  // Benchmark 5: Metrics
  try {
    const result = await runBenchmark({
      name: 'Metrics',
      path: '/v1/metrics',
    });
    printResult('Metrics', result);
  } catch (error) {
    console.error('❌ Metrics benchmark failed:', error.message);
  }

  // Benchmark 6: Skills
  try {
    const result = await runBenchmark({
      name: 'Skills',
      path: '/v1/skills',
    });
    printResult('Skills', result);
  } catch (error) {
    console.error('❌ Skills benchmark failed:', error.message);
  }

  // Benchmark 7: Team Stats
  try {
    const result = await runBenchmark({
      name: 'Team Stats',
      path: '/v1/team/stats',
    });
    printResult('Team Stats', result);
  } catch (error) {
    console.error('❌ Team stats benchmark failed:', error.message);
  }

  console.log('\n✅ All benchmarks completed!\n');
}

/**
 * Performance comparison
 * @param {Object} baseline - Baseline results
 * @param {Object} current - Current results
 */
function comparePerformance(baseline, current) {
  console.log('\n📊 Performance Comparison');
  console.log('='.repeat(60));

  for (const key of Object.keys(baseline)) {
    const baselineLatency = baseline[key].latency.mean;
    const currentLatency = current[key].latency.mean;

    const diff = currentLatency - baselineLatency;
    const percentChange = ((diff / baselineLatency) * 100).toFixed(2);

    let status = '✅';
    if (diff > 0 && Math.abs(percentChange) > 10) {
      status = '📉';
    } else if (diff < 0 && Math.abs(percentChange) > 10) {
      status = '📈';
    }

    console.log(`\n${status} ${key}:`);
    console.log(`   Baseline: ${baselineLatency.toFixed(2)}ms`);
    console.log(`   Current:  ${currentLatency.toFixed(2)}ms`);
    console.log(`   Change:   ${diff > 0 ? '+' : ''}${diff.toFixed(2)}ms (${percentChange}%)`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Generate benchmark report
 * @param {Array} results - Benchmark results
 * @returns {Object> Report data
 */
function generateReport(results) {
  return {
    timestamp: new Date().toISOString(),
    configuration: {
      base_url: BASE_URL,
      concurrency: CONCURRENCY,
      duration: DURATION,
    },
    benchmarks: results.map(r => ({
      name: r.name,
      requests: r.requests.total,
      throughput: r.requests.average,
      latency: {
        mean: r.latency.mean,
        p99: r.latency.p99,
        p999: r.latency.p999,
        min: r.latency.min,
        max: r.latency.max,
      },
    })),
  };
}

// Run benchmarks if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runBenchmark,
  printResult,
  comparePerformance,
  generateReport,
};
