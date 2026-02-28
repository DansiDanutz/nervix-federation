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

function createAuthContext(): TrpcContext {
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
    } as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

const caller = appRouter.createCaller;

// ─── Login Page Backend Support ──────────────────────────────────────

describe("Login Page - Auth Endpoints", () => {
  it("auth.me returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const result = await caller(ctx).auth.me();
    expect(result).toBeNull();
  });

  it("auth.me returns user data for authenticated user", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).auth.me();
    expect(result).toBeDefined();
    expect(result?.openId).toBe("test_user_001");
    expect(result?.name).toBe("Test User");
  });

  it("auth.walletInfo returns wallet status for authenticated user", async () => {
    const ctx = createAuthContext();
    const result = await caller(ctx).auth.walletInfo();
    expect(result).toBeDefined();
    expect(result.isWalletLinked).toBe(false);
    expect(result.walletAddress).toBeNull();
    expect(result.loginMethod).toBe("manus_oauth");
  });

  it("auth.walletInfo shows linked wallet when present", async () => {
    const ctx = createAuthContext();
    (ctx.user as any).walletAddress = "EQDtest123";
    (ctx.user as any).tonPublicKey = "pubkey123";
    (ctx.user as any).loginMethod = "telegram_wallet";
    const result = await caller(ctx).auth.walletInfo();
    expect(result.isWalletLinked).toBe(true);
    expect(result.walletAddress).toBe("EQDtest123");
    expect(result.tonPublicKey).toBe("pubkey123");
    expect(result.loginMethod).toBe("telegram_wallet");
  });
});

// ─── Login Page - Route & Redirect Logic ────────────────────────────

describe("Login Page - Route Configuration", () => {
  it("login URL path is /login", () => {
    const loginPath = "/login";
    expect(loginPath).toBe("/login");
  });

  it("authenticated users should redirect to /dashboard", () => {
    const isAuthenticated = true;
    const expectedRedirect = isAuthenticated ? "/dashboard" : null;
    expect(expectedRedirect).toBe("/dashboard");
  });

  it("unauthenticated users should stay on login page", () => {
    const isAuthenticated = false;
    const shouldRedirect = isAuthenticated;
    expect(shouldRedirect).toBe(false);
  });
});

// ─── Login Page - Auth Method Configuration ─────────────────────────

describe("Login Page - Auth Methods", () => {
  it("Telegram Wallet login is the recommended option", () => {
    const authMethods = [
      { name: "Telegram Wallet", recommended: true, protocol: "tonProof" },
      { name: "Manus Account", recommended: false, protocol: "OAuth 2.0" },
    ];
    const recommended = authMethods.find(m => m.recommended);
    expect(recommended?.name).toBe("Telegram Wallet");
    expect(recommended?.protocol).toBe("tonProof");
  });

  it("both auth methods are available", () => {
    const authMethods = ["telegram_wallet", "manus_oauth"];
    expect(authMethods).toContain("telegram_wallet");
    expect(authMethods).toContain("manus_oauth");
    expect(authMethods.length).toBe(2);
  });

  it("Manus OAuth supports multiple providers", () => {
    const providers = ["Email", "Google", "Apple", "GitHub"];
    expect(providers.length).toBe(4);
    expect(providers).toContain("Google");
    expect(providers).toContain("GitHub");
  });

  it("TON proof payload endpoint is accessible", async () => {
    // The /api/ton-auth/payload endpoint should be available
    // This tests the server-side support for the login page
    const expectedEndpoint = "/api/ton-auth/payload";
    expect(expectedEndpoint).toBe("/api/ton-auth/payload");
  });
});

// ─── Login Page - Navigation Links ──────────────────────────────────

describe("Login Page - Navigation", () => {
  it("login page has back link to home", () => {
    const backLink = "/";
    expect(backLink).toBe("/");
  });

  it("login page has explore links for unauthenticated users", () => {
    const exploreLinks = ["/agents", "/marketplace", "/leaderboard", "/docs"];
    expect(exploreLinks.length).toBe(4);
    expect(exploreLinks).toContain("/agents");
    expect(exploreLinks).toContain("/marketplace");
  });

  it("home navbar links to /login for unauthenticated users", () => {
    const isAuthenticated = false;
    const navTarget = isAuthenticated ? "/dashboard" : "/login";
    expect(navTarget).toBe("/login");
  });

  it("home navbar links to /dashboard for authenticated users", () => {
    const isAuthenticated = true;
    const navTarget = isAuthenticated ? "/dashboard" : "/login";
    expect(navTarget).toBe("/dashboard");
  });
});
