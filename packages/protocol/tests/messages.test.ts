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
      room: { code: "ABCD", players: [{ id: "u1", name: "Asha", connected: true }] },
    };
    expect(parseServerMessage(JSON.stringify(snapshot))).toEqual({ ok: true, message: snapshot });
  });

  it("accepts pong and error", () => {
    expect(parseServerMessage(JSON.stringify({ type: "pong", t: 1, serverTime: 2 })).ok).toBe(true);
    expect(parseServerMessage(JSON.stringify({ type: "error", reason: "Nope" })).ok).toBe(true);
  });

  it("rejects a snapshot with a bad room code", () => {
    const snapshot = { type: "snapshot", room: { code: "OOOO", players: [] } };
    expect(parseServerMessage(JSON.stringify(snapshot)).ok).toBe(false);
  });
});
