CREATE TABLE `monitor_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`volumeThreshold` float NOT NULL DEFAULT 2,
	`minVolumeAbsolute` bigint NOT NULL DEFAULT 100000,
	`notifyOnSpike` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitor_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitor_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `screener_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`filters` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `screener_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `volume_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`exchange` varchar(8) NOT NULL,
	`stockName` varchar(128),
	`sector` varchar(64),
	`currentVolume` bigint NOT NULL,
	`avgVolume` bigint NOT NULL,
	`volumeMultiplier` float NOT NULL,
	`price` float,
	`changePercent` float,
	`alertType` varchar(32) NOT NULL DEFAULT 'volume_spike',
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`notified` int NOT NULL DEFAULT 0,
	`dismissed` int NOT NULL DEFAULT 0,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `volume_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_presets_idx` ON `screener_presets` (`userId`);--> statement-breakpoint
CREATE INDEX `symbol_detected_idx` ON `volume_alerts` (`symbol`,`detectedAt`);--> statement-breakpoint
CREATE INDEX `detected_at_idx` ON `volume_alerts` (`detectedAt`);