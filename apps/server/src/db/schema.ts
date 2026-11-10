import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Single source of truth for the database. Change this file, then run
// `pnpm --filter @playden/server db:generate` to create the migration.

/**
 * pending: waiting for an admin. approved: member. declined: request turned down, may ask
 * again later. banned: no access (a former member, or a blocked request if never approved).
 */
export const userStatuses = ["pending", "approved", "declined", "banned"] as const;
const statusList = sql.raw(userStatuses.map((status) => `'${status}'`).join(", "));

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
    /** Set when ever approved, so a ban can tell a former member from a blocked request. */
    approvedAt: integer("approved_at"),
    /** Last time the request was declined; kept after asking again to flag repeat requests. */
    declinedAt: integer("declined_at"),
  },
  (t) => [
    index("users_status_created").on(t.status, t.createdAt),
    check("users_status_check", sql`${t.status} IN (${statusList})`),
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
