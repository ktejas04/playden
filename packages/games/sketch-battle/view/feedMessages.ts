import type { Guess, TeamView } from "../types";

/** One word's feed as a screen has it: the drawer and start may not be known yet. */
export interface FeedWord {
  drawerId: string | null;
  drawFrom: number | null;
  guesses: Guess[];
}

/** The lines a feed opens each word with (SB29). */
export type FeedHeader = "drawer" | "guessers";

export type FeedLine =
  | { kind: "drawer" | "guessers"; key: string; drawerId: string }
  | { kind: "guess"; key: string; guess: Guess; elapsedMs: number | null };

/**
 * A feed's lines in time order, as the original's MessageLog builds them: for each word, the
 * headers asked for, then that word's guesses with their time since the word's drawing began.
 */
export function feedLines(words: readonly FeedWord[], headers: readonly FeedHeader[]): FeedLine[] {
  return words.flatMap((word, w) => {
    const { drawerId, drawFrom } = word;
    const top: FeedLine[] =
      drawerId === null ? [] : headers.map((kind) => ({ kind, key: `${w}-${kind}`, drawerId }));
    const guesses = word.guesses.map((guess, i): FeedLine => ({
      kind: "guess",
      key: `${w}-${i}`,
      guess,
      elapsedMs: drawFrom === null ? null : guess.at - drawFrom,
    }));
    return [...top, ...guesses];
  });
}

/** The words a team's feed shows: its finished showdown words, then the current one (SB30). */
export function teamWords(team: TeamView): FeedWord[] {
  if (team.guesses === null) return [];
  const current = { drawerId: team.drawerId, drawFrom: team.drawFrom, guesses: team.guesses };
  return [...(team.earlier ?? []), current];
}

/** "Ben is guessing", "Ben and Chi are guessing", "Ben, Chi, and Esha are guessing". */
export function guessersLine(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is guessing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are guessing`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)} are guessing`;
}

/** The original's hover text: seconds to one decimal, "12.3s elapsed". */
export function elapsedLabel(ms: number): string {
  return `${Math.round(ms / 100) / 10}s elapsed`;
}

/**
 * The other team's ✓ / ✕ marks, newest first, as the original (SB31): their right guess, if
 * they made it, then a ✕ for each wrong one. `true` is a right guess.
 */
export function attemptMarks(team: TeamView): boolean[] {
  return [
    ...(team.solvedAt !== null ? [true] : []),
    ...Array.from({ length: team.wrongGuesses }, () => false),
  ];
}
