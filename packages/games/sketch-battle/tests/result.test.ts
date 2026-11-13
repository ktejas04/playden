import { describe, expect, it } from "vitest";
import type { RoundRecord } from "../types";
import { resultText } from "../view/result";

const record = (fields: Partial<RoundRecord>): RoundRecord => ({
  number: 1,
  word: "pot of gold",
  drawerIds: ["asha", "dev"],
  winnerTeam: 0,
  solvedAt: [12_300, 47_000],
  drawingStartedAt: [0, 0],
  points: [200, 100],
  ...fields,
});

describe("the round result overlay (S7)", () => {
  it("the first team won by the gap, +200", () => {
    expect(resultText(record({}), 0)).toEqual({
      title: "You won by 35 seconds!",
      detail: "+200 points",
      tone: "won",
    });
  });

  it("the second team lost by the gap, +100", () => {
    expect(resultText(record({ solvedAt: [1_000, 1_400] }), 1)).toEqual({
      title: "You lost by 0.4 seconds",
      detail: "+100 points",
      tone: "lost",
    });
  });

  it("only one team guessed: the winner got it first, the other team hears the word", () => {
    const one = record({ solvedAt: [5_000, null], points: [200, 0] });
    expect(resultText(one, 0)).toMatchObject({ title: "You got it first!", detail: "+200 points" });
    expect(resultText(one, 1)).toEqual({
      title: "Time's up!",
      detail: "The word was pot of gold",
      tone: "lost",
    });
  });

  it("nobody guessed: time's up for everyone", () => {
    const none = record({ winnerTeam: null, solvedAt: [null, null], points: [0, 0] });
    expect(resultText(none, 0)).toEqual({
      title: "Time's up!",
      detail: "The word was pot of gold",
      tone: "neutral",
    });
    expect(resultText(none, null).title).toBe("Time's up!");
  });

  it("spectators hear which team won and the word", () => {
    expect(resultText(record({}), null)).toEqual({
      title: "Team 1 won by 35 seconds",
      detail: "The word was pot of gold",
      tone: "neutral",
    });
  });
});
