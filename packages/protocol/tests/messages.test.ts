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
