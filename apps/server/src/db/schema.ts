import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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

/*
 * The permanent record of rooms and games (D58). Live play stays in each room's own storage;
 * the room writes these rows only when something important happens. No CHECK constraints
 * here (D37): changing one rebuilds the table, which would cascade into game_participants.
 */

/** One row per room ever created. Codes repeat over time, so the id is the key. */
export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
    /** Null while the room is open. */
    closedAt: integer("closed_at"),
  },
  (t) => [index("rooms_code").on(t.code)],
);

/**
 * Why someone is no longer in a room: left (Leave room), removed (by the host, D42/D59),
 * timed_out (away longer than the grace while not holding a seat in a running game), or
 * room_closed (still listed when the room closed).
 */
export const roomLeaveReasons = ["left", "removed", "timed_out", "room_closed"] as const;

/**
 * Who has been in a room: one row per visit. A visit starts on arrival and ends on a final
 * departure; coming back after leaving starts a new visit, so earlier ones keep their reason
 * (as games keep their old rows, D58). Drops and reconnects within the grace aren't visits
 * (D59). At most one open visit per person per room.
 */
export const roomMembers = sqliteTable(
  "room_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at").notNull(),
    /** Null while this visit is going on. */
    leftAt: integer("left_at"),
    leaveReason: text("leave_reason", { enum: roomLeaveReasons }),
  },
  (t) => [
    uniqueIndex("room_members_one_open_visit")
      .on(t.roomId, t.userId)
      .where(sql`${t.leftAt} IS NULL`),
    index("room_members_room").on(t.roomId),
    index("room_members_user").on(t.userId),
  ],
);

/** setup → playing → finished, or ended_early when the host ends it or the room closes mid-game. */
export const gameStatuses = ["setup", "playing", "finished", "ended_early"] as const;

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    /** The game's id, e.g. "sketch-battle". */
    gameType: text("game_type").notNull(),
    status: text("status", { enum: gameStatuses }).notNull(),
    /**
     * The room's current game. A row goes inactive when the host switches game in setup, on
     * Play again or Return to room, and when the room closes.
     */
    isActive: integer("is_active", { mode: "boolean" }).notNull(),
    /** The current host, updated whenever host passes on (D40, D51); can differ from created_by. */
    hostId: text("host_id").references(() => users.id, { onDelete: "set null" }),
    config: text("config", { mode: "json" }),
    createdAt: integer("created_at").notNull(),
    /** Who set the game up (the host at that moment); never changes. */
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: integer("started_at"),
    endedAt: integer("ended_at"),
    /** Null for a draw, an early end, or a game without teams. */
    winningTeam: integer("winning_team"),
    /** The game's own record from its optional `recordSummary(state)`. */
    summary: text("summary", { mode: "json" }),
  },
  (t) => [
    uniqueIndex("games_one_active_per_room")
      .on(t.roomId)
      .where(sql`${t.isActive} = 1`),
    index("games_room").on(t.roomId),
  ],
);

export const participantRoles = ["player", "spectator"] as const;

export const leaveReasons = ["left", "banned"] as const;

/** Who played or watched a game; written at Start and again when the game ends. */
export const gameParticipants = sqliteTable(
  "game_participants",
  {
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: participantRoles }).notNull(),
    team: integer("team"),
    /** Final score; null for spectators and until the game ends. */
    score: integer("score"),
    /** Left, was banned or was removed mid-game. */
    leftEarly: integer("left_early", { mode: "boolean" }).notNull().default(false),
    /**
     * Why they left mid-game: left (Leave game or left the room) or banned (the host banned them
     * from this game; they stay in the room). Removal from the room is recorded in room_members
     * (D59). Null for anyone who stayed, including players who were only away.
     */
    leaveReason: text("leave_reason", { enum: leaveReasons }),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.userId] }), index("participants_user").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type GameStatus = (typeof gameStatuses)[number];
export type ParticipantRole = (typeof participantRoles)[number];
export type LeaveReason = (typeof leaveReasons)[number];
export type RoomLeaveReason = (typeof roomLeaveReasons)[number];
export type UserStatus = User["status"];
export type Session = typeof sessions.$inferSelect;
