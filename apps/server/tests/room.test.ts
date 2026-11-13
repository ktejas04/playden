import { SELF, env, runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ROOM_CLOSE, type ServerMessage } from "@playden/protocol";
import { createApp } from "../src/app";
import {
  NOW,
  ORIGIN,
  connect,
  createRoom,
  getRoom,
  member,
  playerNames,
  refusedWith,
  roomStub,
  settle,
  awaySnapshot,
  snapshotWith,
  wsRequest,
} from "./roomKit";

const ADMIN_SUB = "r-admin";

/** The Worker with `ADMIN_SUB` listed as an admin; `SELF` can't take env overrides. */
function adminAwareRequest(code: string, cookie: string) {
  const app = createApp({
    google: () => {
      throw new Error("unused");
    },
    now: () => NOW,
  });
  return app.fetch(
    new Request(`${ORIGIN}/api/rooms/${code}/ws`, { headers: { upgrade: "websocket", cookie } }),
    { ...env, ADMIN_EMAILS: `${ADMIN_SUB}@example.com` },
  );
}

describe("POST /api/rooms", () => {
  it("creates a room and returns its code", async () => {
    const { cookie } = await member("r-create", "Asha");
    const code = await createRoom(cookie);
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect((await getRoom(code, cookie)).status).toBe(200);
  });

  it("returns 403 for pending members", async () => {
    const { cookie } = await member("r-create-pending", "Ravi", "pending");
    const response = await SELF.fetch(`${ORIGIN}/api/rooms`, {
      method: "POST",
      headers: { cookie },
    });
    expect(response.status).toBe(403);
  });

  it("picks another code when the first one is already in use", async () => {
    const { cookie } = await member("r-clash", "Asha");
    const rolls = [0, 0, 1].map((byte) => new Uint8Array(4).fill(byte));
    const app = createApp({
      google: () => {
        throw new Error("unused");
      },
      now: () => NOW,
      randomBytes: () => rolls.shift() ?? new Uint8Array(4).fill(2),
    });
    const create = async () => {
      const response = await app.fetch(
        new Request(`${ORIGIN}/api/rooms`, { method: "POST", headers: { cookie } }),
        env,
      );
      return ((await response.json()) as { code: string }).code;
    };
    expect(await create()).toBe("AAAA");
    expect(await create()).toBe("BBBB");
  });
});

describe("GET /api/rooms/:code", () => {
  it("says a code that was never created is not found", async () => {
    const { cookie } = await member("r-missing", "Asha");
    const response = await getRoom("KMPT", cookie);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Room not found" });
  });

  it("rejects a malformed code", async () => {
    const { cookie } = await member("r-malformed", "Asha");
    expect((await getRoom("OOOO", cookie)).status).toBe(400);
  });
});

describe("room WebSocket", () => {
  // A browser can't read the HTTP status of a failed WebSocket, so refusals arrive as
  // close codes on an accepted socket; that lets the client skip a separate existence check.
  it("refuses signed-out, pending and bad codes with close codes", async () => {
    const pending = await member("r-pending", "Pen", "pending");
    const ok = await member("r-ok", "Okay");
    const code = await createRoom(ok.cookie);
    expect(await refusedWith(code, "")).toBe(ROOM_CLOSE.signedOut);
    expect(await refusedWith(code, pending.cookie)).toBe(ROOM_CLOSE.notAllowed);
    expect(await refusedWith("OOOO", ok.cookie)).toBe(ROOM_CLOSE.notFound);
    expect((await wsRequest(code, ok.cookie, false)).status).toBe(426);
  });

  it("refuses a room that was never created as not found", async () => {
    const ok = await member("r-ws-missing", "Okay");
    expect(await refusedWith("ZZZZ", ok.cookie)).toBe(ROOM_CLOSE.notFound);
  });

  it("two members see each other join, then leave", async () => {
    const asha = await member("r-asha", "Asha");
    const ravi = await member("r-ravi", "Ravi");
    const code = await createRoom(asha.cookie);

    const a = await connect(code, asha.cookie);
    expect(playerNames(await a.next(snapshotWith(1)))).toEqual(["Asha"]);

    const b = await connect(code, ravi.cookie);
    expect(playerNames(await b.next(snapshotWith(2)))).toEqual(["Asha", "Ravi"]);
    expect(await a.next(snapshotWith(2))).toMatchObject({ type: "snapshot", room: { code } });

    b.send({ type: "leave" });
    expect(playerNames(await a.next(snapshotWith(1)))).toEqual(["Asha"]);
    a.ws.close(1000, "bye");
  });

  it("someone whose connection drops is away for a while, then gone", async () => {
    const asha = await member("r-away-a", "Asha");
    const ravi = await member("r-away-r", "Ravi");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const b = await connect(code, ravi.cookie);
    await a.next(snapshotWith(2));

    b.ws.close(1000);
    const away = await a.next(awaySnapshot);
    expect(away.type === "snapshot" && away.room.players).toEqual([
      expect.objectContaining({ name: "Asha", connected: true }),
      expect.objectContaining({ name: "Ravi", connected: false }),
    ]);

    // The room's alarm is the end of Ravi's grace.
    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    expect(playerNames(await a.next(snapshotWith(1)))).toEqual(["Asha"]);
    a.ws.close(1000);
  });

  it("someone who drops and comes back within the grace keeps their place", async () => {
    const asha = await member("r-back-a", "Asha");
    const ravi = await member("r-back-r", "Ravi");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const b = await connect(code, ravi.cookie);
    await a.next(snapshotWith(2));
    a.ws.close(1000);
    await b.next(awaySnapshot);

    const again = await connect(code, asha.cookie);
    const back = await again.next(
      (m) => m.type === "snapshot" && m.room.players.every((p) => p.connected),
    );
    expect(back.type === "snapshot" && back.room).toMatchObject({
      hostId: asha.user.id,
      players: [{ name: "Asha" }, { name: "Ravi" }],
    });
    for (const socket of [again, b]) socket.ws.close(1000);
  });

  it("the same member in two tabs counts as one player", async () => {
    const asha = await member("r-tabs", "Asha");
    const code = await createRoom(asha.cookie);
    const first = await connect(code, asha.cookie);
    await first.next(snapshotWith(1));
    const second = await connect(code, asha.cookie);
    expect(playerNames(await second.next(snapshotWith(1)))).toEqual(["Asha"]);
    second.ws.close(1000);
  });

  it("answers ping with pong and server time", async () => {
    const asha = await member("r-ping", "Asha");
    const a = await connect(await createRoom(asha.cookie), asha.cookie);
    a.ws.send(JSON.stringify({ type: "ping", t: 42 }));
    expect(await a.next((m) => m.type === "pong")).toMatchObject({ type: "pong", t: 42 });
    a.ws.close(1000);
  });

  it("replies to a malformed message with an error and keeps the socket open", async () => {
    const asha = await member("r-bad", "Asha");
    const a = await connect(await createRoom(asha.cookie), asha.cookie);
    a.ws.send("not json");
    expect(await a.next((m) => m.type === "error")).toEqual({
      type: "error",
      reason: "Message is not JSON",
    });
    a.ws.send(JSON.stringify({ type: "ping", t: 1 }));
    expect((await a.next((m) => m.type === "pong")).type).toBe("pong");
    a.ws.close(1000);
  });

  it("keeps names with non-Latin characters intact", async () => {
    const meera = await member("r-hindi", "मीरा");
    const a = await connect(await createRoom(meera.cookie), meera.cookie);
    expect(playerNames(await a.next(snapshotWith(1)))).toEqual(["मीरा"]);
    a.ws.close(1000);
  });
});

function hostOf(message: ServerMessage): string | undefined {
  return message.type === "snapshot" ? message.room.hostId : undefined;
}

describe("room host", () => {
  it("the creator is the host, and players are listed in the order they joined", async () => {
    const asha = await member("h-creator", "Asha");
    const ravi = await member("h-creator-2", "Ravi");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const b = await connect(code, ravi.cookie);
    const snapshot = await b.next(snapshotWith(2));
    expect(hostOf(snapshot)).toBe(asha.user.id);
    expect(snapshot.type === "snapshot" && snapshot.room.players.map((p) => p.name)).toEqual([
      "Asha",
      "Ravi",
    ]);
    a.ws.close(1000);
    b.ws.close(1000);
  });

  it("when the host leaves, the longest-seated player becomes host and keeps it", async () => {
    const asha = await member("h-leave-a", "Asha");
    const ravi = await member("h-leave-r", "Ravi");
    const meera = await member("h-leave-m", "Meera");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const r = await connect(code, ravi.cookie);
    await r.next(snapshotWith(2));
    const m = await connect(code, meera.cookie);
    await m.next(snapshotWith(3));
    await r.next(snapshotWith(3));

    a.send({ type: "leave" });
    expect(hostOf(await m.next(snapshotWith(2)))).toBe(ravi.user.id);

    const back = await connect(code, asha.cookie);
    expect(hostOf(await back.next(snapshotWith(3)))).toBe(ravi.user.id);
    for (const socket of [back, r, m]) socket.ws.close(1000);
  });

  it("a host who drops keeps host through the grace, then it passes on", async () => {
    const asha = await member("h-drop-a", "Asha");
    const ravi = await member("h-drop-r", "Ravi");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const r = await connect(code, ravi.cookie);
    await r.next(snapshotWith(2));

    a.ws.close(1000);
    expect(hostOf(await r.next(awaySnapshot))).toBe(asha.user.id);
    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    expect(hostOf(await r.next(snapshotWith(1)))).toBe(ravi.user.id);
    r.ws.close(1000);
  });

  it("if the creator never joins, the first player in becomes host", async () => {
    const asha = await member("h-absent-a", "Asha");
    const ravi = await member("h-absent-r", "Ravi");
    const code = await createRoom(asha.cookie);
    const r = await connect(code, ravi.cookie);
    expect(hostOf(await r.next(snapshotWith(1)))).toBe(ravi.user.id);
    r.ws.close(1000);
  });
});

describe("one device per player (Play here)", () => {
  it("a second device takes the seat and the first is told, then closed as replaced", async () => {
    const asha = await member("p-takeover", "Asha");
    const code = await createRoom(asha.cookie);
    const phone = await connect(code, asha.cookie);
    await phone.next(snapshotWith(1));

    const pc = await connect(code, asha.cookie);
    expect(playerNames(await pc.next(snapshotWith(1)))).toEqual(["Asha"]);
    expect(await phone.next((m) => m.type === "replaced")).toEqual({ type: "replaced" });
    expect(await phone.closed).toBe(ROOM_CLOSE.replaced);
    pc.ws.close(1000);
  });

  it("taking over keeps the host and the seating order", async () => {
    const asha = await member("p-order-a", "Asha");
    const ravi = await member("p-order-r", "Ravi");
    const code = await createRoom(asha.cookie);
    const a1 = await connect(code, asha.cookie);
    await a1.next(snapshotWith(1));
    const r = await connect(code, ravi.cookie);
    await r.next(snapshotWith(2));

    const a2 = await connect(code, asha.cookie);
    const seen = await a2.next(snapshotWith(2));
    expect(seen.type === "snapshot" && seen.room.hostId).toBe(asha.user.id);
    expect(seen.type === "snapshot" && seen.room.players.map((p) => p.name)).toEqual([
      "Asha",
      "Ravi",
    ]);
    expect(await a1.closed).toBe(ROOM_CLOSE.replaced);

    await settle();
    const fresh = await connect(code, ravi.cookie);
    const now = await fresh.next(snapshotWith(2));
    expect(now.type === "snapshot" && now.room.hostId).toBe(asha.user.id);
    expect(await r.closed).toBe(ROOM_CLOSE.replaced);
    fresh.ws.close(1000);
    a2.ws.close(1000);
  });

  it("Play here on the first device takes the seat back", async () => {
    const asha = await member("p-back", "Asha");
    const code = await createRoom(asha.cookie);
    const phone = await connect(code, asha.cookie);
    await phone.next(snapshotWith(1));
    const pc = await connect(code, asha.cookie);
    expect(await phone.closed).toBe(ROOM_CLOSE.replaced);

    const phoneAgain = await connect(code, asha.cookie);
    await phoneAgain.next(snapshotWith(1));
    expect(await pc.next((m) => m.type === "replaced")).toEqual({ type: "replaced" });
    expect(await pc.closed).toBe(ROOM_CLOSE.replaced);
    phoneAgain.ws.close(1000);
  });

  it("a replaced device closing doesn't start the room's close timer", async () => {
    const asha = await member("p-timer", "Asha");
    const code = await createRoom(asha.cookie);
    const phone = await connect(code, asha.cookie);
    await phone.next(snapshotWith(1));
    const pc = await connect(code, asha.cookie);
    await pc.next(snapshotWith(1));
    expect(await phone.closed).toBe(ROOM_CLOSE.replaced);
    await settle();

    expect(await runDurableObjectAlarm(roomStub(code))).toBe(false);
    expect((await getRoom(code, asha.cookie)).status).toBe(200);
    pc.ws.close(1000);
  });
});

describe("room lifetime", () => {
  it("a room nobody joins closes when its timer runs out", async () => {
    const asha = await member("r-unused", "Asha");
    const code = await createRoom(asha.cookie);
    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    expect((await getRoom(code, asha.cookie)).status).toBe(404);
  });

  it("closes once the last player has left and the timer runs out", async () => {
    const asha = await member("r-empty", "Asha");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    a.ws.close(1000);
    await settle();

    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    expect((await getRoom(code, asha.cookie)).status).toBe(404);
    expect(await refusedWith(code, asha.cookie)).toBe(ROOM_CLOSE.notFound);
  });

  it("joining cancels the close timer", async () => {
    const asha = await member("r-busy", "Asha");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));

    expect(await runDurableObjectAlarm(roomStub(code))).toBe(false);
    expect((await getRoom(code, asha.cookie)).status).toBe(200);
    a.ws.close(1000);
  });
});

describe("removing a player", () => {
  const remove = (socket: WebSocket, playerId: string) =>
    socket.send(JSON.stringify({ type: "remove", playerId }));

  it("the host removes a player: their socket closes, the rest are told, and they can't rejoin", async () => {
    const asha = await member("k-host", "Asha");
    const ravi = await member("k-target", "Ravi");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const r = await connect(code, ravi.cookie);
    await a.next(snapshotWith(2));

    remove(a.ws, ravi.user.id);
    const notice = { type: "removed", playerId: ravi.user.id, name: "Ravi" };
    // The removed player is told too, so their screen can stop without waiting on the close.
    expect(await r.next((m) => m.type === "removed")).toEqual(notice);
    expect(await r.closed).toBe(ROOM_CLOSE.removed);
    expect(await a.next((m) => m.type === "removed")).toEqual(notice);
    expect(playerNames(await a.next(snapshotWith(1)))).toEqual(["Asha"]);

    expect(await refusedWith(code, ravi.cookie)).toBe(ROOM_CLOSE.removed);
    a.ws.close(1000);
  });

  it("a removed player is refused on every device", async () => {
    const asha = await member("k-tabs-host", "Asha");
    const ravi = await member("k-tabs-target", "Ravi");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const r = await connect(code, ravi.cookie);
    await r.next(snapshotWith(2));

    remove(a.ws, ravi.user.id);
    expect(await r.closed).toBe(ROOM_CLOSE.removed);
    expect(await refusedWith(code, ravi.cookie)).toBe(ROOM_CLOSE.removed);
    expect(await refusedWith(code, ravi.cookie)).toBe(ROOM_CLOSE.removed);
    a.ws.close(1000);
  });

  it("refuses anyone who isn't host, and nobody leaves", async () => {
    const asha = await member("k-refuse-host", "Asha");
    const ravi = await member("k-refuse-r", "Ravi");
    const meera = await member("k-refuse-m", "Meera");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const r = await connect(code, ravi.cookie);
    await r.next(snapshotWith(2));
    const m = await connect(code, meera.cookie);
    await r.next(snapshotWith(3));

    remove(r.ws, meera.user.id);
    expect(await r.next((msg) => msg.type === "error")).toEqual({
      type: "error",
      reason: "You can't remove that player",
    });
    r.ws.send(JSON.stringify({ type: "ping", t: 1 }));
    await r.next((msg) => msg.type === "pong");
    expect(m.ws.readyState).toBe(WebSocket.OPEN);
    for (const socket of [a, r, m]) socket.ws.close(1000);
  });

  it("ignores a player who is no longer in the room", async () => {
    const asha = await member("k-gone-host", "Asha");
    const ravi = await member("k-gone-r", "Ravi");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));

    remove(a.ws, ravi.user.id);
    expect(await a.next((msg) => msg.type === "error")).toEqual({
      type: "error",
      reason: "That player isn't in the room",
    });
    expect((await connect(code, ravi.cookie)).ws.readyState).toBe(WebSocket.OPEN);
    a.ws.close(1000);
  });

  it("admins are regular people in a room: an admin who isn't host can't remove anyone, and the host can remove an admin (D59)", async () => {
    const asha = await member("k-admin-host", "Asha");
    const ravi = await member("k-admin-r", "Ravi");
    const boss = await member(ADMIN_SUB, "Boss");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie, adminAwareRequest);
    await a.next(snapshotWith(1));
    const r = await connect(code, ravi.cookie, adminAwareRequest);
    await r.next(snapshotWith(2));
    const b = await connect(code, boss.cookie, adminAwareRequest);
    const snapshot = await r.next(snapshotWith(3));
    expect(
      snapshot.type === "snapshot" && snapshot.room.players.map((p) => [p.name, p.isAdmin]),
    ).toEqual([
      ["Asha", false],
      ["Ravi", false],
      ["Boss", true],
    ]);

    remove(b.ws, asha.user.id);
    expect(await b.next((msg) => msg.type === "error")).toEqual({
      type: "error",
      reason: "You can't remove that player",
    });
    remove(b.ws, ravi.user.id);
    expect(await b.next((msg) => msg.type === "error")).toEqual({
      type: "error",
      reason: "You can't remove that player",
    });

    remove(a.ws, boss.user.id);
    expect(await b.closed).toBe(ROOM_CLOSE.removed);
    expect(hostOf(await r.next(snapshotWith(2)))).toBe(asha.user.id);
    for (const socket of [a, r]) socket.ws.close(1000);
  });
});
