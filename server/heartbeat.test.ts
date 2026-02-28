import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  updateAgentHeartbeat: vi.fn().mockResolvedValue(undefined),
  getHeartbeatHistory: vi.fn().mockResolvedValue([
    {
      id: 1,
      agentId: "agt_test123",
      timestamp: new Date("2026-02-25T12:00:00Z"),
      latencyMs: 42,
      cpuUsage: "35.50",
      memoryUsage: "62.10",
      diskUsage: null,
      activeTaskCount: 2,
      agentVersion: "1.0.0",
      statusMessage: "All systems nominal",
      ipAddress: "192.168.1.100",
      region: "us-east-1",
      healthy: true,
    },
    {
      id: 2,
      agentId: "agt_test123",
      timestamp: new Date("2026-02-25T11:59:00Z"),
      latencyMs: 150,
      cpuUsage: "88.00",
      memoryUsage: "91.00",
      diskUsage: "75.00",
      activeTaskCount: 5,
      agentVersion: "1.0.0",
      statusMessage: "High load",
      ipAddress: "192.168.1.100",
      region: "us-east-1",
      healthy: false,
    },
  ]),
  getHeartbeatStats: vi.fn().mockResolvedValue({
    totalBeats: 1500,
    healthyBeats: 1425,
    avgLatency: 55,
    uptimePercent: 95,
    lastBeat: {
      id: 1,
      agentId: "agt_test123",
      timestamp: new Date("2026-02-25T12:00:00Z"),
      latencyMs: 42,
      healthy: true,
    },
  }),
  getLiveAgentStatuses: vi.fn().mockResolvedValue([
    {
      agentId: "agt_test123",
      name: "TestAgent",
      status: "active",
      lastHeartbeat: new Date(Date.now() - 30000), // 30s ago
      heartbeatInterval: 60,
      version: "1.0.0",
      activeTasks: 2,
      maxConcurrentTasks: 5,
      region: "us-east-1",
      liveStatus: "online",
      elapsedSinceHeartbeat: 30000,
    },
    {
      agentId: "agt_degraded",
      name: "DegradedAgent",
      status: "active",
      lastHeartbeat: new Date(Date.now() - 180000), // 3min ago
      heartbeatInterval: 60,
      version: "0.9.0",
      activeTasks: 0,
      maxConcurrentTasks: 3,
      region: "eu-west-1",
      liveStatus: "degraded",
      elapsedSinceHeartbeat: 180000,
    },
    {
      agentId: "agt_offline",
      name: "OfflineAgent",
      status: "offline",
      lastHeartbeat: null,
      heartbeatInterval: 60,
      version: null,
      activeTasks: 0,
      maxConcurrentTasks: 3,
      region: null,
      liveStatus: "offline",
      elapsedSinceHeartbeat: Date.now(),
    },
  ]),
  purgeOldHeartbeats: vi.fn().mockResolvedValue(undefined),
}));

import * as db from "./db";

describe("Agent Heartbeat System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Heartbeat Mutation ─────────────────────────────────────────────────
  describe("heartbeat mutation (updateAgentHeartbeat)", () => {
    it("should accept a basic heartbeat with just agentId", async () => {
      await db.updateAgentHeartbeat("agt_test123");
      expect(db.updateAgentHeartbeat).toHaveBeenCalledWith("agt_test123");
    });

    it("should accept heartbeat with full metadata", async () => {
      const metadata = {
        latencyMs: 42,
        cpuUsage: 35.5,
        memoryUsage: 62.1,
        diskUsage: 40.0,
        activeTaskCount: 2,
        agentVersion: "1.0.0",
        statusMessage: "All systems nominal",
        ipAddress: "192.168.1.100",
        region: "us-east-1",
        healthy: true,
      };
      await db.updateAgentHeartbeat("agt_test123", metadata);
      expect(db.updateAgentHeartbeat).toHaveBeenCalledWith("agt_test123", metadata);
    });

    it("should accept heartbeat with partial metadata", async () => {
      const partial = { latencyMs: 100, healthy: true };
      await db.updateAgentHeartbeat("agt_test123", partial);
      expect(db.updateAgentHeartbeat).toHaveBeenCalledWith("agt_test123", partial);
    });

    it("should accept heartbeat with unhealthy status", async () => {
      const metadata = { healthy: false, statusMessage: "Memory critical", cpuUsage: 99.5 };
      await db.updateAgentHeartbeat("agt_test123", metadata);
      expect(db.updateAgentHeartbeat).toHaveBeenCalledWith("agt_test123", metadata);
    });
  });

  // ─── Heartbeat History ──────────────────────────────────────────────────
  describe("heartbeat history (getHeartbeatHistory)", () => {
    it("should return heartbeat log entries for an agent", async () => {
      const history = await db.getHeartbeatHistory("agt_test123", 50);
      expect(history).toHaveLength(2);
      expect(history[0].agentId).toBe("agt_test123");
      expect(history[0].latencyMs).toBe(42);
      expect(history[0].healthy).toBe(true);
    });

    it("should include system metrics in heartbeat logs", async () => {
      const history = await db.getHeartbeatHistory("agt_test123", 50);
      const beat = history[0];
      expect(beat.cpuUsage).toBe("35.50");
      expect(beat.memoryUsage).toBe("62.10");
      expect(beat.agentVersion).toBe("1.0.0");
      expect(beat.statusMessage).toBe("All systems nominal");
    });

    it("should include unhealthy beats with high resource usage", async () => {
      const history = await db.getHeartbeatHistory("agt_test123", 50);
      const unhealthy = history[1];
      expect(unhealthy.healthy).toBe(false);
      expect(parseFloat(unhealthy.cpuUsage as string)).toBeGreaterThan(80);
      expect(unhealthy.statusMessage).toBe("High load");
    });

    it("should call with correct limit parameter", async () => {
      await db.getHeartbeatHistory("agt_test123", 10);
      expect(db.getHeartbeatHistory).toHaveBeenCalledWith("agt_test123", 10);
    });
  });

  // ─── Heartbeat Stats ───────────────────────────────────────────────────
  describe("heartbeat stats (getHeartbeatStats)", () => {
    it("should return aggregated heartbeat statistics", async () => {
      const stats = await db.getHeartbeatStats("agt_test123");
      expect(stats.totalBeats).toBe(1500);
      expect(stats.healthyBeats).toBe(1425);
      expect(stats.avgLatency).toBe(55);
      expect(stats.uptimePercent).toBe(95);
    });

    it("should include the last beat information", async () => {
      const stats = await db.getHeartbeatStats("agt_test123");
      expect(stats.lastBeat).toBeDefined();
      expect(stats.lastBeat.agentId).toBe("agt_test123");
      expect(stats.lastBeat.healthy).toBe(true);
    });

    it("should calculate uptime as percentage of healthy beats", async () => {
      const stats = await db.getHeartbeatStats("agt_test123");
      const expectedUptime = Math.round((1425 / 1500) * 100);
      expect(stats.uptimePercent).toBe(expectedUptime);
    });
  });

  // ─── Live Agent Statuses ──────────────────────────────────────────────
  describe("live agent statuses (getLiveAgentStatuses)", () => {
    it("should return all agents with computed live status", async () => {
      const statuses = await db.getLiveAgentStatuses();
      expect(statuses).toHaveLength(3);
    });

    it("should mark recently-heartbeating agents as online", async () => {
      const statuses = await db.getLiveAgentStatuses();
      const online = statuses.find((s: any) => s.agentId === "agt_test123");
      expect(online).toBeDefined();
      expect(online!.liveStatus).toBe("online");
      expect(online!.elapsedSinceHeartbeat).toBeLessThan(120000);
    });

    it("should mark agents with stale heartbeats as degraded", async () => {
      const statuses = await db.getLiveAgentStatuses();
      const degraded = statuses.find((s: any) => s.agentId === "agt_degraded");
      expect(degraded).toBeDefined();
      expect(degraded!.liveStatus).toBe("degraded");
    });

    it("should mark agents with no heartbeat as offline", async () => {
      const statuses = await db.getLiveAgentStatuses();
      const offline = statuses.find((s: any) => s.agentId === "agt_offline");
      expect(offline).toBeDefined();
      expect(offline!.liveStatus).toBe("offline");
    });

    it("should include agent metadata in live status response", async () => {
      const statuses = await db.getLiveAgentStatuses();
      const agent = statuses[0];
      expect(agent.name).toBeDefined();
      expect(agent.activeTasks).toBeDefined();
      expect(agent.maxConcurrentTasks).toBeDefined();
      expect(agent.region).toBeDefined();
    });
  });

  // ─── Purge Old Heartbeats ─────────────────────────────────────────────
  describe("purge old heartbeats (purgeOldHeartbeats)", () => {
    it("should call purge with agent ID and keep count", async () => {
      await db.purgeOldHeartbeats("agt_test123", 200);
      expect(db.purgeOldHeartbeats).toHaveBeenCalledWith("agt_test123", 200);
    });

    it("should accept custom keep count", async () => {
      await db.purgeOldHeartbeats("agt_test123", 50);
      expect(db.purgeOldHeartbeats).toHaveBeenCalledWith("agt_test123", 50);
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("should handle heartbeat with zero latency", async () => {
      await db.updateAgentHeartbeat("agt_test123", { latencyMs: 0, healthy: true });
      expect(db.updateAgentHeartbeat).toHaveBeenCalledWith("agt_test123", { latencyMs: 0, healthy: true });
    });

    it("should handle heartbeat with max CPU usage", async () => {
      await db.updateAgentHeartbeat("agt_test123", { cpuUsage: 100, healthy: false });
      expect(db.updateAgentHeartbeat).toHaveBeenCalledWith("agt_test123", { cpuUsage: 100, healthy: false });
    });

    it("should handle empty metadata object", async () => {
      await db.updateAgentHeartbeat("agt_test123", undefined);
      expect(db.updateAgentHeartbeat).toHaveBeenCalledWith("agt_test123", undefined);
    });
  });
});
