import { env, runDurableObjectAlarm } from "cloudflare:test";
import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { GameSession, ServerMessage } from "@playden/protocol";
import { getDb } from "../src/db/client";
import { gameParticipants, games, roomMembers, rooms } from "../src/db/schema";
import {
  awaySnapshot,
  connect,
  createRoom,
  member,
  roomStub,
  settle,
  snapshotWith,
} from "./roomKit";

/** The permanent record in D1 (D58), written by real rooms playing Tap Race. */

const db = getDb(env.DB);
const phaseIs = (phase: GameSession["phase"]) => (m: ServerMessage) =>
  m.type === "game.status" && m.session?.phase === phase;

async function roomRow(code: string) {
  await roomStub(code).recordsSettled();
  const [row] = await db.select().from(rooms).where(eq(rooms.code, code));
  if (!row) throw new Error(`No rooms row for ${code}`);
  return row;
}

/** Each person's visits to the room, oldest first. */
async function visitsIn(code: string) {
  const room = await roomRow(code);
  const rows = await db
    .select()
    .from(roomMembers)
    .where(eq(roomMembers.roomId, room.id))
    .orderBy(asc(roomMembers.id));
  const byPerson: Record<string, (typeof rows)[number][]> = {};
  for (const row of rows) (byPerson[row.userId] ??= []).push(row);
  return byPerson;
}

/** Each person's latest visit. */
async function memberRows(code: string) {
  const visits = await visitsIn(code);
  return Object.fromEntries(Object.entries(visits).map(([id, rows]) => [id, rows.at(-1)]));
}

async function gameRows(roomId: string) {
  return db.select().from(games).where(eq(games.roomId, roomId)).orderBy(asc(games.createdAt));
}

describe("the record of rooms and games in D1", () => {
  it("creating a room records it as open", async () => {
    const asha = await member("rec-room", "Asha");
    const code = await createRoom(asha.cookie);
    expect(await roomRow(code)).toMatchObject({ code, createdBy: asha.user.id, closedAt: null });
  });

  it("a finished game is recorded with its result, players and summary; Play again opens the next", async () => {
    const asha = await member("rec-a", "Asha");
    const ben = await member("rec-b", "Ben");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const b = await connect(code, ben.cookie);
    await b.next(snapshotWith(2));

    a.send({ type: "game.pick", gameId: "tap-race" });
    await b.next(phaseIs("setup"));
    b.send({ type: "game.join" });
    await a.next((m) => m.type === "game.status" && m.session?.players.length === 2);
    a.send({ type: "game.setConfig", config: { targetTaps: 5, roundSeconds: 60 } });
    await b.next(
      (m) =>
        m.type === "game.status" &&
        (m.session?.config as { targetTaps?: number } | undefined)?.targetTaps === 5,
    );

    const room = await roomRow(code);
    const [opened] = await gameRows(room.id);
    expect(opened).toMatchObject({
      gameType: "tap-race",
      status: "setup",
      isActive: true,
      hostId: asha.user.id,
    });

    a.send({ type: "game.start" });
    await b.next(phaseIs("playing"));
    for (let i = 0; i < 5; i++) b.send({ type: "move", move: { type: "tap" } });
    await a.next(phaseIs("results"));
    await roomStub(code).recordsSettled();

    const [finished] = await gameRows(room.id);
    expect(finished).toMatchObject({
      status: "finished",
      isActive: true,
      winningTeam: 1,
      config: { targetTaps: 5, roundSeconds: 60 },
      summary: { counts: [0, 5], target: 5, winningTeam: 1 },
    });
    expect(finished?.startedAt).not.toBeNull();
    expect(finished?.endedAt).not.toBeNull();

    const players = await db
      .select()
      .from(gameParticipants)
      .where(eq(gameParticipants.gameId, finished?.id ?? ""))
      .orderBy(asc(gameParticipants.team));
    expect(players).toEqual([
      expect.objectContaining({ userId: asha.user.id, role: "player", team: 0, score: 0 }),
      expect.objectContaining({ userId: ben.user.id, role: "player", team: 1, score: 5 }),
    ]);

    a.send({ type: "game.playAgain" });
    await b.next(phaseIs("setup"));
    await roomStub(code).recordsSettled();
    const both = await gameRows(room.id);
    expect(both.map((g) => [g.status, g.isActive])).toEqual([
      ["finished", false],
      ["setup", true],
    ]);

    a.ws.close(1000);
    b.ws.close(1000);
  });

  it("when host passes on, host_id follows and created_by stays", async () => {
    const asha = await member("rec-host-a", "Asha");
    const ben = await member("rec-host-b", "Ben");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const b = await connect(code, ben.cookie);
    await b.next(snapshotWith(2));
    a.send({ type: "game.pick", gameId: "tap-race" });
    await b.next(phaseIs("setup"));
    b.send({ type: "game.join" });
    await b.next((m) => m.type === "game.status" && m.session?.players.length === 2);

    // Leaving on purpose passes host at once (D40).
    a.send({ type: "leave" });
    await b.next((m) => m.type === "snapshot" && m.room.hostId === ben.user.id);
    const room = await roomRow(code);
    const [game] = await gameRows(room.id);
    expect(game).toMatchObject({ createdBy: asha.user.id, hostId: ben.user.id, isActive: true });
    b.ws.close(1000);
  });

  it("closing a room mid-game ends the game early, deactivates it and closes the room", async () => {
    const asha = await member("rec-close-a", "Asha");
    const ben = await member("rec-close-b", "Ben");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const b = await connect(code, ben.cookie);
    await b.next(snapshotWith(2));
    a.send({ type: "game.pick", gameId: "tap-race" });
    await b.next(phaseIs("setup"));
    b.send({ type: "game.join" });
    await a.next((m) => m.type === "game.status" && m.session?.players.length === 2);
    a.send({ type: "game.start" });
    await b.next(phaseIs("playing"));

    a.ws.close(1000);
    b.ws.close(1000);
    await settle();
    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);

    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    expect(room?.closedAt).not.toBeNull();
    const [game] = await gameRows(room?.id ?? "");
    expect(game).toMatchObject({ status: "ended_early", isActive: false, winningTeam: null });
    // Both still held their seats (away), so they were listed until the room closed.
    const rows = await db
      .select()
      .from(roomMembers)
      .where(eq(roomMembers.roomId, room?.id ?? ""));
    expect(Object.fromEntries(rows.map((r) => [r.userId, r.leaveReason]))).toEqual({
      [asha.user.id]: "room_closed",
      [ben.user.id]: "room_closed",
    });
  });
});

describe("the record of who was in a room (D59)", () => {
  it("an arrival opens a visit; a drop and reconnect is the same visit; leaving and coming back keep the old visit and open a new one", async () => {
    const asha = await member("rm-a", "Asha");
    const ben = await member("rm-b", "Ben");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    let b = await connect(code, ben.cookie);
    await a.next(snapshotWith(2));
    const [first] = (await visitsIn(code))[ben.user.id] ?? [];
    expect(first).toMatchObject({ leftAt: null, leaveReason: null });

    b.ws.close(1000);
    await a.next(awaySnapshot);
    b = await connect(code, ben.cookie);
    await a.next((m) => m.type === "snapshot" && m.room.players.every((p) => p.connected));
    expect((await visitsIn(code))[ben.user.id]).toEqual([first]);

    b.send({ type: "leave" });
    await a.next(snapshotWith(1));
    expect((await visitsIn(code))[ben.user.id]).toEqual([
      expect.objectContaining({ id: first?.id, leaveReason: "left" }),
    ]);

    b = await connect(code, ben.cookie);
    await a.next(snapshotWith(2));
    const visits = (await visitsIn(code))[ben.user.id] ?? [];
    expect(visits).toEqual([
      expect.objectContaining({ id: first?.id, joinedAt: first?.joinedAt, leaveReason: "left" }),
      expect.objectContaining({ leftAt: null, leaveReason: null }),
    ]);
    expect(visits[1]?.joinedAt).toBeGreaterThanOrEqual(visits[0]?.leftAt ?? Infinity);
    a.ws.close(1000);
    b.ws.close(1000);
  });

  it("each visit keeps its own reason: timed out, then left, then still here", async () => {
    const asha = await member("rm-v-a", "Asha");
    const ben = await member("rm-v-b", "Ben");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    let b = await connect(code, ben.cookie);
    await a.next(snapshotWith(2));

    b.ws.close(1000);
    await a.next(awaySnapshot);
    // The room's alarm is the end of Ben's grace.
    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    await a.next(snapshotWith(1));

    b = await connect(code, ben.cookie);
    await a.next(snapshotWith(2));
    b.send({ type: "leave" });
    await a.next(snapshotWith(1));
    b = await connect(code, ben.cookie);
    await a.next(snapshotWith(2));

    const visits = (await visitsIn(code))[ben.user.id] ?? [];
    expect(visits.map((v) => v.leaveReason)).toEqual(["timed_out", "left", null]);
    expect(visits.filter((v) => v.leftAt === null)).toHaveLength(1);
    expect((await visitsIn(code))[asha.user.id]).toHaveLength(1);
    a.ws.close(1000);
    b.ws.close(1000);
  });

  it("records removal by the host, and a drop past the grace as timed_out", async () => {
    const asha = await member("rm-rem-a", "Asha");
    const ben = await member("rm-rem-b", "Ben");
    const chi = await member("rm-rem-c", "Chi");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const b = await connect(code, ben.cookie);
    await a.next(snapshotWith(2));
    const c = await connect(code, chi.cookie);
    await a.next(snapshotWith(3));

    a.send({ type: "remove", playerId: ben.user.id });
    await a.next(snapshotWith(2));
    c.ws.close(1000);
    await a.next(awaySnapshot);
    // The room's alarm is the end of Chi's grace.
    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    await a.next(snapshotWith(1));

    const rows = await memberRows(code);
    expect(rows[ben.user.id]).toMatchObject({ leaveReason: "removed" });
    expect(rows[chi.user.id]).toMatchObject({ leaveReason: "timed_out" });
    expect(rows[asha.user.id]).toMatchObject({ leaveReason: null });
    expect(b.ws.readyState).not.toBe(WebSocket.OPEN);
    a.ws.close(1000);
  });

  it("mid-game the host can't remove a seated player (ban first) but can remove a spectator", async () => {
    const asha = await member("rm-game-a", "Asha");
    const ben = await member("rm-game-b", "Ben");
    const chi = await member("rm-game-c", "Chi");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const b = await connect(code, ben.cookie);
    await a.next(snapshotWith(2));
    const c = await connect(code, chi.cookie);
    await a.next(snapshotWith(3));
    a.send({ type: "game.pick", gameId: "tap-race" });
    await b.next(phaseIs("setup"));
    b.send({ type: "game.join" });
    c.send({ type: "game.spectate" });
    await a.next(
      (m) =>
        m.type === "game.status" &&
        m.session?.players.length === 2 &&
        m.session.spectators.length === 1,
    );
    a.send({ type: "game.start" });
    await b.next(phaseIs("playing"));

    a.send({ type: "remove", playerId: ben.user.id });
    expect(await a.next((m) => m.type === "error")).toEqual({
      type: "error",
      reason: "They're playing. Ban them from the game first",
    });
    expect(b.ws.readyState).toBe(WebSocket.OPEN);

    a.send({ type: "remove", playerId: chi.user.id });
    await a.next(snapshotWith(2));
    const rows = await memberRows(code);
    expect(rows[chi.user.id]).toMatchObject({ leaveReason: "removed" });
    expect(rows[ben.user.id]).toMatchObject({ leaveReason: null });

    const room = await roomRow(code);
    const [game] = await gameRows(room.id);
    const people = await db
      .select()
      .from(gameParticipants)
      .where(eq(gameParticipants.gameId, game?.id ?? ""));
    // Chi stays in the game's record as the spectator they were; the room records the removal.
    expect(people.find((p) => p.userId === chi.user.id)).toMatchObject({
      role: "spectator",
      leaveReason: null,
    });
    a.ws.close(1000);
    b.ws.close(1000);
  });

  it("mid-game, an away spectator and someone just in the room time out; an away player keeps their seat", async () => {
    const asha = await member("rm-mid-a", "Asha");
    const ben = await member("rm-mid-b", "Ben");
    const chi = await member("rm-mid-c", "Chi");
    const dev = await member("rm-mid-d", "Dev");
    const code = await createRoom(asha.cookie);
    const a = await connect(code, asha.cookie);
    await a.next(snapshotWith(1));
    const b = await connect(code, ben.cookie);
    await a.next(snapshotWith(2));
    const c = await connect(code, chi.cookie);
    await a.next(snapshotWith(3));
    const d = await connect(code, dev.cookie);
    await a.next(snapshotWith(4));

    // Asha (host) and Ben play, Chi spectates, Dev is only in the room. The round outlasts the grace.
    a.send({ type: "game.pick", gameId: "tap-race" });
    await b.next(phaseIs("setup"));
    b.send({ type: "game.join" });
    c.send({ type: "game.spectate" });
    await a.next(
      (m) =>
        m.type === "game.status" &&
        m.session?.players.length === 2 &&
        m.session.spectators.length === 1,
    );
    a.send({ type: "game.setConfig", config: { targetTaps: 50, roundSeconds: 120 } });
    await a.next(
      (m) =>
        m.type === "game.status" &&
        (m.session?.config as { roundSeconds?: number } | undefined)?.roundSeconds === 120,
    );
    a.send({ type: "game.start" });
    await b.next(phaseIs("playing"));

    for (const socket of [b, c, d]) socket.ws.close(1000);
    await a.next(
      (m) => m.type === "snapshot" && m.room.players.filter((p) => !p.connected).length === 3,
    );
    // Each alarm is the next grace to run out; the game's own deadline is later.
    for (let i = 0; i < 2; i++) {
      const rows = await memberRows(code);
      if (rows[chi.user.id]?.leftAt && rows[dev.user.id]?.leftAt) break;
      expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    }

    const rows = await memberRows(code);
    expect(rows[chi.user.id]).toMatchObject({ leaveReason: "timed_out" });
    expect(rows[dev.user.id]).toMatchObject({ leaveReason: "timed_out" });
    expect(rows[ben.user.id]).toMatchObject({ leftAt: null, leaveReason: null });
    const roomNow = await a.next(snapshotWith(2));
    expect(
      roomNow.type === "snapshot" && roomNow.room.players.map((p) => [p.name, p.connected]),
    ).toEqual([
      ["Asha", true],
      ["Ben", false],
    ]);

    // Ben comes back to his seat, mid-game, in the same visit.
    const back = await connect(code, ben.cookie);
    expect(await back.next((m) => m.type === "game.view")).toMatchObject({
      view: { role: "player" },
    });
    expect((await visitsIn(code))[ben.user.id]).toHaveLength(1);
    a.ws.close(1000);
    back.ws.close(1000);
  });
});
