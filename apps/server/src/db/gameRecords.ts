import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "./client";
import {
  type GameStatus,
  type LeaveReason,
  type ParticipantRole,
  type RoomLeaveReason,
  gameParticipants,
  games,
  roomMembers,
  rooms,
} from "./schema";

/** One participant as recorded at Start or at the end of a game. */
export interface ParticipantRecord {
  userId: string;
  role: ParticipantRole;
  team: number | null;
  score: number | null;
  leftEarly: boolean;
  leaveReason: LeaveReason | null;
}

/** One write to the permanent record (D58). Rooms decide which ones a change needs. */
export type RecordWrite =
  | { kind: "roomOpened"; roomId: string; code: string; createdBy: string; at: number }
  | { kind: "roomClosed"; roomId: string; at: number }
  | { kind: "memberJoined"; roomId: string; userId: string; at: number }
  | {
      kind: "memberLeft";
      roomId: string;
      userId: string;
      at: number;
      reason: Exclude<RoomLeaveReason, "room_closed">;
    }
  /** Everyone still listed when the room closes. */
  | { kind: "membersClosed"; roomId: string; at: number }
  | {
      kind: "gameOpened";
      gameId: string;
      roomId: string;
      gameType: string;
      config: unknown;
      /** The host who set it up: both created_by and the first host_id. */
      createdBy: string | null;
      at: number;
    }
  | { kind: "hostChanged"; gameId: string; hostId: string }
  | {
      kind: "gameStarted";
      gameId: string;
      config: unknown;
      at: number;
      participants: ParticipantRecord[];
    }
  | {
      kind: "gameEnded";
      gameId: string;
      status: Extract<GameStatus, "finished" | "ended_early">;
      at: number;
      winningTeam: number | null;
      summary: unknown;
      participants: ParticipantRecord[];
    }
  | { kind: "gameDeactivated"; gameId: string };

/** Inserts or refreshes participants; writing the same game twice is harmless. */
function upsertParticipants(db: Db, gameId: string, participants: ParticipantRecord[]) {
  return db
    .insert(gameParticipants)
    .values(participants.map((p) => ({ gameId, ...p })))
    .onConflictDoUpdate({
      target: [gameParticipants.gameId, gameParticipants.userId],
      set: {
        role: sql`excluded.role`,
        team: sql`excluded.team`,
        score: sql`excluded.score`,
        leftEarly: sql`excluded.left_early`,
        leaveReason: sql`excluded.leave_reason`,
      },
    });
}

export async function writeRecord(db: Db, write: RecordWrite): Promise<void> {
  switch (write.kind) {
    case "roomOpened":
      await db
        .insert(rooms)
        .values({
          id: write.roomId,
          code: write.code,
          createdBy: write.createdBy,
          createdAt: write.at,
        })
        .onConflictDoNothing();
      return;
    case "roomClosed":
      await db.update(rooms).set({ closedAt: write.at }).where(eq(rooms.id, write.roomId));
      return;
    case "memberJoined":
      // A new visit; earlier visits keep their departure. If one is somehow still open, the
      // one-open-visit index refuses a second, and that open visit carries on.
      await db
        .insert(roomMembers)
        .values({ roomId: write.roomId, userId: write.userId, joinedAt: write.at })
        .onConflictDoNothing();
      return;
    case "memberLeft":
      await db
        .update(roomMembers)
        .set({ leftAt: write.at, leaveReason: write.reason })
        .where(
          and(
            eq(roomMembers.roomId, write.roomId),
            eq(roomMembers.userId, write.userId),
            isNull(roomMembers.leftAt),
          ),
        );
      return;
    case "membersClosed":
      await db
        .update(roomMembers)
        .set({ leftAt: write.at, leaveReason: "room_closed" })
        .where(and(eq(roomMembers.roomId, write.roomId), isNull(roomMembers.leftAt)));
      return;
    case "gameOpened":
      await db
        .insert(games)
        .values({
          id: write.gameId,
          roomId: write.roomId,
          gameType: write.gameType,
          status: "setup",
          isActive: true,
          createdBy: write.createdBy,
          hostId: write.createdBy,
          config: write.config,
          createdAt: write.at,
        })
        .onConflictDoNothing();
      return;
    case "hostChanged":
      await db.update(games).set({ hostId: write.hostId }).where(eq(games.id, write.gameId));
      return;
    case "gameStarted": {
      const update = db
        .update(games)
        .set({ status: "playing", startedAt: write.at, config: write.config })
        .where(eq(games.id, write.gameId));
      if (write.participants.length === 0) await update;
      else await db.batch([update, upsertParticipants(db, write.gameId, write.participants)]);
      return;
    }
    case "gameEnded": {
      const update = db
        .update(games)
        .set({
          status: write.status,
          endedAt: write.at,
          winningTeam: write.winningTeam,
          summary: write.summary,
        })
        .where(eq(games.id, write.gameId));
      if (write.participants.length === 0) await update;
      else await db.batch([update, upsertParticipants(db, write.gameId, write.participants)]);
      return;
    }
    case "gameDeactivated":
      await db.update(games).set({ isActive: false }).where(eq(games.id, write.gameId));
      return;
  }
}
