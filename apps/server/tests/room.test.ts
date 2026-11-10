import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "@playden/protocol";
import { getDb } from "../src/db/client";
import { createSession } from "../src/db/sessions";
import { setProfile, setStatus, upsertGoogleUser } from "../src/db/users";

const db = getDb(env.DB);
const NOW = Date.now();

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

function wsRequest(code: string, cookie: string, upgrade = true) {
  return SELF.fetch(`https://playden.test/api/rooms/${code}/ws`, {
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

function playerNames(message: ServerMessage): string[] {
  return message.type === "snapshot" ? message.room.players.map((p) => p.name).sort() : [];
}

const snapshotWith = (count: number) => (m: ServerMessage) =>
  m.type === "snapshot" && m.room.players.length === count;

describe("POST /api/rooms", () => {
  it("returns a room code for approved members", async () => {
    const { cookie } = await member("r-create", "Asha");
    const response = await SELF.fetch("https://playden.test/api/rooms", {
      method: "POST",
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    const { code } = (await response.json()) as { code: string };
    expect(code).toMatch(/^[A-Z]{4}$/);
  });

  it("returns 403 for pending members", async () => {
    const { cookie } = await member("r-create-pending", "Ravi", "pending");
    const response = await SELF.fetch("https://playden.test/api/rooms", {
      method: "POST",
      headers: { cookie },
    });
    expect(response.status).toBe(403);
  });
});

describe("room WebSocket", () => {
  it("rejects signed-out, pending, bad codes and non-upgrade requests", async () => {
    const pending = await member("r-pending", "Pen", "pending");
    const ok = await member("r-ok", "Okay");
    expect((await wsRequest("ABCD", "")).status).toBe(401);
    expect((await wsRequest("ABCD", pending.cookie)).status).toBe(403);
    expect((await wsRequest("OOOO", ok.cookie)).status).toBe(400);
    expect((await wsRequest("ABCD", ok.cookie, false)).status).toBe(426);
  });

  it("two members see each other join, then leave", async () => {
    const asha = await member("r-asha", "Asha");
    const ravi = await member("r-ravi", "Ravi");

    const a = await connect("BCDE", asha.cookie);
    expect(playerNames(await a.next(snapshotWith(1)))).toEqual(["Asha"]);

    const b = await connect("BCDE", ravi.cookie);
    expect(playerNames(await b.next(snapshotWith(2)))).toEqual(["Asha", "Ravi"]);
    const seenByA = await a.next(snapshotWith(2));
    expect(seenByA).toMatchObject({ type: "snapshot", room: { code: "BCDE" } });

    b.ws.close(1000, "bye");
    expect(playerNames(await a.next(snapshotWith(1)))).toEqual(["Asha"]);
    a.ws.close(1000, "bye");
  });

  it("the same member in two tabs counts as one player", async () => {
    const asha = await member("r-tabs", "Asha");
    const first = await connect("CDEF", asha.cookie);
    await first.next(snapshotWith(1));
    const second = await connect("CDEF", asha.cookie);
    expect(playerNames(await second.next(snapshotWith(1)))).toEqual(["Asha"]);
    first.ws.close(1000);
    second.ws.close(1000);
  });

  it("answers ping with pong and server time", async () => {
    const asha = await member("r-ping", "Asha");
    const a = await connect("DEFG", asha.cookie);
    a.ws.send(JSON.stringify({ type: "ping", t: 42 }));
    const pong = await a.next((m) => m.type === "pong");
    expect(pong).toMatchObject({ type: "pong", t: 42 });
    a.ws.close(1000);
  });

  it("replies to a malformed message with an error and keeps the socket open", async () => {
    const asha = await member("r-bad", "Asha");
    const a = await connect("EFGH", asha.cookie);
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
    const a = await connect("FGHJ", meera.cookie);
    expect(playerNames(await a.next(snapshotWith(1)))).toEqual(["मीरा"]);
    a.ws.close(1000);
  });
});
