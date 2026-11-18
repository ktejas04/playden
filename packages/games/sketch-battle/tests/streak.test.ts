import { describe, expect, it } from "vitest";
import { headStartFor, streakFor } from "../streak";
import type { Pair, RoundRecord, TeamIndex } from "../types";

/** A finished round: who drew for each team and which team won (null: nobody guessed). */
function played(drawerIds: Pair<string>, winnerTeam: TeamIndex | null): RoundRecord {
  return {
    number: 0,
    word: "kite",
    drawerIds,
    winnerTeam,
    solvedAt: [null, null],
    drawingStartedAt: [0, 0],
    points: [0, 0],
    headStartSeconds: 0,
  };
}

describe("streaks (section 7)", () => {
  it("the streak counts consecutive wins by the same drawer and team", () => {
    const history = [
      played(["asha", "dev"], 0),
      played(["asha", "esha"], 0),
      played(["asha", "faiz"], 0),
    ];
    expect(streakFor(history, ["asha", "dev"])).toEqual({ team: 0, drawerId: "asha", count: 3 });
    expect(streakFor(history.slice(0, 1), ["asha", "esha"])).toEqual({
      team: 0,
      drawerId: "asha",
      count: 1,
    });
  });

  it("the streak resets after a loss, a no-winner round or a drawer change", () => {
    // A loss: Team 2 won the last round, so Asha's two wins before it are gone.
    const lost = [
      played(["asha", "dev"], 0),
      played(["asha", "esha"], 0),
      played(["asha", "faiz"], 1),
    ];
    expect(streakFor(lost, ["ben", "faiz"])).toEqual({ team: 1, drawerId: "faiz", count: 1 });
    // A no-winner round counts nothing, and breaks what came before it.
    const nobody = [played(["asha", "dev"], 0), played(["asha", "esha"], null)];
    expect(streakFor(nobody, ["ben", "faiz"])).toBeNull();
    const after = [...nobody, played(["ben", "faiz"], 0)];
    expect(streakFor(after, ["ben", "dev"])).toEqual({ team: 0, drawerId: "ben", count: 1 });
    // A drawer change: Team 1 won with Ben, then with Chi, so Chi's streak is 1.
    const changed = [played(["ben", "dev"], 0), played(["chi", "esha"], 0)];
    expect(streakFor(changed, ["chi", "faiz"])).toEqual({ team: 0, drawerId: "chi", count: 1 });
  });

  it("the streak counts only if the winning drawer draws again in the coming round", () => {
    const history = [played(["asha", "dev"], 0), played(["asha", "esha"], 0)];
    // Asha dropped, so Ben draws for Team 1: no streak, no head start.
    expect(streakFor(history, ["ben", "faiz"])).toBeNull();
  });

  it("there is no streak before round 1", () => {
    expect(streakFor([], ["asha", "dev"])).toBeNull();
  });
});

describe("head starts (section 7)", () => {
  it("the head start is 0 below a streak of 2", () => {
    expect(headStartFor(0)).toBe(0);
    expect(headStartFor(1)).toBe(0);
  });

  it("the head start is 3 s at streak 2 and +1 s per extra win", () => {
    expect([2, 3, 4, 5, 10].map((streak) => headStartFor(streak))).toEqual([3, 4, 5, 6, 11]);
  });

  it("the head start respects the cap only when one is set", () => {
    expect(headStartFor(10, null)).toBe(11);
    expect(headStartFor(10, 5)).toBe(5);
    expect(headStartFor(3, 5)).toBe(4);
    expect(headStartFor(1, 5)).toBe(0);
  });
});
