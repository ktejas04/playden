import type { GameSession } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import {
  type Members,
  expiredIds,
  inGraceIds,
  inOrder,
  memberArrives,
  memberAway,
  memberGone,
  nextExpiry,
} from "../src/room/presence";

const GRACE = 60_000;
const asha = { id: "a", name: "Asha", isAdmin: false };
const ben = { id: "b", name: "Ben", isAdmin: false };

function playing(players: string[]): GameSession {
  return {
    id: 1,
    phase: "playing",
    gameId: "tap-race",
    config: null,
    players: players.map((id) => ({ id, name: id, left: false })),
    spectators: [],
    banned: [],
    startsAt: null,
    result: null,
    endedEarly: false,
  };
}

function room(): Members {
  return memberArrives(memberArrives({}, asha, 1_000), ben, 2_000);
}

describe("presence", () => {
  it("lists members longest in the room first", () => {
    expect(inOrder(room()).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("a member who comes back keeps their place and is no longer away", () => {
    let members = memberAway(room(), "a", 5_000);
    members = memberArrives(members, asha, 9_000);
    expect(members.a).toMatchObject({ joinedAt: 1_000, awayAt: null });
  });

  it("an away member counts as in the room until their grace runs out", () => {
    const members = memberAway(room(), "a", 10_000);
    expect(inGraceIds(members, 10_000 + GRACE - 1, GRACE)).toEqual(["a"]);
    expect(expiredIds(members, null, 10_000 + GRACE - 1, GRACE)).toEqual([]);
    expect(expiredIds(members, null, 10_000 + GRACE, GRACE)).toEqual(["a"]);
    expect(nextExpiry(members, null, GRACE)).toBe(10_000 + GRACE);
  });

  it("a player mid-game keeps their place however long they're away", () => {
    const members = memberAway(room(), "a", 10_000);
    const game = playing(["a", "b"]);
    expect(expiredIds(members, game, 10_000 + 10 * GRACE, GRACE)).toEqual([]);
    expect(nextExpiry(members, game, GRACE)).toBeNull();
    // Once the game is over, the long-gone player expires at once.
    expect(expiredIds(members, { ...game, phase: "results" }, 10_000 + 10 * GRACE, GRACE)).toEqual([
      "a",
    ]);
  });

  it("mid-game, a spectator or someone just in the room is gone after the grace; a seated player isn't", () => {
    const chi = { id: "c", name: "Chi", isAdmin: false };
    let members = memberArrives(room(), chi, 3_000);
    for (const id of ["a", "b", "c"]) members = memberAway(members, id, 10_000);
    // Asha plays, Ben spectates, Chi is only in the room.
    const game = { ...playing(["a"]), spectators: ["b"] };
    expect(expiredIds(members, game, 10_000 + GRACE - 1, GRACE)).toEqual([]);
    expect(nextExpiry(members, game, GRACE)).toBe(10_000 + GRACE);
    expect(expiredIds(members, game, 10_000 + GRACE, GRACE)).toEqual(["b", "c"]);
  });

  it("leaving on purpose is gone at once", () => {
    expect(Object.keys(memberGone(room(), "a"))).toEqual(["b"]);
    expect(memberGone(room(), "z")).toEqual(room());
  });

  it("dropping twice keeps the first time", () => {
    const members = memberAway(memberAway(room(), "a", 10_000), "a", 20_000);
    expect(members.a?.awayAt).toBe(10_000);
  });
});
