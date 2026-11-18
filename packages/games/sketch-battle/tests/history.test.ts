import { describe, expect, it } from "vitest";
import { WORD_HISTORY_ROWS } from "../config";
import type { ShowdownView } from "../types";
import { wordHistory } from "../view/history";

const showdown = (fields: Partial<ShowdownView>): ShowdownView => ({
  total: 6,
  done: [3, 1],
  finished: [["moon", "kite", "drum"], null],
  current: [null, null],
  winnerTeam: null,
  ...fields,
});

describe("the showdown word history (SB27)", () => {
  it("lists the team's finished words, newest first, with how many of the total are done", () => {
    expect(wordHistory(showdown({}), 0)).toEqual({
      words: ["drum", "kite", "moon"],
      done: 3,
      total: 6,
    });
  });

  it("is empty for a team whose words this viewer may not see, or a spectator", () => {
    expect(wordHistory(showdown({}), 1)).toEqual({ words: [], done: 1, total: 6 });
    expect(wordHistory(null, 0)).toBeNull();
    expect(wordHistory(showdown({}), null)).toBeNull();
  });

  it("shows about 15 words before it scrolls", () => {
    expect(WORD_HISTORY_ROWS).toBe(15);
  });
});
