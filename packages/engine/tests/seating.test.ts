import { describe, expect, it } from "vitest";
import type { Seat } from "../src/GameDefinition";
import {
  type SeatRules,
  seatForNewcomer,
  seatInOrder,
  seatProblem,
  teamForNewcomer,
} from "../src/seating";

const solo: SeatRules = { minPlayers: 2, maxPlayers: 3 };
const teams: SeatRules = {
  minPlayers: 2,
  maxPlayers: 6,
  teams: { count: 2, minSize: 1, maxSize: 3, maxSizeGap: 1 },
};
const person = (id: string) => ({ id, name: id });
const seat = (id: string, team?: number): Seat =>
  team === undefined ? { id, name: id } : { id, name: id, team };

describe("teamForNewcomer", () => {
  const rules = teams.teams ?? { count: 2, minSize: 1, maxSize: 3, maxSizeGap: 1 };

  it("picks the first team on a tie", () => {
    expect(teamForNewcomer(rules, [])).toBe(0);
    expect(teamForNewcomer(rules, [seat("a", 0), seat("b", 1)])).toBe(0);
  });

  it("picks the smaller team", () => {
    expect(teamForNewcomer(rules, [seat("a", 0)])).toBe(1);
    expect(teamForNewcomer(rules, [seat("a", 1), seat("b", 1), seat("c", 0)])).toBe(0);
  });

  it("returns null when every team is full", () => {
    const full = ["a", "b", "c"].flatMap((id) => [seat(`${id}0`, 0), seat(`${id}1`, 1)]);
    expect(teamForNewcomer(rules, full)).toBeNull();
  });
});

describe("seatForNewcomer", () => {
  it("seats without a team in games without teams", () => {
    expect(seatForNewcomer(solo, [], person("a"))).toEqual(seat("a"));
  });

  it("refuses once the game is full", () => {
    expect(seatForNewcomer(solo, [seat("a"), seat("b"), seat("c")], person("d"))).toBeNull();
  });

  it("alternates teams as people join one by one", () => {
    const { seats } = seatInOrder(teams, ["a", "b", "c", "d"].map(person));
    expect(seats.map((s) => s.team)).toEqual([0, 1, 0, 1]);
  });
});

describe("seatInOrder", () => {
  it("returns the people who don't fit as overflow, last to join first out", () => {
    const { seats, overflow } = seatInOrder(solo, ["a", "b", "c", "d", "e"].map(person));
    expect(seats.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(overflow).toEqual(["d", "e"]);
  });
});

describe("seatProblem", () => {
  it("counts the players still needed", () => {
    expect(seatProblem(solo, [])).toBe("Need 2 more");
    expect(seatProblem(solo, [seat("a")])).toBe("Need 1 more");
    expect(seatProblem(solo, [seat("a"), seat("b")])).toBeNull();
  });

  it("refuses too many players", () => {
    expect(
      seatProblem(
        solo,
        ["a", "b", "c", "d"].map((id) => seat(id)),
      ),
    ).toBe("At most 3 players");
  });

  it("checks each team's size and the gap between teams", () => {
    expect(seatProblem(teams, [seat("a", 0), seat("b", 0)])).toBe("Team 2 needs 1 more");
    expect(seatProblem(teams, [seat("a", 0), seat("b", 1)])).toBeNull();
    expect(seatProblem(teams, [seat("a", 0), seat("b", 0), seat("c", 0), seat("d", 1)])).toBe(
      "Teams are uneven",
    );
    expect(
      seatProblem(teams, [seat("a", 0), seat("b", 0), seat("c", 0), seat("d", 0), seat("e", 1)]),
    ).toBe("Team 1 is over 3");
  });
});
