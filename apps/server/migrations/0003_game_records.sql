CREATE TABLE `game_participants` (
	`game_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`team` integer,
	`score` integer,
	`left_early` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`game_id`, `user_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `participants_user` ON `game_participants` (`user_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`game_type` text NOT NULL,
	`status` text NOT NULL,
	`is_active` integer NOT NULL,
	`host_id` text,
	`config` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`winning_team` integer,
	`summary` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_one_active_per_room` ON `games` (`room_id`) WHERE "games"."is_active" = 1;--> statement-breakpoint
CREATE INDEX `games_room` ON `games` (`room_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rooms_code` ON `rooms` (`code`);