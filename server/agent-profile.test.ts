import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Test Helpers ──────────────────────────────────────────────────────

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

const caller = appRouter.createCaller;

// ─── Agent Profile Full ──────────────────────────────────────────────

describe("agentProfile.full", () => {
  it("throws error for non-existent agent", async () => {
    const ctx = createPublicContext();
    await expect(
      caller(ctx).agentProfile.full({ agentId: "nonexistent_agent_999" })
    ).rejects.toThrow();
  });

  it("returns comprehensive profile for existing agent", async () => {
    const ctx = createPublicContext();

    // First get any agent from the registry
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) {
      // No agents in DB, skip
      return;
    }

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    // Verify top-level structure
    expect(profile).toBeDefined();
    expect(profile.agent).toBeDefined();
    expect(profile.leaderboard).toBeDefined();
    expect(profile.taskTimeline).toBeDefined();
    expect(profile.knowledgeInventory).toBeDefined();
    expect(profile.barterHistory).toBeDefined();
    expect(profile.earningsBreakdown).toBeDefined();
    expect(profile.recentTransactions).toBeDefined();
  });

  it("agent object has all required fields", async () => {
    const ctx = createPublicContext();
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) return;

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    const agent = profile.agent;
    expect(agent).toHaveProperty("agentId");
    expect(agent).toHaveProperty("name");
    expect(agent).toHaveProperty("status");
    expect(agent).toHaveProperty("roles");
    expect(agent).toHaveProperty("creditBalance");
    expect(agent).toHaveProperty("totalCreditsEarned");
    expect(agent).toHaveProperty("totalCreditsSpent");
    expect(agent).toHaveProperty("totalTasksCompleted");
    expect(agent).toHaveProperty("totalTasksFailed");
    expect(agent).toHaveProperty("createdAt");
    expect(typeof agent.creditBalance).toBe("number");
    expect(typeof agent.totalCreditsEarned).toBe("number");
    expect(typeof agent.totalCreditsSpent).toBe("number");
  });

  it("leaderboard object has rank, tier, and composite score", async () => {
    const ctx = createPublicContext();
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) return;

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    const lb = profile.leaderboard;
    expect(lb).toHaveProperty("rank");
    expect(lb).toHaveProperty("totalRanked");
    expect(lb).toHaveProperty("compositeScore");
    expect(lb).toHaveProperty("tier");
    expect(lb).toHaveProperty("percentile");
    expect(typeof lb.compositeScore).toBe("number");
    expect(["diamond", "platinum", "gold", "silver", "bronze"]).toContain(lb.tier);
    if (lb.rank !== null) {
      expect(lb.rank).toBeGreaterThanOrEqual(1);
      expect(lb.rank).toBeLessThanOrEqual(lb.totalRanked);
    }
  });

  it("reputation object has score breakdown", async () => {
    const ctx = createPublicContext();
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) return;

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    if (profile.reputation) {
      expect(profile.reputation).toHaveProperty("overallScore");
      expect(profile.reputation).toHaveProperty("successRate");
      expect(profile.reputation).toHaveProperty("avgResponseTime");
      expect(profile.reputation).toHaveProperty("avgQualityRating");
      expect(profile.reputation).toHaveProperty("uptimeConsistency");
      expect(profile.reputation).toHaveProperty("totalTasksScored");
      expect(typeof profile.reputation.overallScore).toBe("number");
      expect(typeof profile.reputation.successRate).toBe("number");
    }
  });

  it("taskTimeline entries have required fields", async () => {
    const ctx = createPublicContext();
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) return;

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    expect(Array.isArray(profile.taskTimeline)).toBe(true);
    if (profile.taskTimeline.length > 0) {
      const task = profile.taskTimeline[0];
      expect(task).toHaveProperty("taskId");
      expect(task).toHaveProperty("title");
      expect(task).toHaveProperty("status");
      expect(task).toHaveProperty("priority");
      expect(task).toHaveProperty("role");
      expect(task).toHaveProperty("creditReward");
      expect(["requester", "assignee"]).toContain(task.role);
    }
  });

  it("knowledgeInventory entries have required fields", async () => {
    const ctx = createPublicContext();
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) return;

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    expect(Array.isArray(profile.knowledgeInventory)).toBe(true);
    if (profile.knowledgeInventory.length > 0) {
      const pkg = profile.knowledgeInventory[0];
      expect(pkg).toHaveProperty("packageId");
      expect(pkg).toHaveProperty("displayName");
      expect(pkg).toHaveProperty("category");
      expect(pkg).toHaveProperty("auditStatus");
      expect(pkg).toHaveProperty("totalTrades");
    }
  });

  it("barterHistory entries have required fields", async () => {
    const ctx = createPublicContext();
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) return;

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    expect(Array.isArray(profile.barterHistory)).toBe(true);
    if (profile.barterHistory.length > 0) {
      const trade = profile.barterHistory[0];
      expect(trade).toHaveProperty("barterTxId");
      expect(trade).toHaveProperty("status");
      expect(trade).toHaveProperty("role");
      expect(["proposer", "responder"]).toContain(trade.role);
    }
  });

  it("recentTransactions entries have required fields", async () => {
    const ctx = createPublicContext();
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) return;

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    expect(Array.isArray(profile.recentTransactions)).toBe(true);
    if (profile.recentTransactions.length > 0) {
      const tx = profile.recentTransactions[0];
      expect(tx).toHaveProperty("transactionId");
      expect(tx).toHaveProperty("type");
      expect(tx).toHaveProperty("amount");
      expect(tx).toHaveProperty("isIncoming");
      expect(typeof tx.amount).toBe("number");
      expect(typeof tx.isIncoming).toBe("boolean");
    }
  });

  it("earningsBreakdown is an object with numeric values", async () => {
    const ctx = createPublicContext();
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) return;

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    expect(typeof profile.earningsBreakdown).toBe("object");
    for (const val of Object.values(profile.earningsBreakdown)) {
      expect(typeof val).toBe("number");
    }
  });

  it("capabilities array has proper structure", async () => {
    const ctx = createPublicContext();
    const agentsList = await caller(ctx).agents.list({ limit: 1 });
    if (agentsList.agents.length === 0) return;

    const agentId = (agentsList.agents[0] as any).agentId;
    const profile = await caller(ctx).agentProfile.full({ agentId });

    expect(Array.isArray(profile.capabilities)).toBe(true);
    if (profile.capabilities.length > 0) {
      const cap = profile.capabilities[0];
      expect(cap).toHaveProperty("skillId");
      expect(cap).toHaveProperty("skillName");
      expect(cap).toHaveProperty("proficiencyLevel");
      expect(cap).toHaveProperty("isVerified");
    }
  });
});
