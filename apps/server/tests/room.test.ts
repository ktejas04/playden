import { SELF, env, runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ROOM_CLOSE, type ServerMessage } from "@playden/protocol";
import { createApp } from "../src/app";
import { getDb } from "../src/db/client";
import { createSession } from "../src/db/sessions";
import { setProfile, setStatus, upsertGoogleUser } from "../src/db/users";

const db = getDb(env.DB);
const NOW = Date.now();
const ORIGIN = "https://playden.test";

async function member(sub: string, name: string, status: "approved" | "pending" = "approved") {
  const user = await upsertGoogleUser(db, {
    googleSub: sub,
    email: `${sub}@example.com`,
    isAdmin: false,
    now: NOW,
  });
  await setProfile(db, user.id, { displayName: name, invitedBy: "test" });
  if (status === "approved") await setStatus(db, user.id, "approved", NOW);
  const { token } = await createSession(db, user.id, NOW);
  return { user, cookie: `pd_session=${token}` };
}

async function createRoom(cookie: string): Promise<string> {
  const response = await SELF.fetch(`${ORIGIN}/api/rooms`, { method: "POST", headers: { cookie } });
  expect(response.status).toBe(200);
  return ((await response.json()) as { code: string }).code;
}

function getRoom(code: string, cookie: string) {
  return SELF.fetch(`${ORIGIN}/api/rooms/${code}`, { headers: { cookie } });
}

function roomStub(code: string) {
  return env.ROOM.get(env.ROOM.idFromName(code));
}

function wsRequest(code: string, cookie: string, upgrade = true) {
  return SELF.fetch(`${ORIGIN}/api/rooms/${code}/ws`, {
    headers: upgrade ? { upgrade: "websocket", cookie } : { cookie },
  });
}

async function connect(code: string, cookie: string) {
  const response = await wsRequest(code, cookie);
  const ws = response.webSocket;
  if (!ws) throw new Error(`No WebSocket (status ${response.status})`);
  ws.accept();
  const inbox: ServerMessage[] = [];
  ws.addEventListener("message", (event) => {
    inbox.push(JSON.parse(event.data as string) as ServerMessage);
  });

  async function next(match: (m: ServerMessage) => boolean): Promise<ServerMessage> {
    for (let i = 0; i < 100; i++) {
      const index = inbox.findIndex(match);
      if (index !== -1) return inbox.splice(index, 1)[0] as ServerMessage;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out; inbox: ${JSON.stringify(inbox)}`);
  }

  return { ws, next };
}

/** Opens a socket that the server is expected to refuse; returns its close code. */
async function refusedWith(code: string, cookie: string): Promise<number> {
  const response = await wsRequest(code, cookie);
  expect(response.status).toBe(101);
  const ws = response.webSocket;
  if (!ws) throw new Error("No WebSocket");
  const closed = new Promise<number>((resolve) => {
    ws.addEventListener("close", (event) => resolve(event.code));
  });
  ws.accept();
  return closed;
}

function playerNames(message: ServerMessage): string[] {
  return message.type === "snapshot" ? message.room.players.map((p) => p.name).sort() : [];
}

const snapshotWith = (count: number) => (m: ServerMessage) =>
  m.type === "snapshot" && m.room.players.length === count;

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

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

    b.ws.close(1000, "bye");
    expect(playerNames(await a.next(snapshotWith(1)))).toEqual(["Asha"]);
    a.ws.close(1000, "bye");
  });

  it("the same member in two tabs counts as one player", async () => {
    const asha = await member("r-tabs", "Asha");
    const code = await createRoom(asha.cookie);
    const first = await connect(code, asha.cookie);
    await first.next(snapshotWith(1));
    const second = await connect(code, asha.cookie);
    expect(playerNames(await second.next(snapshotWith(1)))).toEqual(["Asha"]);
    first.ws.close(1000);
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

    a.ws.close(1000);
    expect(hostOf(await m.next(snapshotWith(2)))).toBe(ravi.user.id);

    const back = await connect(code, asha.cookie);
    expect(hostOf(await back.next(snapshotWith(3)))).toBe(ravi.user.id);
    for (const socket of [back, r, m]) socket.ws.close(1000);
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
