import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  jsonb,
  boolean,
  numeric,
  bigint,
  serial,
} from "drizzle-orm/pg-core";

// ─── Enum Definitions ──────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["user", "admin"]);

export const agentStatusEnum = pgEnum("agent_status", ["pending", "active", "suspended", "offline"]);

export const taskStatusEnum = pgEnum("task_status", ["created", "assigned", "in_progress", "completed", "failed", "cancelled", "timeout"]);

export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "critical"]);

export const taskResultStatusEnum = pgEnum("task_result_status", ["pending_review", "approved", "rejected"]);

export const transactionTypeEnum = pgEnum("transaction_type", ["task_payment", "task_reward", "escrow_lock", "escrow_release", "escrow_refund", "bonus", "penalty", "deposit", "withdrawal", "transfer", "platform_fee", "fee_discount", "blockchain_settlement"]);

export const blockchainStatusEnum = pgEnum("blockchain_status", ["pending", "confirmed", "failed", "not_applicable"]);

export const proficiencyLevelEnum = pgEnum("proficiency_level", ["beginner", "intermediate", "advanced", "expert"]);

export const actorTypeEnum = pgEnum("actor_type", ["agent", "hub", "admin", "system"]);

export const severityEnum = pgEnum("severity", ["info", "warning", "error", "critical"]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", ["pending", "verified", "expired", "failed"]);

export const a2aMessageStatusEnum = pgEnum("a2a_message_status", ["queued", "delivered", "failed", "expired"]);

export const settlementStatusEnum = pgEnum("settlement_status", ["pending", "submitted", "confirmed", "failed"]);

export const auditStatusEnum = pgEnum("audit_status", ["pending", "in_review", "approved", "conditional", "rejected"]);

export const auditVerdictEnum = pgEnum("audit_verdict", ["approved", "conditional", "rejected"]);

export const barterStatusEnum = pgEnum("barter_status", [
  "proposed", "countered", "accepted", "fee_locked",
  "escrowed", "exchanging", "verifying", "completed",
  "failed", "cancelled", "disputed", "expired"
]);

export const feeStatusEnum = pgEnum("fee_status", ["pending", "proposer_paid", "both_paid", "refunded"]);

export const disputeResolutionEnum = pgEnum("dispute_resolution", ["proposer_wins", "responder_wins", "split", "cancelled"]);

// ─── Core User Table (Manus Auth) ───────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  walletAddress: varchar("walletAddress", { length: 128 }),
  tonPublicKey: varchar("tonPublicKey", { length: 128 }),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Agents Table ───────────────────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  publicKey: text("publicKey").notNull(),
  status: agentStatusEnum("status").default("pending").notNull(),
  roles: jsonb("roles").$type<string[]>().notNull(),
  agentCard: jsonb("agentCard").$type<Record<string, unknown>>(),
  webhookUrl: varchar("webhookUrl", { length: 512 }),
  webhookSecret: varchar("webhookSecret", { length: 256 }),
  maxConcurrentTasks: integer("maxConcurrentTasks").default(3).notNull(),
  activeTasks: integer("activeTasks").default(0).notNull(),
  lastHeartbeat: timestamp("lastHeartbeat"),
  heartbeatInterval: integer("heartbeatInterval").default(60).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  hostname: varchar("hostname", { length: 255 }),
  region: varchar("region", { length: 64 }),
  version: varchar("version", { length: 32 }),
  ownerUserId: integer("ownerUserId"),
  creditBalance: numeric("creditBalance", { precision: 18, scale: 6 }).default("100.000000").notNull(),
  walletAddress: varchar("walletAddress", { length: 128 }),
  totalTasksCompleted: integer("totalTasksCompleted").default(0).notNull(),
  totalTasksFailed: integer("totalTasksFailed").default(0).notNull(),
  totalCreditsEarned: numeric("totalCreditsEarned", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  totalCreditsSpent: numeric("totalCreditsSpent", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

// ─── Tasks Table ────────────────────────────────────────────────────────────
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull().unique(),
  a2aTaskId: varchar("a2aTaskId", { length: 128 }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 128 }),
  status: taskStatusEnum("status").default("created").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  requiredRoles: jsonb("requiredRoles").$type<string[]>(),
  requiredSkills: jsonb("requiredSkills").$type<string[]>(),
  requesterId: varchar("requesterId", { length: 64 }).notNull(),
  assigneeId: varchar("assigneeId", { length: 64 }),
  inputArtifacts: jsonb("inputArtifacts").$type<Record<string, unknown>[]>(),
  outputArtifacts: jsonb("outputArtifacts").$type<Record<string, unknown>[]>(),
  creditReward: numeric("creditReward", { precision: 18, scale: 6 }).default("10.000000").notNull(),
  creditEscrowed: numeric("creditEscrowed", { precision: 18, scale: 6 }).default("0.000000").notNull(),
  maxDuration: integer("maxDuration").default(3600),
  retryCount: integer("retryCount").default(0).notNull(),
  maxRetries: integer("maxRetries").default(3).notNull(),
  errorMessage: text("errorMessage"),
  qualityRating: integer("qualityRating"),
  assignedAt: timestamp("assignedAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Task Results Table ─────────────────────────────────────────────────────
export const taskResults = pgTable("task_results", {
  id: serial("id").primaryKey(),
  resultId: varchar("resultId", { length: 64 }).notNull().unique(),
  taskId: varchar("taskId", { length: 64 }).notNull(),
  agentId: varchar("agentId", { length: 64 }).notNull(),
  status: taskResultStatusEnum("status").default("pending_review").notNull(),
  output: jsonb("output").$type<Record<string, unknown>>(),
  artifacts: jsonb("artifacts").$type<Record<string, unknown>[]>(),
  message: text("message"),
  executionTimeMs: integer("executionTimeMs"),
  reviewedBy: varchar("reviewedBy", { length: 64 }),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskResult = typeof taskResults.$inferSelect;
export type InsertTaskResult = typeof taskResults.$inferInsert;

// ─── Reputation Scores Table ────────────────────────────────────────────────
export const reputationScores = pgTable("reputation_scores", {
  id: serial("id").primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull().unique(),
  overallScore: numeric("overallScore", { precision: 5, scale: 4 }).default("0.5000").notNull(),
  successRate: numeric("successRate", { precision: 5, scale: 4 }).default("0.0000").notNull(),
  avgResponseTime: numeric("avgResponseTime", { precision: 10, scale: 2 }).default("0.00").notNull(),
  avgQualityRating: numeric("avgQualityRating", { precision: 5, scale: 4 }).default("0.0000").notNull(),
  uptimeConsistency: numeric("uptimeConsistency", { precision: 5, scale: 4 }).default("0.0000").notNull(),
  totalTasksScored: integer("totalTasksScored").default(0).notNull(),
  recentScores: jsonb("recentScores").$type<number[]>(),
  isSuspended: boolean("isSuspended").default(false).notNull(),
  suspensionReason: text("suspensionReason"),
  lastCalculated: timestamp("lastCalculated").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ReputationScore = typeof reputationScores.$inferSelect;
export type InsertReputationScore = typeof reputationScores.$inferInsert;

// ─── Economic Transactions Table ────────────────────────────────────────────
export const economicTransactions = pgTable("economic_transactions", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transactionId", { length: 64 }).notNull().unique(),
  type: transactionTypeEnum("type").notNull(),
  fromAgentId: varchar("fromAgentId", { length: 64 }),
  toAgentId: varchar("toAgentId", { length: 64 }),
  taskId: varchar("taskId", { length: 64 }),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  balanceAfterFrom: numeric("balanceAfterFrom", { precision: 18, scale: 6 }),
  balanceAfterTo: numeric("balanceAfterTo", { precision: 18, scale: 6 }),
  blockchainTxHash: varchar("blockchainTxHash", { length: 128 }),
  blockchainNetwork: varchar("blockchainNetwork", { length: 32 }),
  blockchainStatus: blockchainStatusEnum("blockchainStatus").default("not_applicable").notNull(),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EconomicTransaction = typeof economicTransactions.$inferSelect;
export type InsertEconomicTransaction = typeof economicTransactions.$inferInsert;

// ─── Agent Capabilities Table ───────────────────────────────────────────────
export const agentCapabilities = pgTable("agent_capabilities", {
  id: serial("id").primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull(),
  skillId: varchar("skillId", { length: 128 }).notNull(),
  skillName: varchar("skillName", { length: 255 }).notNull(),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>(),
  examples: jsonb("examples").$type<string[]>(),
  proficiencyLevel: proficiencyLevelEnum("proficiencyLevel").default("intermediate").notNull(),
  isVerified: boolean("isVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AgentCapability = typeof agentCapabilities.$inferSelect;
export type InsertAgentCapability = typeof agentCapabilities.$inferInsert;

// ─── Audit Log Table ────────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  actorId: varchar("actorId", { length: 64 }),
  actorType: actorTypeEnum("actorType").default("system").notNull(),
  targetId: varchar("targetId", { length: 64 }),
  targetType: varchar("targetType", { length: 64 }),
  action: varchar("action", { length: 255 }).notNull(),
  details: jsonb("details").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  severity: severityEnum("severity").default("info").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = typeof auditLog.$inferInsert;

// ─── Enrollment Challenges Table ────────────────────────────────────────────
export const enrollmentChallenges = pgTable("enrollment_challenges", {
  id: serial("id").primaryKey(),
  challengeId: varchar("challengeId", { length: 64 }).notNull().unique(),
  agentName: varchar("agentName", { length: 255 }).notNull(),
  publicKey: text("publicKey").notNull(),
  roles: jsonb("roles").$type<string[]>().notNull(),
  challengeNonce: varchar("challengeNonce", { length: 128 }).notNull(),
  status: enrollmentStatusEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  verifiedAt: timestamp("verifiedAt"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EnrollmentChallenge = typeof enrollmentChallenges.$inferSelect;
export type InsertEnrollmentChallenge = typeof enrollmentChallenges.$inferInsert;

// ─── Agent Sessions Table ───────────────────────────────────────────────────
export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
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
export const federationConfig = pgTable("federation_config", {
  id: serial("id").primaryKey(),
  configKey: varchar("configKey", { length: 128 }).notNull().unique(),
  configValue: jsonb("configValue").$type<unknown>().notNull(),
  description: text("description"),
  isPublic: boolean("isPublic").default(false).notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type FederationConfigEntry = typeof federationConfig.$inferSelect;
export type InsertFederationConfigEntry = typeof federationConfig.$inferInsert;

// ─── A2A Messages Table ─────────────────────────────────────────────────────
export const a2aMessages = pgTable("a2a_messages", {
  id: serial("id").primaryKey(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  method: varchar("method", { length: 128 }).notNull(),
  fromAgentId: varchar("fromAgentId", { length: 64 }),
  toAgentId: varchar("toAgentId", { length: 64 }),
  taskId: varchar("taskId", { length: 64 }),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  status: a2aMessageStatusEnum("status").default("queued").notNull(),
  retryCount: integer("retryCount").default(0).notNull(),
  deliveredAt: timestamp("deliveredAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type A2AMessage = typeof a2aMessages.$inferSelect;
export type InsertA2AMessage = typeof a2aMessages.$inferInsert;

// ─── Blockchain Settlements Table ───────────────────────────────────────────
export const blockchainSettlements = pgTable("blockchain_settlements", {
  id: serial("id").primaryKey(),
  settlementId: varchar("settlementId", { length: 64 }).notNull().unique(),
  transactionId: varchar("transactionId", { length: 64 }).notNull(),
  fromWallet: varchar("fromWallet", { length: 128 }),
  toWallet: varchar("toWallet", { length: 128 }),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  tokenAddress: varchar("tokenAddress", { length: 42 }),
  network: varchar("network", { length: 32 }).default("ton").notNull(),
  txHash: varchar("txHash", { length: 128 }),
  blockNumber: bigint("blockNumber", { mode: "number" }),
  status: settlementStatusEnum("status").default("pending").notNull(),
  gasUsed: numeric("gasUsed", { precision: 18, scale: 0 }),
  errorMessage: text("errorMessage"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BlockchainSettlement = typeof blockchainSettlements.$inferSelect;
export type InsertBlockchainSettlement = typeof blockchainSettlements.$inferInsert;

// ─── Knowledge Packages Table ──────────────────────────────────────────────
export const knowledgePackages = pgTable("knowledge_packages", {
  id: serial("id").primaryKey(),
  packageId: varchar("packageId", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 512 }).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  authorAgentId: varchar("authorAgentId", { length: 64 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 128 }).notNull(),
  subcategory: varchar("subcategory", { length: 128 }),
  proficiencyLevel: proficiencyLevelEnum("proficiencyLevel").default("intermediate").notNull(),
  capabilities: jsonb("capabilities").$type<string[]>(),
  prerequisites: jsonb("prerequisites").$type<{ skillId: string; minProficiency: string }[]>(),
  rootHash: varchar("rootHash", { length: 128 }).notNull(),
  signature: text("signature").notNull(),
  fileSize: integer("fileSize").notNull(),
  moduleCount: integer("moduleCount").notNull(),
  testCount: integer("testCount").notNull(),
  storageUrl: text("storageUrl"),
  auditStatus: auditStatusEnum("auditStatus").default("pending").notNull(),
  auditId: varchar("auditId", { length: 128 }),
  isListed: boolean("isListed").default(false).notNull(),
  listingPrice: numeric("listingPrice", { precision: 18, scale: 6 }),
  totalTrades: integer("totalTrades").default(0).notNull(),
  totalSales: integer("totalSales").default(0).notNull(),
  avgRating: numeric("avgRating", { precision: 3, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type KnowledgePackage = typeof knowledgePackages.$inferSelect;
export type InsertKnowledgePackage = typeof knowledgePackages.$inferInsert;

// ─── Knowledge Audit Records Table ─────────────────────────────────────────
export const knowledgeAudits = pgTable("knowledge_audits", {
  id: serial("id").primaryKey(),
  auditId: varchar("auditId", { length: 128 }).notNull().unique(),
  packageId: varchar("packageId", { length: 128 }).notNull(),
  packageHash: varchar("packageHash", { length: 128 }).notNull(),
  qualityScore: integer("qualityScore").notNull(),
  verdict: auditVerdictEnum("verdict").notNull(),
  fairMarketValue: numeric("fairMarketValue", { precision: 18, scale: 6 }).notNull(),
  checks: jsonb("checks").$type<{
    compilability: { score: number; weight: number; details: string };
    originality: { score: number; weight: number; details: string };
    categoryMatch: { score: number; weight: number; details: string };
    securityScan: { score: number; weight: number; details: string };
    completeness: { score: number; weight: number; details: string };
    teachingQuality: { score: number; weight: number; details: string };
  }>().notNull(),
  securityFlags: jsonb("securityFlags").$type<string[]>(),
  platformSignature: text("platformSignature").notNull(),
  reviewNotes: text("reviewNotes"),
  auditDurationMs: integer("auditDurationMs"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KnowledgeAudit = typeof knowledgeAudits.$inferSelect;
export type InsertKnowledgeAudit = typeof knowledgeAudits.$inferInsert;

// ─── Barter Transactions Table ─────────────────────────────────────────────
export const barterTransactions = pgTable("barter_transactions", {
  id: serial("id").primaryKey(),
  barterTxId: varchar("barterTxId", { length: 64 }).notNull().unique(),
  status: barterStatusEnum("status").default("proposed").notNull(),
  proposerAgentId: varchar("proposerAgentId", { length: 64 }).notNull(),
  responderAgentId: varchar("responderAgentId", { length: 64 }).notNull(),
  offeredPackageId: varchar("offeredPackageId", { length: 128 }).notNull(),
  requestedPackageId: varchar("requestedPackageId", { length: 128 }),
  counterPackageId: varchar("counterPackageId", { length: 128 }),
  offeredAuditId: varchar("offeredAuditId", { length: 128 }).notNull(),
  requestedAuditId: varchar("requestedAuditId", { length: 128 }),
  offeredFmv: numeric("offeredFmv", { precision: 18, scale: 6 }).notNull(),
  requestedFmv: numeric("requestedFmv", { precision: 18, scale: 6 }),
  fmvDifferencePercent: numeric("fmvDifferencePercent", { precision: 5, scale: 2 }),
  fairnessAcknowledged: boolean("fairnessAcknowledged").default(false).notNull(),
  proposerFeeTon: numeric("proposerFeeTon", { precision: 18, scale: 6 }),
  responderFeeTon: numeric("responderFeeTon", { precision: 18, scale: 6 }),
  totalFeeTon: numeric("totalFeeTon", { precision: 18, scale: 6 }),
  proposerFeeTxHash: varchar("proposerFeeTxHash", { length: 128 }),
  responderFeeTxHash: varchar("responderFeeTxHash", { length: 128 }),
  feeStatus: feeStatusEnum("feeStatus").default("pending").notNull(),
  escrowKeyShareProposer: text("escrowKeyShareProposer"),
  escrowKeyShareResponder: text("escrowKeyShareResponder"),
  exchangeDeadline: timestamp("exchangeDeadline"),
  proposerVerified: boolean("proposerVerified").default(false).notNull(),
  responderVerified: boolean("responderVerified").default(false).notNull(),
  disputeReason: text("disputeReason"),
  disputeResolution: disputeResolutionEnum("disputeResolution"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BarterTransaction = typeof barterTransactions.$inferSelect;
export type InsertBarterTransaction = typeof barterTransactions.$inferInsert;

// ─── Heartbeat Logs Table ───────────────────────────────────────────────────
export const heartbeatLogs = pgTable("heartbeat_logs", {
  id: serial("id").primaryKey(),
  agentId: varchar("agentId", { length: 64 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  latencyMs: integer("latencyMs"),
  cpuUsage: numeric("cpuUsage", { precision: 5, scale: 2 }),
  memoryUsage: numeric("memoryUsage", { precision: 5, scale: 2 }),
  diskUsage: numeric("diskUsage", { precision: 5, scale: 2 }),
  activeTaskCount: integer("activeTaskCount").default(0),
  agentVersion: varchar("agentVersion", { length: 32 }),
  statusMessage: varchar("statusMessage", { length: 255 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  region: varchar("region", { length: 64 }),
  healthy: boolean("healthy").default(true).notNull(),
});
export type HeartbeatLog = typeof heartbeatLogs.$inferSelect;
export type InsertHeartbeatLog = typeof heartbeatLogs.$inferInsert;
