CREATE TABLE `a2a_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` varchar(64) NOT NULL,
	`method` varchar(128) NOT NULL,
	`fromAgentId` varchar(64),
	`toAgentId` varchar(64),
	`taskId` varchar(64),
	`payload` json,
	`status` enum('queued','delivered','failed','expired') NOT NULL DEFAULT 'queued',
	`retryCount` int NOT NULL DEFAULT 0,
	`deliveredAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `a2a_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `a2a_messages_messageId_unique` UNIQUE(`messageId`)
);
--> statement-breakpoint
CREATE TABLE `agent_capabilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`skillId` varchar(128) NOT NULL,
	`skillName` varchar(255) NOT NULL,
	`description` text,
	`tags` json,
	`examples` json,
	`proficiencyLevel` enum('beginner','intermediate','advanced','expert') NOT NULL DEFAULT 'intermediate',
	`isVerified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_capabilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text NOT NULL,
	`accessTokenExpiresAt` timestamp NOT NULL,
	`refreshTokenExpiresAt` timestamp NOT NULL,
	`isRevoked` boolean NOT NULL DEFAULT false,
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	`ipAddress` varchar(45),
	`userAgent` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`publicKey` text NOT NULL,
	`status` enum('pending','active','suspended','offline') NOT NULL DEFAULT 'pending',
	`roles` json NOT NULL,
	`agentCard` json,
	`webhookUrl` varchar(512),
	`webhookSecret` varchar(256),
	`maxConcurrentTasks` int NOT NULL DEFAULT 3,
	`activeTasks` int NOT NULL DEFAULT 0,
	`lastHeartbeat` timestamp,
	`heartbeatInterval` int NOT NULL DEFAULT 60,
	`ipAddress` varchar(45),
	`hostname` varchar(255),
	`region` varchar(64),
	`version` varchar(32),
	`ownerUserId` int,
	`creditBalance` decimal(18,6) NOT NULL DEFAULT '100.000000',
	`walletAddress` varchar(42),
	`totalTasksCompleted` int NOT NULL DEFAULT 0,
	`totalTasksFailed` int NOT NULL DEFAULT 0,
	`totalCreditsEarned` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`totalCreditsSpent` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_agentId_unique` UNIQUE(`agentId`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`actorId` varchar(64),
	`actorType` enum('agent','hub','admin','system') NOT NULL DEFAULT 'system',
	`targetId` varchar(64),
	`targetType` varchar(64),
	`action` varchar(255) NOT NULL,
	`details` json,
	`ipAddress` varchar(45),
	`severity` enum('info','warning','error','critical') NOT NULL DEFAULT 'info',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_log_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `blockchain_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementId` varchar(64) NOT NULL,
	`transactionId` varchar(64) NOT NULL,
	`fromWallet` varchar(42),
	`toWallet` varchar(42),
	`amount` decimal(18,6) NOT NULL,
	`tokenAddress` varchar(42),
	`network` varchar(32) NOT NULL DEFAULT 'polygon',
	`txHash` varchar(128),
	`blockNumber` bigint,
	`status` enum('pending','submitted','confirmed','failed') NOT NULL DEFAULT 'pending',
	`gasUsed` decimal(18,0),
	`errorMessage` text,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blockchain_settlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `blockchain_settlements_settlementId_unique` UNIQUE(`settlementId`)
);
--> statement-breakpoint
CREATE TABLE `economic_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` varchar(64) NOT NULL,
	`type` enum('task_payment','task_reward','escrow_lock','escrow_release','escrow_refund','bonus','penalty','deposit','withdrawal') NOT NULL,
	`fromAgentId` varchar(64),
	`toAgentId` varchar(64),
	`taskId` varchar(64),
	`amount` decimal(18,6) NOT NULL,
	`balanceAfterFrom` decimal(18,6),
	`balanceAfterTo` decimal(18,6),
	`blockchainTxHash` varchar(128),
	`blockchainNetwork` varchar(32),
	`blockchainStatus` enum('pending','confirmed','failed','not_applicable') NOT NULL DEFAULT 'not_applicable',
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `economic_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `economic_transactions_transactionId_unique` UNIQUE(`transactionId`)
);
--> statement-breakpoint
CREATE TABLE `enrollment_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challengeId` varchar(64) NOT NULL,
	`agentName` varchar(255) NOT NULL,
	`publicKey` text NOT NULL,
	`roles` json NOT NULL,
	`challengeNonce` varchar(128) NOT NULL,
	`status` enum('pending','verified','expired','failed') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`verifiedAt` timestamp,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrollment_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrollment_challenges_challengeId_unique` UNIQUE(`challengeId`)
);
--> statement-breakpoint
CREATE TABLE `federation_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configKey` varchar(128) NOT NULL,
	`configValue` json NOT NULL,
	`description` text,
	`isPublic` boolean NOT NULL DEFAULT false,
	`updatedBy` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `federation_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `federation_config_configKey_unique` UNIQUE(`configKey`)
);
--> statement-breakpoint
CREATE TABLE `reputation_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`overallScore` decimal(5,4) NOT NULL DEFAULT '0.5000',
	`successRate` decimal(5,4) NOT NULL DEFAULT '0.0000',
	`avgResponseTime` decimal(10,2) NOT NULL DEFAULT '0.00',
	`avgQualityRating` decimal(5,4) NOT NULL DEFAULT '0.0000',
	`uptimeConsistency` decimal(5,4) NOT NULL DEFAULT '0.0000',
	`totalTasksScored` int NOT NULL DEFAULT 0,
	`recentScores` json,
	`isSuspended` boolean NOT NULL DEFAULT false,
	`suspensionReason` text,
	`lastCalculated` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reputation_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `reputation_scores_agentId_unique` UNIQUE(`agentId`)
);
--> statement-breakpoint
CREATE TABLE `task_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resultId` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`status` enum('pending_review','approved','rejected') NOT NULL DEFAULT 'pending_review',
	`output` json,
	`artifacts` json,
	`message` text,
	`executionTimeMs` int,
	`reviewedBy` varchar(64),
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_results_resultId_unique` UNIQUE(`resultId`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`a2aTaskId` varchar(128),
	`title` varchar(512) NOT NULL,
	`description` text,
	`type` varchar(128),
	`status` enum('created','assigned','in_progress','completed','failed','cancelled','timeout') NOT NULL DEFAULT 'created',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`requiredRoles` json,
	`requiredSkills` json,
	`requesterId` varchar(64) NOT NULL,
	`assigneeId` varchar(64),
	`inputArtifacts` json,
	`outputArtifacts` json,
	`creditReward` decimal(18,6) NOT NULL DEFAULT '10.000000',
	`creditEscrowed` decimal(18,6) NOT NULL DEFAULT '0.000000',
	`maxDuration` int DEFAULT 3600,
	`retryCount` int NOT NULL DEFAULT 0,
	`maxRetries` int NOT NULL DEFAULT 3,
	`errorMessage` text,
	`qualityRating` int,
	`assignedAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `tasks_taskId_unique` UNIQUE(`taskId`)
);
