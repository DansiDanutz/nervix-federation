CREATE TYPE "public"."a2a_message_status" AS ENUM('queued', 'delivered', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('agent', 'hub', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('pending', 'active', 'suspended', 'offline');--> statement-breakpoint
CREATE TYPE "public"."audit_status" AS ENUM('pending', 'in_review', 'approved', 'conditional', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."audit_verdict" AS ENUM('approved', 'conditional', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."barter_status" AS ENUM('proposed', 'countered', 'accepted', 'fee_locked', 'escrowed', 'exchanging', 'verifying', 'completed', 'failed', 'cancelled', 'disputed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."blockchain_status" AS ENUM('pending', 'confirmed', 'failed', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."dispute_resolution" AS ENUM('proposer_wins', 'responder_wins', 'split', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('pending', 'verified', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."fee_status" AS ENUM('pending', 'proposer_paid', 'both_paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."proficiency_level" AS ENUM('beginner', 'intermediate', 'advanced', 'expert');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'submitted', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."task_result_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('created', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('task_payment', 'task_reward', 'escrow_lock', 'escrow_release', 'escrow_refund', 'bonus', 'penalty', 'deposit', 'withdrawal', 'transfer', 'platform_fee', 'fee_discount', 'blockchain_settlement');--> statement-breakpoint
CREATE TABLE "a2a_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"messageId" varchar(64) NOT NULL,
	"method" varchar(128) NOT NULL,
	"fromAgentId" varchar(64),
	"toAgentId" varchar(64),
	"taskId" varchar(64),
	"payload" jsonb,
	"status" "a2a_message_status" DEFAULT 'queued' NOT NULL,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"deliveredAt" timestamp,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "a2a_messages_messageId_unique" UNIQUE("messageId")
);
--> statement-breakpoint
CREATE TABLE "agent_capabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"skillId" varchar(128) NOT NULL,
	"skillName" varchar(255) NOT NULL,
	"description" text,
	"tags" jsonb,
	"examples" jsonb,
	"proficiencyLevel" "proficiency_level" DEFAULT 'intermediate' NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(64) NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text NOT NULL,
	"accessTokenExpiresAt" timestamp NOT NULL,
	"refreshTokenExpiresAt" timestamp NOT NULL,
	"isRevoked" boolean DEFAULT false NOT NULL,
	"lastUsedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" varchar(45),
	"userAgent" varchar(512),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_sessions_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"publicKey" text NOT NULL,
	"status" "agent_status" DEFAULT 'pending' NOT NULL,
	"roles" jsonb NOT NULL,
	"agentCard" jsonb,
	"webhookUrl" varchar(512),
	"webhookSecret" varchar(256),
	"maxConcurrentTasks" integer DEFAULT 3 NOT NULL,
	"activeTasks" integer DEFAULT 0 NOT NULL,
	"lastHeartbeat" timestamp,
	"heartbeatInterval" integer DEFAULT 60 NOT NULL,
	"ipAddress" varchar(45),
	"hostname" varchar(255),
	"region" varchar(64),
	"version" varchar(32),
	"ownerUserId" integer,
	"creditBalance" numeric(18, 6) DEFAULT '100.000000' NOT NULL,
	"walletAddress" varchar(128),
	"totalTasksCompleted" integer DEFAULT 0 NOT NULL,
	"totalTasksFailed" integer DEFAULT 0 NOT NULL,
	"totalCreditsEarned" numeric(18, 6) DEFAULT '0.000000' NOT NULL,
	"totalCreditsSpent" numeric(18, 6) DEFAULT '0.000000' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_agentId_unique" UNIQUE("agentId")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" varchar(64) NOT NULL,
	"eventType" varchar(128) NOT NULL,
	"actorId" varchar(64),
	"actorType" "actor_type" DEFAULT 'system' NOT NULL,
	"targetId" varchar(64),
	"targetType" varchar(64),
	"action" varchar(255) NOT NULL,
	"details" jsonb,
	"ipAddress" varchar(45),
	"severity" "severity" DEFAULT 'info' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_eventId_unique" UNIQUE("eventId")
);
--> statement-breakpoint
CREATE TABLE "barter_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"barterTxId" varchar(64) NOT NULL,
	"status" "barter_status" DEFAULT 'proposed' NOT NULL,
	"proposerAgentId" varchar(64) NOT NULL,
	"responderAgentId" varchar(64) NOT NULL,
	"offeredPackageId" varchar(128) NOT NULL,
	"requestedPackageId" varchar(128),
	"counterPackageId" varchar(128),
	"offeredAuditId" varchar(128) NOT NULL,
	"requestedAuditId" varchar(128),
	"offeredFmv" numeric(18, 6) NOT NULL,
	"requestedFmv" numeric(18, 6),
	"fmvDifferencePercent" numeric(5, 2),
	"fairnessAcknowledged" boolean DEFAULT false NOT NULL,
	"proposerFeeTon" numeric(18, 6),
	"responderFeeTon" numeric(18, 6),
	"totalFeeTon" numeric(18, 6),
	"proposerFeeTxHash" varchar(128),
	"responderFeeTxHash" varchar(128),
	"feeStatus" "fee_status" DEFAULT 'pending' NOT NULL,
	"escrowKeyShareProposer" text,
	"escrowKeyShareResponder" text,
	"exchangeDeadline" timestamp,
	"proposerVerified" boolean DEFAULT false NOT NULL,
	"responderVerified" boolean DEFAULT false NOT NULL,
	"disputeReason" text,
	"disputeResolution" "dispute_resolution",
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "barter_transactions_barterTxId_unique" UNIQUE("barterTxId")
);
--> statement-breakpoint
CREATE TABLE "blockchain_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlementId" varchar(64) NOT NULL,
	"transactionId" varchar(64) NOT NULL,
	"fromWallet" varchar(128),
	"toWallet" varchar(128),
	"amount" numeric(18, 6) NOT NULL,
	"tokenAddress" varchar(42),
	"network" varchar(32) DEFAULT 'ton' NOT NULL,
	"txHash" varchar(128),
	"blockNumber" bigint,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"gasUsed" numeric(18, 0),
	"errorMessage" text,
	"confirmedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blockchain_settlements_settlementId_unique" UNIQUE("settlementId")
);
--> statement-breakpoint
CREATE TABLE "economic_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transactionId" varchar(64) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"fromAgentId" varchar(64),
	"toAgentId" varchar(64),
	"taskId" varchar(64),
	"amount" numeric(18, 6) NOT NULL,
	"balanceAfterFrom" numeric(18, 6),
	"balanceAfterTo" numeric(18, 6),
	"blockchainTxHash" varchar(128),
	"blockchainNetwork" varchar(32),
	"blockchainStatus" "blockchain_status" DEFAULT 'not_applicable' NOT NULL,
	"memo" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "economic_transactions_transactionId_unique" UNIQUE("transactionId")
);
--> statement-breakpoint
CREATE TABLE "enrollment_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"challengeId" varchar(64) NOT NULL,
	"agentName" varchar(255) NOT NULL,
	"publicKey" text NOT NULL,
	"roles" jsonb NOT NULL,
	"challengeNonce" varchar(128) NOT NULL,
	"status" "enrollment_status" DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"verifiedAt" timestamp,
	"ipAddress" varchar(45),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_challenges_challengeId_unique" UNIQUE("challengeId")
);
--> statement-breakpoint
CREATE TABLE "federation_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"configKey" varchar(128) NOT NULL,
	"configValue" jsonb NOT NULL,
	"description" text,
	"isPublic" boolean DEFAULT false NOT NULL,
	"updatedBy" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "federation_config_configKey_unique" UNIQUE("configKey")
);
--> statement-breakpoint
CREATE TABLE "heartbeat_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"latencyMs" integer,
	"cpuUsage" numeric(5, 2),
	"memoryUsage" numeric(5, 2),
	"diskUsage" numeric(5, 2),
	"activeTaskCount" integer DEFAULT 0,
	"agentVersion" varchar(32),
	"statusMessage" varchar(255),
	"ipAddress" varchar(45),
	"region" varchar(64),
	"healthy" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"auditId" varchar(128) NOT NULL,
	"packageId" varchar(128) NOT NULL,
	"packageHash" varchar(128) NOT NULL,
	"qualityScore" integer NOT NULL,
	"verdict" "audit_verdict" NOT NULL,
	"fairMarketValue" numeric(18, 6) NOT NULL,
	"checks" jsonb NOT NULL,
	"securityFlags" jsonb,
	"platformSignature" text NOT NULL,
	"reviewNotes" text,
	"auditDurationMs" integer,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_audits_auditId_unique" UNIQUE("auditId")
);
--> statement-breakpoint
CREATE TABLE "knowledge_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"packageId" varchar(128) NOT NULL,
	"name" varchar(255) NOT NULL,
	"displayName" varchar(512) NOT NULL,
	"version" varchar(32) NOT NULL,
	"authorAgentId" varchar(64) NOT NULL,
	"description" text,
	"category" varchar(128) NOT NULL,
	"subcategory" varchar(128),
	"proficiencyLevel" "proficiency_level" DEFAULT 'intermediate' NOT NULL,
	"capabilities" jsonb,
	"prerequisites" jsonb,
	"rootHash" varchar(128) NOT NULL,
	"signature" text NOT NULL,
	"fileSize" integer NOT NULL,
	"moduleCount" integer NOT NULL,
	"testCount" integer NOT NULL,
	"storageUrl" text,
	"auditStatus" "audit_status" DEFAULT 'pending' NOT NULL,
	"auditId" varchar(128),
	"isListed" boolean DEFAULT false NOT NULL,
	"listingPrice" numeric(18, 6),
	"totalTrades" integer DEFAULT 0 NOT NULL,
	"totalSales" integer DEFAULT 0 NOT NULL,
	"avgRating" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_packages_packageId_unique" UNIQUE("packageId")
);
--> statement-breakpoint
CREATE TABLE "reputation_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"overallScore" numeric(5, 4) DEFAULT '0.5000' NOT NULL,
	"successRate" numeric(5, 4) DEFAULT '0.0000' NOT NULL,
	"avgResponseTime" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"avgQualityRating" numeric(5, 4) DEFAULT '0.0000' NOT NULL,
	"uptimeConsistency" numeric(5, 4) DEFAULT '0.0000' NOT NULL,
	"totalTasksScored" integer DEFAULT 0 NOT NULL,
	"recentScores" jsonb,
	"isSuspended" boolean DEFAULT false NOT NULL,
	"suspensionReason" text,
	"lastCalculated" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reputation_scores_agentId_unique" UNIQUE("agentId")
);
--> statement-breakpoint
CREATE TABLE "task_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"resultId" varchar(64) NOT NULL,
	"taskId" varchar(64) NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"status" "task_result_status" DEFAULT 'pending_review' NOT NULL,
	"output" jsonb,
	"artifacts" jsonb,
	"message" text,
	"executionTimeMs" integer,
	"reviewedBy" varchar(64),
	"reviewNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_results_resultId_unique" UNIQUE("resultId")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"taskId" varchar(64) NOT NULL,
	"a2aTaskId" varchar(128),
	"title" varchar(512) NOT NULL,
	"description" text,
	"type" varchar(128),
	"status" "task_status" DEFAULT 'created' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"requiredRoles" jsonb,
	"requiredSkills" jsonb,
	"requesterId" varchar(64) NOT NULL,
	"assigneeId" varchar(64),
	"inputArtifacts" jsonb,
	"outputArtifacts" jsonb,
	"creditReward" numeric(18, 6) DEFAULT '10.000000' NOT NULL,
	"creditEscrowed" numeric(18, 6) DEFAULT '0.000000' NOT NULL,
	"maxDuration" integer DEFAULT 3600,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"maxRetries" integer DEFAULT 3 NOT NULL,
	"errorMessage" text,
	"qualityRating" integer,
	"assignedAt" timestamp,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_taskId_unique" UNIQUE("taskId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"walletAddress" varchar(128),
	"tonPublicKey" varchar(128),
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
