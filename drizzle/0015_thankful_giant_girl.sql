CREATE TABLE `page_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pagePath` varchar(255) NOT NULL,
	`symbol` varchar(32),
	`visitorHash` varchar(64),
	`viewDate` varchar(10) NOT NULL,
	`viewCount` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `page_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `page_visitor_date_idx` UNIQUE(`pagePath`,`visitorHash`,`viewDate`)
);
--> statement-breakpoint
ALTER TABLE `visitor_log` ADD `city` varchar(128);--> statement-breakpoint
ALTER TABLE `visitor_log` ADD `region` varchar(128);--> statement-breakpoint
ALTER TABLE `visitor_log` ADD `countryCode` varchar(4);--> statement-breakpoint
CREATE INDEX `page_date_idx` ON `page_views` (`viewDate`);--> statement-breakpoint
CREATE INDEX `symbol_idx` ON `page_views` (`symbol`);