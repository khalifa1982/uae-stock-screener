CREATE TABLE `sa_statistics_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`exchange` varchar(10) NOT NULL,
	`data` json,
	`scraped_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sa_statistics_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `sa_stats_symbol_exchange_idx` UNIQUE(`symbol`,`exchange`)
);
