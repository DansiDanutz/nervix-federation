#!/usr/bin/env node
/**
 * NERVIX Load Test — Concurrent API stress test
 * Tests: health, agent list, task list, enrollment under load
 *
 * Usage: node scripts/load-test.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = "http://157.230.23.158";

// Load credentials
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, "agent-credentials.json"), "utf-8"));
const david = creds.find((c) => c.name === "david");

const results = { total: 0, success: 0, failed: 0, errors: [], latencies: [] };

async function timedFetch(label, url, opts = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), ...opts });
    const ms = Date.now() - start;
    results.total++;
    results.latencies.push(ms);
    if (res.ok) {
      results.success++;
      return { ok: true, ms, status: res.status };
    } else {
      results.failed++;
      results.errors.push(`${label}: HTTP ${res.status} (${ms}ms)`);
      return { ok: false, ms, status: res.status };
    }
  } catch (err) {
    const ms = Date.now() - start;
    results.total++;
    results.failed++;
    results.latencies.push(ms);
    results.errors.push(`${label}: ${err.message} (${ms}ms)`);
    return { ok: false, ms, error: err.message };
  }
}

async function healthCheck() {
  return timedFetch("health", `${API_URL}/api/trpc/federation.health`);
}

async function agentsList() {
  const input = encodeURIComponent(JSON.stringify({ json: { limit: 10 } }));
  return timedFetch("agents.list", `${API_URL}/api/trpc/agents.list?input=${input}`, {
    headers: { Authorization: `Bearer ${david.accessToken}` },
  });
}

async function tasksList() {
  const input = encodeURIComponent(JSON.stringify({ json: { status: "open" } }));
  return timedFetch("tasks.list", `${API_URL}/api/trpc/tasks.list?input=${input}`, {
    headers: { Authorization: `Bearer ${david.accessToken}` },
  });
}

async function federationStats() {
  return timedFetch("federation.stats", `${API_URL}/api/trpc/federation.stats`);
}

async function metricsEndpoint() {
  return timedFetch("metrics", `${API_URL}/metrics`);
}

async function leaderboard() {
  return timedFetch("leaderboard", `${API_URL}/api/trpc/federation.leaderboard`);
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

async function runBatch(label, fn, concurrency, totalRequests) {
  console.log(`\n--- ${label}: ${totalRequests} requests, ${concurrency} concurrent ---`);
  const batchStart = Date.now();
  const batchLatencies = [];
  let completed = 0;

  for (let i = 0; i < totalRequests; i += concurrency) {
    const batch = Math.min(concurrency, totalRequests - i);
    const promises = Array.from({ length: batch }, () => fn());
    const batchResults = await Promise.all(promises);
    batchResults.forEach((r) => batchLatencies.push(r.ms));
    completed += batch;
  }

  const elapsed = Date.now() - batchStart;
  const rps = (totalRequests / (elapsed / 1000)).toFixed(1);
  const avg = (batchLatencies.reduce((a, b) => a + b, 0) / batchLatencies.length).toFixed(0);
  const p50 = percentile(batchLatencies, 50);
  const p95 = percentile(batchLatencies, 95);
  const p99 = percentile(batchLatencies, 99);
  console.log(`  Completed: ${totalRequests} in ${elapsed}ms (${rps} req/s)`);
  console.log(`  Latency: avg=${avg}ms  p50=${p50}ms  p95=${p95}ms  p99=${p99}ms`);
}

async function main() {
  console.log("=== NERVIX Load Test ===");
  console.log(`API: ${API_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Warmup
  console.log("Warmup: 5 health checks...");
  for (let i = 0; i < 5; i++) await healthCheck();

  // Test 1: Health endpoint (public, no DB)
  await runBatch("Health Check (public)", healthCheck, 10, 50);

  // Test 2: Federation stats (public, hits DB)
  await runBatch("Federation Stats (public, DB read)", federationStats, 10, 50);

  // Test 3: Metrics endpoint
  await runBatch("Prometheus /metrics (DB aggregation)", metricsEndpoint, 5, 25);

  // Test 4: Agent list (authenticated)
  await runBatch("Agents List (auth, DB read)", agentsList, 10, 50);

  // Test 5: Tasks list (authenticated)
  await runBatch("Tasks List (auth, DB read)", tasksList, 10, 50);

  // Test 6: Leaderboard (public, DB aggregation)
  await runBatch("Leaderboard (public, DB aggregation)", leaderboard, 10, 50);

  // Test 7: Mixed workload — simulate real traffic
  console.log("\n--- Mixed Workload: 100 requests, 20 concurrent ---");
  const mixStart = Date.now();
  const mixFns = [healthCheck, federationStats, agentsList, tasksList, leaderboard, metricsEndpoint];
  const mixPromises = Array.from({ length: 100 }, () => {
    const fn = mixFns[Math.floor(Math.random() * mixFns.length)];
    return fn();
  });
  // Run in waves of 20
  for (let i = 0; i < mixPromises.length; i += 20) {
    await Promise.all(mixPromises.slice(i, i + 20));
  }
  const mixElapsed = Date.now() - mixStart;
  console.log(`  Completed: 100 mixed requests in ${mixElapsed}ms (${(100 / (mixElapsed / 1000)).toFixed(1)} req/s)`);

  // Summary
  const avg = (results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length).toFixed(0);
  const p50 = percentile(results.latencies, 50);
  const p95 = percentile(results.latencies, 95);
  const p99 = percentile(results.latencies, 99);
  const maxLat = Math.max(...results.latencies);
  const minLat = Math.min(...results.latencies);

  console.log("\n=== LOAD TEST RESULTS ===");
  console.log(`Total requests: ${results.total}`);
  console.log(`Success: ${results.success} (${((results.success / results.total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${results.failed} (${((results.failed / results.total) * 100).toFixed(1)}%)`);
  console.log(`Latency: min=${minLat}ms avg=${avg}ms p50=${p50}ms p95=${p95}ms p99=${p99}ms max=${maxLat}ms`);

  if (results.errors.length > 0) {
    console.log(`\nErrors (${results.errors.length}):`);
    const unique = [...new Set(results.errors)];
    unique.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
  }

  // Pass/fail
  const successRate = results.success / results.total;
  const acceptable = successRate >= 0.95 && parseInt(avg) < 2000;
  console.log(`\n${acceptable ? "✅ LOAD TEST PASSED" : "⚠️  LOAD TEST NEEDS ATTENTION"}`);
  if (!acceptable) {
    if (successRate < 0.95) console.log(`  Success rate ${(successRate * 100).toFixed(1)}% < 95%`);
    if (parseInt(avg) >= 2000) console.log(`  Average latency ${avg}ms >= 2000ms`);
  }
}

main().catch(console.error);
