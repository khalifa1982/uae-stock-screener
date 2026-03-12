CREATE TABLE `chat_message_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(128) NOT NULL,
	`emoji` varchar(8) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_message_reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `reaction_unique_idx` UNIQUE(`messageId`,`userId`,`emoji`)
);
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `replyToId` int;--> statement-breakpoint
CREATE INDEX `reaction_message_idx` ON `chat_message_reactions` (`messageId`);