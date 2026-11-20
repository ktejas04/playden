import { describe, expect, it } from "vitest";
import type { ShowdownView } from "../types";
import { wordTable } from "../view/showdownTable";

/** The original's FinalRoundSidebar (SB30): a column per team, a row per showdown word. */
const showdown = (over: Partial<ShowdownView> = {}): ShowdownView => ({
  total: 4,
  done: [2, 1],
  finished: [["cat", "sun"], null],
  current: [null, null],
  winnerTeam: null,
  ...over,
});

describe("the showdown word table", () => {
  it("puts the player's own team first: their words in green, the other team's as ticks, blanks after", () => {
    const table = wordTable(showdown(), 0);
    expect(table.map((column) => column.team)).toEqual([0, 1]);
    expect(table[0]?.cells).toEqual([
      { kind: "word", word: "cat" },
      { kind: "word", word: "sun" },
      { kind: "blank" },
      { kind: "blank" },
    ]);
    expect(table[1]?.cells).toEqual([
      { kind: "check" },
      { kind: "blank" },
      { kind: "blank" },
      { kind: "blank" },
    ]);
  });

  it("a Team 2 player sees Team 2 first", () => {
    const table = wordTable(showdown({ done: [1, 2], finished: [null, ["cat", "sun"]] }), 1);
    expect(table.map((column) => column.team)).toEqual([1, 0]);
    expect(table[0]?.cells.slice(0, 2)).toEqual([
      { kind: "word", word: "cat" },
      { kind: "word", word: "sun" },
    ]);
    expect(table[1]?.cells[0]).toEqual({ kind: "check" });
  });

  it("never shows a word the player wasn't sent", () => {
    // Even if the counts run ahead of the words, a missing word is a tick, not text.
    const table = wordTable(showdown({ done: [3, 0], finished: [["cat"], null] }), 0);
    expect(table[0]?.cells.slice(0, 3)).toEqual([
      { kind: "word", word: "cat" },
      { kind: "check" },
      { kind: "check" },
    ]);
  });
});
