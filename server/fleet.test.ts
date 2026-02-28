import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Test Helpers ──────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "admin@nervix.io",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

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

// ─── Fleet Overview ────────────────────────────────────────────────────

describe("fleet.overview", () => {
  it("returns aggregated fleet statistics", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.overview();

    expect(result).toBeDefined();
    expect(typeof result.totalAgents).toBe("number");
    expect(typeof result.activeAgents).toBe("number");
    expect(typeof result.totalEarned).toBe("number");
    expect(typeof result.totalSpent).toBe("number");
    expect(typeof result.totalBalance).toBe("number");
    expect(typeof result.totalTasksCompleted).toBe("number");
    expect(typeof result.totalTasksFailed).toBe("number");
    expect(typeof result.activeBarters).toBe("number");
    expect(typeof result.completedBarters).toBe("number");
    expect(typeof result.totalKnowledgePackages).toBe("number");
    expect(typeof result.approvedPackages).toBe("number");
    expect(typeof result.barterFeesCollected).toBe("string");
    expect(typeof result.platformFeesCollected).toBe("string");
  });

  it("has non-negative numeric values", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.overview();

    expect(result.totalAgents).toBeGreaterThanOrEqual(0);
    expect(result.activeAgents).toBeGreaterThanOrEqual(0);
    expect(result.totalBalance).toBeGreaterThanOrEqual(0);
    expect(result.totalTasksCompleted).toBeGreaterThanOrEqual(0);
  });

  it("active agents does not exceed total agents", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.overview();

    expect(result.activeAgents).toBeLessThanOrEqual(result.totalAgents);
  });
});

// ─── Agent Earnings ────────────────────────────────────────────────────

describe("fleet.agentEarnings", () => {
  it("returns an array of agent earnings", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.agentEarnings();

    expect(Array.isArray(result)).toBe(true);
  });

  it("each agent has required fields", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.agentEarnings();

    if (result.length > 0) {
      const agent = result[0];
      expect(agent).toHaveProperty("agentId");
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("status");
      expect(agent).toHaveProperty("roles");
      expect(agent).toHaveProperty("creditBalance");
      expect(agent).toHaveProperty("totalEarned");
      expect(agent).toHaveProperty("totalSpent");
      expect(agent).toHaveProperty("tasksCompleted");
      expect(agent).toHaveProperty("tasksFailed");
      expect(typeof agent.creditBalance).toBe("number");
      expect(typeof agent.totalEarned).toBe("number");
    }
  });

  it("roles is an array", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.agentEarnings();

    if (result.length > 0) {
      expect(Array.isArray(result[0].roles)).toBe(true);
    }
  });
});

// ─── Active Trades ─────────────────────────────────────────────────────

describe("fleet.activeTrades", () => {
  it("returns an array of active trades", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.activeTrades();

    expect(Array.isArray(result)).toBe(true);
  });

  it("each trade has required fields", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.activeTrades();

    if (result.length > 0) {
      const trade = result[0];
      expect(trade).toHaveProperty("barterTxId");
      expect(trade).toHaveProperty("status");
      expect(trade).toHaveProperty("proposerAgentId");
    }
  });

  it("all trades have non-completed status", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.activeTrades();

    const completedStatuses = ["completed", "cancelled", "disputed", "expired"];
    for (const trade of result) {
      expect(completedStatuses).not.toContain(trade.status);
    }
  });
});

// ─── Knowledge Inventory ───────────────────────────────────────────────

describe("fleet.knowledgeInventory", () => {
  it("returns an array of knowledge packages", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.knowledgeInventory();

    expect(Array.isArray(result)).toBe(true);
  });

  it("each package has required fields", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.knowledgeInventory();

    if (result.length > 0) {
      const pkg = result[0];
      expect(pkg).toHaveProperty("packageId");
      expect(pkg).toHaveProperty("displayName");
      expect(pkg).toHaveProperty("category");
      expect(pkg).toHaveProperty("auditStatus");
      expect(pkg).toHaveProperty("proficiencyLevel");
    }
  });

  it("audit status is a valid value", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.knowledgeInventory();

    const validStatuses = ["pending", "in_review", "approved", "conditional", "rejected"];
    for (const pkg of result) {
      expect(validStatuses).toContain(pkg.auditStatus);
    }
  });
});

// ─── Income Streams ────────────────────────────────────────────────────

describe("fleet.incomeStreams", () => {
  it("returns income stream data", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.incomeStreams();

    expect(result).toBeDefined();
    expect(typeof result.taskEarnings).toBe("number");
    expect(typeof result.platformFees).toBe("number");
    expect(typeof result.barterFees).toBe("number");
    expect(typeof result.totalVolume).toBe("number");
    expect(typeof result.totalTransactions).toBe("number");
    expect(Array.isArray(result.recentFees)).toBe(true);
  });

  it("has non-negative values", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.incomeStreams();

    expect(result.taskEarnings).toBeGreaterThanOrEqual(0);
    expect(result.platformFees).toBeGreaterThanOrEqual(0);
    expect(result.barterFees).toBeGreaterThanOrEqual(0);
    expect(result.totalVolume).toBeGreaterThanOrEqual(0);
    expect(result.totalTransactions).toBeGreaterThanOrEqual(0);
  });

  it("recent fees has valid structure", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).fleet.incomeStreams();

    for (const fee of result.recentFees) {
      expect(fee).toHaveProperty("type");
      expect(fee).toHaveProperty("amount");
    }
  });
});

// ─── Public Access ─────────────────────────────────────────────────────

describe("fleet public access", () => {
  it("overview is accessible without authentication", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).fleet.overview();
    expect(result).toBeDefined();
    expect(typeof result.totalAgents).toBe("number");
  });

  it("agentEarnings is accessible without authentication", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).fleet.agentEarnings();
    expect(Array.isArray(result)).toBe(true);
  });

  it("activeTrades is accessible without authentication", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).fleet.activeTrades();
    expect(Array.isArray(result)).toBe(true);
  });

  it("knowledgeInventory is accessible without authentication", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).fleet.knowledgeInventory();
    expect(Array.isArray(result)).toBe(true);
  });

  it("incomeStreams is accessible without authentication", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).fleet.incomeStreams();
    expect(result).toBeDefined();
    expect(typeof result.taskEarnings).toBe("number");
  });
});
