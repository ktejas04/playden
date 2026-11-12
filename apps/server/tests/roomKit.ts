import { SELF, env } from "cloudflare:test";
import { expect } from "vitest";
import type { ServerMessage } from "@playden/protocol";
import { getDb } from "../src/db/client";
import { createSession } from "../src/db/sessions";
import { setProfile, setStatus, upsertGoogleUser } from "../src/db/users";

/** Shared helpers for tests that talk to rooms over real WebSockets. */

const db = getDb(env.DB);
export const NOW = Date.now();
export const ORIGIN = "https://playden.test";

export async function member(
  sub: string,
  name: string,
  status: "approved" | "pending" = "approved",
) {
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

export async function createRoom(cookie: string): Promise<string> {
  const response = await SELF.fetch(`${ORIGIN}/api/rooms`, { method: "POST", headers: { cookie } });
  expect(response.status).toBe(200);
  return ((await response.json()) as { code: string }).code;
}

export function getRoom(code: string, cookie: string) {
  return SELF.fetch(`${ORIGIN}/api/rooms/${code}`, { headers: { cookie } });
}

export function roomStub(code: string) {
  return env.ROOM.get(env.ROOM.idFromName(code));
}

export function wsRequest(code: string, cookie: string, upgrade = true) {
  return SELF.fetch(`${ORIGIN}/api/rooms/${code}/ws`, {
    headers: upgrade ? { upgrade: "websocket", cookie } : { cookie },
  });
}

export async function connect(code: string, cookie: string, request = wsRequest) {
  const response = await request(code, cookie);
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

  const send = (message: unknown) => ws.send(JSON.stringify(message));

  const closed = new Promise<number>((resolve) => {
    ws.addEventListener("close", (event) => resolve(event.code));
  });

  return { ws, next, send, inbox, closed };
}

/** Opens a socket that the server is expected to refuse; returns its close code. */
export async function refusedWith(code: string, cookie: string): Promise<number> {
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

export function playerNames(message: ServerMessage): string[] {
  return message.type === "snapshot" ? message.room.players.map((p) => p.name).sort() : [];
}

export const snapshotWith = (count: number) => (m: ServerMessage) =>
  m.type === "snapshot" && m.room.players.length === count;

export const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

/** A snapshot in which someone is away (their connection dropped). */
export const awaySnapshot = (m: ServerMessage) =>
  m.type === "snapshot" && m.room.players.some((p) => !p.connected);
