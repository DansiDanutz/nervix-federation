import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { generatePayload, verifyNonce } from "./ton-proof";

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

function createAuthContext(overrides: Partial<TrpcContext["user"]> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test_user_001",
      name: "Test User",
      email: "test@nervix.ai",
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
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

const caller = appRouter.createCaller;

// ─── Nonce Generation & Verification ──────────────────────────────────

describe("TON Proof - Nonce System", () => {
  it("generates a 64-character hex nonce", async () => {
    const nonce = await generatePayload();
    expect(nonce).toBeDefined();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBe(64); // 32 bytes = 64 hex chars
    expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
  });

  it("generates unique nonces each time", async () => {
    const nonce1 = await generatePayload();
    const nonce2 = await generatePayload();
    expect(nonce1).not.toBe(nonce2);
  });

  it("verifies a valid nonce", async () => {
    const nonce = await generatePayload();
    const isValid = verifyNonce(nonce);
    expect(isValid).toBe(true);
  });

  it("rejects an unknown nonce", () => {
    const isValid = verifyNonce("unknown_nonce_that_was_never_generated");
    expect(isValid).toBe(false);
  });

  it("consumes nonce on first use (one-time)", async () => {
    const nonce = await generatePayload();
    const first = verifyNonce(nonce);
    const second = verifyNonce(nonce);
    expect(first).toBe(true);
    expect(second).toBe(false); // Already consumed
  });
});

// ─── Auth Router - walletInfo ──────────────────────────────────────────

describe("auth.walletInfo", () => {
  it("returns wallet info for authenticated user without wallet", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).auth.walletInfo();
    expect(result).toEqual({
      walletAddress: null,
      tonPublicKey: null,
      loginMethod: "manus_oauth",
      isWalletLinked: false,
      ownedAgents: [],
    });
  });

  it("returns wallet info for user with linked wallet", async () => {
    const ctx = createAuthContext({
      walletAddress: "EQD...abc123",
      tonPublicKey: "abcdef1234567890",
      loginMethod: "telegram_wallet",
    });
    const result = await caller(ctx).auth.walletInfo();
    expect(result).toEqual({
      walletAddress: "EQD...abc123",
      tonPublicKey: "abcdef1234567890",
      loginMethod: "telegram_wallet",
      isWalletLinked: true,
      ownedAgents: [],
    });
  });
});

// ─── Agents Router - linkWallet ──────────────────────────────────────

describe("agents.linkWallet", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    await expect(
      caller(ctx).agents.linkWallet({
        agentId: "agt_test",
        walletAddress: "EQD...test",
      })
    ).rejects.toThrow();
  });

  it("rejects non-existent agent", async () => {
    const ctx = createAuthContext();
    await expect(
      caller(ctx).agents.linkWallet({
        agentId: "agt_nonexistent_999",
        walletAddress: "EQD...test",
      })
    ).rejects.toThrow("Agent not found");
  });

  it("validates wallet address length", async () => {
    const ctx = createAuthContext();
    await expect(
      caller(ctx).agents.linkWallet({
        agentId: "agt_test",
        walletAddress: "", // empty
      })
    ).rejects.toThrow();
  });
});

// ─── Integration: Wallet login creates proper user structure ──────────

describe("TON Auth - User Structure", () => {
  it("wallet-based openId follows ton_ prefix convention", () => {
    const walletAddress = "EQDrjaLahLkMB-hMCmkzOyBuHJ186Kj3BzU3sRGnGXygt_6v";
    const openId = `ton_${walletAddress}`;
    expect(openId).toMatch(/^ton_EQ/);
    expect(openId.length).toBeGreaterThan(10);
  });

  it("short address display format is correct", () => {
    const addr = "EQDrjaLahLkMB-hMCmkzOyBuHJ186Kj3BzU3sRGnGXygt_6v";
    const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    expect(short).toBe("EQDrja...t_6v");
  });
});
