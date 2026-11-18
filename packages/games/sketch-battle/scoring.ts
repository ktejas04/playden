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
 * Milliseconds between the two teams' correct guesses on the clock, as the original: a head
 * start counts, since the round is won on the clock. Null unless both guessed.
 */
export function gapMs(solvedAt: Pair<number | null>): number | null {
  const [a, b] = solvedAt;
  if (a === null || b === null) return null;
  return Math.abs(a - b);
}

/**
 * The gap between two teams' guesses (SB14):
 * - If >= 1 s: rounded up to the nearest upper whole second ("4 seconds", "1 second")
 * - If < 1 s: rounded to nearest tenth of a second ("0.4 seconds", "less than 0.1 seconds")
 */
export function formatGap(ms: number): string {
  if (ms >= 1000) {
    const sec = Math.ceil(ms / 1000);
    return `${sec} ${sec === 1 ? "second" : "seconds"}`;
  }
  const tenths = Math.round(ms / 100);
  if (tenths === 0) return "less than 0.1 seconds";
  if (tenths === 10) return "1 second";
  return `${(tenths / 10).toFixed(1)} seconds`;
}
