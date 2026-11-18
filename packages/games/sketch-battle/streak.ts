import {
  HEAD_START_BASE_SECONDS,
  HEAD_START_MAX_SECONDS,
  HEAD_START_MIN_STREAK,
  HEAD_START_PER_EXTRA_WIN_SECONDS,
} from "./config";
import type { Pair, RoundRecord, TeamIndex } from "./types";

export interface Streak {
  team: TeamIndex;
  drawerId: string;
  /** Rounds in a row this drawer has won for this team. */
  count: number;
}

/**
 * The streak going into a round (section 7): looking back from the last round, the rounds in a
 * row won by the same team with the same drawer. It counts only if that drawer draws for that
 * team in the coming round. A loss, a no-winner round or a drawer change breaks it.
 */
export function streakFor(
  history: readonly RoundRecord[],
  nextDrawers: Pair<string>,
): Streak | null {
  const last = history.at(-1);
  if (!last || last.winnerTeam === null) return null;
  const team = last.winnerTeam;
  const drawerId = last.drawerIds[team];
  if (nextDrawers[team] !== drawerId) return null;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const record = history[i];
    if (record?.winnerTeam !== team || record.drawerIds[team] !== drawerId) break;
    count += 1;
  }
  return { team, drawerId, count };
}

/** The challenger's head start for the other team's streak: `3 + (streak − 2)` s from a streak of 2. */
export function headStartFor(streak: number, max: number | null = HEAD_START_MAX_SECONDS): number {
  if (streak < HEAD_START_MIN_STREAK) return 0;
  const seconds =
    HEAD_START_BASE_SECONDS + (streak - HEAD_START_MIN_STREAK) * HEAD_START_PER_EXTRA_WIN_SECONDS;
  return max === null ? seconds : Math.min(seconds, max);
}
