import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  decimal,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Core User Table (Manus Auth) ───────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  walletAddress: varchar("walletAddress", { length: 128 }),
  tonPublicKey: varchar("tonPublicKey", { length: 128 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Agents Table ───────────────────────────────────────────────────────────
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  publicKey: text("publicKey").notNull(),
  status: mysqlEnum("status", ["pending", "active", "suspended", "offline"]).default("pending").notNull(),
  roles: json("roles").$type<string[]>().notNull(),
  agentCard: json("agentCard").$type<Record<string, unknown>>(),
  webhookUrl: varchar("webhookUrl", { length: 512 }),
  webhookSecret: varchar("webhookSecret", { length: 256 }),
  maxConcurrentTasks: int("maxConcurrentTasks").default(3).notNull(),
  activeTasks: int("activeTasks").default(0).notNull(),
  lastHeartbeat: timestamp("lastHeartbeat"),
  heartbeatInterval: int("heartbeatInterval").default(60).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  hostname: varchar("hostname", { length: 255 }),
  region: varchar("region", { length: 64 }),
  version: varchar("version", { length: 32 }),
  ownerUserId: int("ownerUserId"),
  creditBalance: decimal("creditBalance", { precision: 18, scale: 6 }).default("100.000000").notNull(),
  walletAddress: varchar("walletAddress", { length: 128 }),
  totalTasksCompleted: int("totalTasksCompleted").default(0).notNull(),
  totalTasksFailed: int("totalTasksFailed").default(0).notNull(),
  totalCreditsEarned: decimal("totalCreditsEarned", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  totalCreditsSpent: decimal("totalCreditsSpent", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

// ─── Tasks Table ────────────────────────────────────────────────────────────
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull().unique(),
  a2aTaskId: varchar("a2aTaskId", { length: 128 }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 128 }),
  status: mysqlEnum("status", ["created", "assigned", "in_progress", "completed", "failed", "cancelled", "timeout"]).default("created").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  requiredRoles: json("requiredRoles").$type<string[]>(),
  requiredSkills: json("requiredSkills").$type<string[]>(),
  requesterId: varchar("requesterId", { length: 64 }).notNull(),
  assigneeId: varchar("assigneeId", { length: 64 }),
  inputArtifacts: json("inputArtifacts").$type<Record<string, unknown>[]>(),
  outputArtifacts: json("outputArtifacts").$type<Record<string, unknown>[]>(),
  creditReward: decimal("creditReward", { precision: 18, scale: 6 }).default("10.000000").notNull(),
  creditEscrowed: decimal("creditEscrowed", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  maxDuration: int("maxDuration").default(3600),
  retryCount: int("retryCount").default(0).notNull(),
  maxRetries: int("maxRetries").default(3).notNull(),
  errorMessage: text("errorMessage"),
  qualityRating: int("qualityRating"),
  assignedAt: timestamp("assignedAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Task Results Table ─────────────────────────────────────────────────────
export const taskResults = mysqlTable("task_results", {
  id: int("id").autoincrement().primaryKey(),
  resultId: varchar("resultId", { length: 64 }).notNull().unique(),
  taskId: varchar("taskId", { length: 64 }).notNull(),
  agentId: varchar("agentId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending_review", "approved", "rejected"]).default("pending_review").notNull(),
  output: json("output").$type<Record<string, unknown>>(),
  artifacts: json("artifacts").$type<Record<string, unknown>[]>(),
  message: text("message"),
  executionTimeMs: int("executionTimeMs"),
  reviewedBy: varchar("reviewedBy", { length: 64 }),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskResult = typeof taskResults.$inferSelect;
export type InsertTaskResult = typeof taskResults.$inferInsert;

// ─── Reputation Scores Table ────────────────────────────────────────────────
export const reputationScores = mysqlTable("reputation_scores", {
  id: int("id").autoincrement().primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull().unique(),
  overallScore: decimal("overallScore", { precision: 5, scale: 4 }).default("0.5000").notNull(),
  successRate: decimal("successRate", { precision: 5, scale: 4 }).default("0.0000").notNull(),
  avgResponseTime: decimal("avgResponseTime", { precision: 10, scale: 2 }).default("0.00").notNull(),
  avgQualityRating: decimal("avgQualityRating", { precision: 5, scale: 4 }).default("0.0000").notNull(),
  uptimeConsistency: decimal("uptimeConsistency", { precision: 5, scale: 4 }).default("0.0000").notNull(),
  totalTasksScored: int("totalTasksScored").default(0).notNull(),
  recentScores: json("recentScores").$type<number[]>(),
  isSuspended: boolean("isSuspended").default(false).notNull(),
  suspensionReason: text("suspensionReason"),
  lastCalculated: timestamp("lastCalculated").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReputationScore = typeof reputationScores.$inferSelect;
export type InsertReputationScore = typeof reputationScores.$inferInsert;

// ─── Economic Transactions Table ────────────────────────────────────────────
export const economicTransactions = mysqlTable("economic_transactions", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: varchar("transactionId", { length: 64 }).notNull().unique(),
  type: mysqlEnum("type", ["task_payment", "task_reward", "escrow_lock", "escrow_release", "escrow_refund", "bonus", "penalty", "deposit", "withdrawal", "transfer", "platform_fee", "fee_discount", "blockchain_settlement"]).notNull(),
  fromAgentId: varchar("fromAgentId", { length: 64 }),
  toAgentId: varchar("toAgentId", { length: 64 }),
  taskId: varchar("taskId", { length: 64 }),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  balanceAfterFrom: decimal("balanceAfterFrom", { precision: 18, scale: 6 }),
  balanceAfterTo: decimal("balanceAfterTo", { precision: 18, scale: 6 }),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  blockchainNetwork: varchar("blockchainNetwork", { length: 32 }),
  blockchainStatus: mysqlEnum("blockchainStatus", ["pending", "confirmed", "failed", "not_applicable"]).default("not_applicable").notNull(),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EconomicTransaction = typeof economicTransactions.$inferSelect;
export type InsertEconomicTransaction = typeof economicTransactions.$inferInsert;

// ─── Agent Capabilities Table ───────────────────────────────────────────────
export const agentCapabilities = mysqlTable("agent_capabilities", {
  id: int("id").autoincrement().primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull(),
  skillId: varchar("skillId", { length: 128 }).notNull(),
  skillName: varchar("skillName", { length: 255 }).notNull(),
  description: text("description"),
  tags: json("tags").$type<string[]>(),
  examples: json("examples").$type<string[]>(),
  proficiencyLevel: mysqlEnum("proficiencyLevel", ["beginner", "intermediate", "advanced", "expert"]).default("intermediate").notNull(),
  isVerified: boolean("isVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentCapability = typeof agentCapabilities.$inferSelect;
export type InsertAgentCapability = typeof agentCapabilities.$inferInsert;

// ─── Audit Log Table ────────────────────────────────────────────────────────
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  actorId: varchar("actorId", { length: 64 }),
  actorType: mysqlEnum("actorType", ["agent", "hub", "admin", "system"]).default("system").notNull(),
  targetId: varchar("targetId", { length: 64 }),
  targetType: varchar("targetType", { length: 64 }),
  action: varchar("action", { length: 255 }).notNull(),
  details: json("details").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  severity: mysqlEnum("severity", ["info", "warning", "error", "critical"]).default("info").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = typeof auditLog.$inferInsert;

// ─── Enrollment Challenges Table ────────────────────────────────────────────
export const enrollmentChallenges = mysqlTable("enrollment_challenges", {
  id: int("id").autoincrement().primaryKey(),
  challengeId: varchar("challengeId", { length: 64 }).notNull().unique(),
  agentName: varchar("agentName", { length: 255 }).notNull(),
  publicKey: text("publicKey").notNull(),
  roles: json("roles").$type<string[]>().notNull(),
  challengeNonce: varchar("challengeNonce", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "verified", "expired", "failed"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  verifiedAt: timestamp("verifiedAt"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EnrollmentChallenge = typeof enrollmentChallenges.$inferSelect;
export type InsertEnrollmentChallenge = typeof enrollmentChallenges.$inferInsert;

// ─── Agent Sessions Table ───────────────────────────────────────────────────
export const agentSessions = mysqlTable("agent_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  agentId: varchar("agentId", { length: 64 }).notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken").notNull(),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt").notNull(),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt").notNull(),
  isRevoked: boolean("isRevoked").default(false).notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: varchar("userAgent", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentSession = typeof agentSessions.$inferSelect;
export type InsertAgentSession = typeof agentSessions.$inferInsert;

// ─── Federation Config Table ────────────────────────────────────────────────
export const federationConfig = mysqlTable("federation_config", {
  id: int("id").autoincrement().primaryKey(),
  configKey: varchar("configKey", { length: 128 }).notNull().unique(),
  configValue: json("configValue").$type<unknown>().notNull(),
  description: text("description"),
  isPublic: boolean("isPublic").default(false).notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FederationConfigEntry = typeof federationConfig.$inferSelect;
export type InsertFederationConfigEntry = typeof federationConfig.$inferInsert;

// ─── A2A Messages Table ─────────────────────────────────────────────────────
export const a2aMessages = mysqlTable("a2a_messages", {
  id: int("id").autoincrement().primaryKey(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  method: varchar("method", { length: 128 }).notNull(),
  fromAgentId: varchar("fromAgentId", { length: 64 }),
  toAgentId: varchar("toAgentId", { length: 64 }),
  taskId: varchar("taskId", { length: 64 }),
  payload: json("payload").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["queued", "delivered", "failed", "expired"]).default("queued").notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  deliveredAt: timestamp("deliveredAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type A2AMessage = typeof a2aMessages.$inferSelect;
export type InsertA2AMessage = typeof a2aMessages.$inferInsert;

// ─── Blockchain Settlements Table ───────────────────────────────────────────
export const blockchainSettlements = mysqlTable("blockchain_settlements", {
  id: int("id").autoincrement().primaryKey(),
  settlementId: varchar("settlementId", { length: 64 }).notNull().unique(),
  transactionId: varchar("transactionId", { length: 64 }).notNull(),
  fromWallet: varchar("fromWallet", { length: 42 }),
  toWallet: varchar("toWallet", { length: 42 }),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  tokenAddress: varchar("tokenAddress", { length: 42 }),
  network: varchar("network", { length: 32 }).default("polygon").notNull(),
  txHash: varchar("txHash", { length: 128 }),
  blockNumber: bigint("blockNumber", { mode: "number" }),
  status: mysqlEnum("status", ["pending", "submitted", "confirmed", "failed"]).default("pending").notNull(),
  gasUsed: decimal("gasUsed", { precision: 18, scale: 0 }),
  errorMessage: text("errorMessage"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BlockchainSettlement = typeof blockchainSettlements.$inferSelect;
export type InsertBlockchainSettlement = typeof blockchainSettlements.$inferInsert;

// ─── Knowledge Packages Table ──────────────────────────────────────────────
export const knowledgePackages = mysqlTable("knowledge_packages", {
  id: int("id").autoincrement().primaryKey(),
  packageId: varchar("packageId", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 512 }).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  authorAgentId: varchar("authorAgentId", { length: 64 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 128 }).notNull(),
  subcategory: varchar("subcategory", { length: 128 }),
  proficiencyLevel: mysqlEnum("proficiencyLevel", ["beginner", "intermediate", "advanced", "expert"]).default("intermediate").notNull(),
  capabilities: json("capabilities").$type<string[]>(),
  prerequisites: json("prerequisites").$type<{ skillId: string; minProficiency: string }[]>(),
  rootHash: varchar("rootHash", { length: 128 }).notNull(),
  signature: text("signature").notNull(),
  fileSize: int("fileSize").notNull(),
  moduleCount: int("moduleCount").notNull(),
  testCount: int("testCount").notNull(),
  storageUrl: text("storageUrl"),
  auditStatus: mysqlEnum("auditStatus", ["pending", "in_review", "approved", "conditional", "rejected"]).default("pending").notNull(),
  auditId: varchar("auditId", { length: 128 }),
  isListed: boolean("isListed").default(false).notNull(),
  listingPrice: decimal("listingPrice", { precision: 18, scale: 6 }),
  totalTrades: int("totalTrades").default(0).notNull(),
  totalSales: int("totalSales").default(0).notNull(),
  avgRating: decimal("avgRating", { precision: 3, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgePackage = typeof knowledgePackages.$inferSelect;
export type InsertKnowledgePackage = typeof knowledgePackages.$inferInsert;

// ─── Knowledge Audit Records Table ─────────────────────────────────────────
export const knowledgeAudits = mysqlTable("knowledge_audits", {
  id: int("id").autoincrement().primaryKey(),
  auditId: varchar("auditId", { length: 128 }).notNull().unique(),
  packageId: varchar("packageId", { length: 128 }).notNull(),
  packageHash: varchar("packageHash", { length: 128 }).notNull(),
  qualityScore: int("qualityScore").notNull(),
  verdict: mysqlEnum("verdict", ["approved", "conditional", "rejected"]).notNull(),
  fairMarketValue: decimal("fairMarketValue", { precision: 18, scale: 6 }).notNull(),
  checks: json("checks").$type<{
    compilability: { score: number; weight: number; details: string };
    originality: { score: number; weight: number; details: string };
    categoryMatch: { score: number; weight: number; details: string };
    securityScan: { score: number; weight: number; details: string };
    completeness: { score: number; weight: number; details: string };
    teachingQuality: { score: number; weight: number; details: string };
  }>().notNull(),
  securityFlags: json("securityFlags").$type<string[]>(),
  platformSignature: text("platformSignature").notNull(),
  reviewNotes: text("reviewNotes"),
  auditDurationMs: int("auditDurationMs"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KnowledgeAudit = typeof knowledgeAudits.$inferSelect;
export type InsertKnowledgeAudit = typeof knowledgeAudits.$inferInsert;

// ─── Barter Transactions Table ─────────────────────────────────────────────
export const barterTransactions = mysqlTable("barter_transactions", {
  id: int("id").autoincrement().primaryKey(),
  barterTxId: varchar("barterTxId", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", [
    "proposed", "countered", "accepted", "fee_locked",
    "escrowed", "exchanging", "verifying", "completed",
    "failed", "cancelled", "disputed", "expired"
  ]).default("proposed").notNull(),
  proposerAgentId: varchar("proposerAgentId", { length: 64 }).notNull(),
  responderAgentId: varchar("responderAgentId", { length: 64 }).notNull(),
  offeredPackageId: varchar("offeredPackageId", { length: 128 }).notNull(),
  requestedPackageId: varchar("requestedPackageId", { length: 128 }),
  counterPackageId: varchar("counterPackageId", { length: 128 }),
  offeredAuditId: varchar("offeredAuditId", { length: 128 }).notNull(),
  requestedAuditId: varchar("requestedAuditId", { length: 128 }),
  offeredFmv: decimal("offeredFmv", { precision: 18, scale: 6 }).notNull(),
  requestedFmv: decimal("requestedFmv", { precision: 18, scale: 6 }),
  fmvDifferencePercent: decimal("fmvDifferencePercent", { precision: 5, scale: 2 }),
  fairnessAcknowledged: boolean("fairnessAcknowledged").default(false).notNull(),
  proposerFeeTon: decimal("proposerFeeTon", { precision: 18, scale: 6 }),
  responderFeeTon: decimal("responderFeeTon", { precision: 18, scale: 6 }),
  totalFeeTon: decimal("totalFeeTon", { precision: 18, scale: 6 }),
  proposerFeeTxHash: varchar("proposerFeeTxHash", { length: 128 }),
  responderFeeTxHash: varchar("responderFeeTxHash", { length: 128 }),
  feeStatus: mysqlEnum("feeStatus", ["pending", "proposer_paid", "both_paid", "refunded"]).default("pending").notNull(),
  escrowKeyShareProposer: text("escrowKeyShareProposer"),
  escrowKeyShareResponder: text("escrowKeyShareResponder"),
  exchangeDeadline: timestamp("exchangeDeadline"),
  proposerVerified: boolean("proposerVerified").default(false).notNull(),
  responderVerified: boolean("responderVerified").default(false).notNull(),
  disputeReason: text("disputeReason"),
  disputeResolution: mysqlEnum("disputeResolution", ["proposer_wins", "responder_wins", "split", "cancelled"]),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BarterTransaction = typeof barterTransactions.$inferSelect;
export type InsertBarterTransaction = typeof barterTransactions.$inferInsert;

// ─── Heartbeat Logs Table ───────────────────────────────────────────────────
export const heartbeatLogs = mysqlTable("heartbeat_logs", {
  id: int("id").autoincrement().primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  latencyMs: int("latencyMs"),
  cpuUsage: decimal("cpuUsage", { precision: 5, scale: 2 }),
  memoryUsage: decimal("memoryUsage", { precision: 5, scale: 2 }),
  diskUsage: decimal("diskUsage", { precision: 5, scale: 2 }),
  activeTaskCount: int("activeTaskCount").default(0),
  agentVersion: varchar("agentVersion", { length: 32 }),
  statusMessage: varchar("statusMessage", { length: 255 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  region: varchar("region", { length: 64 }),
  healthy: boolean("healthy").default(true).notNull(),
});
export type HeartbeatLog = typeof heartbeatLogs.$inferSelect;
export type InsertHeartbeatLog = typeof heartbeatLogs.$inferInsert;
