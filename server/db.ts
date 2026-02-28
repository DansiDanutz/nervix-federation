import { eq, and, desc, asc, sql, inArray, gte, lte, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  agents, InsertAgent, Agent,
  tasks, InsertTask, Task,
  taskResults, InsertTaskResult,
  reputationScores, InsertReputationScore,
  economicTransactions, InsertEconomicTransaction,
  agentCapabilities, InsertAgentCapability,
  auditLog, InsertAuditLogEntry,
  enrollmentChallenges, InsertEnrollmentChallenge,
  agentSessions, InsertAgentSession,
  federationConfig, InsertFederationConfigEntry,
  a2aMessages, InsertA2AMessage,
  blockchainSettlements, InsertBlockchainSettlement,
  knowledgePackages, InsertKnowledgePackage, KnowledgePackage,
  knowledgeAudits, InsertKnowledgeAudit, KnowledgeAudit,
  barterTransactions, InsertBarterTransaction, BarterTransaction,
  heartbeatLogs, InsertHeartbeatLog, HeartbeatLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ──────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "walletAddress", "tonPublicKey"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByWalletAddress(walletAddress: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.walletAddress, walletAddress)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Agents ─────────────────────────────────────────────────────────────────
export async function createAgent(agent: InsertAgent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(agents).values(agent);
  return getAgentById(agent.agentId);
}

export async function getAgentById(agentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(agents).where(eq(agents.agentId, agentId)).limit(1);
  return result[0];
}

export async function getAgentByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
  return result[0];
}

export async function listAgents(filters?: {
  status?: string;
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { agents: [], total: 0 };
  const conditions = [];
  if (filters?.status) conditions.push(eq(agents.status, filters.status as any));
  if (filters?.search) conditions.push(or(like(agents.name, `%${filters.search}%`), like(agents.description, `%${filters.search}%`)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  let query = db.select().from(agents);
  if (where) query = query.where(where) as any;
  const result = await (query as any).orderBy(desc(agents.createdAt)).limit(limit).offset(offset);

  let countQuery = db.select({ count: sql<number>`count(*)` }).from(agents);
  if (where) countQuery = countQuery.where(where) as any;
  const countResult = await countQuery;
  const total = countResult[0]?.count || 0;

  // Filter by role in JS since roles is JSON
  let filtered = result;
  if (filters?.role) {
    filtered = result.filter((a: any) => a.roles && a.roles.includes(filters.role));
  }

  return { agents: filtered, total };
}

export async function updateAgent(agentId: string, data: Partial<InsertAgent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(agents).set(data).where(eq(agents.agentId, agentId));
  return getAgentById(agentId);
}

/**
 * Get all agents owned by a specific user.
 */
export async function getAgentsByOwnerUserId(ownerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agents).where(eq(agents.ownerUserId, ownerUserId));
}

/**
 * Propagate a wallet address to all agents owned by a user.
 * Returns the list of agent IDs that were updated.
 */
export async function propagateWalletToOwnedAgents(
  ownerUserId: number,
  walletAddress: string
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const ownedAgents = await getAgentsByOwnerUserId(ownerUserId);
  const updatedAgentIds: string[] = [];
  for (const agent of ownedAgents) {
    // Only update if the agent doesn't already have this wallet or has no wallet
    if (agent.walletAddress !== walletAddress) {
      await db.update(agents)
        .set({ walletAddress })
        .where(eq(agents.agentId, agent.agentId));
      updatedAgentIds.push(agent.agentId);
    }
  }
  return updatedAgentIds;
}

export async function updateAgentHeartbeat(agentId: string, metadata?: {
  latencyMs?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  activeTaskCount?: number;
  agentVersion?: string;
  statusMessage?: string;
  ipAddress?: string;
  region?: string;
  healthy?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set({ lastHeartbeat: new Date(), status: "active" }).where(eq(agents.agentId, agentId));
  // Also log the heartbeat
  const logEntry: InsertHeartbeatLog = {
    agentId,
    latencyMs: metadata?.latencyMs ?? null,
    cpuUsage: metadata?.cpuUsage != null ? String(metadata.cpuUsage) : null,
    memoryUsage: metadata?.memoryUsage != null ? String(metadata.memoryUsage) : null,
    diskUsage: metadata?.diskUsage != null ? String(metadata.diskUsage) : null,
    activeTaskCount: metadata?.activeTaskCount ?? 0,
    agentVersion: metadata?.agentVersion ?? null,
    statusMessage: metadata?.statusMessage ?? null,
    ipAddress: metadata?.ipAddress ?? null,
    region: metadata?.region ?? null,
    healthy: metadata?.healthy ?? true,
  };
  await db.insert(heartbeatLogs).values(logEntry);
}

export async function deleteAgent(agentId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(agents).where(eq(agents.agentId, agentId));
}

// ─── Enrollment Challenges ──────────────────────────────────────────────────
export async function createEnrollmentChallenge(challenge: InsertEnrollmentChallenge) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(enrollmentChallenges).values(challenge);
  return challenge;
}

export async function getEnrollmentChallenge(challengeId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(enrollmentChallenges).where(eq(enrollmentChallenges.challengeId, challengeId)).limit(1);
  return result[0];
}

export async function updateEnrollmentChallenge(challengeId: string, data: Partial<InsertEnrollmentChallenge>) {
  const db = await getDb();
  if (!db) return;
  await db.update(enrollmentChallenges).set(data).where(eq(enrollmentChallenges.challengeId, challengeId));
}

// ─── Tasks ──────────────────────────────────────────────────────────────────
export async function createTask(task: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(tasks).values(task);
  return getTaskById(task.taskId);
}

export async function getTaskById(taskId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.taskId, taskId)).limit(1);
  return result[0];
}

export async function listTasks(filters?: {
  status?: string;
  requesterId?: string;
  assigneeId?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { tasks: [], total: 0 };
  const conditions = [];
  if (filters?.status) conditions.push(eq(tasks.status, filters.status as any));
  if (filters?.requesterId) conditions.push(eq(tasks.requesterId, filters.requesterId));
  if (filters?.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
  if (filters?.priority) conditions.push(eq(tasks.priority, filters.priority as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  let query = db.select().from(tasks);
  if (where) query = query.where(where) as any;
  const result = await (query as any).orderBy(desc(tasks.createdAt)).limit(limit).offset(offset);

  let countQuery = db.select({ count: sql<number>`count(*)` }).from(tasks);
  if (where) countQuery = countQuery.where(where) as any;
  const countResult = await countQuery;
  const total = countResult[0]?.count || 0;

  return { tasks: result, total };
}

export async function updateTask(taskId: string, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tasks).set(data).where(eq(tasks.taskId, taskId));
  return getTaskById(taskId);
}

// ─── Task Results ───────────────────────────────────────────────────────────
export async function createTaskResult(result: InsertTaskResult) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(taskResults).values(result);
  return result;
}

export async function getTaskResults(taskId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskResults).where(eq(taskResults.taskId, taskId));
}

// ─── Reputation Scores ─────────────────────────────────────────────────────
export async function getOrCreateReputation(agentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(reputationScores).where(eq(reputationScores.agentId, agentId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(reputationScores).values({ agentId });
  const created = await db.select().from(reputationScores).where(eq(reputationScores.agentId, agentId)).limit(1);
  return created[0]!;
}

export async function updateReputation(agentId: string, data: Partial<InsertReputationScore>) {
  const db = await getDb();
  if (!db) return;
  await db.update(reputationScores).set(data).where(eq(reputationScores.agentId, agentId));
}

export async function getReputationLeaderboard(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reputationScores).orderBy(desc(reputationScores.overallScore)).limit(limit);
}

// ─── Economic Transactions ──────────────────────────────────────────────────
export async function createEconomicTransaction(tx: InsertEconomicTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(economicTransactions).values(tx);
  return tx;
}

export async function getAgentTransactions(agentId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(economicTransactions)
    .where(or(eq(economicTransactions.fromAgentId, agentId), eq(economicTransactions.toAgentId, agentId)))
    .orderBy(desc(economicTransactions.createdAt))
    .limit(limit);
}

export async function getEconomyStats() {
  const db = await getDb();
  if (!db) return { totalTransactions: 0, totalVolume: "0" };
  const countResult = await db.select({ count: sql<number>`count(*)`, volume: sql<string>`COALESCE(SUM(amount), 0)` }).from(economicTransactions);
  return { totalTransactions: countResult[0]?.count || 0, totalVolume: countResult[0]?.volume || "0" };
}

// ─── Agent Capabilities ─────────────────────────────────────────────────────
export async function setAgentCapabilities(agentId: string, capabilities: InsertAgentCapability[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(agentCapabilities).where(eq(agentCapabilities.agentId, agentId));
  if (capabilities.length > 0) {
    await db.insert(agentCapabilities).values(capabilities);
  }
}

export async function getAgentCapabilities(agentId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentCapabilities).where(eq(agentCapabilities.agentId, agentId));
}

// ─── Audit Log ──────────────────────────────────────────────────────────────
export async function createAuditEntry(entry: InsertAuditLogEntry) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLog).values(entry);
}

export async function getAuditLog(filters?: { actorId?: string; eventType?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.actorId) conditions.push(eq(auditLog.actorId, filters.actorId));
  if (filters?.eventType) conditions.push(eq(auditLog.eventType, filters.eventType));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  let query = db.select().from(auditLog);
  if (where) query = query.where(where) as any;
  return (query as any).orderBy(desc(auditLog.createdAt)).limit(filters?.limit || 100);
}

// ─── Agent Sessions ─────────────────────────────────────────────────────────
export async function createAgentSession(session: InsertAgentSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(agentSessions).values(session);
  return session;
}

export async function getAgentSession(sessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(agentSessions).where(eq(agentSessions.sessionId, sessionId)).limit(1);
  return result[0];
}

export async function revokeAgentSession(sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(agentSessions).set({ isRevoked: true }).where(eq(agentSessions.sessionId, sessionId));
}

// ─── Federation Config ──────────────────────────────────────────────────────
export async function getFederationConfig(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(federationConfig).where(eq(federationConfig.configKey, key)).limit(1);
  return result[0];
}

export async function setFederationConfig(key: string, value: unknown, description?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(federationConfig).values({ configKey: key, configValue: value, description })
    .onDuplicateKeyUpdate({ set: { configValue: value, description } });
}

export async function getAllPublicConfig() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(federationConfig).where(eq(federationConfig.isPublic, true));
}

// ─── A2A Messages ───────────────────────────────────────────────────────────
export async function createA2AMessage(msg: InsertA2AMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(a2aMessages).values(msg);
  return msg;
}

export async function updateA2AMessage(messageId: string, data: Partial<InsertA2AMessage>) {
  const db = await getDb();
  if (!db) return;
  await db.update(a2aMessages).set(data).where(eq(a2aMessages.messageId, messageId));
}

// ─── Blockchain Settlements ─────────────────────────────────────────────────
export async function createBlockchainSettlement(settlement: InsertBlockchainSettlement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(blockchainSettlements).values(settlement);
  return settlement;
}

export async function updateBlockchainSettlement(settlementId: string, data: Partial<InsertBlockchainSettlement>) {
  const db = await getDb();
  if (!db) return;
  await db.update(blockchainSettlements).set(data).where(eq(blockchainSettlements.settlementId, settlementId));
}

// ─── Stats ──────────────────────────────────────────────────────────────────
export async function getFederationStats() {
  const db = await getDb();
  if (!db) return { totalAgents: 0, activeAgents: 0, totalTasks: 0, completedTasks: 0, failedTasks: 0, activeTasks: 0 };

  const agentCount = await db.select({ count: sql<number>`count(*)` }).from(agents);
  const activeAgentCount = await db.select({ count: sql<number>`count(*)` }).from(agents).where(eq(agents.status, "active"));
  const taskCount = await db.select({ count: sql<number>`count(*)` }).from(tasks);
  const completedTaskCount = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "completed"));
  const failedTaskCount = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "failed"));
  const activeTaskCount = await db.select({ count: sql<number>`count(*)` }).from(tasks)
    .where(or(eq(tasks.status, "created"), eq(tasks.status, "assigned"), eq(tasks.status, "in_progress")));

  return {
    totalAgents: agentCount[0]?.count || 0,
    activeAgents: activeAgentCount[0]?.count || 0,
    totalTasks: taskCount[0]?.count || 0,
    completedTasks: completedTaskCount[0]?.count || 0,
    failedTasks: failedTaskCount[0]?.count || 0,
    activeTasks: activeTaskCount[0]?.count || 0,
  };
}

// ─── Treasury Fee Queries ──────────────────────────────────────────────────
export async function getTreasuryFees() {
  const db = await getDb();
  if (!db) return { totalFeesCollected: "0", totalTransactions: 0, recentFees: [] };

  const feeSum = await db.select({
    total: sql<string>`COALESCE(SUM(amount), 0)`,
    count: sql<number>`count(*)`,
  }).from(economicTransactions).where(eq(economicTransactions.type, "platform_fee"));

  const recentFees = await db.select()
    .from(economicTransactions)
    .where(eq(economicTransactions.type, "platform_fee"))
    .orderBy(desc(economicTransactions.createdAt))
    .limit(20);

  return {
    totalFeesCollected: feeSum[0]?.total || "0",
    totalTransactions: feeSum[0]?.count || 0,
    recentFees,
  };
}

// ─── Knowledge Packages ────────────────────────────────────────────────────
export async function createKnowledgePackage(pkg: InsertKnowledgePackage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(knowledgePackages).values(pkg);
  return pkg;
}

export async function getKnowledgePackage(packageId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(knowledgePackages).where(eq(knowledgePackages.packageId, packageId)).limit(1);
  return rows[0] || null;
}

export async function listKnowledgePackages(opts?: {
  authorAgentId?: string;
  category?: string;
  auditStatus?: string;
  isListed?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { packages: [], total: 0 };
  const conditions = [];
  if (opts?.authorAgentId) conditions.push(eq(knowledgePackages.authorAgentId, opts.authorAgentId));
  if (opts?.category) conditions.push(eq(knowledgePackages.category, opts.category));
  if (opts?.auditStatus) conditions.push(eq(knowledgePackages.auditStatus, opts.auditStatus as any));
  if (opts?.isListed !== undefined) conditions.push(eq(knowledgePackages.isListed, opts.isListed));
  if (opts?.search) conditions.push(like(knowledgePackages.displayName, `%${opts.search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(knowledgePackages).where(where)
    .orderBy(desc(knowledgePackages.createdAt))
    .limit(opts?.limit || 50)
    .offset(opts?.offset || 0);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(knowledgePackages).where(where);
  return { packages: rows, total: countResult[0]?.count || 0 };
}

export async function updateKnowledgePackage(packageId: string, updates: Partial<InsertKnowledgePackage>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(knowledgePackages).set(updates).where(eq(knowledgePackages.packageId, packageId));
  return getKnowledgePackage(packageId);
}

// ─── Knowledge Audits ──────────────────────────────────────────────────────
export async function createKnowledgeAudit(audit: InsertKnowledgeAudit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(knowledgeAudits).values(audit);
  return audit;
}

export async function getKnowledgeAudit(auditId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(knowledgeAudits).where(eq(knowledgeAudits.auditId, auditId)).limit(1);
  return rows[0] || null;
}

export async function getAuditByPackage(packageId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(knowledgeAudits)
    .where(eq(knowledgeAudits.packageId, packageId))
    .orderBy(desc(knowledgeAudits.createdAt))
    .limit(1);
  return rows[0] || null;
}

export async function listPendingAudits(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgePackages)
    .where(eq(knowledgePackages.auditStatus, "pending"))
    .orderBy(asc(knowledgePackages.createdAt))
    .limit(limit);
}

// ─── Barter Transactions ───────────────────────────────────────────────────
export async function createBarterTransaction(tx: InsertBarterTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(barterTransactions).values(tx);
  return tx;
}

export async function getBarterTransaction(barterTxId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(barterTransactions).where(eq(barterTransactions.barterTxId, barterTxId)).limit(1);
  return rows[0] || null;
}

export async function updateBarterTransaction(barterTxId: string, updates: Partial<InsertBarterTransaction>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(barterTransactions).set(updates).where(eq(barterTransactions.barterTxId, barterTxId));
  return getBarterTransaction(barterTxId);
}

export async function listBarterTransactions(opts?: {
  agentId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { transactions: [], total: 0 };
  const conditions = [];
  if (opts?.agentId) {
    conditions.push(or(
      eq(barterTransactions.proposerAgentId, opts.agentId),
      eq(barterTransactions.responderAgentId, opts.agentId),
    ));
  }
  if (opts?.status) conditions.push(eq(barterTransactions.status, opts.status as any));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(barterTransactions).where(where)
    .orderBy(desc(barterTransactions.createdAt))
    .limit(opts?.limit || 50)
    .offset(opts?.offset || 0);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(barterTransactions).where(where);
  return { transactions: rows, total: countResult[0]?.count || 0 };
}

// ─── Heartbeat Logs ─────────────────────────────────────────────────────────────
export async function getHeartbeatHistory(agentId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(heartbeatLogs)
    .where(eq(heartbeatLogs.agentId, agentId))
    .orderBy(desc(heartbeatLogs.timestamp))
    .limit(limit);
}

export async function getHeartbeatStats(agentId: string) {
  const db = await getDb();
  if (!db) return { totalBeats: 0, healthyBeats: 0, avgLatency: 0, uptimePercent: 0, lastBeat: null };
  const total = await db.select({ count: sql<number>`count(*)` }).from(heartbeatLogs)
    .where(eq(heartbeatLogs.agentId, agentId));
  const healthy = await db.select({ count: sql<number>`count(*)` }).from(heartbeatLogs)
    .where(and(eq(heartbeatLogs.agentId, agentId), eq(heartbeatLogs.healthy, true)));
  const avgLat = await db.select({ avg: sql<number>`COALESCE(AVG(latencyMs), 0)` }).from(heartbeatLogs)
    .where(and(eq(heartbeatLogs.agentId, agentId), sql`latencyMs IS NOT NULL`));
  const lastBeat = await db.select().from(heartbeatLogs)
    .where(eq(heartbeatLogs.agentId, agentId))
    .orderBy(desc(heartbeatLogs.timestamp))
    .limit(1);
  const totalCount = total[0]?.count || 0;
  const healthyCount = healthy[0]?.count || 0;
  return {
    totalBeats: totalCount,
    healthyBeats: healthyCount,
    avgLatency: Math.round(avgLat[0]?.avg || 0),
    uptimePercent: totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0,
    lastBeat: lastBeat[0] || null,
  };
}

export async function getLiveAgentStatuses() {
  const db = await getDb();
  if (!db) return [];
  const allAgents = await db.select({
    agentId: agents.agentId,
    name: agents.name,
    status: agents.status,
    lastHeartbeat: agents.lastHeartbeat,
    heartbeatInterval: agents.heartbeatInterval,
    version: agents.version,
    activeTasks: agents.activeTasks,
    maxConcurrentTasks: agents.maxConcurrentTasks,
    region: agents.region,
  }).from(agents).orderBy(desc(agents.lastHeartbeat));
  const now = Date.now();
  return allAgents.map(a => {
    const lastBeatMs = a.lastHeartbeat ? new Date(a.lastHeartbeat).getTime() : 0;
    const intervalMs = (a.heartbeatInterval || 60) * 1000;
    const elapsed = now - lastBeatMs;
    let liveStatus: "online" | "degraded" | "offline" = "offline";
    if (lastBeatMs > 0 && elapsed < intervalMs * 2) liveStatus = "online";
    else if (lastBeatMs > 0 && elapsed < intervalMs * 5) liveStatus = "degraded";
    return { ...a, liveStatus, elapsedSinceHeartbeat: elapsed };
  });
}

export async function purgeOldHeartbeats(agentId: string, keepCount = 200) {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select({ id: heartbeatLogs.id }).from(heartbeatLogs)
    .where(eq(heartbeatLogs.agentId, agentId))
    .orderBy(desc(heartbeatLogs.timestamp))
    .limit(1).offset(keepCount);
  if (rows[0]) {
    await db.delete(heartbeatLogs)
      .where(and(eq(heartbeatLogs.agentId, agentId), lte(heartbeatLogs.id, rows[0].id)));
  }
}

export async function getBarterStats() {
  const db = await getDb();
  if (!db) return { totalBarters: 0, completedBarters: 0, totalFeesCollected: "0", activeProposals: 0 };

  const total = await db.select({ count: sql<number>`count(*)` }).from(barterTransactions);
  const completed = await db.select({ count: sql<number>`count(*)` }).from(barterTransactions)
    .where(eq(barterTransactions.status, "completed"));
  const fees = await db.select({ total: sql<string>`COALESCE(SUM(totalFeeTon), 0)` }).from(barterTransactions)
    .where(eq(barterTransactions.status, "completed"));
  const active = await db.select({ count: sql<number>`count(*)` }).from(barterTransactions)
    .where(inArray(barterTransactions.status, ["proposed", "countered", "accepted", "fee_locked", "escrowed", "exchanging", "verifying"]));

  return {
    totalBarters: total[0]?.count || 0,
    completedBarters: completed[0]?.count || 0,
    totalFeesCollected: fees[0]?.total || "0",
    activeProposals: active[0]?.count || 0,
  };
}
