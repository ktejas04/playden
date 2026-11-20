import type { ShowdownView, TeamIndex } from "../types";

export type WordCell = { kind: "word"; word: string } | { kind: "check" } | { kind: "blank" };

/**
 * The original's showdown table (SB30) for a player: a column per team, their own first, a
 * row per word. A finished word shows as text when the player was sent it (their own team's),
 * else as a ✓; words not yet finished are blank lines.
 */
export function wordTable(
  showdown: ShowdownView,
  viewerTeam: TeamIndex,
): { team: TeamIndex; cells: WordCell[] }[] {
  const order: TeamIndex[] = viewerTeam === 0 ? [0, 1] : [1, 0];
  return order.map((team) => ({
    team,
    cells: Array.from({ length: showdown.total }, (_, row): WordCell => {
      if (row >= showdown.done[team]) return { kind: "blank" };
      const word = showdown.finished[team]?.[row];
      return word === undefined ? { kind: "check" } : { kind: "word", word };
    }),
  }));
}
