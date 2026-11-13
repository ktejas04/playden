CREATE TABLE `room_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	`leave_reason` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_members_one_open_visit` ON `room_members` (`room_id`,`user_id`) WHERE "room_members"."left_at" IS NULL;--> statement-breakpoint
CREATE INDEX `room_members_room` ON `room_members` (`room_id`);--> statement-breakpoint
CREATE INDEX `room_members_user` ON `room_members` (`user_id`);