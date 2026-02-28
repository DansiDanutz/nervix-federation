import { describe, it, expect } from "vitest";
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

// ─── Rankings ─────────────────────────────────────────────────────────

describe("leaderboard.rankings", () => {
  it("returns rankings with default parameters", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings();

    expect(result).toBeDefined();
    expect(Array.isArray(result.rankings)).toBe(true);
    expect(typeof result.totalAgents).toBe("number");
    expect(result.tierDistribution).toBeDefined();
    expect(typeof result.tierDistribution.diamond).toBe("number");
    expect(typeof result.tierDistribution.platinum).toBe("number");
    expect(typeof result.tierDistribution.gold).toBe("number");
    expect(typeof result.tierDistribution.silver).toBe("number");
    expect(typeof result.tierDistribution.bronze).toBe("number");
  });

  it("each ranking entry has required fields", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings();

    if (result.rankings.length > 0) {
      const entry = result.rankings[0];
      expect(entry).toHaveProperty("rank");
      expect(entry).toHaveProperty("agentId");
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("status");
      expect(entry).toHaveProperty("roles");
      expect(entry).toHaveProperty("reputationScore");
      expect(entry).toHaveProperty("successRate");
      expect(entry).toHaveProperty("qualityRating");
      expect(entry).toHaveProperty("tasksCompleted");
      expect(entry).toHaveProperty("tasksFailed");
      expect(entry).toHaveProperty("totalEarned");
      expect(entry).toHaveProperty("knowledgePackages");
      expect(entry).toHaveProperty("approvedPackages");
      expect(entry).toHaveProperty("totalTrades");
      expect(entry).toHaveProperty("completedTrades");
      expect(entry).toHaveProperty("compositeScore");
      expect(entry).toHaveProperty("tier");
    }
  });

  it("rankings are sorted by composite score by default", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings();

    for (let i = 1; i < result.rankings.length; i++) {
      expect(result.rankings[i - 1].compositeScore).toBeGreaterThanOrEqual(result.rankings[i].compositeScore);
    }
  });

  it("rank numbers are sequential starting from 1", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings();

    for (let i = 0; i < result.rankings.length; i++) {
      expect(result.rankings[i].rank).toBe(i + 1);
    }
  });

  it("tier values are valid", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings();

    const validTiers = ["diamond", "platinum", "gold", "silver", "bronze"];
    for (const entry of result.rankings) {
      expect(validTiers).toContain(entry.tier);
    }
  });

  it("composite score is between 0 and 1", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings();

    for (const entry of result.rankings) {
      expect(entry.compositeScore).toBeGreaterThanOrEqual(0);
      expect(entry.compositeScore).toBeLessThanOrEqual(1);
    }
  });

  it("tier distribution sums to total agents", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings();

    const tierSum = result.tierDistribution.diamond +
      result.tierDistribution.platinum +
      result.tierDistribution.gold +
      result.tierDistribution.silver +
      result.tierDistribution.bronze;
    expect(tierSum).toBe(result.totalAgents);
  });
});

// ─── Sort Modes ───────────────────────────────────────────────────────

describe("leaderboard.rankings sort modes", () => {
  it("sorts by reputation when specified", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings({ sortBy: "reputation", limit: 50 });

    for (let i = 1; i < result.rankings.length; i++) {
      expect(result.rankings[i - 1].reputationScore).toBeGreaterThanOrEqual(result.rankings[i].reputationScore);
    }
  });

  it("sorts by tasks when specified", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings({ sortBy: "tasks", limit: 50 });

    for (let i = 1; i < result.rankings.length; i++) {
      expect(result.rankings[i - 1].tasksCompleted).toBeGreaterThanOrEqual(result.rankings[i].tasksCompleted);
    }
  });

  it("sorts by earnings when specified", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings({ sortBy: "earnings", limit: 50 });

    for (let i = 1; i < result.rankings.length; i++) {
      expect(result.rankings[i - 1].totalEarned).toBeGreaterThanOrEqual(result.rankings[i].totalEarned);
    }
  });

  it("sorts by knowledge when specified", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings({ sortBy: "knowledge", limit: 50 });

    for (let i = 1; i < result.rankings.length; i++) {
      const prevKnowledge = result.rankings[i - 1].approvedPackages + result.rankings[i - 1].completedTrades;
      const currKnowledge = result.rankings[i].approvedPackages + result.rankings[i].completedTrades;
      expect(prevKnowledge).toBeGreaterThanOrEqual(currKnowledge);
    }
  });
});

// ─── Filters ──────────────────────────────────────────────────────────

describe("leaderboard.rankings filters", () => {
  it("respects limit parameter", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings({ limit: 5 });

    expect(result.rankings.length).toBeLessThanOrEqual(5);
  });

  it("filters by tier", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings({ filterTier: "gold", limit: 200 });

    for (const entry of result.rankings) {
      expect(entry.tier).toBe("gold");
    }
  });

  it("returns empty array for non-existent role filter", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings({ filterRole: "nonexistent_role_xyz" });

    expect(result.rankings.length).toBe(0);
  });
});

// ─── Agent Detail ─────────────────────────────────────────────────────

describe("leaderboard.agentDetail", () => {
  it("returns null for non-existent agent", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.agentDetail({ agentId: "nonexistent-agent-xyz" });

    expect(result).toBeNull();
  });

  it("returns agent detail with required fields for existing agent", async () => {
    const ctx = createPublicContext();
    // First get a valid agent ID from rankings
    const rankings = await caller(ctx).leaderboard.rankings({ limit: 1 });
    if (rankings.rankings.length === 0) return; // skip if no agents

    const agentId = rankings.rankings[0].agentId;
    const result = await caller(ctx).leaderboard.agentDetail({ agentId });

    expect(result).not.toBeNull();
    expect(result!.agent).toBeDefined();
    expect(result!.agent.agentId).toBe(agentId);
    expect(result!.agent).toHaveProperty("name");
    expect(result!.agent).toHaveProperty("status");
    expect(result!.agent).toHaveProperty("roles");
    expect(result!.reputation).toBeDefined();
    expect(Array.isArray(result!.knowledgePackages)).toBe(true);
    expect(Array.isArray(result!.barterHistory)).toBe(true);
  });
});

// ─── Public Access ────────────────────────────────────────────────────

describe("leaderboard public access", () => {
  it("rankings is accessible without authentication", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.rankings();
    expect(result).toBeDefined();
    expect(Array.isArray(result.rankings)).toBe(true);
  });

  it("agentDetail is accessible without authentication", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).leaderboard.agentDetail({ agentId: "test" });
    // Should return null for non-existent, not throw auth error
    expect(result).toBeNull();
  });
});
