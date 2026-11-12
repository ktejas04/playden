import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_LENGTH,
  ROOM_CODE_ALPHABET,
  parseClientMessage,
  parseServerMessage,
  roomCodeSchema,
} from "../src";

describe("roomCodeSchema", () => {
  it("accepts 4 letters from the alphabet", () => {
    expect(roomCodeSchema.safeParse("ABCD").success).toBe(true);
  });

  it("rejects look-alike letters, lower case and wrong lengths", () => {
    for (const code of ["ABCI", "ABCO", "ABCL", "abcd", "ABC", "ABCDE", "AB1D"]) {
      expect(roomCodeSchema.safeParse(code).success).toBe(false);
    }
  });

  it("alphabet has no look-alike letters", () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[ILO0-9]/);
  });
});

describe("parseClientMessage", () => {
  it("accepts a ping", () => {
    expect(parseClientMessage(JSON.stringify({ type: "ping", t: 123 }))).toEqual({
      ok: true,
      message: { type: "ping", t: 123 },
    });
  });

  it("accepts a remove with a player id", () => {
    expect(parseClientMessage(JSON.stringify({ type: "remove", playerId: "u2" }))).toEqual({
      ok: true,
      message: { type: "remove", playerId: "u2" },
    });
  });

  it("rejects a remove without a player id", () => {
    expect(parseClientMessage(JSON.stringify({ type: "remove" })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ type: "remove", playerId: "" })).ok).toBe(false);
  });

  it("rejects non-JSON", () => {
    expect(parseClientMessage("not json")).toEqual({ ok: false, reason: "Message is not JSON" });
  });

  it("rejects an unknown type", () => {
    expect(parseClientMessage(JSON.stringify({ type: "hack" })).ok).toBe(false);
  });

  it("rejects extra fields", () => {
    expect(parseClientMessage(JSON.stringify({ type: "ping", t: 1, admin: true })).ok).toBe(false);
  });

  it("rejects messages over the length limit", () => {
    const raw = JSON.stringify({ type: "ping", t: 1, pad: "x".repeat(MAX_MESSAGE_LENGTH) });
    expect(parseClientMessage(raw)).toEqual({ ok: false, reason: "Message is too long" });
  });
});

describe("parseServerMessage", () => {
  it("accepts a snapshot", () => {
    const snapshot = {
      type: "snapshot",
      room: {
        code: "ABCD",
        hostId: "u1",
        players: [{ id: "u1", name: "Asha", connected: true, isAdmin: false }],
      },
    };
    expect(parseServerMessage(JSON.stringify(snapshot))).toEqual({ ok: true, message: snapshot });
  });

  it("rejects a snapshot without a host", () => {
    const snapshot = { type: "snapshot", room: { code: "ABCD", players: [] } };
    expect(parseServerMessage(JSON.stringify(snapshot)).ok).toBe(false);
  });

  it("accepts pong and error", () => {
    expect(parseServerMessage(JSON.stringify({ type: "pong", t: 1, serverTime: 2 })).ok).toBe(true);
    expect(parseServerMessage(JSON.stringify({ type: "error", reason: "Nope" })).ok).toBe(true);
  });

  it("accepts a replaced notice", () => {
    const notice = { type: "replaced" };
    expect(parseServerMessage(JSON.stringify(notice))).toEqual({ ok: true, message: notice });
  });

  it("accepts a removed notice", () => {
    const notice = { type: "removed", playerId: "u2", name: "Ravi" };
    expect(parseServerMessage(JSON.stringify(notice))).toEqual({ ok: true, message: notice });
  });

  it("rejects a snapshot player without an admin flag", () => {
    const snapshot = {
      type: "snapshot",
      room: { code: "ABCD", hostId: "u1", players: [{ id: "u1", name: "Asha", connected: true }] },
    };
    expect(parseServerMessage(JSON.stringify(snapshot)).ok).toBe(false);
  });

  it("rejects a snapshot with a bad room code", () => {
    const snapshot = { type: "snapshot", room: { code: "OOOO", hostId: "u1", players: [] } };
    expect(parseServerMessage(JSON.stringify(snapshot)).ok).toBe(false);
  });
});

describe("game messages", () => {
  const client = (message: unknown) => parseClientMessage(JSON.stringify(message));
  const server = (message: unknown) => parseServerMessage(JSON.stringify(message));

  it("accepts every game session control", () => {
    for (const message of [
      { type: "game.pick", gameId: "tap-race" },
      { type: "game.setConfig", config: { targetTaps: 10 } },
      { type: "game.join" },
      { type: "game.spectate" },
      { type: "game.leave" },
      { type: "game.start" },
      { type: "game.ban", playerId: "u2" },
      { type: "game.end" },
      { type: "game.playAgain" },
      { type: "game.returnToRoom" },
      { type: "leave" },
    ]) {
      expect(client(message)).toEqual({ ok: true, message });
    }
  });

  it("accepts a move with any game-specific payload", () => {
    const message = { type: "move", move: { type: "tap" } };
    expect(client(message)).toEqual({ ok: true, message });
  });

  it("rejects a game id that isn't lowercase-hyphenated", () => {
    expect(client({ type: "game.pick", gameId: "Tap Race" }).ok).toBe(false);
  });

  const setup = {
    id: 1,
    phase: "setup",
    gameId: "tap-race",
    config: { targetTaps: 10 },
    players: [
      { id: "u1", name: "Asha", team: 0, left: false },
      { id: "u2", name: "Ben", team: 1, left: false },
    ],
    spectators: ["u3"],
    banned: [],
    result: null,
    endedEarly: false,
  };

  it("accepts an idle room and a session in every phase", () => {
    const results = {
      ...setup,
      phase: "results",
      result: { scores: { u1: 3, u2: 1 }, winners: ["u1"] },
    };
    for (const session of [null, setup, { ...setup, phase: "playing" }, results]) {
      const message = { type: "game.status", session };
      expect(server(message)).toEqual({ ok: true, message });
    }
  });

  it("rejects an unknown phase", () => {
    expect(server({ type: "game.status", session: { ...setup, phase: "paused" } }).ok).toBe(false);
  });

  it("accepts a player's view and game events", () => {
    const view = { type: "game.view", view: { ownCount: 3 } };
    const events = {
      type: "game.events",
      events: [{ type: "won", data: { team: 1 } }, { type: "timeUp" }],
    };
    expect(server(view)).toEqual({ ok: true, message: view });
    expect(server(events)).toEqual({ ok: true, message: events });
  });

  it("lets server messages be far larger than client messages, for big game views", () => {
    const big = { type: "game.view", view: { strokes: "x".repeat(50_000) } };
    expect(server(big).ok).toBe(true);
    expect(client({ type: "move", move: { strokes: "x".repeat(50_000) } }).ok).toBe(false);
  });
});
