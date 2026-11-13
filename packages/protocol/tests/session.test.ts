import { describe, expect, it } from "vitest";
import { type GameSession, activePlayers, roleIn } from "../src";

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
