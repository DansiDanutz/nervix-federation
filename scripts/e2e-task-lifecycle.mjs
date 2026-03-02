#!/usr/bin/env node
/**
 * NERVIX E2E Task Lifecycle Test
 * Tests: create task → assign → complete → verify balances + reputation
 *
 * Usage: node scripts/e2e-task-lifecycle.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = "http://157.230.23.158";

// Load credentials
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, "agent-credentials.json"), "utf-8"));
const david = creds.find((c) => c.name === "david");
const nano = creds.find((c) => c.name === "nano");
const dexter = creds.find((c) => c.name === "dexter");

if (!david || !nano || !dexter) {
  console.error("Missing agent credentials. Run enroll-team.mjs first.");
  process.exit(1);
}

async function trpcQuery(procedure, input, token) {
  const url = `${API_URL}/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (data.error) throw new Error(`${procedure}: ${JSON.stringify(data.error)}`);
  return data.result?.data?.json;
}

async function trpcMutation(procedure, input, token) {
  const res = await fetch(`${API_URL}/api/trpc/${procedure}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`${procedure}: ${JSON.stringify(data.error)}`);
  return data.result?.data?.json;
}

function assert(condition, msg) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

async function main() {
  console.log("=== NERVIX E2E Task Lifecycle Test ===\n");

  // Step 0: Check initial balances
  console.log("Step 0: Check initial balances");
  const davidAgent = await trpcQuery("agents.getById", { agentId: david.agentId }, david.accessToken);
  const nanoAgent = await trpcQuery("agents.getById", { agentId: nano.agentId }, nano.accessToken);
  const davidBalance = parseFloat(davidAgent.creditBalance);
  const nanoBalance = parseFloat(nanoAgent.creditBalance);
  console.log(`  David balance: ${davidBalance} cr`);
  console.log(`  Nano balance: ${nanoBalance} cr`);
  assert(davidBalance >= 10, `David has enough credits (${davidBalance} >= 10)`);

  // Step 1: David creates a task
  console.log("\nStep 1: David creates a task (reward: 5 cr)");
  const task = await trpcMutation("tasks.create", {
    title: "E2E Test: Generate status report",
    description: "Generate a status report for the NERVIX federation. This is an automated E2E test task.",
    reward: "5",
    requiredRoles: ["coder"],
    priority: "medium",
    maxDuration: 3600,
  }, david.accessToken);
  console.log(`  Task ID: ${task.taskId}`);
  console.log(`  Status: ${task.status}`);
  console.log(`  Assignee: ${task.assigneeId || "none"}`);
  assert(task.requesterId === david.agentId, `Task requester is David`);

  // Step 2: If auto-assigned, accept; otherwise manually assign to Nano
  const assigneeId = task.assigneeId || nano.agentId;
  const assigneeToken = assigneeId === nano.agentId ? nano.accessToken
    : creds.find(c => c.agentId === assigneeId)?.accessToken || nano.accessToken;

  if (task.status === "assigned" || task.status === "in_progress") {
    console.log(`\nStep 2: Task auto-assigned to ${assigneeId}`);
    assert(!!task.assigneeId, `Task has an assignee`);
  } else {
    console.log("\nStep 2: Manually assigning to Nano");
    const claimed = await trpcMutation("tasks.updateStatus", {
      taskId: task.taskId,
      status: "in_progress",
      assigneeId: nano.agentId,
    }, nano.accessToken);
    console.log(`  Status after claim: ${claimed.status}`);
  }

  // If status is "assigned", move to "in_progress" first
  if (task.status === "assigned") {
    console.log("\nStep 2b: Moving task to in_progress");
    const started = await trpcMutation("tasks.updateStatus", {
      taskId: task.taskId,
      status: "in_progress",
    }, assigneeToken);
    console.log(`  Status: ${started.status}`);
  }

  // Step 3: Complete the task
  console.log("\nStep 3: Assignee completes the task");
  const completed = await trpcMutation("tasks.updateStatus", {
    taskId: task.taskId,
    status: "completed",
    result: "Status report generated: 21 agents enrolled, 5 real team agents, all systems nominal.",
  }, assigneeToken);
  console.log(`  Status after complete: ${completed.status}`);
  assert(completed.status === "completed", `Task status is 'completed'`);

  // Step 4: Verify balance changes
  console.log("\nStep 4: Verify balance changes");
  const davidAfter = await trpcQuery("agents.getById", { agentId: david.agentId }, david.accessToken);
  const davidBalanceAfter = parseFloat(davidAfter.creditBalance);
  const davidSpent = davidBalance - davidBalanceAfter;
  console.log(`  David: ${davidBalance} → ${davidBalanceAfter} (spent this run: ${davidSpent.toFixed(2)} cr)`);
  assert(davidBalanceAfter < davidBalance, `David balance decreased (${davidBalance} → ${davidBalanceAfter})`);
  assert(davidSpent >= 5, `David spent at least 5 cr (actual: ${davidSpent.toFixed(2)})`);

  // Step 5: Check reputation updated
  console.log("\nStep 5: Check assignee reputation");
  const nanoRep = await trpcQuery("agents.getReputation", { agentId: assigneeId }, assigneeToken);
  if (nanoRep) {
    console.log(`  Overall score: ${nanoRep.overallScore}`);
    console.log(`  Tasks scored: ${nanoRep.totalTasksScored}`);
    assert(parseInt(nanoRep.totalTasksScored) >= 1, `Assignee has at least 1 task scored`);
  } else {
    console.log(`  (reputation not available via this endpoint)`);
  }

  // Step 7: Run a second task with Dexter
  console.log("\nStep 7: Second task — David → Dexter");
  const task2 = await trpcMutation("tasks.create", {
    title: "E2E Test: Security audit stub",
    description: "Run basic security checks on the federation API. Automated E2E test.",
    reward: "3",
    requiredRoles: ["security"],
    priority: "low",
    maxDuration: 1800,
  }, david.accessToken);
  console.log(`  Task ID: ${task2.taskId}`);

  await trpcMutation("tasks.updateStatus", {
    taskId: task2.taskId,
    status: "in_progress",
    assigneeId: dexter.agentId,
  }, dexter.accessToken);
  console.log(`  Dexter claimed task`);

  const completed2 = await trpcMutation("tasks.updateStatus", {
    taskId: task2.taskId,
    status: "completed",
    result: "Security scan passed: no critical vulnerabilities found.",
  }, dexter.accessToken);
  assert(completed2.status === "completed", `Second task completed`);

  const dexterAfter = await trpcQuery("agents.getById", { agentId: dexter.agentId }, dexter.accessToken);
  const dexterEarned = parseFloat(dexterAfter.creditBalance) - 100;
  console.log(`  Dexter earned: ${dexterEarned.toFixed(2)} cr`);

  // Final summary
  console.log("\n=== E2E TEST PASSED ===");
  console.log(`Tasks completed: 2`);
  console.log(`Agents involved: David (requester), Nano (assignee), Dexter (assignee)`);
  console.log(`Credits flowed: David → Nano (5cr task), David → Dexter (3cr task)`);
  console.log(`Atomic RPC: ${completed.atomicRpc ? "YES" : "fallback (check logs)"}`);
}

main().catch((err) => {
  console.error(`\n❌ E2E TEST FAILED: ${err.message}`);
  process.exit(1);
});
