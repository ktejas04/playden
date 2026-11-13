import type { z } from "zod";

/** Lowercase words joined by hyphens, e.g. "sketch-battle". Never changes once a game ships. */
export const GAME_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** A player in the game, with their team index (0-based) when the game has teams. */
export interface Seat {
  id: string;
  name: string;
  team?: number;
}

/** Something that happened, for animations and the game log. Must be plain JSON. */
export interface GameEvent {
  type: string;
  data?: unknown;
}

export interface GameResult {
  /** Final score per player id. */
  scores: Record<string, number>;
  /** Winning player ids; empty means a draw. */
  winners: string[];
}

export type Ok = { ok: true };
export type Rejection = { ok: false; reason: string };
export type Validation = Ok | Rejection;

export interface Transition<State> {
  state: State;
  events: GameEvent[];
  /**
   * A live change (D55), for moves that arrive many times a second (strokes, wrong guesses):
   * the room keeps it in memory, sends deltas, and saves it with the next ordinary change.
   * A live change must never change `nextDeadline` (the contract kit checks it).
   */
  live?: true;
}

/** Game moves one connection may send: a burst, then this many a second (D54, D55). */
export interface MoveLimit {
  perSecond: number;
  burst: number;
}

/**
 * How many teams and how big each may be. Uneven teams are the players' call: joining picks
 * the smaller team and Shuffle deals even teams, but Start checks only these sizes.
 */
export interface TeamRules {
  count: number;
  minSize: number;
  maxSize: number;
}

/**
 * Everything the platform knows about a game. All functions are pure and deterministic:
 * time (`now`, server milliseconds) and randomness (`seed`) come in as arguments, state and
 * views are plain JSON, and nothing is changed in place. The room never knows the rules.
 */
export interface GameDefinition<State, Move, View, Config, Delta = unknown> {
  id: string;
  name: string;
  /** One line for the game picker. */
  summary: string;
  minPlayers: number;
  maxPlayers: number;
  teams?: TeamRules;
  /** Shown only on local dev servers (test-player sign-in on). */
  devOnly?: boolean;
  /** Replaces the platform's per-connection move limit (D54) for this game. */
  moveLimit?: MoveLimit;

  defaultConfig: Config;
  configSchema: z.ZodType<Config>;
  /** The room parses every incoming move with this before calling `validate`. */
  moveSchema: z.ZodType<Move>;

  setup(seats: Seat[], config: Config, seed: number, now: number): State;
  validate(state: State, playerId: string, move: Move, now: number): Validation;
  apply(state: State, playerId: string, move: Move, now: number): Transition<State>;
  /** What one player may see. Hidden information never goes into another player's view. */
  view(state: State, playerId: string | "spectator"): View;
  /**
   * What changed for one viewer between two states, or null when nothing did (D55). With it,
   * the room sends deltas after every change and the full view only on join and resync.
   * Same rules as `view`: hidden information never goes in. Needs `applyDelta`.
   */
  delta?(before: State, after: State, viewer: string | "spectator"): Delta | null;
  /** The viewer's view after a delta; `applyDelta(view(before), delta)` equals `view(after)`. */
  applyDelta?(view: View, delta: Delta): View;
  /** When the room should wake the game next, or null. */
  nextDeadline(state: State): number | null;
  onDeadline(state: State, now: number): Transition<State>;
  /** The seat is gone for good: Leave game, a ban, or removal. */
  onPlayerLeft(state: State, playerId: string): Transition<State>;
  /**
   * Who is away right now (D56): called mid-game whenever a player's connection drops or comes
   * back (never for Play here), with every away player. They keep their seats; a game may skip
   * them, e.g. when picking the next drawer. Optional.
   */
  onPresence?(state: State, awayIds: string[], now: number): Transition<State>;
  /** Null while the game is in progress. */
  result(state: State): GameResult | null;
  /**
   * Scores so far, for a game the host ends early. Optional: without it, an early end
   * shows every player on 0. There is never a winner when a game ends early.
   */
  standings?(state: State): Record<string, number>;
  /**
   * What the game keeps in its permanent record when it ends (D58): small, plain JSON, e.g.
   * each round's word and winner. Optional: without it, the record has no summary.
   */
  recordSummary?(state: State): unknown;
}

/** Any game, for registries. Method syntax above keeps concrete games assignable to this. */
export type AnyGame = GameDefinition<unknown, unknown, unknown, unknown, unknown>;
