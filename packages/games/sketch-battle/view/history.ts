import type { ShowdownView, TeamIndex } from "../types";

/** A team's finished showdown words for its own players (SB27), newest first. */
export function wordHistory(
  showdown: ShowdownView | null,
  team: TeamIndex | null,
): { words: string[]; done: number; total: number } | null {
  if (!showdown || team === null) return null;
  const words = [...(showdown.finished[team] ?? [])].reverse();
  return { words, done: showdown.done[team], total: showdown.total };
}
