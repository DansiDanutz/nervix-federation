import { describe, it, expect } from "vitest";

describe("CLAWHUB_API_TOKEN", () => {
  it("should be set in environment", () => {
    const token = process.env.CLAWHUB_API_TOKEN;
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token!.length).toBeGreaterThan(0);
  });

  it("should have a valid token format (starts with clh_ or is a non-empty string)", () => {
    const token = process.env.CLAWHUB_API_TOKEN!;
    // ClawHub tokens typically start with clh_ but we accept any non-empty string
    expect(token.trim().length).toBeGreaterThan(0);
  });
});
