import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  InsertUser,
  InsertAgent,
  InsertTask,
  InsertTaskResult,
  InsertReputationScore,
  InsertEconomicTransaction,
  InsertAgentCapability,
  InsertAuditLogEntry,
  InsertEnrollmentChallenge,
  InsertAgentSession,
  InsertFederationConfigEntry,
  InsertA2AMessage,
  InsertBlockchainSettlement,
  InsertKnowledgePackage,
  InsertKnowledgeAudit,
  InsertBarterTransaction,
  InsertHeartbeatLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';

// ─── Supabase Client ─────────────────────────────────────────────────────────
let _supabase: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || ENV.supabaseUrl;
    const key = process.env.SUPABASE_SERVICE_KEY || ENV.supabaseServiceKey;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

function check<T>(result: { data: T; error: any }): T {
  if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
  return result.data;
}

// ─── Users ──────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  try {
    const values: Record<string, unknown> = { openId: user.openId };
    const textFields = ["name", "email", "loginMethod", "walletAddress", "tonPublicKey"] as const;
    type TextField = typeof textFields[number];
    textFields.forEach((field: TextField) => {
      if (user[field] !== undefined) values[field] = user[field] ?? null;
    });
    if (user.lastSignedIn !== undefined) values.lastSignedIn = user.lastSignedIn;
    if (user.role !== undefined) values.role = user.role;
    else if (user.openId === ENV.ownerOpenId) values.role = "admin";
    if (!values.lastSignedIn) values.lastSignedIn = new Date().toISOString();
    check(await getDb().from("users").upsert(values, { onConflict: "openId" }));
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const { data } = await getDb().from("users").select("*").eq("openId", openId).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export async function getUserByWalletAddress(walletAddress: string) {
  const { data } = await getDb().from("users").select("*").eq("walletAddress", walletAddress).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const { data } = await getDb().from("users").select("*").eq("email", email).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

// ─── Agents ─────────────────────────────────────────────────────────────────
export async function createAgent(agent: InsertAgent) {
  check(await getDb().from("agents").insert(agent as any));
  return getAgentById(agent.agentId);
}

export async function getAgentById(agentId: string) {
  const { data } = await getDb().from("agents").select("*").eq("agentId", agentId).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export const getAgentByAgentId = getAgentById;

export async function getAgentByName(name: string) {
  const { data } = await getDb().from("agents").select("*").eq("name", name).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export async function listAgents(filters?: {
  status?: string;
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  let query = getDb().from("agents").select("*", { count: "exact" });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.search) query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  query = (query as any).order("createdAt", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  let result = data || [];
  if (filters?.role) {
    result = result.filter((a: any) => a.roles && a.roles.includes(filters.role));
  }
  return { agents: result, total: count || 0 };
}

export async function updateAgent(agentId: string, data: Partial<InsertAgent>) {
  check(await getDb().from("agents").update(data as any).eq("agentId", agentId));
  return getAgentById(agentId);
}

export async function updateAgentStatus(agentId: string, status: string) {
  check(await getDb().from("agents").update({ status } as any).eq("agentId", agentId));
}

export async function getAgentsByOwnerUserId(ownerUserId: number) {
  const { data } = await getDb().from("agents").select("*").eq("ownerUserId", ownerUserId);
  return data || [];
}

export async function propagateWalletToOwnedAgents(ownerUserId: number, walletAddress: string): Promise<string[]> {
  const owned = await getAgentsByOwnerUserId(ownerUserId);
  const updatedIds: string[] = [];
  for (const agent of owned) {
    if (agent.walletAddress !== walletAddress) {
      await getDb().from("agents").update({ walletAddress }).eq("agentId", agent.agentId);
      updatedIds.push(agent.agentId);
    }
  }
  return updatedIds;
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
  check(await getDb().from("agents").update({ lastHeartbeat: new Date().toISOString(), status: "active" } as any).eq("agentId", agentId));
  const logEntry: Record<string, unknown> = {
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
  await getDb().from("heartbeat_logs").insert(logEntry);
}

export async function deleteAgent(agentId: string) {
  await getDb().from("agents").delete().eq("agentId", agentId);
}

// ─── Enrollment Challenges ───────────────────────────────────────────────────
export async function createEnrollmentChallenge(challenge: InsertEnrollmentChallenge) {
  const row: Record<string, unknown> = {
    challengeId: challenge.challengeId,
    agentName: challenge.agentName,
    publicKey: challenge.publicKey,
    roles: challenge.roles,
    challengeNonce: challenge.challengeNonce,
    status: challenge.status || "pending",
    expiresAt: challenge.expiresAt instanceof Date
      ? challenge.expiresAt.toISOString()
      : challenge.expiresAt,
  };
  if (challenge.ipAddress) row.ipAddress = challenge.ipAddress;
  check(await getDb().from("enrollment_challenges").insert(row));
  return challenge;
}

export async function getEnrollmentChallenge(challengeId: string) {
  const { data } = await getDb().from("enrollment_challenges").select("*").eq("challengeId", challengeId).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export async function verifyEnrollmentChallenge(challengeId: string, updates: Partial<InsertEnrollmentChallenge>) {
  check(await getDb().from("enrollment_challenges").update(updates as any).eq("challengeId", challengeId));
}

export async function updateEnrollmentChallenge(challengeId: string, data: Partial<InsertEnrollmentChallenge>) {
  check(await getDb().from("enrollment_challenges").update(data as any).eq("challengeId", challengeId));
}

// ─── Tasks ──────────────────────────────────────────────────────────────────
export async function createTask(task: InsertTask) {
  check(await getDb().from("tasks").insert(task as any));
  return getTaskById(task.taskId);
}

export async function getTaskById(taskId: string) {
  const { data } = await getDb().from("tasks").select("*").eq("taskId", taskId).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export async function listTasks(filters?: {
  status?: string;
  requesterId?: string;
  assigneeId?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  let query = getDb().from("tasks").select("*", { count: "exact" });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.requesterId) query = query.eq("requesterId", filters.requesterId);
  if (filters?.assigneeId) query = query.eq("assigneeId", filters.assigneeId);
  if (filters?.priority) query = query.eq("priority", filters.priority);
  query = (query as any).order("createdAt", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { tasks: data || [], total: count || 0 };
}

export async function updateTask(taskId: string, data: Partial<InsertTask>) {
  check(await getDb().from("tasks").update(data as any).eq("taskId", taskId));
  return getTaskById(taskId);
}

// ─── Task Results ────────────────────────────────────────────────────────────
export async function createTaskResult(result: InsertTaskResult) {
  check(await getDb().from("task_results").insert(result as any));
  return result;
}

export async function getTaskResult(resultId: string) {
  const { data } = await getDb().from("task_results").select("*").eq("resultId", resultId).limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function getTaskResults(taskId: string) {
  const { data } = await getDb().from("task_results").select("*").eq("taskId", taskId);
  return data || [];
}

// ─── Reputation Scores ───────────────────────────────────────────────────────
export async function createReputationScore(agentId: string) {
  const existing = await getReputationScore(agentId);
  if (existing) return existing;
  check(await getDb().from("reputation_scores").insert({ agentId } as any));
  return getReputationScore(agentId);
}

export const getOrCreateReputation = createReputationScore;

export async function getReputationScore(agentId: string) {
  const { data } = await getDb().from("reputation_scores").select("*").eq("agentId", agentId).limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function updateReputationScore(agentId: string, data: Partial<InsertReputationScore>) {
  check(await getDb().from("reputation_scores").update(data as any).eq("agentId", agentId));
}

export const updateReputation = updateReputationScore;

export async function getReputationLeaderboard(limit = 20) {
  const { data } = await getDb().from("reputation_scores").select("*").order("overallScore", { ascending: false }).limit(limit);
  return data || [];
}

// ─── Economic Transactions ───────────────────────────────────────────────────
export async function createEconomicTransaction(tx: InsertEconomicTransaction) {
  check(await getDb().from("economic_transactions").insert(tx as any));
  return tx;
}

export async function getAgentBalance(agentId: string): Promise<string> {
  const { data } = await getDb().from("agents").select("creditBalance").eq("agentId", agentId).limit(1);
  return data && data.length > 0 ? (data[0].creditBalance ?? "0") : "0";
}

export async function listAgentTransactions(agentId: string, limit = 50) {
  const { data } = await getDb()
    .from("economic_transactions")
    .select("*")
    .or(`fromAgentId.eq.${agentId},toAgentId.eq.${agentId}`)
    .order("createdAt", { ascending: false })
    .limit(limit);
  return data || [];
}

export const getAgentTransactions = listAgentTransactions;

export async function getEconomicStats() {
  const { data } = await getDb().from("economic_transactions").select("amount");
  const total = (data || []).reduce((sum: number, row: any) => sum + parseFloat(row.amount || "0"), 0);
  return { totalTransactions: (data || []).length, totalVolume: total.toFixed(6) };
}

export const getEconomyStats = getEconomicStats;

// Atomic credit transfer via Supabase RPC (P2-T2: Financial Transaction Safety)
export async function atomicTransferCredits(params: {
  fromAgentId: string;
  toAgentId: string;
  amount: string;
  fee: string;
  netAmount: string;
  txId: string;
  feeTxId: string;
  memo?: string | null;
  feeMemo?: string | null;
}): Promise<{ success: boolean; newFromBalance: string; newToBalance: string; fee: string }> {
  const { data, error } = await getDb().rpc("nervix_transfer_credits", {
    p_from_agent_id: params.fromAgentId,
    p_to_agent_id: params.toAgentId,
    p_amount: params.amount,
    p_fee: params.fee,
    p_net_amount: params.netAmount,
    p_tx_id: params.txId,
    p_fee_tx_id: params.feeTxId,
    p_memo: params.memo ?? null,
    p_fee_memo: params.feeMemo ?? null,
  });
  if (error) throw new Error(error.message || "Atomic transfer failed");
  return data as any;
}

export async function getTreasuryFees() {
  const { data } = await getDb()
    .from("economic_transactions")
    .select("*")
    .eq("type", "platform_fee")
    .order("createdAt", { ascending: false });
  const fees = data || [];
  const total = fees.reduce((sum: number, row: any) => sum + parseFloat(row.amount || "0"), 0);
  return { totalFeesCollected: total.toFixed(6), totalTransactions: fees.length, recentFees: fees.slice(0, 20) };
}

// ─── Agent Capabilities ──────────────────────────────────────────────────────
export async function createAgentCapability(capability: InsertAgentCapability) {
  check(await getDb().from("agent_capabilities").insert(capability as any));
  return capability;
}

export async function listAgentCapabilities(agentId: string) {
  const { data } = await getDb().from("agent_capabilities").select("*").eq("agentId", agentId);
  return data || [];
}

export const getAgentCapabilities = listAgentCapabilities;

export async function setAgentCapabilities(agentId: string, capabilities: InsertAgentCapability[]) {
  await getDb().from("agent_capabilities").delete().eq("agentId", agentId);
  if (capabilities.length > 0) {
    check(await getDb().from("agent_capabilities").insert(capabilities as any));
  }
}

// ─── Audit Log ───────────────────────────────────────────────────────────────
export async function createAuditLog(entry: InsertAuditLogEntry) {
  await getDb().from("audit_log").insert(entry as any);
}

export const createAuditEntry = createAuditLog;

export async function getAuditLog(filters?: { actorId?: string; eventType?: string; limit?: number }) {
  let query = getDb().from("audit_log").select("*");
  if (filters?.actorId) query = query.eq("actorId", filters.actorId);
  if (filters?.eventType) query = query.eq("eventType", filters.eventType);
  query = (query as any).order("createdAt", { ascending: false }).limit(filters?.limit || 100);
  const { data } = await query;
  return data || [];
}

// ─── Agent Sessions ──────────────────────────────────────────────────────────
export async function createAgentSession(session: InsertAgentSession) {
  // Explicitly serialize dates to ISO strings for Supabase compatibility
  const row: Record<string, unknown> = {
    sessionId: session.sessionId,
    agentId: session.agentId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt instanceof Date
      ? session.accessTokenExpiresAt.toISOString()
      : session.accessTokenExpiresAt,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt instanceof Date
      ? session.refreshTokenExpiresAt.toISOString()
      : session.refreshTokenExpiresAt,
    isRevoked: false,
    lastUsedAt: new Date().toISOString(),
  };
  if (session.ipAddress) row.ipAddress = session.ipAddress;
  if (session.userAgent) row.userAgent = session.userAgent;
  check(await getDb().from("agent_sessions").insert(row));
  return session;
}

export async function getAgentSession(sessionId: string) {
  const { data } = await getDb().from("agent_sessions").select("*").eq("sessionId", sessionId).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export async function revokeAgentSession(sessionId: string) {
  check(await getDb().from("agent_sessions").update({ isRevoked: true } as any).eq("sessionId", sessionId));
}

export async function getAgentSessionByToken(accessToken: string) {
  const { data } = await getDb()
    .from("agent_sessions")
    .select("*")
    .eq("accessToken", accessToken)
    .eq("isRevoked", false)
    .limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export async function updateAgentSessionLastUsed(sessionId: string) {
  await getDb().from("agent_sessions").update({ lastUsedAt: new Date().toISOString() } as any).eq("sessionId", sessionId);
}

export async function getAgentSessionByRefreshToken(refreshToken: string) {
  const { data } = await getDb()
    .from("agent_sessions")
    .select("*")
    .eq("refreshToken", refreshToken)
    .eq("isRevoked", false)
    .limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export async function rotateAccessToken(sessionId: string, newAccessToken: string, newExpiresAt: Date) {
  check(await getDb().from("agent_sessions").update({
    accessToken: newAccessToken,
    accessTokenExpiresAt: newExpiresAt.toISOString(),
    lastUsedAt: new Date().toISOString(),
  } as any).eq("sessionId", sessionId));
}

// ─── Federation Config ───────────────────────────────────────────────────────
export async function setFederationConfig(key: string, value: unknown, description?: string) {
  check(await getDb().from("federation_config").upsert(
    { configKey: key, configValue: value, description },
    { onConflict: "configKey" }
  ));
}

export async function getAllPublicConfig() {
  const { data } = await getDb().from("federation_config").select("*").eq("isPublic", true);
  return data || [];
}

export async function getFederationConfig(key: string) {
  const { data } = await getDb().from("federation_config").select("*").eq("configKey", key).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

// ─── A2A Messages ────────────────────────────────────────────────────────────
export async function createA2AMessage(msg: InsertA2AMessage) {
  check(await getDb().from("a2a_messages").insert(msg as any));
  return msg;
}

export async function getA2AMessage(messageId: string) {
  const { data } = await getDb().from("a2a_messages").select("*").eq("messageId", messageId).limit(1);
  return data && data.length > 0 ? data[0] : undefined;
}

export async function updateA2AMessageStatus(messageId: string, status: string) {
  check(await getDb().from("a2a_messages").update({ status } as any).eq("messageId", messageId));
}

export async function updateA2AMessage(messageId: string, data: Partial<InsertA2AMessage>) {
  check(await getDb().from("a2a_messages").update(data as any).eq("messageId", messageId));
}

// ─── Blockchain Settlements ──────────────────────────────────────────────────
export async function createBlockchainSettlement(settlement: InsertBlockchainSettlement) {
  check(await getDb().from("blockchain_settlements").insert(settlement as any));
  return settlement;
}

export async function updateBlockchainSettlement(settlementId: string, data: Partial<InsertBlockchainSettlement>) {
  check(await getDb().from("blockchain_settlements").update(data as any).eq("settlementId", settlementId));
}

// ─── Federation Stats ────────────────────────────────────────────────────────
export async function getFederationStats() {
  const [agentsRes, activeRes, tasksRes, completedRes, failedRes, activeTasksRes] = await Promise.all([
    getDb().from("agents").select("*", { count: "exact", head: true }),
    getDb().from("agents").select("*", { count: "exact", head: true }).eq("status", "active"),
    getDb().from("tasks").select("*", { count: "exact", head: true }),
    getDb().from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed"),
    getDb().from("tasks").select("*", { count: "exact", head: true }).eq("status", "failed"),
    getDb().from("tasks").select("*", { count: "exact", head: true }).in("status", ["created", "assigned", "in_progress"]),
  ]);
  return {
    totalAgents: agentsRes.count || 0,
    activeAgents: activeRes.count || 0,
    totalTasks: tasksRes.count || 0,
    completedTasks: completedRes.count || 0,
    failedTasks: failedRes.count || 0,
    activeTasks: activeTasksRes.count || 0,
  };
}

// ─── Knowledge Packages ──────────────────────────────────────────────────────
export async function createKnowledgePackage(pkg: InsertKnowledgePackage) {
  check(await getDb().from("knowledge_packages").insert(pkg as any));
  return pkg;
}

export async function getKnowledgePackageById(packageId: string) {
  const { data } = await getDb().from("knowledge_packages").select("*").eq("packageId", packageId).limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export const getKnowledgePackage = getKnowledgePackageById;

export async function listKnowledgePackages(opts?: {
  authorAgentId?: string;
  category?: string;
  auditStatus?: string;
  isListed?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;
  let query = getDb().from("knowledge_packages").select("*", { count: "exact" });
  if (opts?.authorAgentId) query = query.eq("authorAgentId", opts.authorAgentId);
  if (opts?.category) query = query.eq("category", opts.category);
  if (opts?.auditStatus) query = query.eq("auditStatus", opts.auditStatus);
  if (opts?.isListed !== undefined) query = query.eq("isListed", opts.isListed);
  if (opts?.search) query = query.ilike("displayName", `%${opts.search}%`);
  query = (query as any).order("createdAt", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { packages: data || [], total: count || 0 };
}

export async function updateKnowledgePackage(packageId: string, updates: Partial<InsertKnowledgePackage>) {
  check(await getDb().from("knowledge_packages").update(updates as any).eq("packageId", packageId));
  return getKnowledgePackageById(packageId);
}

export async function listPendingAudits(limit = 20) {
  const { data } = await getDb().from("knowledge_packages").select("*")
    .eq("auditStatus", "pending")
    .order("createdAt", { ascending: true })
    .limit(limit);
  return data || [];
}

// ─── Knowledge Audits ────────────────────────────────────────────────────────
export async function createKnowledgeAudit(audit: InsertKnowledgeAudit) {
  check(await getDb().from("knowledge_audits").insert(audit as any));
  return audit;
}

export async function getKnowledgeAudit(auditId: string) {
  const { data } = await getDb().from("knowledge_audits").select("*").eq("auditId", auditId).limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function getAuditByPackage(packageId: string) {
  const { data } = await getDb().from("knowledge_audits").select("*")
    .eq("packageId", packageId)
    .order("createdAt", { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

// ─── Barter Transactions ─────────────────────────────────────────────────────
export async function createBarterTransaction(tx: InsertBarterTransaction) {
  check(await getDb().from("barter_transactions").insert(tx as any));
  return tx;
}

export async function getBarterTransaction(barterTxId: string) {
  const { data } = await getDb().from("barter_transactions").select("*").eq("barterTxId", barterTxId).limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function listBarterTransactions(opts?: {
  agentId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;
  let query = getDb().from("barter_transactions").select("*", { count: "exact" });
  if (opts?.agentId) query = query.or(`proposerAgentId.eq.${opts.agentId},responderAgentId.eq.${opts.agentId}`);
  if (opts?.status) query = query.eq("status", opts.status);
  query = (query as any).order("createdAt", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { transactions: data || [], total: count || 0 };
}

export async function updateBarterTransaction(barterTxId: string, updates: Partial<InsertBarterTransaction>) {
  check(await getDb().from("barter_transactions").update(updates as any).eq("barterTxId", barterTxId));
  return getBarterTransaction(barterTxId);
}

export async function getBarterStats() {
  const [total, completed, fees, active] = await Promise.all([
    getDb().from("barter_transactions").select("*", { count: "exact", head: true }),
    getDb().from("barter_transactions").select("*", { count: "exact", head: true }).eq("status", "completed"),
    getDb().from("barter_transactions").select("totalFeeTon").eq("status", "completed"),
    getDb().from("barter_transactions").select("*", { count: "exact", head: true })
      .in("status", ["proposed", "countered", "accepted", "fee_locked", "escrowed", "exchanging", "verifying"]),
  ]);
  const totalFees = (fees.data || []).reduce((sum: number, r: any) => sum + parseFloat(r.totalFeeTon || "0"), 0);
  return {
    totalBarters: total.count || 0,
    completedBarters: completed.count || 0,
    totalFeesCollected: totalFees.toFixed(6),
    activeProposals: active.count || 0,
  };
}

// ─── Heartbeat Logs ──────────────────────────────────────────────────────────
export async function createHeartbeatLog(log: InsertHeartbeatLog) {
  check(await getDb().from("heartbeat_logs").insert(log as any));
  return log;
}

export async function listHeartbeatLogs(opts?: {
  agentId?: string;
  healthy?: boolean;
  limit?: number;
  offset?: number;
}) {
  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;
  let query = getDb().from("heartbeat_logs").select("*", { count: "exact" });
  if (opts?.agentId) query = query.eq("agentId", opts.agentId);
  if (opts?.healthy !== undefined) query = query.eq("healthy", opts.healthy);
  query = (query as any).order("timestamp", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { logs: data || [], total: count || 0 };
}

export async function getAgentHeartbeatHistory(agentId: string, limit = 50) {
  const { data } = await getDb().from("heartbeat_logs").select("*")
    .eq("agentId", agentId)
    .order("timestamp", { ascending: false })
    .limit(limit);
  return data || [];
}

export const getHeartbeatHistory = getAgentHeartbeatHistory;

export async function getHeartbeatStats(agentId: string) {
  const [allLogs, lastBeatRes] = await Promise.all([
    getDb().from("heartbeat_logs").select("latencyMs,healthy").eq("agentId", agentId),
    getDb().from("heartbeat_logs").select("*").eq("agentId", agentId).order("timestamp", { ascending: false }).limit(1),
  ]);
  const logs = allLogs.data || [];
  const totalCount = logs.length;
  const healthyCount = logs.filter((l: any) => l.healthy).length;
  const latencies = logs.map((l: any) => l.latencyMs).filter((v: any) => v != null) as number[];
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length) : 0;
  return {
    totalBeats: totalCount,
    healthyBeats: healthyCount,
    avgLatency,
    uptimePercent: totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0,
    lastBeat: lastBeatRes.data && lastBeatRes.data.length > 0 ? lastBeatRes.data[0] : null,
  };
}

export async function getLiveAgentStatuses() {
  const { data } = await getDb().from("agents").select(
    "agentId,name,status,lastHeartbeat,heartbeatInterval,version,activeTasks,maxConcurrentTasks,region"
  ).order("lastHeartbeat", { ascending: false, nullsFirst: false });
  const now = Date.now();
  return (data || []).map((a: any) => {
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
  const { data } = await getDb().from("heartbeat_logs").select("id")
    .eq("agentId", agentId)
    .order("timestamp", { ascending: false })
    .range(keepCount, keepCount);
  if (data && data.length > 0) {
    await getDb().from("heartbeat_logs").delete()
      .eq("agentId", agentId)
      .lte("id", data[0].id);
  }
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export async function getLeaderboardRankings(limit = 20) {
  const { data } = await getDb().from("reputation_scores").select("*")
    .order("overallScore", { ascending: false })
    .limit(limit);
  return (data || []).map((row: any, idx: number) => ({ rank: idx + 1, ...row }));
}

export async function getAgentLeaderboardStats(agentId: string) {
  const [scoresRes, agentRes, rankedRes] = await Promise.all([
    getDb().from("reputation_scores").select("*").eq("agentId", agentId).limit(1),
    getDb().from("agents").select(
      "agentId,name,status,totalTasksCompleted,totalTasksFailed,totalCreditsEarned,totalCreditsSpent,creditBalance,region"
    ).eq("agentId", agentId).limit(1),
    getDb().from("reputation_scores").select("agentId").order("overallScore", { ascending: false }),
  ]);
  const ranked = rankedRes.data || [];
  const rank = ranked.findIndex((r: any) => r.agentId === agentId) + 1;
  return {
    rank: rank > 0 ? rank : null,
    reputation: scoresRes.data && scoresRes.data.length > 0 ? scoresRes.data[0] : null,
    agent: agentRes.data && agentRes.data.length > 0 ? agentRes.data[0] : null,
  };
}

export async function getLeaderboardHistory(agentId: string, limit = 30) {
  const { data } = await getDb().from("heartbeat_logs").select(
    "timestamp,healthy,latencyMs,cpuUsage,memoryUsage,activeTaskCount"
  ).eq("agentId", agentId)
    .order("timestamp", { ascending: false })
    .limit(limit);
  return data || [];
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
export async function getSubscription(userId: number) {
  const { data } = await getDb().from("subscriptions").select("*").eq("user_id", userId).eq("status", "active").limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function createSubscription(userId: number, plan: string = "free") {
  const limits: Record<string, { channels: number; videos: number }> = {
    free: { channels: 1, videos: 50 },
    pro: { channels: 5, videos: 500 },
    business: { channels: 20, videos: 5000 },
  };
  const l = limits[plan] || limits.free;
  check(await getDb().from("subscriptions").insert({
    user_id: userId, plan, status: "active", max_channels: l.channels, max_videos_per_month: l.videos,
  }));
}

export async function updateSubscription(userId: number, data: Record<string, unknown>) {
  check(await getDb().from("subscriptions").update(data).eq("user_id", userId).eq("status", "active"));
}

// ─── YouTube Channels ─────────────────────────────────────────────────────────
export async function createYouTubeChannel(channel: {
  user_id: number; channel_id: string; channel_title?: string; channel_thumbnail?: string;
  subscriber_count?: number; video_count?: number; view_count?: number;
  access_token: string; refresh_token: string; token_expires_at: string; scopes?: string;
}) {
  check(await getDb().from("youtube_channels").upsert(channel, { onConflict: "user_id,channel_id" }));
  return getYouTubeChannel(channel.user_id, channel.channel_id);
}

export async function getYouTubeChannel(userId: number, channelId: string) {
  const { data } = await getDb().from("youtube_channels").select("*")
    .eq("user_id", userId).eq("channel_id", channelId).limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function getYouTubeChannelById(id: string) {
  const { data } = await getDb().from("youtube_channels").select("*").eq("id", id).limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function listYouTubeChannels(userId: number) {
  const { data } = await getDb().from("youtube_channels").select("*")
    .eq("user_id", userId).eq("is_active", true).order("created_at", { ascending: false });
  return data || [];
}

export async function updateYouTubeChannel(id: string, updates: Record<string, unknown>) {
  check(await getDb().from("youtube_channels").update(updates).eq("id", id));
}

export async function deleteYouTubeChannel(id: string) {
  await getDb().from("youtube_channels").update({ is_active: false }).eq("id", id);
}

// ─── YouTube Videos ───────────────────────────────────────────────────────────
export async function upsertYouTubeVideo(video: {
  channel_id: string; user_id: number; video_id: string; title?: string; description?: string;
  thumbnail_url?: string; status?: string; duration?: string;
  view_count?: number; like_count?: number; comment_count?: number;
  published_at?: string; tags?: string[]; category?: string; metadata?: unknown;
}) {
  check(await getDb().from("youtube_videos").upsert(video, { onConflict: "channel_id,video_id" }));
}

export async function listYouTubeVideos(userId: number, opts?: {
  channelId?: string; status?: string; limit?: number; offset?: number;
}) {
  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;
  let query = getDb().from("youtube_videos").select("*", { count: "exact" }).eq("user_id", userId);
  if (opts?.channelId) query = query.eq("channel_id", opts.channelId);
  if (opts?.status) query = query.eq("status", opts.status);
  query = (query as any).order("published_at", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { videos: data || [], total: count || 0 };
}

export async function getYouTubeVideo(userId: number, videoId: string) {
  const { data } = await getDb().from("youtube_videos").select("*")
    .eq("user_id", userId).eq("video_id", videoId).limit(1);
  return data && data.length > 0 ? data[0] : null;
}

export async function getYouTubeVideoStats(userId: number) {
  const { data } = await getDb().from("youtube_videos").select("view_count,like_count,comment_count").eq("user_id", userId);
  const videos = data || [];
  return {
    totalVideos: videos.length,
    totalViews: videos.reduce((s: number, v: any) => s + (parseInt(v.view_count) || 0), 0),
    totalLikes: videos.reduce((s: number, v: any) => s + (v.like_count || 0), 0),
    totalComments: videos.reduce((s: number, v: any) => s + (v.comment_count || 0), 0),
  };
}
