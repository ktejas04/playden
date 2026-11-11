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
}

export interface TeamRules {
  count: number;
  minSize: number;
  maxSize: number;
  /** Largest allowed difference between the biggest and smallest team. */
  maxSizeGap: number;
}

/**
 * Everything the platform knows about a game. All functions are pure and deterministic:
 * time (`now`, server milliseconds) and randomness (`seed`) come in as arguments, state and
 * views are plain JSON, and nothing is changed in place. The room never knows the rules.
 */
export interface GameDefinition<State, Move, View, Config> {
  id: string;
  name: string;
  /** One line for the game picker. */
  summary: string;
  minPlayers: number;
  maxPlayers: number;
  teams?: TeamRules;
  /** Shown only on local dev servers (test-player sign-in on). */
  devOnly?: boolean;

  defaultConfig: Config;
  configSchema: z.ZodType<Config>;
  /** The room parses every incoming move with this before calling `validate`. */
  moveSchema: z.ZodType<Move>;

  setup(seats: Seat[], config: Config, seed: number, now: number): State;
  validate(state: State, playerId: string, move: Move, now: number): Validation;
  apply(state: State, playerId: string, move: Move, now: number): Transition<State>;
  /** What one player may see. Hidden information never goes into another player's view. */
  view(state: State, playerId: string | "spectator"): View;
  /** When the room should wake the game next, or null. */
  nextDeadline(state: State): number | null;
  onDeadline(state: State, now: number): Transition<State>;
  onPlayerLeft(state: State, playerId: string): Transition<State>;
  /** Null while the game is in progress. */
  result(state: State): GameResult | null;
}

/** Any game, for registries. Method syntax above keeps concrete games assignable to this. */
export type AnyGame = GameDefinition<unknown, unknown, unknown, unknown>;
