export interface Player {
  id: string;
  name: string;
}

export interface GameEvent {
  type: string;
  data?: unknown;
}

export interface GameResult {
  scores: Record<string, number>;
  winners: string[];
}

export type Ok = { ok: true };
export type Rejection = { ok: false; reason: string };
export type Validation = Ok | Rejection;

export interface Transition<State> {
  state: State;
  events: GameEvent[];
}

export interface GameDefinition<State, Move, View, Config> {
  id: string;
  minPlayers: number;
  maxPlayers: number;
  defaultConfig: Config;

  setup(players: Player[], config: Config, seed: number): State;
  validate(state: State, playerId: string, move: Move, now: number): Validation;
  apply(state: State, playerId: string, move: Move, now: number): Transition<State>;
  view(state: State, playerId: string | "spectator"): View;
  nextDeadline(state: State): number | null;
  onDeadline(state: State, now: number): Transition<State>;
  onPlayerLeft(state: State, playerId: string): Transition<State>;
  result(state: State): GameResult | null;
}
