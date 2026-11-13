import { GAME_ID_PATTERN } from "@playden/engine";
import { z } from "zod";
import { roomCodeSchema } from "./roomCode";

/** Longest message a client may send; moves and controls are small. */
export const MAX_MESSAGE_LENGTH = 4096;
/** Longest message the server sends; a game view (e.g. a full drawing) can be large. */
export const MAX_SERVER_MESSAGE_LENGTH = 1_000_000;

const userIdSchema = z.string().min(1).max(64);

export const roomPlayerSchema = z.strictObject({
  id: userIdSchema,
  name: z.string().min(1).max(40),
  connected: z.boolean(),
  isAdmin: z.boolean(),
});

const gameIdSchema = z.string().max(40).regex(GAME_ID_PATTERN);

/**
 * A game session's phase (docs/design/rooms-and-games.md). With no session the room is idle.
 * Setup: people join or spectate until the host starts. Results: the game is over.
 */
export const sessionPhaseSchema = z.enum(["setup", "playing", "results"]);

export const gameResultSchema = z.strictObject({
  scores: z.record(z.string(), z.number()),
  winners: z.array(userIdSchema),
});

/** A player of a session, in join order (their seating and team rotation order). */
export const sessionPlayerSchema = z.strictObject({
  id: userIdSchema,
  name: z.string().min(1).max(40),
  team: z.number().int().min(0).optional(),
  /** Left, was banned or was removed mid-game: the seat is gone but their score stays. */
  left: z.boolean(),
});

/** The room's current game session: who plays, who spectates, and how it ended. */
export const gameSessionSchema = z.strictObject({
  /** 1, 2, 3… within the room; a new one for each setup. */
  id: z.number().int().min(1),
  phase: sessionPhaseSchema,
  gameId: gameIdSchema,
  config: z.unknown(),
  players: z.array(sessionPlayerSchema),
  spectators: z.array(userIdSchema),
  /** Banned from playing in this session; they may still spectate. */
  banned: z.array(userIdSchema),
  /**
   * When play begins (server time): Start sets it a short countdown ahead, so every screen
   * counts 3-2-1 together and moves before it are refused. Null until Start.
   */
  startsAt: z.number().nullable(),
  result: gameResultSchema.nullable(),
  /** The host ended it (or every player left): standings so far, no winner. */
  endedEarly: z.boolean(),
});

export const gameEventSchema = z.strictObject({
  type: z.string().min(1),
  data: z.unknown().optional(),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ping"), t: z.number() }),
  z.strictObject({ type: z.literal("remove"), playerId: userIdSchema }),
  /** Leaving the room on purpose (the Leave button): gone at once, not "away" for a while. */
  z.strictObject({ type: z.literal("leave") }),
  /** Host: open setup for a game, or switch the game in setup; settings reset to its defaults. */
  z.strictObject({ type: z.literal("game.pick"), gameId: gameIdSchema }),
  /** Host, in setup: change settings; the game's own schema checks them on the server. */
  z.strictObject({ type: z.literal("game.setConfig"), config: z.unknown() }),
  /** In setup: become a player (or switch from spectating). */
  z.strictObject({ type: z.literal("game.join") }),
  /** In setup, a player moves to another team (to the end of its rotation order). */
  z.strictObject({ type: z.literal("game.switchTeam"), team: z.number().int().min(0).max(15) }),
  /** Host, in setup: deal every player into even teams at random. */
  z.strictObject({ type: z.literal("game.shuffleTeams") }),
  /** Become a spectator: in setup, or mid-game for anyone not playing. */
  z.strictObject({ type: z.literal("game.spectate") }),
  /** Out of the game, back to just being in the room. Mid-game, a player's seat is freed. */
  z.strictObject({ type: z.literal("game.leave") }),
  z.strictObject({ type: z.literal("game.start") }),
  /** Host: out of this session's game, spectating at most. */
  z.strictObject({ type: z.literal("game.ban"), playerId: userIdSchema }),
  /** Host, mid-game: finish now with the standings so far and no winner. */
  z.strictObject({ type: z.literal("game.end") }),
  /** Host, once a game ends: setup again with the same game, settings, players and spectators. */
  z.strictObject({ type: z.literal("game.playAgain") }),
  /** Host, in setup or results: close the session; the room is idle again. */
  z.strictObject({ type: z.literal("game.returnToRoom") }),
  /** A game move; the game's own schema checks it on the server. */
  z.strictObject({ type: z.literal("move"), move: z.unknown() }),
]);

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("snapshot"),
    room: z.strictObject({
      code: roomCodeSchema,
      hostId: userIdSchema,
      players: z.array(roomPlayerSchema),
    }),
  }),
  z.strictObject({ type: z.literal("pong"), t: z.number(), serverTime: z.number() }),
  z.strictObject({
    type: z.literal("removed"),
    playerId: userIdSchema,
    name: z.string().min(1).max(40),
  }),
  z.strictObject({ type: z.literal("error"), reason: z.string() }),
  /** Sent to a connection just before another device of the same player takes its seat. */
  z.strictObject({ type: z.literal("replaced") }),
  /** The room's game session, or null while the room is idle. */
  z.strictObject({ type: z.literal("game.status"), session: gameSessionSchema.nullable() }),
  /** This viewer's own view of the game (a player's, or the spectator view); never anyone else's. */
  z.strictObject({ type: z.literal("game.view"), view: z.unknown() }),
  z.strictObject({ type: z.literal("game.events"), events: z.array(gameEventSchema) }),
  /**
   * Someone is out of a running game: sent only to those it affects (their teammates, and the
   * host unless the host did it), so others aren't disturbed.
   */
  z.strictObject({
    type: z.literal("game.notice"),
    kind: z.enum(["left", "banned"]),
    playerId: userIdSchema,
    name: z.string().min(1).max(40),
  }),
]);

export type RoomPlayer = z.infer<typeof roomPlayerSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type SessionPhase = z.infer<typeof sessionPhaseSchema>;
export type SessionPlayer = z.infer<typeof sessionPlayerSchema>;
export type GameSession = z.infer<typeof gameSessionSchema>;
export type GameStatus = Extract<ServerMessage, { type: "game.status" }>;
export type GameNotice = Extract<ServerMessage, { type: "game.notice" }>;

export type ParseResult<T> = { ok: true; message: T } | { ok: false; reason: string };

function parseWith<T>(schema: z.ZodType<T>, raw: string, maxLength: number): ParseResult<T> {
  if (raw.length > maxLength) return { ok: false, reason: "Message is too long" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Message is not JSON" };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "Message is not valid" };
  return { ok: true, message: parsed.data };
}

export function parseClientMessage(raw: string): ParseResult<ClientMessage> {
  return parseWith(clientMessageSchema, raw, MAX_MESSAGE_LENGTH);
}

export function parseServerMessage(raw: string): ParseResult<ServerMessage> {
  return parseWith(serverMessageSchema, raw, MAX_SERVER_MESSAGE_LENGTH);
}

/**
 * Close codes a room socket can end with. Browsers can't read the HTTP status of a
 * failed WebSocket, so the server accepts the socket and closes it with one of these.
 */
export const ROOM_CLOSE = {
  signedOut: 4401,
  notAllowed: 4403,
  notFound: 4404,
  /** The same player opened the room on another device or tab, which took the seat (D49). */
  replaced: 4409,
  /** Removed by the host; refused on rejoin until the room closes (D42, D59). */
  removed: 4410,
} as const;
