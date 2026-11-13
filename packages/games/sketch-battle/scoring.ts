import { FIRST_TEAM_POINTS, SECOND_TEAM_POINTS } from "./config";
import type { Pair, TeamIndex } from "./types";

/**
 * Round points from the order the teams guessed in (SB1): first 200, second a flat 100
 * however late, a team that never guessed 0.
 */
export function pointsFor(solvedOrder: readonly TeamIndex[]): Pair<number> {
  const points: Pair<number> = [0, 0];
  const [first, second] = solvedOrder;
  if (first !== undefined) points[first] = FIRST_TEAM_POINTS;
  if (second !== undefined) points[second] = SECOND_TEAM_POINTS;
  return points;
}

/**
 * Milliseconds between the two teams' correct guesses, each timed from its own drawer's start;
 * null unless both guessed.
 */
export function gapMs(
  solvedAt: Pair<number | null>,
  drawingStartedAt: Pair<number>,
): number | null {
  const [a, b] = solvedAt;
  if (a === null || b === null) return null;
  return Math.abs(a - drawingStartedAt[0] - (b - drawingStartedAt[1]));
}

/** "0.4 seconds" under a second, otherwise whole seconds rounded up ("35 seconds"). */
export function formatGap(ms: number): string {
  if (ms < 1_000) {
    const tenths = Math.max(1, Math.ceil(ms / 100));
    if (tenths < 10) return `0.${tenths} seconds`;
  }
  const seconds = Math.max(1, Math.ceil(ms / 1_000));
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}
