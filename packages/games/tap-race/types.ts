export interface TapRaceConfig {
  targetTaps: number;
  roundSeconds: number;
}

export type TapRaceMove = { type: "tap" };

/** How the race ended: the winning team, or null for a draw. */
export interface TapRaceEnding {
  winningTeam: number | null;
  counts: number[];
}

export interface TapRaceState {
  /** Team index per player id. */
  teamOf: Record<string, number>;
  /** Taps per team. */
  counts: number[];
  target: number;
  endsAt: number;
  ended: TapRaceEnding | null;
}

export type Standing = "ahead" | "behind" | "level";

export type TapRaceView =
  | {
      role: "player";
      team: number;
      ownCount: number;
      standing: Standing;
      target: number;
      endsAt: number;
      ended: TapRaceEnding | null;
    }
  | {
      role: "spectator";
      counts: number[];
      target: number;
      endsAt: number;
      ended: TapRaceEnding | null;
    };
