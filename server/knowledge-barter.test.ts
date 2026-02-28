import { describe, expect, it, beforeAll, vi } from "vitest";
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

function createCaller() {
  const ctx = createPublicContext();
  return appRouter.createCaller(ctx);
}

// ─── Knowledge Package Upload Tests ───────────────────────────────────

describe("Knowledge Router — Upload", () => {
  it("uploads a knowledge package and returns pending audit status", async () => {
    const caller = createCaller();
    const result = await caller.knowledge.upload({
      name: "react-hooks-mastery",
      displayName: "React Hooks Mastery",
      version: "1.0.0",
      authorAgentId: "agt_test_author_001",
      description: "Complete guide to React hooks including custom hooks, performance optimization, and testing patterns",
      category: "frontend",
      subcategory: "react",
      proficiencyLevel: "advanced",
      capabilities: ["react-hooks", "custom-hooks", "performance"],
      prerequisites: [],
      rootHash: "sha256_abc123def456",
      signature: "ed25519_sig_test_001",
      fileSize: 45000,
      moduleCount: 8,
      testCount: 24,
    });

    expect(result).toHaveProperty("packageId");
    expect(result.packageId).toMatch(/^nkp_/);
    expect(result.auditStatus).toBe("pending");
    expect(result.message).toBe("Package queued for Nervix Audit");
  });

  it("uploads a minimal package with only required fields", async () => {
    const caller = createCaller();
    const result = await caller.knowledge.upload({
      name: "basic-css",
      displayName: "Basic CSS",
      authorAgentId: "agt_test_author_002",
      category: "frontend",
      rootHash: "sha256_minimal_001",
      signature: "ed25519_sig_minimal",
      fileSize: 5000,
      moduleCount: 2,
      testCount: 0,
    });

    expect(result.packageId).toMatch(/^nkp_/);
    expect(result.auditStatus).toBe("pending");
  });
});

// ─── Knowledge Package List & Get Tests ───────────────────────────────

describe("Knowledge Router — List & Get", () => {
  let testPackageId: string;

  beforeAll(async () => {
    const caller = createCaller();
    const result = await caller.knowledge.upload({
      name: "solidity-security",
      displayName: "Solidity Security Patterns",
      version: "2.0.0",
      authorAgentId: "agt_test_author_003",
      description: "Smart contract security patterns and audit techniques",
      category: "blockchain",
      proficiencyLevel: "expert",
      capabilities: ["solidity", "security-audit", "smart-contracts"],
      rootHash: "sha256_solidity_001",
      signature: "ed25519_sig_solidity",
      fileSize: 120000,
      moduleCount: 12,
      testCount: 48,
    });
    testPackageId = result.packageId;
  });

  it("retrieves a package by ID", async () => {
    const caller = createCaller();
    const pkg = await caller.knowledge.get({ packageId: testPackageId });

    expect(pkg.packageId).toBe(testPackageId);
    expect(pkg.displayName).toBe("Solidity Security Patterns");
    expect(pkg.category).toBe("blockchain");
    expect(pkg.proficiencyLevel).toBe("expert");
    expect(pkg.moduleCount).toBe(12);
    expect(pkg.testCount).toBe(48);
    expect(pkg.auditStatus).toBe("pending");
  });

  it("throws when getting a non-existent package", async () => {
    const caller = createCaller();
    await expect(caller.knowledge.get({ packageId: "nkp_nonexistent" }))
      .rejects.toThrow("Package not found");
  });

  it("lists packages with default filters", async () => {
    const caller = createCaller();
    const result = await caller.knowledge.list();

    expect(result).toHaveProperty("packages");
    expect(result).toHaveProperty("total");
    expect(result.total).toBeGreaterThan(0);
    expect(Array.isArray(result.packages)).toBe(true);
  });

  it("lists packages filtered by category", async () => {
    const caller = createCaller();
    const result = await caller.knowledge.list({ category: "blockchain" });

    expect(result.packages.length).toBeGreaterThan(0);
    result.packages.forEach((pkg: any) => {
      expect(pkg.category).toBe("blockchain");
    });
  });

  it("lists packages filtered by audit status", async () => {
    const caller = createCaller();
    const result = await caller.knowledge.list({ auditStatus: "pending" });

    expect(result.packages.length).toBeGreaterThan(0);
    result.packages.forEach((pkg: any) => {
      expect(pkg.auditStatus).toBe("pending");
    });
  });

  it("lists pending audits", async () => {
    const caller = createCaller();
    const pending = await caller.knowledge.pendingAudits();

    expect(Array.isArray(pending)).toBe(true);
    pending.forEach((pkg: any) => {
      expect(pkg.auditStatus).toBe("pending");
    });
  });
});

// ─── Knowledge Audit Tests ────────────────────────────────────────────

describe("Knowledge Router — Audit", () => {
  let auditPackageId: string;

  beforeAll(async () => {
    const caller = createCaller();
    const result = await caller.knowledge.upload({
      name: "python-data-science",
      displayName: "Python Data Science Toolkit",
      version: "1.5.0",
      authorAgentId: "agt_test_auditor_001",
      description: "Comprehensive data science toolkit with pandas, numpy, and matplotlib",
      category: "data",
      proficiencyLevel: "intermediate",
      capabilities: ["pandas", "numpy", "matplotlib", "data-analysis"],
      rootHash: "sha256_python_ds_001",
      signature: "ed25519_sig_python_ds",
      fileSize: 85000,
      moduleCount: 10,
      testCount: 30,
    });
    auditPackageId = result.packageId;
  });

  it("runs audit and returns quality score, verdict, and FMV", async () => {
    const caller = createCaller();
    const result = await caller.knowledge.audit({ packageId: auditPackageId });

    expect(result).toHaveProperty("auditId");
    expect(result.auditId).toMatch(/^aud_/);
    expect(result).toHaveProperty("qualityScore");
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(100);
    expect(["approved", "conditional", "rejected"]).toContain(result.verdict);
    expect(result).toHaveProperty("fairMarketValue");
    expect(result.fairMarketValue).toBeGreaterThan(0);

    // Verify 6 audit checks
    expect(result.checks).toHaveProperty("compilability");
    expect(result.checks).toHaveProperty("originality");
    expect(result.checks).toHaveProperty("categoryMatch");
    expect(result.checks).toHaveProperty("securityScan");
    expect(result.checks).toHaveProperty("completeness");
    expect(result.checks).toHaveProperty("teachingQuality");

    // Each check should have score, weight, details
    Object.values(result.checks).forEach((check: any) => {
      expect(check).toHaveProperty("score");
      expect(check).toHaveProperty("weight");
      expect(check).toHaveProperty("details");
      expect(check.score).toBeGreaterThanOrEqual(0);
      expect(check.score).toBeLessThanOrEqual(100);
    });
  });

  it("updates package audit status after audit", async () => {
    const caller = createCaller();
    const pkg = await caller.knowledge.get({ packageId: auditPackageId });

    expect(["approved", "conditional", "rejected"]).toContain(pkg.auditStatus);
    expect(pkg.auditId).toMatch(/^aud_/);
    expect(pkg.audit).not.toBeNull();
  });

  it("retrieves audit by ID", async () => {
    const caller = createCaller();
    const pkg = await caller.knowledge.get({ packageId: auditPackageId });
    if (pkg.auditId) {
      const audit = await caller.knowledge.getAudit({ auditId: pkg.auditId });
      expect(audit).not.toBeNull();
      expect(audit!.packageId).toBe(auditPackageId);
      expect(audit!.qualityScore).toBeGreaterThanOrEqual(0);
    }
  });

  it("rejects re-auditing an already audited package", async () => {
    const caller = createCaller();
    await expect(caller.knowledge.audit({ packageId: auditPackageId }))
      .rejects.toThrow(/already audited/);
  });

  it("rejects auditing a non-existent package", async () => {
    const caller = createCaller();
    await expect(caller.knowledge.audit({ packageId: "nkp_nonexistent" }))
      .rejects.toThrow("Package not found");
  });
});

// ─── Barter Transaction Tests ─────────────────────────────────────────

describe("Barter Router — Propose & Accept", () => {
  let offeredPkgId: string;
  let requestedPkgId: string;

  beforeAll(async () => {
    const caller = createCaller();

    // Create and audit two packages for barter
    const pkg1 = await caller.knowledge.upload({
      name: "devops-kubernetes",
      displayName: "Kubernetes Orchestration",
      authorAgentId: "agt_barter_proposer",
      category: "devops",
      proficiencyLevel: "advanced",
      rootHash: "sha256_k8s_001",
      signature: "ed25519_sig_k8s",
      fileSize: 60000,
      moduleCount: 6,
      testCount: 18,
    });
    offeredPkgId = pkg1.packageId;
    await caller.knowledge.audit({ packageId: offeredPkgId });

    const pkg2 = await caller.knowledge.upload({
      name: "security-pentesting",
      displayName: "Penetration Testing Fundamentals",
      authorAgentId: "agt_barter_responder",
      category: "security",
      proficiencyLevel: "advanced",
      rootHash: "sha256_pentest_001",
      signature: "ed25519_sig_pentest",
      fileSize: 55000,
      moduleCount: 7,
      testCount: 21,
    });
    requestedPkgId = pkg2.packageId;
    await caller.knowledge.audit({ packageId: requestedPkgId });
  });

  it("proposes a barter trade between two agents", async () => {
    const caller = createCaller();
    const result = await caller.barter.propose({
      proposerAgentId: "agt_barter_proposer",
      responderAgentId: "agt_barter_responder",
      offeredPackageId: offeredPkgId,
      requestedPackageId: requestedPkgId,
    });

    expect(result).toHaveProperty("barterTxId");
    expect(result.barterTxId).toMatch(/^btr_/);
    expect(result).toHaveProperty("proposerFee");
    expect(result).toHaveProperty("responderFee");
    expect(result).toHaveProperty("totalFee");
    expect(parseFloat(result.totalFee)).toBeGreaterThan(0);
    expect(result).toHaveProperty("isFairTrade");
    expect(result).toHaveProperty("exchangeDeadline");
  });

  it("rejects barter with unaudited package", async () => {
    const caller = createCaller();
    const unaudited = await caller.knowledge.upload({
      name: "unaudited-pkg",
      displayName: "Unaudited Package",
      authorAgentId: "agt_barter_proposer",
      category: "other",
      rootHash: "sha256_unaudited",
      signature: "ed25519_sig_unaudited",
      fileSize: 1000,
      moduleCount: 1,
      testCount: 0,
    });

    await expect(caller.barter.propose({
      proposerAgentId: "agt_barter_proposer",
      responderAgentId: "agt_barter_responder",
      offeredPackageId: unaudited.packageId,
    })).rejects.toThrow(/must pass Nervix Audit/);
  });

  it("rejects barter when offering someone else's package", async () => {
    const caller = createCaller();
    // offeredPkgId belongs to agt_barter_proposer, not agt_wrong_agent
    await expect(caller.barter.propose({
      proposerAgentId: "agt_wrong_agent",
      responderAgentId: "agt_barter_responder",
      offeredPackageId: offeredPkgId,
    })).rejects.toThrow(/only offer your own/);
  });
});

describe("Barter Router — Full Lifecycle", () => {
  let barterTxId: string;
  let offeredId: string;
  let requestedId: string;

  beforeAll(async () => {
    const caller = createCaller();

    // Create and audit packages
    const pkg1 = await caller.knowledge.upload({
      name: "lifecycle-pkg-a",
      displayName: "Lifecycle Test Package A",
      authorAgentId: "agt_lifecycle_a",
      category: "testing",
      proficiencyLevel: "intermediate",
      rootHash: "sha256_lifecycle_a",
      signature: "ed25519_sig_lifecycle_a",
      fileSize: 30000,
      moduleCount: 4,
      testCount: 12,
    });
    offeredId = pkg1.packageId;
    await caller.knowledge.audit({ packageId: offeredId });

    const pkg2 = await caller.knowledge.upload({
      name: "lifecycle-pkg-b",
      displayName: "Lifecycle Test Package B",
      authorAgentId: "agt_lifecycle_b",
      category: "testing",
      proficiencyLevel: "intermediate",
      rootHash: "sha256_lifecycle_b",
      signature: "ed25519_sig_lifecycle_b",
      fileSize: 28000,
      moduleCount: 4,
      testCount: 10,
    });
    requestedId = pkg2.packageId;
    await caller.knowledge.audit({ packageId: requestedId });

    // Propose barter
    const proposal = await caller.barter.propose({
      proposerAgentId: "agt_lifecycle_a",
      responderAgentId: "agt_lifecycle_b",
      offeredPackageId: offeredId,
      requestedPackageId: requestedId,
    });
    barterTxId = proposal.barterTxId;
  });

  it("retrieves barter transaction by ID", async () => {
    const caller = createCaller();
    const tx = await caller.barter.get({ barterTxId });

    expect(tx.barterTxId).toBe(barterTxId);
    expect(tx.status).toBe("proposed");
    expect(tx.proposerAgentId).toBe("agt_lifecycle_a");
    expect(tx.responderAgentId).toBe("agt_lifecycle_b");
    expect(tx.offeredPackageId).toBe(offeredId);
    expect(tx.requestedPackageId).toBe(requestedId);
  });

  it("accepts the barter proposal", async () => {
    const caller = createCaller();
    const result = await caller.barter.accept({
      barterTxId,
      responderAgentId: "agt_lifecycle_b",
      fairnessAcknowledged: true,
    });

    expect(result.status).toBe("accepted");
    expect(result.nextStep).toBe("fee_lock");
  });

  it("rejects acceptance from wrong agent", async () => {
    // Create a new barter for this test
    const caller = createCaller();
    const pkg3 = await caller.knowledge.upload({
      name: "wrong-agent-test",
      displayName: "Wrong Agent Test",
      authorAgentId: "agt_lifecycle_a",
      category: "other",
      rootHash: "sha256_wrong_agent",
      signature: "ed25519_sig_wrong",
      fileSize: 1000,
      moduleCount: 1,
      testCount: 0,
    });
    await caller.knowledge.audit({ packageId: pkg3.packageId });

    const proposal = await caller.barter.propose({
      proposerAgentId: "agt_lifecycle_a",
      responderAgentId: "agt_lifecycle_b",
      offeredPackageId: pkg3.packageId,
    });

    await expect(caller.barter.accept({
      barterTxId: proposal.barterTxId,
      responderAgentId: "agt_wrong_agent",
    })).rejects.toThrow("Not the responder");
  });

  it("confirms fee payment from proposer", async () => {
    const caller = createCaller();
    const result = await caller.barter.confirmFeePaid({
      barterTxId,
      agentId: "agt_lifecycle_a",
      txHash: "ton_tx_hash_proposer_001",
    });

    expect(result.barterTxId).toBe(barterTxId);
    expect(result.bothPaid).toBe(false);
  });

  it("confirms fee payment from responder and locks fees", async () => {
    const caller = createCaller();
    const result = await caller.barter.confirmFeePaid({
      barterTxId,
      agentId: "agt_lifecycle_b",
      txHash: "ton_tx_hash_responder_001",
    });

    expect(result.barterTxId).toBe(barterTxId);
    expect(result.bothPaid).toBe(true);
    expect(result.feeStatus).toBe("both_paid");
    expect(result.nextStep).toBe("escrow");
  });

  it("completes verification from proposer", async () => {
    const caller = createCaller();
    const result = await caller.barter.complete({
      barterTxId,
      agentId: "agt_lifecycle_a",
      verified: true,
    });

    expect(result.status).toBe("verifying");
    expect(result.bothVerified).toBe(false);
  });

  it("completes verification from responder and finalizes trade", async () => {
    const caller = createCaller();
    const result = await caller.barter.complete({
      barterTxId,
      agentId: "agt_lifecycle_b",
      verified: true,
    });

    expect(result.status).toBe("completed");
    expect(result.bothVerified).toBe(true);
  });

  it("verifies trade count incremented on packages", async () => {
    const caller = createCaller();
    const offeredPkg = await caller.knowledge.get({ packageId: offeredId });
    const requestedPkg = await caller.knowledge.get({ packageId: requestedId });

    expect(offeredPkg.totalTrades).toBeGreaterThanOrEqual(1);
    expect(requestedPkg.totalTrades).toBeGreaterThanOrEqual(1);
  });
});

// ─── Barter Stats & List Tests ────────────────────────────────────────

describe("Admin — Seed Knowledge Market", () => {
  it("seeds 10 knowledge packages with pre-run audits", async () => {
    const caller = createCaller();
    const result = await caller.admin.seedKnowledgeMarket();

    expect(result.success).toBe(true);
    expect(result.created).toBe(10);
    expect(result.audited).toBe(10);
    expect(result.packages).toHaveLength(10);

    // Verify each package has a verdict and quality score
    result.packages.forEach((pkg: any) => {
      expect(pkg.packageId).toMatch(/^nkp_/);
      expect(pkg.displayName).toBeTruthy();
      expect(["approved", "conditional", "rejected"]).toContain(pkg.verdict);
      expect(pkg.qualityScore).toBeGreaterThanOrEqual(0);
      expect(pkg.qualityScore).toBeLessThanOrEqual(100);
    });

    // Most should be approved (high-quality seed data)
    const approved = result.packages.filter((p: any) => p.verdict === "approved");
    expect(approved.length).toBeGreaterThanOrEqual(8);
  });

  it("seeded packages are retrievable via knowledge.list", async () => {
    const caller = createCaller();
    const result = await caller.knowledge.list({ limit: 100 });

    // Should have at least the 10 seeded packages
    expect(result.total).toBeGreaterThanOrEqual(10);

    // Check that diverse categories exist
    const categories = new Set(result.packages.map((p: any) => p.category));
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });

  it("seeded packages have valid audit records", async () => {
    const caller = createCaller();
    const result = await caller.knowledge.list({ auditStatus: "approved", limit: 5 });

    for (const pkg of result.packages.slice(0, 3)) {
      const detail = await caller.knowledge.get({ packageId: pkg.packageId });
      expect(detail.auditId).toMatch(/^aud_/);
      expect(detail.audit).not.toBeNull();
      if (detail.audit) {
        expect(detail.audit.qualityScore).toBeGreaterThanOrEqual(70);
        expect(detail.audit.verdict).toBe("approved");
        expect(detail.audit.checks).toHaveProperty("compilability");
        expect(detail.audit.checks).toHaveProperty("originality");
        expect(detail.audit.checks).toHaveProperty("securityScan");
      }
    }
  });
});

describe("Barter Router — Stats & List", () => {
  it("returns barter statistics", async () => {
    const caller = createCaller();
    const stats = await caller.barter.stats();

    expect(stats).toHaveProperty("totalBarters");
    expect(stats).toHaveProperty("completedBarters");
    expect(stats).toHaveProperty("totalFeesCollected");
    expect(stats).toHaveProperty("activeProposals");
    expect(stats.totalBarters).toBeGreaterThanOrEqual(0);
  });

  it("lists barter transactions", async () => {
    const caller = createCaller();
    const result = await caller.barter.list();

    expect(result).toHaveProperty("transactions");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.transactions)).toBe(true);
  });

  it("lists barter transactions filtered by agent", async () => {
    const caller = createCaller();
    const result = await caller.barter.list({ agentId: "agt_lifecycle_a" });

    expect(result.transactions.length).toBeGreaterThan(0);
    result.transactions.forEach((tx: any) => {
      expect(
        tx.proposerAgentId === "agt_lifecycle_a" || tx.responderAgentId === "agt_lifecycle_a"
      ).toBe(true);
    });
  });

  it("throws when getting non-existent barter", async () => {
    const caller = createCaller();
    await expect(caller.barter.get({ barterTxId: "btr_nonexistent" }))
      .rejects.toThrow("Barter transaction not found");
  });
});
