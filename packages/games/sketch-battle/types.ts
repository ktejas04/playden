import type { Rng } from "@playden/engine";

/** Host settings (spec section 4): any shape, checked by `configSchema` (D53). */
export interface SketchBattleConfig {
  rounds: number;
  roundSeconds: number;
  showWordLengths: boolean;
}

export type Tool = "pen" | "eraser";
/** Brush size 1–4, an index into BRUSH_SIZES. */
export type BrushSize = 1 | 2 | 3 | 4;
export type TeamIndex = 0 | 1;
export type Pair<T> = [T, T];

/** One continuous line. Points are absolute x,y pairs (x 0–1500, y 0–1000). */
export interface Stroke {
  id: number;
  tool: Tool;
  /** 0–9, an index into the palette. */
  colour: number;
  size: BrushSize;
  points: number[];
}
export type CanvasOp = Stroke | { clear: true };

export interface Guess {
  by: string;
  text: string;
  /** Server time. */
  at: number;
  correct: boolean;
}

/** One team's side of a round. */
export interface TeamTurn {
  drawerId: string;
  /** Server time this drawer may start drawing. */
  drawFrom: number;
  ops: CanvasOp[];
  /** The 24 × 16 pixel view, row by row: "." empty, "0"–"9" a palette colour (D47). */
  cells: string;
  guesses: Guess[];
  solvedAt: number | null;
}

export interface Round {
  /** 1-based. */
  number: number;
  chooserId: string;
  choices: Pair<string>;
  word: string | null;
  headStartSeconds: number;
  wordChosenAt: number | null;
  /** Teams in the order they guessed the word: the first gets 200, the second 100. */
  solvedOrder: TeamIndex[];
  turns: Pair<TeamTurn>;
}

/** What later rounds, streaks, highlights and the record need from a finished round. */
export interface RoundRecord {
  number: number;
  word: string;
  drawerIds: Pair<string>;
  winnerTeam: TeamIndex | null;
  solvedAt: Pair<number | null>;
  drawingStartedAt: Pair<number>;
  points: Pair<number>;
}

/**
 * Where the game is. `waiting`: the next round can't start until each team has 2 connected
 * players (SB12). The showdown phases come in task 030.
 */
export type Phase = "choose" | "countdown" | "drawing" | "result" | "waiting" | "ended";

export interface SketchBattleState {
  config: SketchBattleConfig;
  rng: Rng;
  phase: Phase;
  /** When the current phase ends (server time); null while waiting or ended. */
  phaseEndsAt: number | null;
  /** Each team's drawing order: its setup order. */
  rotations: Pair<string[]>;
  names: Record<string, string>;
  /** Players whose connection dropped (D56); they keep their seats. */
  away: string[];
  /** Players who left or were banned; out of the rotation for good. */
  left: string[];
  /** The words this game can offer, as indexes into the word list, in seeded order. */
  wordOrder: number[];
  wordCursor: number;
  /** The current round, strokes included; null before round 1. */
  round: Round | null;
  /** Finished rounds, without strokes. */
  history: RoundRecord[];
  scores: Pair<number>;
  /** Each player's latest guess times, for the 3-in-3-seconds limit. */
  recentGuesses: Record<string, number[]>;
}

export type DrawStart = { tool: Tool; colour: number; size: BrushSize };

export type SketchBattleMove =
  | { type: "choose"; index: 0 | 1 }
  | {
      type: "draw";
      stroke: number;
      start?: DrawStart;
      /** x,y pairs; the first absolute, the rest differences from the point before. */
      points: number[];
      end?: true;
    }
  | { type: "clear" }
  | { type: "guess"; text: string };

/** One team's canvas as a viewer may see it: real strokes, or only the pixel view (D47). */
export type CanvasView = { kind: "strokes"; ops: CanvasOp[] } | { kind: "cells"; cells: string };

export interface TeamView {
  players: { id: string; name: string; away: boolean; left: boolean }[];
  score: number;
  drawerId: string | null;
  drawFrom: number | null;
  solvedAt: number | null;
  canvas: CanvasView;
  /** This team's guesses, when the viewer may see them; null otherwise. */
  guesses: Guess[] | null;
}

/** What one viewer sees. Built only from what they may know (spec section 15). */
export interface SketchBattleView {
  me: { team: TeamIndex | null; role: "drawer" | "guesser" | "spectator" };
  phase: Phase;
  phaseEndsAt: number | null;
  roundNumber: number;
  rounds: number;
  chooserId: string | null;
  /** The two words to pick from: only for the two drawers, while choosing. */
  choices: Pair<string> | null;
  /** The word, for drawers (from the countdown), spectators, teams that guessed, and everyone at the result. */
  word: string | null;
  /** The word as blanks, for everyone else once it's chosen (null with word lengths off). */
  blanks: string | null;
  teams: Pair<TeamView>;
  /** The last finished round, for the result overlay. */
  lastRound: RoundRecord | null;
  /** Teams that need more connected players before the next round (SB12). */
  waitingFor: TeamIndex[];
}

/** What changed in one viewer's view (D55); see delta.ts. */
export interface SketchBattleDelta {
  set?: Partial<Omit<SketchBattleView, "teams">>;
  teams?: Pair<TeamDelta | null>;
}

export interface TeamDelta {
  set?: Partial<Omit<TeamView, "canvas" | "guesses">>;
  canvas?: CanvasDelta;
  guesses?: { add: Guess[] } | { replace: Guess[] | null };
}

export type CanvasDelta =
  | { replace: CanvasView }
  /** New points on the last stroke, then new operations after it. */
  | { extend?: number[]; add?: CanvasOp[] }
  /** Changed pixel cells: [cell index, "." or "0"–"9"]. */
  | { cells: [number, string][] };

/** Kept in the game's permanent record (D58): rounds now, the showdown and highlights later. */
export interface SketchBattleSummary {
  rounds: {
    number: number;
    word: string;
    drawerIds: Pair<string>;
    winnerTeam: TeamIndex | null;
    /** Milliseconds between the two teams' correct guesses; null unless both guessed. */
    gapMs: number | null;
  }[];
  scores: Pair<number>;
}
