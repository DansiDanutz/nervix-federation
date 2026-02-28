/**
 * Nervix V2 — Demo Data Seeder
 * 
 * This module provides a tRPC procedure that seeds the database with
 * realistic demo agents, tasks, reputation scores, and transactions
 * to showcase the platform's capabilities.
 */

import { nanoid } from "nanoid";
import * as db from "./db";

const DEMO_AGENTS = [
  { name: "dexter-orchestrator", roles: ["orchestrator", "coder"], desc: "Primary orchestration agent — coordinates all federation workflows", region: "eu-west-1" },
  { name: "sienna-trader", roles: ["data", "research"], desc: "Financial data analysis and trading strategy agent", region: "us-east-1" },
  { name: "atlas-devops", roles: ["devops", "deploy"], desc: "Infrastructure automation and cloud deployment specialist", region: "us-west-2" },
  { name: "sentinel-security", roles: ["security", "monitor"], desc: "Cybersecurity scanning, threat detection, and system monitoring", region: "eu-central-1" },
  { name: "nova-coder", roles: ["coder", "qa"], desc: "Full-stack development with integrated testing capabilities", region: "ap-southeast-1" },
  { name: "cipher-data", roles: ["data", "research"], desc: "Big data processing, ETL pipelines, and analytics", region: "us-east-2" },
  { name: "herald-docs", roles: ["docs", "research"], desc: "Technical documentation and knowledge base management", region: "eu-west-2" },
  { name: "forge-deploy", roles: ["deploy", "devops"], desc: "CI/CD pipeline management and release automation", region: "us-west-1" },
  { name: "prism-qa", roles: ["qa", "security"], desc: "Automated testing, code review, and security auditing", region: "ap-northeast-1" },
  { name: "nexus-monitor", roles: ["monitor", "orchestrator"], desc: "Real-time system monitoring and incident response coordination", region: "eu-north-1" },
];

const DEMO_TASKS = [
  { title: "Deploy staging environment for v2.1", roles: ["devops", "deploy"], priority: "high" as const, reward: "25.00" },
  { title: "Run security audit on API endpoints", roles: ["security"], priority: "critical" as const, reward: "50.00" },
  { title: "Generate API documentation for federation protocol", roles: ["docs"], priority: "medium" as const, reward: "15.00" },
  { title: "Optimize database query performance", roles: ["coder", "data"], priority: "high" as const, reward: "35.00" },
  { title: "Set up monitoring dashboards for production", roles: ["monitor", "devops"], priority: "medium" as const, reward: "20.00" },
  { title: "Implement rate limiting middleware", roles: ["coder", "security"], priority: "high" as const, reward: "30.00" },
  { title: "Analyze agent performance metrics", roles: ["data", "research"], priority: "low" as const, reward: "10.00" },
  { title: "Configure automated backup system", roles: ["devops"], priority: "medium" as const, reward: "18.00" },
];

export async function seedDemoData(): Promise<{ agents: number; tasks: number }> {
  const agentIds: string[] = [];

  // Seed agents
  for (const demo of DEMO_AGENTS) {
    const agentId = `agt_${nanoid(20)}`;
    agentIds.push(agentId);

    await db.createAgent({
      agentId,
      name: demo.name,
      publicKey: `ed25519:demo_${nanoid(32)}`,
      roles: demo.roles,
      status: Math.random() > 0.2 ? "active" : "pending",
      description: demo.desc,
      region: demo.region,
      creditBalance: (100 + Math.floor(Math.random() * 400)).toFixed(2),
      maxConcurrentTasks: Math.floor(Math.random() * 5) + 3,
      totalTasksCompleted: Math.floor(Math.random() * 50),
      totalTasksFailed: Math.floor(Math.random() * 5),
      lastHeartbeat: new Date(),
    });

    // Add reputation (create first, then update)
    await db.getOrCreateReputation(agentId);
    await db.updateReputation(agentId, {
      overallScore: (0.6 + Math.random() * 0.35).toFixed(4),
      successRate: (0.7 + Math.random() * 0.28).toFixed(4),
      avgResponseTime: (5 + Math.random() * 55).toFixed(2),
      avgQualityRating: (0.65 + Math.random() * 0.3).toFixed(4),
      uptimeConsistency: (0.8 + Math.random() * 0.18).toFixed(4),
      totalTasksScored: Math.floor(Math.random() * 40) + 5,
    });

    // Add capabilities
    const skills = [
      { name: "Container Orchestration", tags: ["docker", "kubernetes"] },
      { name: "Code Generation", tags: ["typescript", "python"] },
      { name: "Vulnerability Scanning", tags: ["owasp", "cve"] },
      { name: "Data Pipeline", tags: ["etl", "spark"] },
      { name: "Documentation", tags: ["markdown", "openapi"] },
    ];
    const skill = skills[Math.floor(Math.random() * skills.length)];
    await db.setAgentCapabilities(agentId, [{
      agentId,
      skillId: `skill_${skill.name.toLowerCase().replace(/\s+/g, "_")}`,
      skillName: skill.name,
      description: `Expert in ${skill.name.toLowerCase()}`,
      proficiencyLevel: (["intermediate", "advanced", "expert"] as const)[Math.floor(Math.random() * 3)],
      tags: skill.tags,
    }]);

    // Audit log
    await db.createAuditEntry({
      eventId: `evt_${nanoid(16)}`,
      eventType: "agent.enrolled",
      actorType: "agent",
      actorId: agentId,
      action: `Agent ${demo.name} enrolled in federation`,
      details: { roles: demo.roles, region: demo.region },
    });
  }

  // Seed tasks
  let taskCount = 0;
  for (const demo of DEMO_TASKS) {
    const taskId = `tsk_${nanoid(20)}`;
    const requesterId = agentIds[Math.floor(Math.random() * agentIds.length)];
    const statuses = ["created", "assigned", "in_progress", "completed"] as const;
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const assigneeId = status !== "created" ? agentIds[Math.floor(Math.random() * agentIds.length)] : undefined;

    await db.createTask({
      taskId,
      title: demo.title,
      description: `Federation task: ${demo.title}`,
      requiredRoles: demo.roles,
      requesterId,
      assigneeId,
      status,
      priority: demo.priority,
      creditReward: demo.reward,
    });

    // Add transaction for completed tasks
    if (status === "completed" && assigneeId) {
      await db.createEconomicTransaction({
        transactionId: `tx_${nanoid(20)}`,
        fromAgentId: requesterId,
        toAgentId: assigneeId,
        amount: demo.reward,
        type: "task_reward",
        taskId,
        memo: `Reward for: ${demo.title}`,
      });
    }

    taskCount++;
  }

  return { agents: DEMO_AGENTS.length, tasks: taskCount };
}
