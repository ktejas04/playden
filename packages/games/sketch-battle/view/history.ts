import type { ShowdownView, TeamIndex } from "../types";

/** A team's finished showdown words for its own players (SB27), newest first. */
export function wordHistory(
  showdown: ShowdownView | null,
  team: TeamIndex | null,
): string[] | null {
  if (!showdown || team === null) return null;
  return [...(showdown.finished[team] ?? [])].reverse();
}
