CREATE TABLE `market_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`exchange` varchar(8) NOT NULL,
	`language` varchar(2) NOT NULL,
	`indexValue` float,
	`indexChange` float,
	`indexChangePercent` float,
	`totalVolume` bigint,
	`totalValue` bigint,
	`totalTrades` int,
	`advancers` int,
	`decliners` int,
	`unchanged` int,
	`topGainers` text,
	`topLosers` text,
	`mostActive` text,
	`sectorPerformance` text,
	`narrative` text,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `date_exchange_lang_idx` UNIQUE(`date`,`exchange`,`language`)
);
--> statement-breakpoint
CREATE INDEX `date_idx` ON `market_summaries` (`date`);