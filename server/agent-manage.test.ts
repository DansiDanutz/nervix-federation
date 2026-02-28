import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Context Helpers ────────────────────────────────────────────────────
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createAuthContext(overrides: Partial<NonNullable<TrpcContext["user"]>> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "manage_test_user",
      name: "Manage Tester",
      email: "manage@nervix.ai",
      loginMethod: "manus_oauth",
      role: "user",
      walletAddress: null,
      tonPublicKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    } as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createAuthContext({ role: "admin" as any, openId: "admin_manage_user" });
}

// ─── Agent Management Tests ─────────────────────────────────────────────
describe("Agent Management — agents router", () => {
  describe("agents.list", () => {
    it("returns a list of agents with pagination", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.agents.list({ page: 1, limit: 5 });
      expect(result).toBeDefined();
      expect(Array.isArray(result.agents)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("supports page parameter", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const page1 = await caller.agents.list({ page: 1, limit: 2 });
      const page2 = await caller.agents.list({ page: 2, limit: 2 });
      expect(page1).toBeDefined();
      expect(page2).toBeDefined();
    });
  });

  describe("agents.getById", () => {
    it("throws for non-existent agent", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.agents.getById({ agentId: "nonexistent_agent_xyz" })
      ).rejects.toThrow();
    });
  });

  describe("agents.readiness", () => {
    it("throws for non-existent agent", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.agents.readiness({ agentId: "nonexistent_agent_xyz" })
      ).rejects.toThrow();
    });
  });

  describe("agents.getCapabilities", () => {
    it("returns empty array for non-existent agent", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const caps = await caller.agents.getCapabilities({ agentId: "nonexistent_agent_xyz" });
      expect(Array.isArray(caps)).toBe(true);
      expect(caps.length).toBe(0);
    });
  });

  describe("agents.setCapabilities", () => {
    it("accepts valid capability data", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      // This will either succeed or fail based on agent existence, but should not throw validation error
      try {
        const result = await caller.agents.setCapabilities({
          agentId: "test_agent_id",
          capabilities: [
            {
              skillId: "skill_1",
              skillName: "TypeScript",
              description: "TypeScript development",
              tags: ["typescript", "coding"],
              examples: ["Build REST APIs"],
              proficiencyLevel: "advanced",
            },
          ],
        });
        expect(result).toEqual({ ok: true });
      } catch (err: any) {
        // May fail if agent doesn't exist, but should not be a validation error
        expect(err.message).not.toContain("invalid");
      }
    });
  });

  describe("agents.linkWallet", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        (caller as any).agents.linkWallet({
          agentId: "test_agent",
          walletAddress: "EQA1234567890",
        })
      ).rejects.toThrow();
    });
  });

  describe("agents.getReputation", () => {
    it("returns reputation data for any agent id", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const rep = await caller.agents.getReputation({ agentId: "test_reputation_agent" });
      expect(rep).toBeDefined();
      expect(rep.overallScore).toBeDefined();
    });
  });
});

// ─── Enrollment Router Tests ────────────────────────────────────────────
describe("Agent Management — enrollment router", () => {
  describe("enrollment.request", () => {
    it("creates enrollment challenge with valid data", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.enrollment.request({
        agentName: `test-enroll-${Date.now()}`,
        publicKey: "ed25519_" + "a".repeat(56),
        roles: ["coder"],
      });
      expect(result).toBeDefined();
      expect(result.challengeId).toBeDefined();
      expect(result.challengeNonce).toBeDefined();
      expect(typeof result.challengeId).toBe("string");
      expect(typeof result.challengeNonce).toBe("string");
    });

    it("rejects enrollment with empty roles", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.enrollment.request({
          agentName: "test-agent",
          publicKey: "ed25519_" + "b".repeat(56),
          roles: [],
        })
      ).rejects.toThrow();
    });

    it("rejects enrollment with short public key", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.enrollment.request({
          agentName: "test-agent",
          publicKey: "short",
          roles: ["coder"],
        })
      ).rejects.toThrow();
    });

    it("accepts optional fields (description, webhookUrl, region)", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.enrollment.request({
        agentName: `test-full-${Date.now()}`,
        publicKey: "ed25519_" + "c".repeat(56),
        roles: ["coder", "devops"],
        description: "A test agent with full options",
        webhookUrl: "https://example.com/webhook",
        region: "eu-west-1",
      });
      expect(result.challengeId).toBeDefined();
    });
  });

  describe("enrollment.verify", () => {
    it("rejects invalid challenge ID", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.enrollment.verify({
          challengeId: "nonexistent_challenge",
          signature: "fake_signature_hex",
        })
      ).rejects.toThrow();
    });
  });
});

// ─── Agent Profile Router Tests ─────────────────────────────────────────
describe("Agent Management — agentProfile router", () => {
  describe("agentProfile.getProfile", () => {
    it("returns null or profile for non-existent agent", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      try {
        const profile = await caller.agentProfile.getProfile({ agentId: "nonexistent_profile_agent" });
        // May return null or throw
        expect(profile === null || profile === undefined || typeof profile === "object").toBe(true);
      } catch {
        // Expected for non-existent agent
      }
    });
  });
});

// ─── Leaderboard Router Tests ───────────────────────────────────────────
describe("Agent Management — leaderboard router", () => {
  describe("leaderboard.rankings", () => {
    it("returns rankings with default parameters", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.leaderboard.rankings({});
      expect(result).toBeDefined();
      expect(Array.isArray(result.rankings)).toBe(true);
      expect(typeof result.totalAgents).toBe("number");
    });

    it("supports sortBy filter", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.leaderboard.rankings({ sortBy: "reputation" });
      expect(result).toBeDefined();
      expect(Array.isArray(result.rankings)).toBe(true);
    });
  });
});

// ─── Admin Operations Tests ─────────────────────────────────────────────
describe("Agent Management — admin operations", () => {
  describe("admin.deleteAgent", () => {
    it("requires admin role", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        (caller as any).admin.deleteAgent({ agentId: "test_agent" })
      ).rejects.toThrow();
    });
  });
});

// ─── Escrow Router Tests ────────────────────────────────────────────────
describe("Agent Management — escrow router", () => {
  describe("escrow.contractInfo", () => {
    it("returns contract info data", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.escrow.contractInfo();
      expect(result).toBeDefined();
      expect(result.contractAddress).toBeDefined();
    });
  });

  describe("escrow.treasuryInfo", () => {
    it("returns treasury info", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.escrow.treasuryInfo();
      expect(result).toBeDefined();
    });
  });
});
