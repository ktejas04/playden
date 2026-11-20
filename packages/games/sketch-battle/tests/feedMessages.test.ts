import { describe, expect, it } from "vitest";
import type { Guess, TeamView, WordFeed } from "../types";
import {
  attemptMarks,
  elapsedLabel,
  feedLines,
  guessersLine,
  teamWords,
} from "../view/feedMessages";

/** The feed as the original's MessageLog builds it (SB29, SB30). */
const g = (by: string, text: string, at: number, correct = false): Guess => ({
  by,
  text,
  at,
  correct,
});

const team = (over: Partial<TeamView> = {}): TeamView => ({
  players: [],
  score: 0,
  drawerId: "asha",
  drawFrom: 1_000,
  solvedAt: null,
  canvas: { kind: "cells", cells: "" },
  guesses: [],
  wrongGuesses: 0,
  earlier: null,
  ...over,
});

describe("the guessers line", () => {
  it("names one, two, or a list with a final 'and', as the original", () => {
    expect(guessersLine([])).toBe("");
    expect(guessersLine(["Ben"])).toBe("Ben is guessing");
    expect(guessersLine(["Ben", "Chi"])).toBe("Ben and Chi are guessing");
    expect(guessersLine(["Ben", "Chi", "Esha"])).toBe("Ben, Chi, and Esha are guessing");
    expect(guessersLine(["Ben", "Chi", "Esha", "Faiz"])).toBe(
      "Ben, Chi, Esha, and Faiz are guessing",
    );
  });
});

describe("a guess's time", () => {
  it("is seconds to one decimal, as the original's hover text", () => {
    expect(elapsedLabel(12_345)).toBe("12.3s elapsed");
    expect(elapsedLabel(5_000)).toBe("5s elapsed");
    expect(elapsedLabel(49)).toBe("0s elapsed");
  });
});

describe("feed lines", () => {
  const word: WordFeed = {
    drawerId: "asha",
    drawFrom: 1_000,
    guesses: [g("ben", "cat", 3_500), g("chi", "dog", 9_000, true)],
  };

  it("a round: the drawer line, the guessers line, then the guesses in time order", () => {
    const lines = feedLines([word], ["drawer", "guessers"]);
    expect(lines.map((l) => l.kind)).toEqual(["drawer", "guessers", "guess", "guess"]);
    expect(
      lines.map((l) => (l.kind === "guess" ? [l.guess.text, l.elapsedMs] : l.drawerId)),
    ).toEqual(["asha", "asha", ["cat", 2_500], ["dog", 8_000]]);
  });

  it("the showdown: a drawer line at each word, every word kept", () => {
    const next: WordFeed = {
      drawerId: "ben",
      drawFrom: 11_000,
      guesses: [g("chi", "sun", 12_000)],
    };
    const lines = feedLines([word, next], ["drawer"]);
    expect(
      lines.map((l) => (l.kind === "guess" ? l.guess.text : `${l.kind}:${l.drawerId}`)),
    ).toEqual(["drawer:asha", "cat", "dog", "drawer:ben", "sun"]);
    expect(lines.at(-1)).toMatchObject({ elapsedMs: 1_000 });
  });

  it("guesses only, for the other team's box, spectators' showdown and the summary", () => {
    expect(feedLines([word], []).map((l) => l.kind)).toEqual(["guess", "guess"]);
  });

  it("gives every line its own key", () => {
    const lines = feedLines([word, word], ["drawer", "guessers"]);
    expect(new Set(lines.map((l) => l.key)).size).toBe(lines.length);
  });
});

describe("a team's words", () => {
  it("are the finished showdown words, then the current one", () => {
    const earlier: WordFeed[] = [{ drawerId: "chi", drawFrom: 0, guesses: [] }];
    const guesses = [g("ben", "cat", 1_500)];
    expect(teamWords(team({ earlier, guesses }))).toEqual([
      ...earlier,
      { drawerId: "asha", drawFrom: 1_000, guesses },
    ]);
  });

  it("are nothing when the viewer may not see the guesses", () => {
    expect(teamWords(team({ guesses: null }))).toEqual([]);
  });

  it("have no drawer before one is known, and no times before drawing starts", () => {
    expect(teamWords(team({ drawerId: null, drawFrom: null }))).toEqual([
      { drawerId: null, drawFrom: null, guesses: [] },
    ]);
  });
});

describe("the other team's marks (SB31)", () => {
  it("are newest first: their right guess, then each wrong one", () => {
    expect(attemptMarks(team({ wrongGuesses: 2, solvedAt: 9_000 }))).toEqual([true, false, false]);
    expect(attemptMarks(team({ wrongGuesses: 3 }))).toEqual([false, false, false]);
    expect(attemptMarks(team())).toEqual([]);
  });
});
