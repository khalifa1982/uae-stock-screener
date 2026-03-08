CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(32) NOT NULL DEFAULT 'volume_spike',
	`title` varchar(256) NOT NULL,
	`message` text NOT NULL,
	`symbol` varchar(32),
	`exchange` varchar(8),
	`notif_severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`isRead` int NOT NULL DEFAULT 0,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_notif_idx` ON `notifications` (`userId`,`isRead`);--> statement-breakpoint
CREATE INDEX `notif_created_idx` ON `notifications` (`createdAt`);