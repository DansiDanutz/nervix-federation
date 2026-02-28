CREATE TABLE `heartbeat_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`latencyMs` int,
	`cpuUsage` decimal(5,2),
	`memoryUsage` decimal(5,2),
	`diskUsage` decimal(5,2),
	`activeTaskCount` int DEFAULT 0,
	`agentVersion` varchar(32),
	`statusMessage` varchar(255),
	`ipAddress` varchar(45),
	`region` varchar(64),
	`healthy` boolean NOT NULL DEFAULT true,
	CONSTRAINT `heartbeat_logs_id` PRIMARY KEY(`id`)
);
