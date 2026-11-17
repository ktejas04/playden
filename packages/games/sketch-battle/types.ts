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

/** One team's side of a round, or of one showdown word. */
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
 * Where the game is. `result`: the round's outcome, 5 s. `summary`: until every connected
 * player has tapped Continue, or someone taps Start next round (section 10). After the last
 * round: the showdown's intro, countdown, play and result (section 9).
 */
export type Phase =
  | "choose"
  | "countdown"
  | "drawing"
  | "result"
  | "summary"
  | "showdownIntro"
  | "showdownCountdown"
  | "showdown"
  | "showdownResult"
  | "ended";

/** The race through every round word after the last round (section 9). */
export interface Showdown {
  /** Every round word, in one seeded order shared by both teams. */
  words: string[];
  /** Words each team has finished; a team's current word is `words[done[team]]`. */
  done: Pair<number>;
  /** Each team's current word: strokes are kept for the current word only. */
  turns: Pair<TeamTurn>;
  /** The team that finished first, and when. */
  winnerTeam: TeamIndex | null;
  finishedAt: number | null;
}

export interface SketchBattleState {
  config: SketchBattleConfig;
  rng: Rng;
  phase: Phase;
  /** When the current phase ends (server time); on the summary, when Start next round opens. */
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
  /** Players who tapped Continue since the round ended. */
  ready: string[];
  /** Each player's latest guess times, for the 3-in-3-seconds limit. */
  recentGuesses: Record<string, number[]>;
  /** The showdown, once the last round's summary is done. */
  showdown: Showdown | null;
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
  | { type: "guess"; text: string }
  | { type: "ready" }
  | { type: "forceStart" };

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
  /** How many wrong guesses this team made this round; everyone sees it, not the texts. */
  wrongGuesses: number;
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
  /** Players who tapped Continue since the round ended. */
  ready: string[];
  /** The showdown as this viewer may see it; null before it starts. */
  showdown: ShowdownView | null;
}

export interface ShowdownView {
  /** How many words each team has to finish. */
  total: number;
  /** Words each team has finished: everyone sees the race. */
  done: Pair<number>;
  /** The words a team finished: for that team and spectators, and for everyone at the end. */
  finished: Pair<string[] | null>;
  /** Each team's current word: for that team's drawer and spectators. */
  current: Pair<string | null>;
  /** Each team's current word as blanks, for that team's guessers (null with word lengths off). */
  blanks: Pair<string | null>;
  winnerTeam: TeamIndex | null;
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
  /** Words each team finished in the showdown and who finished first; null if it never started. */
  showdown: { words: number; done: Pair<number>; winnerTeam: TeamIndex | null } | null;
  scores: Pair<number>;
}
