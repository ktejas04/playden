import { describe, expect, it } from "vitest";
import { type GameSession, activePlayers, inRunningGame, roleIn } from "../src";

const session: GameSession = {
  id: 1,
  phase: "playing",
  gameId: "tap-race",
  config: null,
  players: [
    { id: "a", name: "Asha", team: 0, left: false },
    { id: "b", name: "Ben", team: 1, left: true },
  ],
  spectators: ["c", "b"],
  banned: [],
  startsAt: null,
  result: null,
  endedEarly: false,
};

describe("roleIn", () => {
  it("names each person's part in the session", () => {
    expect(roleIn(session, "a")).toBe("player");
    expect(roleIn(session, "c")).toBe("spectator");
    expect(roleIn(session, "z")).toBeNull();
    expect(roleIn(null, "a")).toBeNull();
  });

  it("treats a player who left as whatever they chose next", () => {
    expect(roleIn(session, "b")).toBe("spectator");
    expect(roleIn({ ...session, spectators: [] }, "b")).toBeNull();
  });
});

describe("activePlayers", () => {
  it("leaves out players who left", () => {
    expect(activePlayers(session).map((p) => p.id)).toEqual(["a"]);
  });
});

describe("inRunningGame (D59)", () => {
  it("is true only for a seated player while the game is played", () => {
    expect(inRunningGame(session, "a")).toBe(true);
    expect(inRunningGame(session, "c")).toBe(false);
    expect(inRunningGame(session, "b")).toBe(false);
    expect(inRunningGame(null, "a")).toBe(false);
  });

  it("is false in setup and on results", () => {
    expect(inRunningGame({ ...session, phase: "setup" }, "a")).toBe(false);
    expect(inRunningGame({ ...session, phase: "results" }, "a")).toBe(false);
  });
});
