CREATE TABLE `site_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`statKey` varchar(64) NOT NULL,
	`statValue` bigint NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_stats_statKey_unique` UNIQUE(`statKey`)
);
--> statement-breakpoint
CREATE TABLE `visitor_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorHash` varchar(64) NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`country` varchar(64),
	`visitDate` varchar(10) NOT NULL,
	`pageViews` int NOT NULL DEFAULT 1,
	`firstVisit` timestamp NOT NULL DEFAULT (now()),
	`lastVisit` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitor_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_date_idx` UNIQUE(`visitorHash`,`visitDate`)
);
--> statement-breakpoint
CREATE INDEX `visit_date_idx` ON `visitor_log` (`visitDate`);