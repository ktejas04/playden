PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`invited_by` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`approved_at` integer,
	`declined_at` integer,
	CONSTRAINT "users_status_check" CHECK("__new_users"."status" IN ('pending', 'approved', 'declined', 'banned'))
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "google_sub", "email", "display_name", "invited_by", "status", "created_at", "approved_at", "declined_at") SELECT "id", "google_sub", "email", "display_name", "invited_by", "status", "created_at", "approved_at", "declined_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);--> statement-breakpoint
CREATE INDEX `users_status_created` ON `users` (`status`,`created_at`);