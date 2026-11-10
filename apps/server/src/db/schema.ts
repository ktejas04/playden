import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Single source of truth for the database. Change this file, then run
// `pnpm --filter @playden/server db:generate` to create the migration.

export const userStatuses = ["pending", "approved", "banned"] as const;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    googleSub: text("google_sub").notNull().unique(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    invitedBy: text("invited_by"),
    status: text("status", { enum: userStatuses }).notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
    approvedAt: integer("approved_at"),
  },
  (t) => [
    index("users_status_created").on(t.status, t.createdAt),
    check("users_status_check", sql`${t.status} IN ('pending', 'approved', 'banned')`),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type UserStatus = User["status"];
export type Session = typeof sessions.$inferSelect;
