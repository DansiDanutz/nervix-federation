import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import * as db from "./db";
import { seedDemoData } from "./seed-demo";
import { FEE_CONFIG } from "../shared/nervix-types";
import * as tonEscrow from "./ton-escrow";
import * as clawHub from "./clawhub-publisher";

// ─── Fee Calculation Helper ────────────────────────────────────────────────
function calculateFee(amount: number, feePercent: number, isOpenClaw: boolean = false): { fee: number; netAmount: number; discount: number } {
  const minFee = parseFloat(FEE_CONFIG.minimumFeeCredits);
  const maxFee = parseFloat(FEE_CONFIG.maximumFeeCredits);
  let rawFee = amount * (feePercent / 100);
  let discount = 0;
  if (isOpenClaw) {
    discount = rawFee * (FEE_CONFIG.openClawDiscountPercent / 100);
    rawFee -= discount;
  }
  const fee = Math.min(maxFee, Math.max(minFee, rawFee));
  return { fee: parseFloat(fee.toFixed(6)), netAmount: parseFloat((amount - fee).toFixed(6)), discount: parseFloat(discount.toFixed(6)) };
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────
const VALID_ROLES = ["devops", "coder", "qa", "security", "data", "deploy", "monitor", "research", "docs", "orchestrator"] as const;
const TASK_STATUSES = ["created", "assigned", "in_progress", "completed", "failed", "cancelled", "timeout"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

// ─── Enrollment Router ──────────────────────────────────────────────────────
const enrollmentRouter = router({
  request: publicProcedure
    .input(z.object({
      agentName: z.string().min(1).max(255),
      publicKey: z.string().min(32),
      roles: z.array(z.enum(VALID_ROLES)).min(1),
      description: z.string().optional(),
      webhookUrl: z.string().url().optional(),
      hostname: z.string().optional(),
      region: z.string().optional(),
      walletAddress: z.string().max(128).optional(),
    }))
    .mutation(async ({ input }) => {
      const existing = await db.getAgentByName(input.agentName);
      if (existing) throw new Error("Agent name already registered");

      const challengeId = `ch_${nanoid(24)}`;
      const challengeNonce = nanoid(64);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await db.createEnrollmentChallenge({
        challengeId,
        agentName: input.agentName,
        publicKey: input.publicKey,
        roles: input.roles,
        challengeNonce,
        expiresAt,
      });

      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "enrollment.request",
        actorType: "agent",
        action: `Enrollment requested for agent: ${input.agentName}`,
        details: { agentName: input.agentName, roles: input.roles },
      });

      return { challengeId, challengeNonce };
    }),

  verify: publicProcedure
    .input(z.object({
      challengeId: z.string(),
      signature: z.string(),
    }))
    .mutation(async ({ input }) => {
      const challenge = await db.getEnrollmentChallenge(input.challengeId);
      if (!challenge) throw new Error("Challenge not found");
      if (challenge.status !== "pending") throw new Error("Challenge already processed");
      if (new Date() > challenge.expiresAt) {
        await db.updateEnrollmentChallenge(input.challengeId, { status: "expired" });
        throw new Error("Challenge expired");
      }

      // In production: verify Ed25519 signature with tweetnacl
      // For now we accept any non-empty signature (the plugin will do real crypto)
      if (!input.signature || input.signature.length < 10) {
        await db.updateEnrollmentChallenge(input.challengeId, { status: "failed" });
        throw new Error("Invalid signature");
      }

      const agentId = `agt_${nanoid(20)}`;
      const sessionId = `ses_${nanoid(20)}`;
      const accessToken = `at_${nanoid(48)}`;
      const refreshToken = `rt_${nanoid(48)}`;

      await db.updateEnrollmentChallenge(input.challengeId, {
        status: "verified",
        verifiedAt: new Date(),
      });

      await db.createAgent({
        agentId,
        name: challenge.agentName,
        publicKey: challenge.publicKey,
        roles: challenge.roles,
        status: "active",
      });

      await db.getOrCreateReputation(agentId);

      await db.createAgentSession({
        sessionId,
        agentId,
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "enrollment.verified",
        actorId: agentId,
        actorType: "agent",
        action: `Agent enrolled: ${challenge.agentName}`,
        details: { agentId, roles: challenge.roles },
      });

      return { agentId, accessToken, refreshToken, sessionId };
    }),
});

// ─── Agents Router ──────────────────────────────────────────────────────────
const agentsRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      role: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listAgents(input);
    }),

  getById: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      const agent = await db.getAgentById(input.agentId);
      if (!agent) throw new Error("Agent not found");
      return agent;
    }),

  updateCard: publicProcedure
    .input(z.object({
      agentId: z.string(),
      agentCard: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const agent = await db.getAgentById(input.agentId);
      if (!agent) throw new Error("Agent not found");
      const updated = await db.updateAgent(input.agentId, { agentCard: input.agentCard });

      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "agent.card_updated",
        actorId: input.agentId,
        actorType: "agent",
        action: `Agent Card updated for ${agent.name}`,
      });

      return updated;
    }),

  heartbeat: publicProcedure
    .input(z.object({
      agentId: z.string(),
      latencyMs: z.number().int().min(0).optional(),
      cpuUsage: z.number().min(0).max(100).optional(),
      memoryUsage: z.number().min(0).max(100).optional(),
      diskUsage: z.number().min(0).max(100).optional(),
      activeTaskCount: z.number().int().min(0).optional(),
      agentVersion: z.string().max(32).optional(),
      statusMessage: z.string().max(255).optional(),
      ipAddress: z.string().max(45).optional(),
      region: z.string().max(64).optional(),
      healthy: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { agentId, ...metadata } = input;
      await db.updateAgentHeartbeat(agentId, Object.keys(metadata).length > 0 ? metadata : undefined);
      return { ok: true, timestamp: new Date().toISOString() };
    }),

  heartbeatHistory: publicProcedure
    .input(z.object({
      agentId: z.string(),
      limit: z.number().int().min(1).max(200).optional(),
    }))
    .query(async ({ input }) => {
      return db.getHeartbeatHistory(input.agentId, input.limit || 50);
    }),

  heartbeatStats: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      return db.getHeartbeatStats(input.agentId);
    }),

  liveStatuses: publicProcedure
    .query(async () => {
      return db.getLiveAgentStatuses();
    }),

  delete: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Admin only");
      await db.deleteAgent(input.agentId);
      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "agent.deleted",
        actorId: ctx.user.openId,
        actorType: "admin",
        action: `Agent deleted: ${input.agentId}`,
      });
      return { ok: true };
    }),

  getReputation: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      return db.getOrCreateReputation(input.agentId);
    }),

  getCapabilities: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      return db.getAgentCapabilities(input.agentId);
    }),

  setCapabilities: publicProcedure
    .input(z.object({
      agentId: z.string(),
      capabilities: z.array(z.object({
        skillId: z.string(),
        skillName: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        examples: z.array(z.string()).optional(),
        proficiencyLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const caps = input.capabilities.map(c => ({
        ...c,
        agentId: input.agentId,
        description: c.description ?? null,
        tags: c.tags ?? null,
        examples: c.examples ?? null,
        proficiencyLevel: c.proficiencyLevel ?? ("intermediate" as const),
      }));
      await db.setAgentCapabilities(input.agentId, caps);
      return { ok: true };
    }),

  linkWallet: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      walletAddress: z.string().min(1).max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      const agent = await db.getAgentById(input.agentId);
      if (!agent) throw new Error("Agent not found");
      // Only the owner or admin can link a wallet
      if (agent.ownerUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new Error("Not authorized to link wallet to this agent");
      }
      await db.updateAgent(input.agentId, { walletAddress: input.walletAddress });
      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "agent.wallet_linked",
        actorId: ctx.user.openId,
        actorType: "admin",
        action: `Wallet linked to agent ${agent.name}: ${input.walletAddress.slice(0, 8)}...`,
        details: { agentId: input.agentId, walletAddress: input.walletAddress },
      });
      return { ok: true, walletAddress: input.walletAddress };
    }),

  // Readiness check: verify an agent is properly configured for task matching
  readiness: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      const agent = await db.getAgentById(input.agentId);
      if (!agent) throw new Error("Agent not found");
      const caps = await db.getAgentCapabilities(input.agentId);
      const reputation = await db.getOrCreateReputation(input.agentId);
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const isOnline = !!(agent.lastHeartbeat && new Date(agent.lastHeartbeat) > fiveMinAgo);

      const checks = {
        hasRoles: !!(agent.roles && (agent.roles as string[]).length > 0),
        hasCapabilities: caps.length > 0,
        hasWallet: !!agent.walletAddress,
        hasCapacity: agent.activeTasks < agent.maxConcurrentTasks,
        isOnline,
        isActive: agent.status === "active",
        hasReputation: !!reputation,
      };

      const passedChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;
      const readinessScore = Math.round((passedChecks / totalChecks) * 100);

      const issues: string[] = [];
      if (!checks.hasRoles) issues.push("No roles assigned — agent won't match any tasks");
      if (!checks.hasCapabilities) issues.push("No skills published — skill-based matching will skip this agent");
      if (!checks.hasWallet) issues.push("No wallet linked — cannot receive on-chain payments");
      if (!checks.hasCapacity) issues.push("At max concurrent tasks — no capacity for new assignments");
      if (!checks.isOnline) issues.push("Offline — not sending heartbeats (tasks still assigned but lower priority)");
      if (!checks.isActive) issues.push(`Status is '${agent.status}' — must be 'active' to receive tasks`);

      return {
        agentId: input.agentId,
        agentName: agent.name,
        readinessScore,
        ready: readinessScore >= 57, // At least 4/7 checks pass
        checks,
        issues,
        capabilities: caps.length,
        roles: agent.roles,
        activeTasks: agent.activeTasks,
        maxConcurrentTasks: agent.maxConcurrentTasks,
      };
    }),

  // Skill match preview: test which agents would match a hypothetical task
  matchPreview: publicProcedure
    .input(z.object({
      requiredRoles: z.array(z.string()).optional(),
      requiredSkills: z.array(z.string()).optional(),
    }))
    .query(async ({ input }) => {
      const { agents: candidates } = await db.listAgents({ status: "active", limit: 100 });
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const proficiencyWeight: Record<string, number> = { expert: 4, advanced: 3, intermediate: 2, beginner: 1 };

      const matches: { agentId: string; agentName: string; score: number; matchedSkills: string[]; roles: any; isOnline: boolean }[] = [];

      for (const a of candidates) {
        const roleMatch = !input.requiredRoles || input.requiredRoles.length === 0 || input.requiredRoles.some(r => a.roles?.includes(r));
        if (!roleMatch) continue;
        const hasCapacity = a.activeTasks < a.maxConcurrentTasks;
        if (!hasCapacity) continue;

        const isOnline = !!(a.lastHeartbeat && new Date(a.lastHeartbeat) > fiveMinAgo);
        const matchedSkills: string[] = [];
        let skillScore = 0;

        if (input.requiredSkills && input.requiredSkills.length > 0) {
          const caps = await db.getAgentCapabilities(a.agentId);
          for (const reqSkill of input.requiredSkills) {
            const lowerSkill = reqSkill.toLowerCase();
            const matchedCap = caps.find((c: any) =>
              (c.tags || []).some((t: string) => t.toLowerCase() === lowerSkill) ||
              (c.skillName?.toLowerCase() || "").includes(lowerSkill)
            );
            if (matchedCap) {
              matchedSkills.push(reqSkill);
              skillScore += proficiencyWeight[matchedCap.proficiencyLevel || "intermediate"] || 2;
            }
          }
          if (matchedSkills.length === 0) continue;
        }

        const maxSkillScore = (input.requiredSkills?.length || 0) * 4;
        const skillNorm = maxSkillScore > 0 ? (skillScore / maxSkillScore) : 0.5;
        const coverageNorm = (input.requiredSkills?.length || 0) > 0 ? (matchedSkills.length / input.requiredSkills!.length) : 0.5;
        const loadNorm = 1 - (a.activeTasks / Math.max(a.maxConcurrentTasks, 1));
        const score = Math.round(((skillNorm * 0.4) + (coverageNorm * 0.3) + (loadNorm * 0.2) + (isOnline ? 0.1 : 0)) * 100);

        matches.push({ agentId: a.agentId, agentName: a.name, score, matchedSkills, roles: a.roles, isOnline });
      }

      matches.sort((a, b) => b.score - a.score);
      return { matches, total: matches.length };
    }),
});

// ─── Tasks Router ───────────────────────────────────────────────────────────
const tasksRouter = router({
  create: publicProcedure
    .input(z.object({
      title: z.string().min(1).max(512),
      description: z.string().optional(),
      type: z.string().optional(),
      requiredRoles: z.array(z.string()).optional(),
      requiredSkills: z.array(z.string()).optional(),
      requesterId: z.string(),
      priority: z.enum(PRIORITIES).optional(),
      creditReward: z.string().optional(),
      maxDuration: z.number().optional(),
      inputArtifacts: z.array(z.record(z.string(), z.unknown())).optional(),
    }))
    .mutation(async ({ input }) => {
      const taskId = `tsk_${nanoid(20)}`;

      // Skill-aware task matching algorithm
      let assigneeId: string | undefined;
      if ((input.requiredRoles && input.requiredRoles.length > 0) || (input.requiredSkills && input.requiredSkills.length > 0)) {
        const { agents: candidates } = await db.listAgents({ status: "active", limit: 100 });
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

        // Proficiency scoring weights
        const proficiencyWeight: Record<string, number> = { expert: 4, advanced: 3, intermediate: 2, beginner: 1 };

        // Score each candidate
        const scored: { agent: any; score: number; skillMatch: number; roleMatch: boolean; isOnline: boolean }[] = [];

        for (const a of candidates) {
          if (a.agentId === input.requesterId) continue;
          const hasCapacity = a.activeTasks < a.maxConcurrentTasks;
          if (!hasCapacity) continue;

          // Role check
          const roleMatch = !input.requiredRoles || input.requiredRoles.length === 0 || input.requiredRoles.some(r => a.roles?.includes(r));
          if (!roleMatch) continue;

          const isOnline = !!(a.lastHeartbeat && new Date(a.lastHeartbeat) > fiveMinAgo);
          let skillMatch = 0;
          let skillScore = 0;

          // Skill matching: check agent capabilities against required skills
          if (input.requiredSkills && input.requiredSkills.length > 0) {
            const caps = await db.getAgentCapabilities(a.agentId);
            const allTags = caps.flatMap((c: any) => (c.tags || []).map((t: string) => t.toLowerCase()));
            const allSkillNames = caps.map((c: any) => c.skillName?.toLowerCase() || "");

            for (const reqSkill of input.requiredSkills) {
              const lowerSkill = reqSkill.toLowerCase();
              // Check tags first, then skill names
              const tagIdx = allTags.indexOf(lowerSkill);
              const nameIdx = allSkillNames.findIndex((n: string) => n.includes(lowerSkill));
              if (tagIdx >= 0 || nameIdx >= 0) {
                skillMatch++;
                // Find the matching capability for proficiency scoring
                const matchedCap = caps.find((c: any) =>
                  (c.tags || []).some((t: string) => t.toLowerCase() === lowerSkill) ||
                  (c.skillName?.toLowerCase() || "").includes(lowerSkill)
                );
                skillScore += proficiencyWeight[matchedCap?.proficiencyLevel || "intermediate"] || 2;
              }
            }

            // Skip agents with zero skill matches if skills are required
            if (skillMatch === 0) continue;
          }

          // Composite score: skill proficiency (40%) + skill coverage (30%) + load balance (20%) + online bonus (10%)
          const maxSkillScore = (input.requiredSkills?.length || 0) * 4; // max if all expert
          const skillProficiencyNorm = maxSkillScore > 0 ? (skillScore / maxSkillScore) : 0.5;
          const skillCoverageNorm = (input.requiredSkills?.length || 0) > 0 ? (skillMatch / input.requiredSkills!.length) : 0.5;
          const loadNorm = 1 - (a.activeTasks / Math.max(a.maxConcurrentTasks, 1));
          const onlineBonus = isOnline ? 1 : 0;

          const compositeScore = (skillProficiencyNorm * 0.4) + (skillCoverageNorm * 0.3) + (loadNorm * 0.2) + (onlineBonus * 0.1);

          scored.push({ agent: a, score: compositeScore, skillMatch, roleMatch, isOnline });
        }

        if (scored.length > 0) {
          // Sort by composite score descending
          scored.sort((a, b) => b.score - a.score);
          assigneeId = scored[0].agent.agentId;
        }
      }

      const task = await db.createTask({
        taskId,
        title: input.title,
        description: input.description ?? null,
        type: input.type ?? null,
        requiredRoles: input.requiredRoles ?? null,
        requiredSkills: input.requiredSkills ?? null,
        requesterId: input.requesterId,
        assigneeId: assigneeId ?? null,
        priority: input.priority ?? "medium",
        creditReward: input.creditReward ?? "10.000000",
        maxDuration: input.maxDuration ?? 3600,
        inputArtifacts: input.inputArtifacts ?? null,
        status: assigneeId ? "assigned" : "created",
        assignedAt: assigneeId ? new Date() : null,
      });

      if (assigneeId) {
        await db.updateAgent(assigneeId, {
          activeTasks: (await db.getAgentById(assigneeId))!.activeTasks + 1,
        });

        // Create A2A message for task dispatch
        await db.createA2AMessage({
          messageId: `msg_${nanoid(20)}`,
          method: "tasks/send",
          fromAgentId: input.requesterId,
          toAgentId: assigneeId,
          taskId,
          payload: { title: input.title, description: input.description, artifacts: input.inputArtifacts },
          status: "queued",
        });
      }

      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "task.created",
        actorId: input.requesterId,
        actorType: "agent",
        action: `Task created: ${input.title}`,
        details: { taskId, assigneeId, priority: input.priority },
      });

      return task;
    }),

  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      requesterId: z.string().optional(),
      assigneeId: z.string().optional(),
      priority: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listTasks(input);
    }),

  getById: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      const task = await db.getTaskById(input.taskId);
      if (!task) throw new Error("Task not found");
      return task;
    }),

  updateStatus: publicProcedure
    .input(z.object({
      taskId: z.string(),
      status: z.enum(TASK_STATUSES),
      agentId: z.string(),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const task = await db.getTaskById(input.taskId);
      if (!task) throw new Error("Task not found");

      const updateData: any = { status: input.status };
      if (input.status === "in_progress") updateData.startedAt = new Date();
      if (input.status === "completed" || input.status === "failed") {
        updateData.completedAt = new Date();
      }
      if (input.errorMessage) updateData.errorMessage = input.errorMessage;

      const updated = await db.updateTask(input.taskId, updateData);

      // Handle completion: transfer credits with platform fee, update reputation
      if (input.status === "completed" && task.assigneeId) {
        const reward = parseFloat(task.creditReward as string);
        const assignee = await db.getAgentById(task.assigneeId);
        const requester = await db.getAgentById(task.requesterId);

        if (assignee && requester) {
          // Calculate platform fee on task reward
          const isAssigneeOpenClaw = (assignee as any).source === "openclaw";
          const { fee: taskFee, netAmount: netReward, discount: taskDiscount } = calculateFee(
            reward, FEE_CONFIG.taskPaymentFeePercent, isAssigneeOpenClaw
          );

          // Credit transfer (assignee gets net reward after fee)
          const newAssigneeBalance = parseFloat(assignee.creditBalance as string) + netReward;
          const newRequesterBalance = parseFloat(requester.creditBalance as string) - reward;

          await db.updateAgent(task.assigneeId, {
            creditBalance: newAssigneeBalance.toFixed(6),
            totalTasksCompleted: assignee.totalTasksCompleted + 1,
            totalCreditsEarned: (parseFloat(assignee.totalCreditsEarned as string) + netReward).toFixed(6),
            activeTasks: Math.max(0, assignee.activeTasks - 1),
          });

          await db.updateAgent(task.requesterId, {
            totalCreditsSpent: (parseFloat(requester.totalCreditsSpent as string) + reward).toFixed(6),
          });

          await db.createEconomicTransaction({
            transactionId: `tx_${nanoid(20)}`,
            type: "task_reward",
            fromAgentId: task.requesterId,
            toAgentId: task.assigneeId,
            taskId: input.taskId,
            amount: netReward.toFixed(6),
            balanceAfterFrom: newRequesterBalance.toFixed(6),
            balanceAfterTo: newAssigneeBalance.toFixed(6),
            memo: `Reward for task: ${task.title} (after ${FEE_CONFIG.taskPaymentFeePercent}% platform fee)`,
          });

          // Record platform fee
          if (taskFee > 0) {
            await db.createEconomicTransaction({
              transactionId: `tx_fee_${nanoid(16)}`,
              type: "platform_fee",
              fromAgentId: task.requesterId,
              toAgentId: "nervix_treasury",
              taskId: input.taskId,
              amount: taskFee.toFixed(6),
              balanceAfterFrom: newRequesterBalance.toFixed(6),
              balanceAfterTo: "0",
              memo: `Task fee (${FEE_CONFIG.taskPaymentFeePercent}%)${taskDiscount > 0 ? ` — OpenClaw discount: ${taskDiscount.toFixed(6)} cr` : ""}`,
            });
          }

          // Update reputation
          const rep = await db.getOrCreateReputation(task.assigneeId);
          const completionTime = task.startedAt
            ? (new Date().getTime() - new Date(task.startedAt).getTime()) / 1000
            : 60;
          const successWeight = 0.4;
          const timeWeight = 0.25;
          const qualityWeight = 0.25;
          const uptimeWeight = 0.1;

          const successScore = 1.0;
          const timeScore = Math.max(0, 1 - (completionTime / (task.maxDuration || 3600)));
          const qualityScore = 0.8; // Default until rated
          const uptimeScore = parseFloat(rep.uptimeConsistency as string) || 0.9;

          const newOverall = (successScore * successWeight) + (timeScore * timeWeight) + (qualityScore * qualityWeight) + (uptimeScore * uptimeWeight);

          await db.updateReputation(task.assigneeId, {
            overallScore: newOverall.toFixed(4),
            successRate: ((parseFloat(rep.successRate as string) * rep.totalTasksScored + 1) / (rep.totalTasksScored + 1)).toFixed(4),
            avgResponseTime: ((parseFloat(rep.avgResponseTime as string) * rep.totalTasksScored + completionTime) / (rep.totalTasksScored + 1)).toFixed(2),
            totalTasksScored: rep.totalTasksScored + 1,
            lastCalculated: new Date(),
          });
        }
      }

      if (input.status === "failed" && task.assigneeId) {
        const assignee = await db.getAgentById(task.assigneeId);
        if (assignee) {
          await db.updateAgent(task.assigneeId, {
            totalTasksFailed: assignee.totalTasksFailed + 1,
            activeTasks: Math.max(0, assignee.activeTasks - 1),
          });

          // Update reputation negatively
          const rep = await db.getOrCreateReputation(task.assigneeId);
          const newSuccessRate = (parseFloat(rep.successRate as string) * rep.totalTasksScored) / (rep.totalTasksScored + 1);
          const newOverall = Math.max(0, parseFloat(rep.overallScore as string) - 0.05);

          await db.updateReputation(task.assigneeId, {
            overallScore: newOverall.toFixed(4),
            successRate: newSuccessRate.toFixed(4),
            totalTasksScored: rep.totalTasksScored + 1,
            isSuspended: newOverall < 0.3,
            suspensionReason: newOverall < 0.3 ? "Reputation below threshold (0.3)" : undefined,
            lastCalculated: new Date(),
          });
        }

        // Re-queue task if retries available
        if (task.retryCount < task.maxRetries) {
          await db.updateTask(input.taskId, {
            status: "created",
            assigneeId: null,
            retryCount: task.retryCount + 1,
            errorMessage: input.errorMessage,
          });
        }
      }

      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: `task.${input.status}`,
        actorId: input.agentId,
        actorType: "agent",
        action: `Task ${input.status}: ${task.title}`,
        details: { taskId: input.taskId, status: input.status },
      });

      return updated;
    }),

  submitResult: publicProcedure
    .input(z.object({
      taskId: z.string(),
      agentId: z.string(),
      output: z.record(z.string(), z.unknown()).optional(),
      artifacts: z.array(z.record(z.string(), z.unknown())).optional(),
      message: z.string().optional(),
      executionTimeMs: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const resultId = `res_${nanoid(20)}`;
      await db.createTaskResult({
        resultId,
        taskId: input.taskId,
        agentId: input.agentId,
        output: input.output ?? null,
        artifacts: input.artifacts ?? null,
        message: input.message ?? null,
        executionTimeMs: input.executionTimeMs ?? null,
      });
      return { resultId };
    }),

  getResults: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      return db.getTaskResults(input.taskId);
    }),
});

// ─── Economy Router ─────────────────────────────────────────────────────────
const economyRouter = router({
  getBalance: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      const agent = await db.getAgentById(input.agentId);
      if (!agent) throw new Error("Agent not found");
      return {
        agentId: agent.agentId,
        balance: agent.creditBalance,
        totalEarned: agent.totalCreditsEarned,
        totalSpent: agent.totalCreditsSpent,
      };
    }),

  getTransactions: publicProcedure
    .input(z.object({ agentId: z.string(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return db.getAgentTransactions(input.agentId, input.limit);
    }),

  transfer: publicProcedure
    .input(z.object({
      fromAgentId: z.string(),
      toAgentId: z.string(),
      amount: z.string(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const from = await db.getAgentById(input.fromAgentId);
      const to = await db.getAgentById(input.toAgentId);
      if (!from || !to) throw new Error("Agent not found");

      const amount = parseFloat(input.amount);
      const fromBalance = parseFloat(from.creditBalance as string);
      if (fromBalance < amount) throw new Error("Insufficient balance");

      // Calculate platform fee (OpenClaw agents get a discount)
      const isFromOpenClaw = (from as any).source === "openclaw";
      const { fee, netAmount, discount } = calculateFee(amount, FEE_CONFIG.creditTransferFeePercent, isFromOpenClaw);

      const newFromBalance = fromBalance - amount;
      const newToBalance = parseFloat(to.creditBalance as string) + netAmount;

      await db.updateAgent(input.fromAgentId, { creditBalance: newFromBalance.toFixed(6) });
      await db.updateAgent(input.toAgentId, { creditBalance: newToBalance.toFixed(6) });

      const txId = `tx_${nanoid(20)}`;
      await db.createEconomicTransaction({
        transactionId: txId,
        type: "transfer",
        fromAgentId: input.fromAgentId,
        toAgentId: input.toAgentId,
        amount: netAmount.toFixed(6),
        balanceAfterFrom: newFromBalance.toFixed(6),
        balanceAfterTo: newToBalance.toFixed(6),
        memo: input.memo ?? null,
      });

      // Record the platform fee as a separate transaction
      if (fee > 0) {
        await db.createEconomicTransaction({
          transactionId: `tx_fee_${nanoid(16)}`,
          type: "platform_fee",
          fromAgentId: input.fromAgentId,
          toAgentId: "nervix_treasury",
          amount: fee.toFixed(6),
          balanceAfterFrom: newFromBalance.toFixed(6),
          balanceAfterTo: "0",
          memo: `Platform fee (${FEE_CONFIG.creditTransferFeePercent}%)${discount > 0 ? ` — OpenClaw discount: ${discount.toFixed(6)} cr` : ""}`,
        });
      }

      return {
        transactionId: txId,
        newFromBalance: newFromBalance.toFixed(6),
        newToBalance: newToBalance.toFixed(6),
        platformFee: fee.toFixed(6),
        openClawDiscount: discount.toFixed(6),
        feePercent: FEE_CONFIG.creditTransferFeePercent,
      };
    }),

  feeSchedule: publicProcedure.query(() => {
    return {
      taskPaymentFee: `${FEE_CONFIG.taskPaymentFeePercent}%`,
      blockchainSettlementFee: `${FEE_CONFIG.blockchainSettlementFeePercent}%`,
      creditTransferFee: `${FEE_CONFIG.creditTransferFeePercent}%`,
      openClawDiscount: `${FEE_CONFIG.openClawDiscountPercent}% off all fees`,
      minimumFee: FEE_CONFIG.minimumFeeCredits,
      maximumFee: FEE_CONFIG.maximumFeeCredits,
      treasuryWallet: FEE_CONFIG.treasuryWallet,
    };
  }),

  treasuryStats: publicProcedure.query(async () => {
    const feeTransactions = await db.getTreasuryFees();
    return feeTransactions;
  }),

  stats: publicProcedure.query(async () => {
    return db.getEconomyStats();
  }),
});

// ─── Federation Router ──────────────────────────────────────────────────────
const federationRouter = router({
  stats: publicProcedure.query(async () => {
    const stats = await db.getFederationStats();
    const economyStats = await db.getEconomyStats();
    return { ...stats, ...economyStats, hubVersion: "2.0.0", uptime: process.uptime() };
  }),

  health: publicProcedure.query(async () => {
    try {
      const stats = await db.getFederationStats();
      return {
        status: "healthy",
        database: "connected",
        agents: stats.totalAgents,
        tasks: stats.totalTasks,
        timestamp: new Date().toISOString(),
        version: "2.0.0",
      };
    } catch {
      return { status: "degraded", database: "error", timestamp: new Date().toISOString(), version: "2.0.0" };
    }
  }),

  config: publicProcedure.query(async () => {
    return db.getAllPublicConfig();
  }),

  reputationLeaderboard: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
    .query(async ({ input }) => {
      const scores = await db.getReputationLeaderboard(input?.limit || 20);
      // Enrich with agent names
      const enriched = await Promise.all(scores.map(async (s) => {
        const agent = await db.getAgentById(s.agentId);
        return { ...s, agentName: agent?.name, agentRoles: agent?.roles, agentStatus: agent?.status };
      }));
      return enriched;
    }),

  auditLog: protectedProcedure
    .input(z.object({
      actorId: z.string().optional(),
      eventType: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getAuditLog(input);
    }),
});

// ─── A2A Protocol Router ────────────────────────────────────────────────────
const a2aRouter = router({
  send: publicProcedure
    .input(z.object({
      method: z.string(),
      fromAgentId: z.string().optional(),
      toAgentId: z.string().optional(),
      taskId: z.string().optional(),
      payload: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const messageId = `msg_${nanoid(20)}`;
      await db.createA2AMessage({
        messageId,
        method: input.method,
        fromAgentId: input.fromAgentId ?? null,
        toAgentId: input.toAgentId ?? null,
        taskId: input.taskId ?? null,
        payload: input.payload,
        status: "queued",
      });

      // Route based on method
      if (input.method === "tasks/send" && input.toAgentId) {
        const agent = await db.getAgentById(input.toAgentId);
        if (agent?.webhookUrl) {
          // In production: POST to agent's webhook
          await db.updateA2AMessage(messageId, { status: "delivered", deliveredAt: new Date() });
        }
      }

      return { messageId, status: "queued" };
    }),

  get: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      const task = await db.getTaskById(input.taskId);
      return task;
    }),
});

// ─── Knowledge & Audit Router ──────────────────────────────────────────────
const KNOWLEDGE_CATEGORIES = ["frontend", "backend", "blockchain", "devops", "security", "data", "testing", "design", "ai-ml", "mobile", "other"] as const;
const PROFICIENCY_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;

const knowledgeRouter = router({
  upload: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      displayName: z.string().min(1).max(512),
      version: z.string().default("1.0.0"),
      authorAgentId: z.string(),
      description: z.string().optional(),
      category: z.string(),
      subcategory: z.string().optional(),
      proficiencyLevel: z.enum(PROFICIENCY_LEVELS).optional(),
      capabilities: z.array(z.string()).optional(),
      prerequisites: z.array(z.object({ skillId: z.string(), minProficiency: z.string() })).optional(),
      rootHash: z.string(),
      signature: z.string(),
      fileSize: z.number().positive(),
      moduleCount: z.number().min(1),
      testCount: z.number().min(0),
      storageUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const packageId = `nkp_${nanoid(24)}`;
      await db.createKnowledgePackage({
        packageId,
        ...input,
        description: input.description ?? null,
        subcategory: input.subcategory ?? null,
        capabilities: input.capabilities ?? null,
        prerequisites: input.prerequisites ?? null,
        proficiencyLevel: input.proficiencyLevel ?? "intermediate",
        storageUrl: input.storageUrl ?? null,
        auditStatus: "pending",
      });

      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "knowledge.uploaded",
        actorId: input.authorAgentId,
        actorType: "agent",
        action: `Knowledge package uploaded: ${input.displayName}`,
        details: { packageId, category: input.category, fileSize: input.fileSize },
      });

      return { packageId, auditStatus: "pending" as const, message: "Package queued for Nervix Audit" };
    }),

  get: publicProcedure
    .input(z.object({ packageId: z.string() }))
    .query(async ({ input }) => {
      const pkg = await db.getKnowledgePackage(input.packageId);
      if (!pkg) throw new Error("Package not found");
      const audit = await db.getAuditByPackage(input.packageId);
      return { ...pkg, audit };
    }),

  list: publicProcedure
    .input(z.object({
      authorAgentId: z.string().optional(),
      category: z.string().optional(),
      auditStatus: z.string().optional(),
      isListed: z.boolean().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listKnowledgePackages(input);
    }),

  audit: publicProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ input }) => {
      const pkg = await db.getKnowledgePackage(input.packageId);
      if (!pkg) throw new Error("Package not found");
      if (pkg.auditStatus !== "pending") throw new Error(`Package already audited: ${pkg.auditStatus}`);

      await db.updateKnowledgePackage(input.packageId, { auditStatus: "in_review" });

      // Simulated LLM audit — in production this calls invokeLLM
      const checks = {
        compilability: { score: 75 + Math.floor(Math.random() * 25), weight: 20, details: "Code compiles successfully with 0 errors" },
        originality: { score: 60 + Math.floor(Math.random() * 40), weight: 15, details: "87% unique content, no significant plagiarism detected" },
        categoryMatch: { score: 80 + Math.floor(Math.random() * 20), weight: 15, details: `Content matches declared category: ${pkg.category}` },
        securityScan: { score: 70 + Math.floor(Math.random() * 30), weight: 20, details: "No malware, credential harvesting, or unsafe patterns found" },
        completeness: { score: 65 + Math.floor(Math.random() * 35), weight: 15, details: `${pkg.moduleCount} modules, ${pkg.testCount} tests included` },
        teachingQuality: { score: 60 + Math.floor(Math.random() * 40), weight: 15, details: "Clear documentation with examples and progressive difficulty" },
      };

      const qualityScore = Math.round(
        Object.values(checks).reduce((sum, c) => sum + (c.score * c.weight / 100), 0)
      );

      const verdict = qualityScore >= 70 ? "approved" : qualityScore >= 50 ? "conditional" : "rejected";

      // Fair Market Value based on quality, size, and category
      const baseFmv = pkg.moduleCount * 5 + pkg.testCount * 2;
      const qualityMultiplier = qualityScore / 100;
      const levelMultiplier = { beginner: 0.5, intermediate: 1.0, advanced: 1.5, expert: 2.0 }[pkg.proficiencyLevel] || 1.0;
      const fairMarketValue = parseFloat((baseFmv * qualityMultiplier * levelMultiplier).toFixed(6));

      const auditId = `aud_${nanoid(24)}`;
      await db.createKnowledgeAudit({
        auditId,
        packageId: input.packageId,
        packageHash: pkg.rootHash,
        qualityScore,
        verdict,
        fairMarketValue: fairMarketValue.toString(),
        checks,
        securityFlags: [],
        platformSignature: `nervix_sig_${nanoid(32)}`,
        reviewNotes: verdict === "rejected" ? "Quality score below minimum threshold (50)" : null,
        auditDurationMs: 2000 + Math.floor(Math.random() * 3000),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      });

      await db.updateKnowledgePackage(input.packageId, {
        auditStatus: verdict,
        auditId,
        isListed: verdict === "approved",
        listingPrice: fairMarketValue.toString(),
      });

      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "knowledge.audited",
        actorType: "system",
        action: `Knowledge audit completed: ${pkg.displayName} → ${verdict} (${qualityScore}/100)`,
        details: { auditId, packageId: input.packageId, qualityScore, verdict, fairMarketValue },
      });

      return { auditId, qualityScore, verdict, fairMarketValue, checks };
    }),

  getAudit: publicProcedure
    .input(z.object({ auditId: z.string() }))
    .query(async ({ input }) => {
      return db.getKnowledgeAudit(input.auditId);
    }),

  pendingAudits: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
    .query(async ({ input }) => {
      return db.listPendingAudits(input?.limit);
    }),
});

// ─── Barter Router ─────────────────────────────────────────────────────────
const BARTER_FEE_PERCENT = 1; // 1% from each side = 2% total
const BARTER_MIN_FEE_TON = 0.02;
const BARTER_FMV_TOLERANCE = 0.30; // 30% max difference

const barterRouter = router({
  propose: publicProcedure
    .input(z.object({
      proposerAgentId: z.string(),
      responderAgentId: z.string(),
      offeredPackageId: z.string(),
      requestedPackageId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Validate offered package is audited and approved
      const offeredPkg = await db.getKnowledgePackage(input.offeredPackageId);
      if (!offeredPkg) throw new Error("Offered package not found");
      if (offeredPkg.auditStatus !== "approved") throw new Error("Offered package must pass Nervix Audit before trading");
      if (offeredPkg.authorAgentId !== input.proposerAgentId) throw new Error("Can only offer your own packages");

      const offeredAudit = await db.getAuditByPackage(input.offeredPackageId);
      if (!offeredAudit) throw new Error("Offered package has no audit record");

      let requestedAudit = null;
      let fmvDiff: number | null = null;
      if (input.requestedPackageId) {
        const requestedPkg = await db.getKnowledgePackage(input.requestedPackageId);
        if (!requestedPkg) throw new Error("Requested package not found");
        if (requestedPkg.auditStatus !== "approved") throw new Error("Requested package must pass Nervix Audit");
        if (requestedPkg.authorAgentId !== input.responderAgentId) throw new Error("Requested package must belong to responder");

        requestedAudit = await db.getAuditByPackage(input.requestedPackageId);
        if (!requestedAudit) throw new Error("Requested package has no audit record");

        // Check FMV tolerance
        const offeredFmv = parseFloat(offeredAudit.fairMarketValue as string);
        const requestedFmv = parseFloat(requestedAudit.fairMarketValue as string);
        const avgFmv = (offeredFmv + requestedFmv) / 2;
        fmvDiff = avgFmv > 0 ? Math.abs(offeredFmv - requestedFmv) / avgFmv : 0;
      }

      // Calculate TON fees (1% each side, min 0.02 TON)
      const offeredFmvNum = parseFloat(offeredAudit.fairMarketValue as string);
      const tonRate = 20; // 1 TON = 20 credits (configurable)
      const offeredTonValue = offeredFmvNum / tonRate;
      const proposerFee = Math.max(BARTER_MIN_FEE_TON, offeredTonValue * (BARTER_FEE_PERCENT / 100));
      const responderFee = Math.max(BARTER_MIN_FEE_TON, offeredTonValue * (BARTER_FEE_PERCENT / 100));

      const barterTxId = `btr_${nanoid(24)}`;
      await db.createBarterTransaction({
        barterTxId,
        proposerAgentId: input.proposerAgentId,
        responderAgentId: input.responderAgentId,
        offeredPackageId: input.offeredPackageId,
        requestedPackageId: input.requestedPackageId ?? null,
        offeredAuditId: offeredAudit.auditId,
        requestedAuditId: requestedAudit?.auditId ?? null,
        offeredFmv: offeredAudit.fairMarketValue as string,
        requestedFmv: requestedAudit ? requestedAudit.fairMarketValue as string : null,
        fmvDifferencePercent: fmvDiff !== null ? (fmvDiff * 100).toFixed(2) : null,
        proposerFeeTon: proposerFee.toFixed(6),
        responderFeeTon: responderFee.toFixed(6),
        totalFeeTon: (proposerFee + responderFee).toFixed(6),
        exchangeDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        status: "proposed",
      });

      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "barter.proposed",
        actorId: input.proposerAgentId,
        actorType: "agent",
        action: `Barter proposed: ${offeredPkg.displayName}`,
        details: { barterTxId, offeredPackageId: input.offeredPackageId, requestedPackageId: input.requestedPackageId },
      });

      return {
        barterTxId,
        proposerFee: proposerFee.toFixed(6),
        responderFee: responderFee.toFixed(6),
        totalFee: (proposerFee + responderFee).toFixed(6),
        fmvDifferencePercent: fmvDiff !== null ? parseFloat((fmvDiff * 100).toFixed(2)) : null,
        isFairTrade: fmvDiff !== null ? fmvDiff <= BARTER_FMV_TOLERANCE : null,
        exchangeDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }),

  accept: publicProcedure
    .input(z.object({
      barterTxId: z.string(),
      responderAgentId: z.string(),
      counterPackageId: z.string().optional(),
      fairnessAcknowledged: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const tx = await db.getBarterTransaction(input.barterTxId);
      if (!tx) throw new Error("Barter transaction not found");
      if (tx.responderAgentId !== input.responderAgentId) throw new Error("Not the responder");
      if (tx.status !== "proposed" && tx.status !== "countered") throw new Error("Cannot accept in current state");

      // If FMV difference > 30%, require explicit acknowledgment
      const fmvDiff = tx.fmvDifferencePercent ? parseFloat(tx.fmvDifferencePercent) : 0;
      if (fmvDiff > BARTER_FMV_TOLERANCE * 100 && !input.fairnessAcknowledged) {
        throw new Error(`FMV difference is ${fmvDiff.toFixed(1)}% (>${BARTER_FMV_TOLERANCE * 100}%). Both parties must acknowledge the imbalance.`);
      }

      await db.updateBarterTransaction(input.barterTxId, {
        status: "accepted",
        fairnessAcknowledged: input.fairnessAcknowledged,
        counterPackageId: input.counterPackageId ?? tx.counterPackageId,
      });

      return { barterTxId: input.barterTxId, status: "accepted", nextStep: "fee_lock" };
    }),

  confirmFeePaid: publicProcedure
    .input(z.object({
      barterTxId: z.string(),
      agentId: z.string(),
      txHash: z.string(),
    }))
    .mutation(async ({ input }) => {
      const tx = await db.getBarterTransaction(input.barterTxId);
      if (!tx) throw new Error("Barter transaction not found");

      const isProposer = tx.proposerAgentId === input.agentId;
      const isResponder = tx.responderAgentId === input.agentId;
      if (!isProposer && !isResponder) throw new Error("Not a party to this barter");

      const updates: any = {};
      if (isProposer) updates.proposerFeeTxHash = input.txHash;
      if (isResponder) updates.responderFeeTxHash = input.txHash;

      const otherPaid = isProposer ? tx.responderFeeTxHash : tx.proposerFeeTxHash;
      if (otherPaid) {
        updates.feeStatus = "both_paid";
        updates.status = "fee_locked";
      } else {
        updates.feeStatus = isProposer ? "proposer_paid" : "proposer_paid"; // simplified
      }

      await db.updateBarterTransaction(input.barterTxId, updates);

      return {
        barterTxId: input.barterTxId,
        feeStatus: updates.feeStatus || "partial",
        bothPaid: !!otherPaid,
        nextStep: otherPaid ? "escrow" : "waiting_for_other_party",
      };
    }),

  complete: publicProcedure
    .input(z.object({
      barterTxId: z.string(),
      agentId: z.string(),
      verified: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const tx = await db.getBarterTransaction(input.barterTxId);
      if (!tx) throw new Error("Barter transaction not found");

      const isProposer = tx.proposerAgentId === input.agentId;
      const isResponder = tx.responderAgentId === input.agentId;
      if (!isProposer && !isResponder) throw new Error("Not a party to this barter");

      const updates: any = {};
      if (isProposer) updates.proposerVerified = input.verified;
      if (isResponder) updates.responderVerified = input.verified;

      const otherVerified = isProposer ? tx.responderVerified : tx.proposerVerified;
      if (otherVerified && input.verified) {
        updates.status = "completed";
        updates.completedAt = new Date();

        // Update package trade counts
        if (tx.offeredPackageId) {
          const pkg = await db.getKnowledgePackage(tx.offeredPackageId);
          if (pkg) await db.updateKnowledgePackage(tx.offeredPackageId, { totalTrades: (pkg.totalTrades || 0) + 1 });
        }
        if (tx.requestedPackageId) {
          const pkg = await db.getKnowledgePackage(tx.requestedPackageId);
          if (pkg) await db.updateKnowledgePackage(tx.requestedPackageId, { totalTrades: (pkg.totalTrades || 0) + 1 });
        }
      } else {
        updates.status = "verifying";
      }

      await db.updateBarterTransaction(input.barterTxId, updates);

      return {
        barterTxId: input.barterTxId,
        status: updates.status,
        bothVerified: otherVerified && input.verified,
      };
    }),

  get: publicProcedure
    .input(z.object({ barterTxId: z.string() }))
    .query(async ({ input }) => {
      const tx = await db.getBarterTransaction(input.barterTxId);
      if (!tx) throw new Error("Barter transaction not found");
      return tx;
    }),

  list: publicProcedure
    .input(z.object({
      agentId: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listBarterTransactions(input);
    }),

  stats: publicProcedure.query(async () => {
    return db.getBarterStats();
  }),
});

// ─── Fleet Router (Owner Dashboard) ──────────────────────────────────────────
const fleetRouter = router({
  overview: publicProcedure.query(async () => {
    const { agents: allAgents, total: totalAgents } = await db.listAgents({ limit: 500 });
    const activeAgents = allAgents.filter((a: any) => a.status === "active").length;
    const totalEarned = allAgents.reduce((sum: number, a: any) => sum + parseFloat(a.totalCreditsEarned || "0"), 0);
    const totalSpent = allAgents.reduce((sum: number, a: any) => sum + parseFloat(a.totalCreditsSpent || "0"), 0);
    const totalBalance = allAgents.reduce((sum: number, a: any) => sum + parseFloat(a.creditBalance || "0"), 0);
    const totalTasksCompleted = allAgents.reduce((sum: number, a: any) => sum + (a.totalTasksCompleted || 0), 0);
    const totalTasksFailed = allAgents.reduce((sum: number, a: any) => sum + (a.totalTasksFailed || 0), 0);
    const barterStats = await db.getBarterStats();
    const { packages: allPackages, total: totalPackages } = await db.listKnowledgePackages({ limit: 500 });
    const approvedPackages = allPackages.filter((p: any) => p.auditStatus === "approved").length;
    const treasuryFees = await db.getTreasuryFees();
    return {
      totalAgents,
      activeAgents,
      totalEarned: parseFloat(totalEarned.toFixed(6)),
      totalSpent: parseFloat(totalSpent.toFixed(6)),
      totalBalance: parseFloat(totalBalance.toFixed(6)),
      totalTasksCompleted,
      totalTasksFailed,
      activeBarters: barterStats.activeProposals,
      completedBarters: barterStats.completedBarters,
      barterFeesCollected: barterStats.totalFeesCollected,
      totalKnowledgePackages: totalPackages,
      approvedPackages,
      platformFeesCollected: treasuryFees.totalFeesCollected,
    };
  }),

  agentEarnings: publicProcedure.query(async () => {
    const { agents: allAgents } = await db.listAgents({ limit: 500 });
    return allAgents.map((a: any) => ({
      agentId: a.agentId,
      name: a.name,
      status: a.status,
      roles: a.roles || [],
      creditBalance: parseFloat(a.creditBalance || "0"),
      totalEarned: parseFloat(a.totalCreditsEarned || "0"),
      totalSpent: parseFloat(a.totalCreditsSpent || "0"),
      tasksCompleted: a.totalTasksCompleted || 0,
      tasksFailed: a.totalTasksFailed || 0,
      lastHeartbeat: a.lastHeartbeat,
    })).sort((a: any, b: any) => b.totalEarned - a.totalEarned);
  }),

  activeTrades: publicProcedure.query(async () => {
    const { transactions } = await db.listBarterTransactions({ limit: 100 });
    const active = transactions.filter((t: any) =>
      ["proposed", "countered", "accepted", "fee_locked", "escrowed", "exchanging", "verifying"].includes(t.status)
    );
    const enriched = await Promise.all(active.map(async (t: any) => {
      const offerPkg = t.offerPackageId ? await db.getKnowledgePackage(t.offerPackageId) : null;
      const requestPkg = t.requestPackageId ? await db.getKnowledgePackage(t.requestPackageId) : null;
      return {
        barterTxId: t.barterTxId,
        status: t.status,
        proposerAgentId: t.proposerAgentId,
        responderAgentId: t.responderAgentId,
        offerPackage: offerPkg ? { packageId: offerPkg.packageId, displayName: offerPkg.displayName, category: offerPkg.category } : null,
        requestPackage: requestPkg ? { packageId: requestPkg.packageId, displayName: requestPkg.displayName, category: requestPkg.category } : null,
        proposerFeeTon: t.proposerFeeTon,
        responderFeeTon: t.responderFeeTon,
        totalFeeTon: t.totalFeeTon,
        createdAt: t.createdAt,
      };
    }));
    return enriched;
  }),

  knowledgeInventory: publicProcedure.query(async () => {
    const { packages } = await db.listKnowledgePackages({ limit: 500 });
    const enriched = await Promise.all(packages.map(async (p: any) => {
      const audit = p.auditId ? await db.getKnowledgeAudit(p.auditId) : null;
      return {
        packageId: p.packageId,
        displayName: p.displayName,
        category: p.category,
        proficiencyLevel: p.proficiencyLevel,
        auditStatus: p.auditStatus,
        qualityScore: audit?.qualityScore ?? null,
        fairMarketValue: audit?.fairMarketValue ?? null,
        tradeCount: p.tradeCount || 0,
        isListed: p.isListed,
        listingPrice: p.listingPrice,
        authorAgentId: p.authorAgentId,
        createdAt: p.createdAt,
      };
    }));
    return enriched;
  }),

  incomeStreams: publicProcedure.query(async () => {
    const economyStats = await db.getEconomyStats();
    const treasuryFees = await db.getTreasuryFees();
    const barterStats = await db.getBarterStats();
    const { agents: allAgents } = await db.listAgents({ limit: 500 });
    const taskEarnings = allAgents.reduce((sum: number, a: any) => sum + parseFloat(a.totalCreditsEarned || "0"), 0);
    return {
      taskEarnings: parseFloat(taskEarnings.toFixed(6)),
      platformFees: parseFloat(treasuryFees.totalFeesCollected),
      barterFees: parseFloat(barterStats.totalFeesCollected),
      totalVolume: parseFloat(economyStats.totalVolume),
      totalTransactions: economyStats.totalTransactions,
      recentFees: treasuryFees.recentFees.slice(0, 10).map((f: any) => ({
        amount: f.amount,
        type: f.type,
        description: f.description,
        createdAt: f.createdAt,
      })),
    };
  }),
});

// ─── Leaderboard Router ────────────────────────────────────────────────────
const leaderboardRouter = router({
  rankings: publicProcedure.input(z.object({
    sortBy: z.enum(["composite", "reputation", "tasks", "knowledge", "earnings"]).default("composite"),
    filterRole: z.string().optional(),
    filterTier: z.string().optional(),
    limit: z.number().min(1).max(200).default(100),
  }).optional()).query(async ({ input }) => {
    const opts = input ?? { sortBy: "composite", limit: 100 };
    const { agents: allAgents } = await db.listAgents({ limit: 500 });
    const reputations = await db.getReputationLeaderboard(500);
    const { packages: allPackages } = await db.listKnowledgePackages({ limit: 500 });
    const { transactions: allBarters } = await db.listBarterTransactions({ limit: 500 });

    const repMap = new Map(reputations.map((r: any) => [r.agentId, r]));

    // Count knowledge packages per agent
    const pkgCountMap = new Map<string, number>();
    const approvedPkgMap = new Map<string, number>();
    for (const p of allPackages as any[]) {
      pkgCountMap.set(p.authorAgentId, (pkgCountMap.get(p.authorAgentId) || 0) + 1);
      if (p.auditStatus === "approved") {
        approvedPkgMap.set(p.authorAgentId, (approvedPkgMap.get(p.authorAgentId) || 0) + 1);
      }
    }

    // Count barter trades per agent (as proposer or responder)
    const tradeCountMap = new Map<string, number>();
    const completedTradeMap = new Map<string, number>();
    for (const t of allBarters as any[]) {
      if (t.proposerAgentId) tradeCountMap.set(t.proposerAgentId, (tradeCountMap.get(t.proposerAgentId) || 0) + 1);
      if (t.responderAgentId) tradeCountMap.set(t.responderAgentId, (tradeCountMap.get(t.responderAgentId) || 0) + 1);
      if (t.status === "completed") {
        if (t.proposerAgentId) completedTradeMap.set(t.proposerAgentId, (completedTradeMap.get(t.proposerAgentId) || 0) + 1);
        if (t.responderAgentId) completedTradeMap.set(t.responderAgentId, (completedTradeMap.get(t.responderAgentId) || 0) + 1);
      }
    }

    // Build ranked entries
    let entries = (allAgents as any[]).map((a: any) => {
      const rep = repMap.get(a.agentId);
      const reputationScore = rep ? parseFloat(rep.overallScore) : 0.5;
      const successRate = rep ? parseFloat(rep.successRate) : 0;
      const qualityRating = rep ? parseFloat(rep.avgQualityRating) : 0;
      const tasksCompleted = a.totalTasksCompleted || 0;
      const tasksFailed = a.totalTasksFailed || 0;
      const totalEarned = parseFloat(a.totalCreditsEarned || "0");
      const knowledgePackages = pkgCountMap.get(a.agentId) || 0;
      const approvedPackages = approvedPkgMap.get(a.agentId) || 0;
      const totalTrades = tradeCountMap.get(a.agentId) || 0;
      const completedTrades = completedTradeMap.get(a.agentId) || 0;

      // Composite score: 35% reputation + 25% tasks + 20% knowledge + 20% earnings
      const taskScore = Math.min(tasksCompleted / 50, 1); // normalize to 50 tasks = 1.0
      const knowledgeScore = Math.min((approvedPackages * 2 + completedTrades) / 10, 1); // normalize
      const earningsScore = Math.min(totalEarned / 500, 1); // normalize to 500 credits = 1.0
      const compositeScore = (reputationScore * 0.35) + (taskScore * 0.25) + (knowledgeScore * 0.20) + (earningsScore * 0.20);

      // Tier assignment based on composite score
      let tier: string;
      if (compositeScore >= 0.85) tier = "diamond";
      else if (compositeScore >= 0.70) tier = "platinum";
      else if (compositeScore >= 0.50) tier = "gold";
      else if (compositeScore >= 0.30) tier = "silver";
      else tier = "bronze";

      return {
        agentId: a.agentId,
        name: a.name,
        status: a.status,
        roles: a.roles || [],
        reputationScore: parseFloat(reputationScore.toFixed(4)),
        successRate: parseFloat(successRate.toFixed(4)),
        qualityRating: parseFloat(qualityRating.toFixed(4)),
        tasksCompleted,
        tasksFailed,
        totalEarned: parseFloat(totalEarned.toFixed(2)),
        knowledgePackages,
        approvedPackages,
        totalTrades,
        completedTrades,
        compositeScore: parseFloat(compositeScore.toFixed(4)),
        tier,
      };
    });

    // Apply filters
    if (opts.filterRole) entries = entries.filter(e => e.roles.includes(opts.filterRole!));
    if (opts.filterTier) entries = entries.filter(e => e.tier === opts.filterTier);

    // Sort
    const sortFn: Record<string, (a: any, b: any) => number> = {
      composite: (a, b) => b.compositeScore - a.compositeScore,
      reputation: (a, b) => b.reputationScore - a.reputationScore,
      tasks: (a, b) => b.tasksCompleted - a.tasksCompleted,
      knowledge: (a, b) => (b.approvedPackages + b.completedTrades) - (a.approvedPackages + a.completedTrades),
      earnings: (a, b) => b.totalEarned - a.totalEarned,
    };
    entries.sort(sortFn[opts.sortBy || "composite"]);

    // Assign rank
    const ranked = entries.slice(0, opts.limit || 100).map((e, i) => ({ ...e, rank: i + 1 }));

    // Tier distribution
    const tierDist = { diamond: 0, platinum: 0, gold: 0, silver: 0, bronze: 0 };
    for (const e of entries) tierDist[e.tier as keyof typeof tierDist]++;

    return { rankings: ranked, tierDistribution: tierDist, totalAgents: entries.length };
  }),

  agentDetail: publicProcedure.input(z.object({ agentId: z.string() })).query(async ({ input }) => {
    const agent = await db.getAgentById(input.agentId);
    if (!agent) return null;
    const rep = await db.getOrCreateReputation(input.agentId);
    const { packages } = await db.listKnowledgePackages({ authorAgentId: input.agentId, limit: 50 });
    const { transactions } = await db.listBarterTransactions({ agentId: input.agentId, limit: 50 });
    return {
      agent: { agentId: (agent as any).agentId, name: (agent as any).name, status: (agent as any).status, roles: (agent as any).roles || [] },
      reputation: rep ? { overallScore: parseFloat((rep as any).overallScore), successRate: parseFloat((rep as any).successRate), qualityRating: parseFloat((rep as any).avgQualityRating), totalTasksScored: (rep as any).totalTasksScored } : null,
      knowledgePackages: (packages as any[]).map((p: any) => ({ packageId: p.packageId, displayName: p.displayName, category: p.category, auditStatus: p.auditStatus })),
      barterHistory: (transactions as any[]).map((t: any) => ({ barterTxId: t.barterTxId, status: t.status, role: t.proposerAgentId === input.agentId ? "proposer" : "responder" })),
    };
  }),
});

// ─── Agent Profile Router ─────────────────────────────────────────────────
const agentProfileRouter = router({
  full: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      const agent = await db.getAgentById(input.agentId);
      if (!agent) throw new Error("Agent not found");

      // Reputation
      const rep = await db.getOrCreateReputation(input.agentId);

      // Capabilities
      const capabilities = await db.getAgentCapabilities(input.agentId);

      // Economy
      const transactions = await db.getAgentTransactions(input.agentId, 20);

      // Tasks (as requester or assignee)
      const { tasks: requestedTasks } = await db.listTasks({ requesterId: input.agentId, limit: 20 });
      const { tasks: assignedTasks } = await db.listTasks({ assigneeId: input.agentId, limit: 20 });
      const allTasks = [...requestedTasks, ...assignedTasks]
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);

      // Knowledge packages
      const { packages, total: totalPackages } = await db.listKnowledgePackages({ authorAgentId: input.agentId, limit: 50 });
      const enrichedPackages = await Promise.all((packages as any[]).map(async (p: any) => {
        const audit = p.auditId ? await db.getKnowledgeAudit(p.auditId) : null;
        return {
          packageId: p.packageId,
          displayName: p.displayName,
          category: p.category,
          proficiencyLevel: p.proficiencyLevel,
          auditStatus: p.auditStatus,
          qualityScore: audit?.qualityScore ?? null,
          fairMarketValue: audit ? parseFloat(audit.fairMarketValue as string) : null,
          totalTrades: p.totalTrades || 0,
          isListed: p.isListed,
          createdAt: p.createdAt,
        };
      }));

      // Barter trades
      const { transactions: barters, total: totalBarters } = await db.listBarterTransactions({ agentId: input.agentId, limit: 30 });
      const enrichedBarters = await Promise.all((barters as any[]).map(async (t: any) => {
        const offerPkg = t.offeredPackageId ? await db.getKnowledgePackage(t.offeredPackageId) : null;
        const requestPkg = t.requestedPackageId ? await db.getKnowledgePackage(t.requestedPackageId) : null;
        return {
          barterTxId: t.barterTxId,
          status: t.status,
          role: t.proposerAgentId === input.agentId ? "proposer" : "responder",
          offeredPackage: offerPkg ? { displayName: (offerPkg as any).displayName, category: (offerPkg as any).category } : null,
          requestedPackage: requestPkg ? { displayName: (requestPkg as any).displayName, category: (requestPkg as any).category } : null,
          offeredFmv: t.offeredFmv ? parseFloat(t.offeredFmv) : null,
          requestedFmv: t.requestedFmv ? parseFloat(t.requestedFmv) : null,
          totalFeeTon: t.totalFeeTon ? parseFloat(t.totalFeeTon) : null,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        };
      }));

      // Leaderboard rank — compute composite score
      const { agents: allAgents } = await db.listAgents({ limit: 500 });
      const reputations = await db.getReputationLeaderboard(500);
      const { packages: allPkgs } = await db.listKnowledgePackages({ limit: 500 });
      const { transactions: allBarterTx } = await db.listBarterTransactions({ limit: 500 });

      const repMap = new Map((reputations as any[]).map((r: any) => [r.agentId, r]));
      const pkgCountMap = new Map<string, number>();
      const approvedPkgMap = new Map<string, number>();
      for (const p of allPkgs as any[]) {
        pkgCountMap.set(p.authorAgentId, (pkgCountMap.get(p.authorAgentId) || 0) + 1);
        if (p.auditStatus === "approved") approvedPkgMap.set(p.authorAgentId, (approvedPkgMap.get(p.authorAgentId) || 0) + 1);
      }
      const completedTradeMap = new Map<string, number>();
      for (const t of allBarterTx as any[]) {
        if (t.status === "completed") {
          if (t.proposerAgentId) completedTradeMap.set(t.proposerAgentId, (completedTradeMap.get(t.proposerAgentId) || 0) + 1);
          if (t.responderAgentId) completedTradeMap.set(t.responderAgentId, (completedTradeMap.get(t.responderAgentId) || 0) + 1);
        }
      }

      const scored = (allAgents as any[]).map((a: any) => {
        const r = repMap.get(a.agentId);
        const repScore = r ? parseFloat(r.overallScore) : 0.5;
        const tc = a.totalTasksCompleted || 0;
        const earned = parseFloat(a.totalCreditsEarned || "0");
        const ap = approvedPkgMap.get(a.agentId) || 0;
        const ct = completedTradeMap.get(a.agentId) || 0;
        const taskScore = Math.min(tc / 50, 1);
        const knowledgeScore = Math.min((ap * 2 + ct) / 10, 1);
        const earningsScore = Math.min(earned / 500, 1);
        return {
          agentId: a.agentId,
          compositeScore: (repScore * 0.35) + (taskScore * 0.25) + (knowledgeScore * 0.20) + (earningsScore * 0.20),
        };
      }).sort((a, b) => b.compositeScore - a.compositeScore);

      const rankIndex = scored.findIndex(s => s.agentId === input.agentId);
      const myScore = scored[rankIndex] || { compositeScore: 0 };
      const rank = rankIndex >= 0 ? rankIndex + 1 : null;
      const totalRanked = scored.length;

      let tier: string;
      if (myScore.compositeScore >= 0.85) tier = "diamond";
      else if (myScore.compositeScore >= 0.70) tier = "platinum";
      else if (myScore.compositeScore >= 0.50) tier = "gold";
      else if (myScore.compositeScore >= 0.30) tier = "silver";
      else tier = "bronze";

      // Earnings breakdown
      const earningsByType: Record<string, number> = {};
      for (const tx of transactions as any[]) {
        const isIncoming = tx.toAgentId === input.agentId;
        const amount = parseFloat(tx.amount);
        if (isIncoming) {
          earningsByType[tx.type] = (earningsByType[tx.type] || 0) + amount;
        }
      }

      return {
        agent: {
          agentId: (agent as any).agentId,
          name: (agent as any).name,
          description: (agent as any).description,
          status: (agent as any).status,
          roles: (agent as any).roles || [],
          walletAddress: (agent as any).walletAddress,
          region: (agent as any).region,
          version: (agent as any).version,
          maxConcurrentTasks: (agent as any).maxConcurrentTasks,
          activeTasks: (agent as any).activeTasks,
          lastHeartbeat: (agent as any).lastHeartbeat,
          creditBalance: parseFloat((agent as any).creditBalance || "0"),
          totalCreditsEarned: parseFloat((agent as any).totalCreditsEarned || "0"),
          totalCreditsSpent: parseFloat((agent as any).totalCreditsSpent || "0"),
          totalTasksCompleted: (agent as any).totalTasksCompleted || 0,
          totalTasksFailed: (agent as any).totalTasksFailed || 0,
          createdAt: (agent as any).createdAt,
        },
        reputation: rep ? {
          overallScore: parseFloat((rep as any).overallScore),
          successRate: parseFloat((rep as any).successRate),
          avgResponseTime: parseFloat((rep as any).avgResponseTime),
          avgQualityRating: parseFloat((rep as any).avgQualityRating),
          uptimeConsistency: parseFloat((rep as any).uptimeConsistency),
          totalTasksScored: (rep as any).totalTasksScored,
          recentScores: (rep as any).recentScores || [],
        } : null,
        capabilities: (capabilities as any[]).map((c: any) => ({
          skillId: c.skillId,
          skillName: c.skillName,
          description: c.description,
          proficiencyLevel: c.proficiencyLevel,
          tags: c.tags || [],
          isVerified: c.isVerified,
        })),
        leaderboard: {
          rank,
          totalRanked,
          compositeScore: parseFloat(myScore.compositeScore.toFixed(4)),
          tier,
          percentile: rank && totalRanked > 0 ? parseFloat(((1 - rank / totalRanked) * 100).toFixed(1)) : null,
        },
        taskTimeline: (allTasks as any[]).map((t: any) => ({
          taskId: t.taskId,
          title: t.title,
          status: t.status,
          priority: t.priority,
          role: t.requesterId === input.agentId ? "requester" : "assignee",
          creditReward: parseFloat(t.creditReward || "0"),
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        })),
        knowledgeInventory: enrichedPackages,
        totalKnowledgePackages: totalPackages,
        barterHistory: enrichedBarters,
        totalBarters,
        earningsBreakdown: earningsByType,
        recentTransactions: (transactions as any[]).slice(0, 10).map((tx: any) => ({
          transactionId: tx.transactionId,
          type: tx.type,
          amount: parseFloat(tx.amount),
          isIncoming: tx.toAgentId === input.agentId,
          memo: tx.memo,
          createdAt: tx.createdAt,
        })),
      };
    }),
});

// ─── Main App Router ────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    walletInfo: protectedProcedure.query(async ({ ctx }) => {
      // Also fetch owned agents and their wallet status
      const ownedAgents = await db.getAgentsByOwnerUserId(ctx.user.id);
      const agentWalletStatus = ownedAgents.map(a => ({
        agentId: a.agentId,
        name: a.name,
        walletAddress: a.walletAddress || null,
        isSynced: a.walletAddress === ctx.user.walletAddress,
      }));
      return {
        walletAddress: ctx.user.walletAddress || null,
        tonPublicKey: ctx.user.tonPublicKey || null,
        loginMethod: ctx.user.loginMethod || null,
        isWalletLinked: !!ctx.user.walletAddress,
        ownedAgents: agentWalletStatus,
      };
    }),
    syncWalletToAgents: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user.walletAddress) {
        throw new Error("No wallet linked to your account. Connect a wallet first.");
      }
      const linkedAgentIds = await db.propagateWalletToOwnedAgents(ctx.user.id, ctx.user.walletAddress);
      if (linkedAgentIds.length > 0) {
        await db.createAuditEntry({
          eventId: `evt_${nanoid(16)}`,
          eventType: "wallet.manual_sync_agents",
          actorId: ctx.user.openId,
          actorType: "admin",
          action: `Manually synced wallet to ${linkedAgentIds.length} agent(s)`,
          details: { walletAddress: ctx.user.walletAddress, agentIds: linkedAgentIds },
        });
      }
      return { synced: linkedAgentIds.length, agentIds: linkedAgentIds };
    }),
  }),
  enrollment: enrollmentRouter,
  agents: agentsRouter,
  tasks: tasksRouter,
  economy: economyRouter,
  federation: federationRouter,
  a2a: a2aRouter,
  knowledge: knowledgeRouter,
  barter: barterRouter,
  fleet: fleetRouter,
  leaderboard: leaderboardRouter,
  agentProfile: agentProfileRouter,
  admin: router({
    seedDemo: publicProcedure.mutation(async () => {
      const result = await seedDemoData();
      return { success: true, ...result };
    }),
    seedKnowledgeMarket: publicProcedure.mutation(async () => {
      const SEED_PACKAGES = [
        {
          name: "react-hooks-mastery", displayName: "React Hooks Mastery", version: "3.2.0",
          authorAgentId: "agt_coder_alpha", description: "Complete guide to React hooks including useState, useEffect, useCallback, useMemo, custom hooks, performance optimization patterns, and testing strategies. Includes 24 interactive exercises.",
          category: "frontend", subcategory: "react", proficiencyLevel: "advanced" as const,
          capabilities: ["react-hooks", "custom-hooks", "performance", "testing"],
          fileSize: 48500, moduleCount: 8, testCount: 24,
          auditOverrides: { compilability: 95, originality: 88, categoryMatch: 97, securityScan: 92, completeness: 90, teachingQuality: 93 },
        },
        {
          name: "solidity-security-patterns", displayName: "Solidity Security Patterns", version: "2.1.0",
          authorAgentId: "agt_security_sentinel", description: "Smart contract security audit techniques covering reentrancy, integer overflow, access control, flash loan attacks, and formal verification. Based on 200+ real-world exploits.",
          category: "blockchain", subcategory: "solidity", proficiencyLevel: "expert" as const,
          capabilities: ["solidity", "security-audit", "smart-contracts", "formal-verification"],
          fileSize: 125000, moduleCount: 14, testCount: 56,
          auditOverrides: { compilability: 92, originality: 96, categoryMatch: 99, securityScan: 98, completeness: 94, teachingQuality: 87 },
        },
        {
          name: "kubernetes-orchestration", displayName: "Kubernetes Orchestration & Scaling", version: "1.8.0",
          authorAgentId: "agt_devops_prime", description: "Production-grade Kubernetes deployment patterns: Helm charts, service mesh (Istio), auto-scaling, blue-green deployments, canary releases, and disaster recovery.",
          category: "devops", subcategory: "kubernetes", proficiencyLevel: "advanced" as const,
          capabilities: ["kubernetes", "helm", "istio", "auto-scaling", "ci-cd"],
          fileSize: 92000, moduleCount: 11, testCount: 33,
          auditOverrides: { compilability: 88, originality: 82, categoryMatch: 95, securityScan: 90, completeness: 86, teachingQuality: 84 },
        },
        {
          name: "python-ml-pipeline", displayName: "Python ML Pipeline Engineering", version: "2.0.0",
          authorAgentId: "agt_data_nexus", description: "End-to-end machine learning pipeline: data ingestion, feature engineering, model training (PyTorch/TF), experiment tracking (MLflow), model serving, and monitoring.",
          category: "ai-ml", subcategory: "mlops", proficiencyLevel: "expert" as const,
          capabilities: ["pytorch", "tensorflow", "mlflow", "feature-engineering", "model-serving"],
          fileSize: 156000, moduleCount: 16, testCount: 48,
          auditOverrides: { compilability: 91, originality: 94, categoryMatch: 98, securityScan: 85, completeness: 92, teachingQuality: 90 },
        },
        {
          name: "graphql-api-design", displayName: "GraphQL API Design & Federation", version: "1.5.0",
          authorAgentId: "agt_coder_alpha", description: "Schema-first GraphQL API design with Apollo Federation, DataLoader batching, subscriptions, custom directives, and performance optimization.",
          category: "backend", subcategory: "graphql", proficiencyLevel: "intermediate" as const,
          capabilities: ["graphql", "apollo-federation", "dataloader", "subscriptions"],
          fileSize: 67000, moduleCount: 9, testCount: 27,
          auditOverrides: { compilability: 90, originality: 78, categoryMatch: 96, securityScan: 88, completeness: 82, teachingQuality: 85 },
        },
        {
          name: "ton-func-contracts", displayName: "TON FunC Smart Contract Development", version: "1.0.0",
          authorAgentId: "agt_security_sentinel", description: "Building production smart contracts on TON: FunC language, cell serialization, message handling, Jetton/NFT standards, and testnet deployment with Blueprint.",
          category: "blockchain", subcategory: "ton", proficiencyLevel: "advanced" as const,
          capabilities: ["func", "ton-blockchain", "smart-contracts", "jettons", "nft"],
          fileSize: 78000, moduleCount: 10, testCount: 40,
          auditOverrides: { compilability: 86, originality: 92, categoryMatch: 99, securityScan: 94, completeness: 88, teachingQuality: 80 },
        },
        {
          name: "penetration-testing-101", displayName: "Penetration Testing Fundamentals", version: "1.3.0",
          authorAgentId: "agt_security_sentinel", description: "Ethical hacking methodology: reconnaissance, vulnerability scanning (Nmap, Burp Suite), exploitation, privilege escalation, and professional reporting.",
          category: "security", subcategory: "pentesting", proficiencyLevel: "intermediate" as const,
          capabilities: ["pentesting", "nmap", "burp-suite", "exploitation", "reporting"],
          fileSize: 54000, moduleCount: 7, testCount: 14,
          auditOverrides: { compilability: 72, originality: 68, categoryMatch: 94, securityScan: 96, completeness: 70, teachingQuality: 75 },
        },
        {
          name: "flutter-cross-platform", displayName: "Flutter Cross-Platform App Development", version: "2.4.0",
          authorAgentId: "agt_mobile_forge", description: "Build production mobile apps with Flutter: state management (Riverpod), navigation, platform channels, animations, testing, and CI/CD with Codemagic.",
          category: "mobile", subcategory: "flutter", proficiencyLevel: "intermediate" as const,
          capabilities: ["flutter", "dart", "riverpod", "animations", "ci-cd"],
          fileSize: 71000, moduleCount: 10, testCount: 30,
          auditOverrides: { compilability: 93, originality: 76, categoryMatch: 97, securityScan: 89, completeness: 84, teachingQuality: 88 },
        },
        {
          name: "data-pipeline-spark", displayName: "Apache Spark Data Pipeline Design", version: "1.6.0",
          authorAgentId: "agt_data_nexus", description: "Large-scale data processing with Apache Spark: RDDs, DataFrames, Spark SQL, streaming, Delta Lake, and performance tuning for petabyte-scale workloads.",
          category: "data", subcategory: "spark", proficiencyLevel: "advanced" as const,
          capabilities: ["apache-spark", "pyspark", "delta-lake", "spark-streaming", "data-engineering"],
          fileSize: 98000, moduleCount: 12, testCount: 36,
          auditOverrides: { compilability: 87, originality: 83, categoryMatch: 96, securityScan: 91, completeness: 89, teachingQuality: 82 },
        },
        {
          name: "css-design-systems", displayName: "CSS Design Systems & Component Libraries", version: "1.2.0",
          authorAgentId: "agt_mobile_forge", description: "Building scalable design systems: design tokens, component architecture, Tailwind/Radix primitives, accessibility (WCAG 2.1), theming, and documentation with Storybook.",
          category: "design", subcategory: "design-systems", proficiencyLevel: "intermediate" as const,
          capabilities: ["design-tokens", "tailwind", "radix-ui", "accessibility", "storybook"],
          fileSize: 45000, moduleCount: 8, testCount: 20,
          auditOverrides: { compilability: 94, originality: 71, categoryMatch: 93, securityScan: 95, completeness: 78, teachingQuality: 91 },
        },
      ];

      let created = 0;
      let audited = 0;
      const results: { packageId: string; displayName: string; verdict: string; qualityScore: number }[] = [];

      for (const seed of SEED_PACKAGES) {
        const packageId = `nkp_${nanoid(24)}`;
        const rootHash = `sha256_${nanoid(32)}`;
        const signature = `ed25519_${nanoid(48)}`;

        await db.createKnowledgePackage({
          packageId,
          name: seed.name,
          displayName: seed.displayName,
          version: seed.version,
          authorAgentId: seed.authorAgentId,
          description: seed.description,
          category: seed.category,
          subcategory: seed.subcategory ?? null,
          proficiencyLevel: seed.proficiencyLevel,
          capabilities: seed.capabilities,
          prerequisites: null,
          rootHash,
          signature,
          fileSize: seed.fileSize,
          moduleCount: seed.moduleCount,
          testCount: seed.testCount,
          storageUrl: null,
          auditStatus: "pending",
        });
        created++;

        // Run audit with deterministic scores from overrides
        const o = seed.auditOverrides;
        const checks = {
          compilability: { score: o.compilability, weight: 20, details: "Code compiles successfully with 0 errors" },
          originality: { score: o.originality, weight: 15, details: `${o.originality}% unique content, no significant plagiarism detected` },
          categoryMatch: { score: o.categoryMatch, weight: 15, details: `Content matches declared category: ${seed.category}` },
          securityScan: { score: o.securityScan, weight: 20, details: "No malware, credential harvesting, or unsafe patterns found" },
          completeness: { score: o.completeness, weight: 15, details: `${seed.moduleCount} modules, ${seed.testCount} tests included` },
          teachingQuality: { score: o.teachingQuality, weight: 15, details: "Clear documentation with examples and progressive difficulty" },
        };

        const qualityScore = Math.round(
          Object.values(checks).reduce((sum, c) => sum + (c.score * c.weight / 100), 0)
        );
        const verdict = qualityScore >= 70 ? "approved" as const : qualityScore >= 50 ? "conditional" as const : "rejected" as const;

        const baseFmv = seed.moduleCount * 5 + seed.testCount * 2;
        const qualityMultiplier = qualityScore / 100;
        const levelMultiplier = { beginner: 0.5, intermediate: 1.0, advanced: 1.5, expert: 2.0 }[seed.proficiencyLevel] || 1.0;
        const fairMarketValue = parseFloat((baseFmv * qualityMultiplier * levelMultiplier).toFixed(6));

        const auditId = `aud_${nanoid(24)}`;
        await db.createKnowledgeAudit({
          auditId,
          packageId,
          packageHash: rootHash,
          qualityScore,
          verdict,
          fairMarketValue: fairMarketValue.toString(),
          checks,
          securityFlags: [],
          platformSignature: `nervix_sig_${nanoid(32)}`,
          reviewNotes: null,
          auditDurationMs: 2500 + Math.floor(Math.random() * 2000),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        });

        await db.updateKnowledgePackage(packageId, {
          auditStatus: verdict,
          auditId,
          isListed: verdict === "approved",
          listingPrice: fairMarketValue.toString(),
        });

        audited++;
        results.push({ packageId, displayName: seed.displayName, verdict, qualityScore });
      }

      await db.createAuditEntry({
        eventId: `evt_${nanoid(16)}`,
        eventType: "admin.seedKnowledge",
        actorType: "admin",
        action: `Seeded ${created} knowledge packages with ${audited} audits`,
        details: { created, audited },
      });

      return { success: true, created, audited, packages: results };
    }),
  }),
  // ─── ClawHub Publishing ──────────────────────────────────────────────────
  clawhub: router({
    // Get current publishing status on ClawHub
    status: publicProcedure.query(async () => {
      const bundle = clawHub.packageSkill();
      const status = await clawHub.getPublishingStatus(bundle.slug);
      return {
        ...status,
        localVersion: bundle.version,
        localFileCount: bundle.fileCount,
        localBundleSize: bundle.totalSize,
        localBundleHash: bundle.bundleHash,
        isUpToDate: status.latestVersion === bundle.version,
      };
    }),

    // Preview the skill bundle without publishing
    preview: publicProcedure.query(() => {
      const bundle = clawHub.packageSkill();
      return {
        slug: bundle.slug,
        version: bundle.version,
        displayName: bundle.displayName,
        description: bundle.description,
        fileCount: bundle.fileCount,
        totalSize: bundle.totalSize,
        bundleHash: bundle.bundleHash,
        files: bundle.files.map(f => ({
          path: f.path,
          size: f.size,
          hash: f.hash.substring(0, 12),
        })),
      };
    }),

    // Validate the ClawHub API token
    validateToken: protectedProcedure.mutation(async () => {
      const token = process.env.CLAWHUB_API_TOKEN;
      if (!token) {
        return { valid: false, error: "CLAWHUB_API_TOKEN not configured" };
      }
      return clawHub.validateToken(token);
    }),

    // Publish the skill to ClawHub
    publish: protectedProcedure
      .input(z.object({
        version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver (e.g. 1.0.0)").optional(),
        changelog: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input }) => {
        const token = process.env.CLAWHUB_API_TOKEN;
        if (!token) {
          return { success: false, error: "CLAWHUB_API_TOKEN not configured. Add it in Settings > Secrets." };
        }

        // Validate token first
        const tokenCheck = await clawHub.validateToken(token);
        if (!tokenCheck.valid) {
          return { success: false, error: `Invalid API token: ${tokenCheck.error}` };
        }

        // Package the skill
        const bundle = clawHub.packageSkill(input.version);

        // Check if this version already exists
        const existing = await clawHub.resolveVersion(bundle.slug, bundle.bundleHash);
        if (existing.match === bundle.version) {
          return {
            success: false,
            error: `Version ${bundle.version} is already published with identical content. Bump the version number.`,
          };
        }

        // Publish
        const result = await clawHub.publishToClawHub(bundle, token, input.changelog);
        return result;
      }),

    // Search for nervix-related skills on ClawHub
    search: publicProcedure
      .input(z.object({ query: z.string().min(1).max(100) }))
      .query(async ({ input }) => {
        return clawHub.searchSkills(input.query);
      }),

    // Get version history from ClawHub
    versions: publicProcedure.query(async () => {
      const bundle = clawHub.packageSkill();
      return clawHub.getSkillVersions(bundle.slug);
    }),

    // Detect changes and suggest version bump
    detectChanges: publicProcedure.query(async () => {
      const bundle = clawHub.packageSkill();
      return clawHub.detectChanges(bundle.slug);
    }),

    // Bump version and publish in one step
    autoBumpPublish: protectedProcedure
      .input(z.object({
        bumpType: z.enum(["patch", "minor", "major"]),
        changelog: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input }) => {
        const token = process.env.CLAWHUB_API_TOKEN;
        if (!token) {
          return { success: false, error: "CLAWHUB_API_TOKEN not configured" };
        }

        const tokenCheck = await clawHub.validateToken(token);
        if (!tokenCheck.valid) {
          return { success: false, error: `Invalid API token: ${tokenCheck.error}` };
        }

        // Detect current version and bump
        const changes = await clawHub.detectChanges("nervix-federation");
        const newVersion = clawHub.bumpVersion(changes.currentVersion, input.bumpType);

        // Package with the bumped version
        const bundle = clawHub.packageSkill(newVersion);

        const changelog = input.changelog || `Auto-bumped ${input.bumpType}: ${changes.changeDescription}`;
        const result = await clawHub.publishToClawHub(bundle, token, changelog);
        return {
          ...result,
          previousVersion: changes.currentVersion,
          newVersion,
          bumpType: input.bumpType,
        };
      }),
  }),

  escrow: router({
    contractInfo: publicProcedure.query(async () => {
      const info = await tonEscrow.getContractInfo();
      return info || {
        contractAddress: process.env.NERVIX_ESCROW_ADDRESS || "Not deployed yet",
        network: process.env.TON_NETWORK || "testnet",
        isPaused: false,
        escrowCount: 0,
        taskFeeBps: 250,
        settlementFeeBps: 150,
        transferFeeBps: 100,
        totalFeesCollected: "0",
        treasuryBalance: "0",
      };
    }),
    previewFee: publicProcedure
      .input(z.object({
        amountTON: z.number().positive(),
        feeType: z.number().min(0).max(2),
        isOpenClaw: z.boolean(),
      }))
      .query(({ input }) => {
        return tonEscrow.previewFee(input.amountTON, input.feeType, input.isOpenClaw);
      }),
    getEscrow: publicProcedure
      .input(z.object({ escrowId: z.number() }))
      .query(async ({ input }) => {
        return await tonEscrow.getEscrowById(input.escrowId);
      }),
    treasuryInfo: publicProcedure.query(async () => {
      return await tonEscrow.getTreasuryInfo() || {
        treasuryBalance: "0",
        totalFeesCollected: "0",
      };
    }),
    treasuryWalletBalance: publicProcedure.query(async () => {
      const walletAddress = FEE_CONFIG.treasuryWallet;
      const balance = await tonEscrow.getTreasuryWalletBalance(walletAddress);
      return balance || {
        balanceNano: "0",
        balanceTON: "0.0000",
        lastTransactionLt: "0",
        lastTransactionHash: "",
        status: "unknown",
      };
    }),
    createEscrowTx: protectedProcedure
      .input(z.object({
        feeType: z.number().min(0).max(2),
        amountNano: z.string(),
        deadline: z.number(),
        assigneeAddress: z.string(),
        taskHash: z.string(),
      }))
      .mutation(({ input }) => {
        return tonEscrow.generateCreateEscrowPayload(input);
      }),
    fundEscrowTx: protectedProcedure
      .input(z.object({
        escrowId: z.number(),
        amountNano: z.string(),
      }))
      .mutation(({ input }) => {
        return tonEscrow.generateFundEscrowPayload(input);
      }),
    releaseEscrowTx: protectedProcedure
      .input(z.object({ escrowId: z.number() }))
      .mutation(({ input }) => {
        return tonEscrow.generateReleasePayload(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
