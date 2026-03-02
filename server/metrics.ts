/**
 * Prometheus-compatible /metrics endpoint for Nervix federation monitoring.
 * Queries live data from Supabase and exposes in Prometheus text format.
 */
import { Router } from "express";
import { getDb } from "./db";

const startTime = Date.now();

// Simple in-memory counters for request tracking
let httpRequestsTotal = 0;
let httpErrorsTotal = 0;

export function incrementRequests() { httpRequestsTotal++; }
export function incrementErrors() { httpErrorsTotal++; }
export function getMetricCounters() { return { httpRequestsTotal, httpErrorsTotal, uptimeSeconds: Math.floor((Date.now() - startTime) / 1000) }; }

function metric(name: string, help: string, type: string, value: number | string, labels?: Record<string, string>): string {
  const labelStr = labels
    ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
    : "";
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name}${labelStr} ${value}\n`;
}

export function registerMetricsRoute(app: Router) {
  app.get("/metrics", async (_req, res) => {
    try {
      const db = getDb();
      const lines: string[] = [];

      // Server uptime
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      lines.push(metric("nervix_server_uptime_seconds", "Server uptime in seconds", "gauge", uptimeSeconds));

      // HTTP counters
      lines.push(metric("nervix_http_requests_total", "Total HTTP requests processed", "counter", httpRequestsTotal));
      lines.push(metric("nervix_http_errors_total", "Total HTTP errors", "counter", httpErrorsTotal));

      // Agent counts by status
      const { data: agents } = await db.from("agents").select("status");
      if (agents) {
        const statusCounts: Record<string, number> = {};
        for (const a of agents) {
          statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
        }
        lines.push(`# HELP nervix_agents_total Number of agents by status\n# TYPE nervix_agents_total gauge`);
        for (const [status, count] of Object.entries(statusCounts)) {
          lines.push(`nervix_agents_total{status="${status}"} ${count}`);
        }
        lines.push("");
        lines.push(metric("nervix_agents_active_gauge", "Number of active agents", "gauge",
          agents.filter(a => a.status === "active").length));
      }

      // Task counts by status
      const { data: tasks } = await db.from("tasks").select("status");
      if (tasks) {
        const taskCounts: Record<string, number> = {};
        for (const t of tasks) {
          taskCounts[t.status] = (taskCounts[t.status] || 0) + 1;
        }
        lines.push(`# HELP nervix_tasks_total Number of tasks by status\n# TYPE nervix_tasks_total gauge`);
        for (const [status, count] of Object.entries(taskCounts)) {
          lines.push(`nervix_tasks_total{status="${status}"} ${count}`);
        }
        lines.push("");
        lines.push(metric("nervix_tasks_completed_total", "Total completed tasks", "counter",
          tasks.filter(t => t.status === "completed").length));
      }

      // Economic transactions count
      const { count: txCount } = await db.from("economic_transactions").select("*", { count: "exact", head: true });
      lines.push(metric("nervix_credit_transfers_total", "Total credit transfer transactions", "counter", txCount || 0));

      // A2A messages
      const { data: msgs } = await db.from("a2a_messages").select("status");
      if (msgs) {
        const msgCounts: Record<string, number> = {};
        for (const m of msgs) {
          msgCounts[m.status] = (msgCounts[m.status] || 0) + 1;
        }
        lines.push(`# HELP nervix_webhook_delivery_total Webhook deliveries by status\n# TYPE nervix_webhook_delivery_total gauge`);
        for (const [status, count] of Object.entries(msgCounts)) {
          lines.push(`nervix_webhook_delivery_total{status="${status}"} ${count}`);
        }
        lines.push("");
      }

      // Heartbeat freshness (seconds since last heartbeat for each active agent)
      const { data: activeAgents } = await db.from("agents").select("agentId,name,lastHeartbeat").eq("status", "active");
      if (activeAgents) {
        lines.push(`# HELP nervix_agent_heartbeat_age_seconds Seconds since last heartbeat\n# TYPE nervix_agent_heartbeat_age_seconds gauge`);
        for (const a of activeAgents) {
          const age = a.lastHeartbeat
            ? Math.floor((Date.now() - new Date(a.lastHeartbeat).getTime()) / 1000)
            : -1;
          lines.push(`nervix_agent_heartbeat_age_seconds{agent="${a.name}",agent_id="${a.agentId}"} ${age}`);
        }
        lines.push("");
      }

      res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      res.send(lines.join("\n") + "\n");
    } catch (err) {
      res.status(500).send(`# Error generating metrics\n# ${err}\n`);
    }
  });
}
