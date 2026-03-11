CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(128) NOT NULL,
	`userColor` varchar(7) NOT NULL,
	`messageType` enum('text','image','system') NOT NULL DEFAULT 'text',
	`content` text,
	`imageUrl` varchar(512),
	`chatDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chat_date_idx` ON `chat_messages` (`chatDate`);--> statement-breakpoint
CREATE INDEX `chat_user_idx` ON `chat_messages` (`userId`);