CREATE TABLE `abboud_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`exchange` varchar(8) NOT NULL,
	`abboud_alert_type` enum('entry_zone','stop_loss','target_1','target_2','target_3','fib_bounce') NOT NULL,
	`price` float NOT NULL,
	`triggerLevel` float NOT NULL,
	`abboud_direction` enum('bullish','bearish') NOT NULL DEFAULT 'bullish',
	`message` text NOT NULL,
	`abboud_severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `abboud_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `abboud_symbol_idx` ON `abboud_alerts` (`symbol`,`detectedAt`);--> statement-breakpoint
CREATE INDEX `abboud_detected_idx` ON `abboud_alerts` (`detectedAt`);