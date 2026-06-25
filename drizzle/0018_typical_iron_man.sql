CREATE TABLE `market_news` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(255) NOT NULL,
	`title` text NOT NULL,
	`provider` varchar(128),
	`source` varchar(128),
	`sourceLogoId` varchar(128),
	`publishedAt` timestamp NOT NULL,
	`urgency` int DEFAULT 0,
	`storyPath` varchar(512),
	`relatedSymbols` json,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_news_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_external_id_idx` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE INDEX `news_published_idx` ON `market_news` (`publishedAt`);