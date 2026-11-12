import type { GameSession } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import { chooseHost } from "../src/room/host";

function session(phase: GameSession["phase"], players: string[], spectators: string[] = []) {
  return {
    id: 1,
    phase,
    gameId: "tap-race",
    config: null,
    players: players.map((id) => ({ id, name: id, left: false })),
    spectators,
    banned: [],
    result: null,
    endedEarly: false,
  } satisfies GameSession;
}

describe("chooseHost", () => {
  it("keeps a connected host", () => {
    expect(chooseHost({ current: "a", memberIds: ["b", "a"], session: null })).toBe("a");
  });

  it("idle: passes to the longest-present member", () => {
    expect(chooseHost({ current: "a", memberIds: ["c", "b"], session: null })).toBe("c");
  });

  it("setup: prefers a player as the next host", () => {
    const s = session("setup", ["a", "b"], ["c"]);
    expect(chooseHost({ current: "a", memberIds: ["c", "b"], session: s })).toBe("b");
  });

  it("setup: with no player left, any member becomes host", () => {
    const s = session("setup", ["a"], ["c"]);
    expect(chooseHost({ current: "a", memberIds: ["c"], session: s })).toBe("c");
  });

  it("playing: only a player can be host, never a spectator or someone just in the room", () => {
    const s = session("playing", ["a", "b"], ["c"]);
    expect(chooseHost({ current: "a", memberIds: ["d", "c", "b"], session: s })).toBe("b");
  });

  it("playing: a host who left the game passes host on at once", () => {
    const s = {
      ...session("playing", ["a", "b"]),
      players: [
        { id: "a", name: "a", left: true },
        { id: "b", name: "b", left: false },
      ],
    };
    expect(chooseHost({ current: "a", memberIds: ["a", "b"], session: s })).toBe("b");
  });

  it("playing: with no connected player, host stays put", () => {
    const s = session("playing", ["a", "b"], ["c"]);
    expect(chooseHost({ current: "a", memberIds: ["c"], session: s })).toBe("a");
  });

  it("results: only a player can be host, never a spectator or someone just in the room", () => {
    const s = session("results", ["a", "b"], ["c"]);
    expect(chooseHost({ current: "a", memberIds: ["d", "c", "b"], session: s })).toBe("b");
    expect(chooseHost({ current: "a", memberIds: ["d", "c"], session: s })).toBe("a");
  });
});
