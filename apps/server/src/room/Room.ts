import { DurableObject } from "cloudflare:workers";
import {
  type GameSession,
  ROOM_CLOSE,
  type ServerMessage,
  canRemovePlayer,
  inRunningGame,
  parseClientMessage,
} from "@playden/protocol";
import { AWAY_GRACE_MS, MOVE_LIMIT, roomEmptyCloseMs, startCountdownMs } from "../config";
import type { Env } from "../env";
import { refuseSocket } from "../http";
import { getDb } from "../db/client";
import { writeRecord } from "../db/gameRecords";
import { RecordWriter } from "./RecordWriter";
import { RoomTable } from "./RoomTable";
import { closingWrites, hostWrites, recordWrites } from "./gameRecords";
import { chooseHost } from "./host";
import {
  type Members,
  expiredIds,
  inGraceIds,
  inOrder,
  memberArrives,
  memberAway,
  memberGone,
  nextExpiry,
} from "./presence";
import { type Bucket, takeToken } from "./rateLimit";
import { gameOf, loadTable, tableDeadline } from "./tableSync";

export const ROOM_HEADERS = {
  userId: "x-playden-user-id",
  userName: "x-playden-user-name",
  isAdmin: "x-playden-user-admin",
} as const;

interface RoomInfo {
  code: string;
  createdBy: string;
  createdAt: number;
  /** This room's row in the D1 `rooms` table (D58); none for rooms from before records. */
  recordId?: string;
}

interface Attachment {
  userId: string;
  name: string;
  isAdmin: boolean;
}

const INFO_KEY = "info";
const HOST_KEY = "host";
/** Everyone in the room, connected or away (presence.ts). */
const MEMBERS_KEY = "members";
/** User ids the host removed; refused until the room closes (D42, D59). */
const REMOVED_KEY = "removed";

/**
 * One room. It exists only after `create`; it closes itself (all storage deleted) once it
 * has had no connection for ROOM_EMPTY_CLOSE_MS (or its env override), after which its code
 * reads as "not found".
 *
 * Members are stored: someone whose connection drops is away for AWAY_GRACE_MS, keeping their
 * place, host and seat; leaving on purpose (`leave`, removal) is gone at once (presence.ts).
 * The creator is host; when the host is gone, host passes on (host.ts: only to a player while
 * a game runs) and stays with the new host even if the old one comes back.
 * Only the host can remove someone (admins included, D59), who then can't rejoin this room; a
 * player seated in a running game is banned from it first.
 * Each player holds their seat from one connection; opening the room elsewhere moves it there.
 * The table (roomGame.ts) runs the room's game session; this object stores it, sends each
 * person their own view, and wakes it at its deadlines. One alarm serves the game's
 * deadlines, away expiries and the empty-room close.
 */
export class Room extends DurableObject<Env> {
  /** Sockets being closed by this object (replaced, removed or left); no longer in the room. */
  private readonly closing = new Set<WebSocket>();
  /** Each connection's move allowance (rateLimit.ts); forgotten if the object sleeps, which is fine. */
  private readonly moveBuckets = new WeakMap<WebSocket, Bucket>();
  /** Writes to the permanent record in D1 (D58), in order; game play never waits on them. */
  private readonly records = new RecordWriter((write) => writeRecord(getDb(this.env.DB), write));

  /** Returns false when the code is already taken by a live room. */
  async create(code: string, createdBy: string, now: number): Promise<boolean> {
    if (await this.info()) return false;
    const recordId = crypto.randomUUID();
    const info: RoomInfo = { code, createdBy, createdAt: now, recordId };
    await this.ctx.storage.put(INFO_KEY, info);
    await this.ctx.storage.setAlarm(now + this.closeAfterMs());
    this.records.add([{ kind: "roomOpened", roomId: recordId, code, createdBy, at: now }]);
    return true;
  }

  /** Resolves once this room's queued record writes are done (the close waits on it; so do tests). */
  async recordsSettled(): Promise<void> {
    await this.records.settled();
  }

  async exists(): Promise<boolean> {
    return (await this.info()) !== undefined;
  }

  override async fetch(request: Request): Promise<Response> {
    const info = await this.info();
    if (!info) return refuseSocket(ROOM_CLOSE.notFound, "Room not found");

    const userId = request.headers.get(ROOM_HEADERS.userId);
    const encodedName = request.headers.get(ROOM_HEADERS.userName);
    if (!userId || !encodedName) return new Response("Bad room request", { status: 400 });
    if ((await this.removedIds()).includes(userId)) {
      return refuseSocket(ROOM_CLOSE.removed, "Removed from this room");
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // One connection per player (D49): a new device or tab takes the seat from the old one.
    const previous = this.openSockets().filter((ws) => attachmentOf(ws).userId === userId);
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = {
      userId,
      name: decodeURIComponent(encodedName),
      isAdmin: request.headers.get(ROOM_HEADERS.isAdmin) === "1",
    };
    server.serializeAttachment(attachment);
    this.replace(previous);
    // A returning member keeps their place in the room (and any seat or host they still hold).
    const members = await this.members();
    const now = Date.now();
    await this.saveMembers(
      memberArrives(
        members,
        { id: userId, name: attachment.name, isAdmin: attachment.isAdmin },
        now,
      ),
    );
    // An arrival starts a visit; reconnecting within the grace is the same visit (D59).
    if (info.recordId && !(userId in members)) {
      this.records.add([{ kind: "memberJoined", roomId: info.recordId, userId, at: now }]);
    }

    await this.refresh(info, { broadcast: true });
    await this.table().welcome(server);
    await this.reschedule();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Closes sockets this object is done with; their close handlers then change nothing. */
  private closeAll(sockets: WebSocket[], code: number, reason: string): void {
    for (const ws of sockets) {
      this.closing.add(ws);
      try {
        ws.close(code, reason);
      } catch {
        // Already closing.
      }
    }
  }

  private replace(sockets: WebSocket[]): void {
    // As with removal, the notice arrives at once; the close can be reported seconds later.
    for (const ws of sockets) this.send(ws, { type: "replaced" });
    this.closeAll(sockets, ROOM_CLOSE.replaced, "Playing on another device");
  }

  override async alarm(): Promise<void> {
    if (this.openSockets().length === 0) {
      // With nobody connected, the only alarm set is the empty-room close.
      await this.recordClose();
      await this.ctx.storage.deleteAll();
      return;
    }
    const info = await this.info();
    if (!info) return;
    // The alarm was set for whichever came first; act on that one (a test may run it early).
    const table = await loadTable(this.ctx.storage);
    const deadline = tableDeadline(table);
    const expiry = await this.nextGraceEnd(info, table.session);
    if (deadline !== null && (expiry === null || deadline <= expiry)) {
      await this.table().deadlineReached();
    } else if (expiry !== null) {
      await this.refresh(info, { broadcast: true, now: Math.max(Date.now(), expiry) });
    }
    await this.reschedule();
  }

  /**
   * The room is about to delete itself: its record is closed first (a running game ends
   * early), and the close waits for the writes, since nothing runs after the delete.
   */
  private async recordClose(): Promise<void> {
    const info = await this.info();
    if (!info?.recordId) return;
    const table = await loadTable(this.ctx.storage);
    this.records.add(
      closingWrites(table, { roomId: info.recordId, now: Date.now(), game: gameOf(table) }),
    );
    await this.records.settled();
  }

  private table(): RoomTable {
    return new RoomTable({
      storage: this.ctx.storage,
      allowDevOnlyGames: this.env.DEV_LOGIN === "true",
      countdownMs: startCountdownMs(this.env.START_COUNTDOWN_MS),
      openSockets: () => this.openSockets(),
      personOf: (ws) => {
        const { userId, name } = attachmentOf(ws);
        return { id: userId, name };
      },
      presentIds: async () => {
        const members = await this.members();
        const connected = this.connectedSet();
        const grace = new Set(inGraceIds(members, Date.now(), AWAY_GRACE_MS));
        return inOrder(members)
          .filter((m) => connected.has(m.id) || grace.has(m.id))
          .map((m) => m.id);
      },
      hostId: async () => {
        const info = await this.info();
        return info ? this.storedHostId(info) : "";
      },
      send: (ws, message) => this.send(ws, message),
      recorded: async (before, after) => {
        const info = await this.info();
        if (!info?.recordId) return;
        const opens = after.session?.recordId !== before.session?.recordId;
        const hostId = opens ? await this.storedHostId(info) : null;
        this.records.add(
          recordWrites(before, after, {
            roomId: info.recordId,
            hostId,
            now: Date.now(),
            game: gameOf(after),
          }),
        );
      },
      changed: async () => {
        const info = await this.info();
        if (info) await this.refresh(info, { broadcast: false });
      },
      reschedule: () => this.reschedule(),
    });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      this.send(ws, { type: "error", reason: "Message is not text" });
      return;
    }
    const parsed = parseClientMessage(message);
    if (!parsed.ok) {
      this.send(ws, { type: "error", reason: parsed.reason });
      return;
    }
    switch (parsed.message.type) {
      case "ping":
        this.send(ws, { type: "pong", t: parsed.message.t, serverTime: Date.now() });
        break;
      case "remove":
        await this.removePlayer(ws, parsed.message.playerId);
        break;
      case "leave":
        await this.leave(ws);
        break;
      case "move": {
        const { ok, bucket } = takeToken(this.moveBuckets.get(ws), Date.now(), MOVE_LIMIT);
        this.moveBuckets.set(ws, bucket);
        // Too fast: dropped quietly (an error back would just be more messages).
        if (ok) await this.table().handle(ws, parsed.message);
        break;
      }
      default:
        await this.table().handle(ws, parsed.message);
    }
  }

  /** Leaving on purpose: out of the room and any game at once, with no away grace. */
  private async leave(ws: WebSocket): Promise<void> {
    const info = await this.info();
    if (!info) return;
    const { userId } = attachmentOf(ws);
    const sockets = this.openSockets().filter((s) => attachmentOf(s).userId === userId);
    this.closeAll(sockets, 1000, "Left the room");
    await this.gone(info, [userId], "left");
    await this.afterLastConnection();
  }

  private async removePlayer(ws: WebSocket, playerId: string): Promise<void> {
    const info = await this.info();
    if (!info) return;
    const actor = attachmentOf(ws);
    const target = (await this.members())[playerId];
    if (!target) {
      this.send(ws, { type: "error", reason: "That player isn't in the room" });
      return;
    }
    const hostId = await this.storedHostId(info);
    if (!canRemovePlayer(actor.userId, playerId, hostId)) {
      this.send(ws, { type: "error", reason: "You can't remove that player" });
      return;
    }
    if (inRunningGame((await loadTable(this.ctx.storage)).session, playerId)) {
      this.send(ws, { type: "error", reason: "They're playing. Ban them from the game first" });
      return;
    }

    await this.ctx.storage.put(REMOVED_KEY, [...(await this.removedIds()), playerId]);
    // The removed player gets the notice too: a close can take seconds to be reported
    // (the client waits on the TCP teardown), the notice arrives at once.
    const notice: ServerMessage = { type: "removed", playerId, name: target.name };
    for (const socket of this.openSockets()) this.send(socket, notice);
    const targetSockets = this.openSockets().filter((s) => attachmentOf(s).userId === playerId);
    this.closeAll(targetSockets, ROOM_CLOSE.removed, "Removed from this room");
    await this.gone(info, [playerId], "removed");
  }

  /** Records people leaving the room for good (D59); drops within the grace never get here. */
  private recordDepartures(
    info: RoomInfo,
    ids: string[],
    reason: "left" | "removed" | "timed_out",
  ): void {
    const roomId = info.recordId;
    if (!roomId) return;
    const at = Date.now();
    this.records.add(ids.map((userId) => ({ kind: "memberLeft", roomId, userId, at, reason })));
  }

  /** People who are gone for good: out of the member list and out of any game. */
  private async gone(info: RoomInfo, ids: string[], reason: "left" | "removed"): Promise<void> {
    let members = await this.members();
    for (const id of ids) members = memberGone(members, id);
    await this.saveMembers(members);
    this.recordDepartures(info, ids, reason);
    for (const id of ids) await this.table().memberRemoved(id);
    await this.refresh(info, { broadcast: true });
    await this.reschedule();
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed by the runtime.
    }
    await this.connectionDropped(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.connectionDropped(ws);
  }

  /** A connection ended. Unless this object closed it on purpose, its member is now away. */
  private async connectionDropped(ws: WebSocket): Promise<void> {
    const onPurpose = this.closing.has(ws);
    this.closing.add(ws);
    const info = await this.info();
    if (!info) return;
    const { userId } = attachmentOf(ws);
    const stillHere = this.openSockets().some((s) => attachmentOf(s).userId === userId);
    if (!onPurpose && !stillHere) {
      await this.saveMembers(memberAway(await this.members(), userId, Date.now()));
      await this.refresh(info, { broadcast: true });
    }
    await this.afterLastConnection();
    await this.reschedule();
  }

  /** With no connection left, the room's alarm becomes its close timer. */
  private async afterLastConnection(): Promise<void> {
    if (this.openSockets().length === 0) {
      await this.ctx.storage.setAlarm(Date.now() + this.closeAfterMs());
    }
  }

  /**
   * While anyone is connected, the alarm is the earlier of the game's next deadline and the
   * next away member's grace running out (or none). With nobody connected it stays the close
   * timer.
   */
  private async reschedule(): Promise<void> {
    if (this.openSockets().length === 0) return;
    const table = await loadTable(this.ctx.storage);
    const info = await this.info();
    const times = [
      tableDeadline(table),
      info ? await this.nextGraceEnd(info, table.session) : null,
    ].filter((t): t is number => t !== null);
    if (times.length === 0) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.min(...times));
  }

  /**
   * The next time someone's away grace runs out: a member who'd then be gone, or the host,
   * who passes host on after the grace even while a running game holds their seat. A host
   * grace already over (nobody to pass host to yet) waits for the next connection instead.
   */
  private async nextGraceEnd(info: RoomInfo, session: GameSession | null): Promise<number | null> {
    const members = await this.members();
    const host = members[await this.storedHostId(info)];
    const hostEnd =
      host?.awayAt != null && host.awayAt + AWAY_GRACE_MS > Date.now()
        ? host.awayAt + AWAY_GRACE_MS
        : null;
    const times = [nextExpiry(members, session, AWAY_GRACE_MS), hostEnd].filter(
      (t): t is number => t !== null,
    );
    return times.length === 0 ? null : Math.min(...times);
  }

  private closeAfterMs(): number {
    return roomEmptyCloseMs(this.env.ROOM_EMPTY_CLOSE_MS);
  }

  private info(): Promise<RoomInfo | undefined> {
    return this.ctx.storage.get<RoomInfo>(INFO_KEY);
  }

  private async members(): Promise<Members> {
    return (await this.ctx.storage.get<Members>(MEMBERS_KEY)) ?? {};
  }

  private async saveMembers(members: Members): Promise<void> {
    await this.ctx.storage.put(MEMBERS_KEY, members);
  }

  private async removedIds(): Promise<string[]> {
    return (await this.ctx.storage.get<string[]>(REMOVED_KEY)) ?? [];
  }

  private async storedHostId(info: RoomInfo): Promise<string> {
    return (await this.ctx.storage.get<string>(HOST_KEY)) ?? info.createdBy;
  }

  private openSockets(): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => !this.closing.has(ws) && ws.readyState === WebSocket.OPEN);
  }

  /** Ids with a live connection. */
  private connectedSet(): Set<string> {
    return new Set(this.openSockets().map((ws) => attachmentOf(ws).userId));
  }

  /**
   * Brings the room up to date after anyone comes, goes or changes role: members whose away
   * grace has run out are gone (and out of any game), a finished game with none of its
   * players left closes, host is re-checked (host.ts), and the snapshot goes out when asked
   * or when host changed. In setup the host always plays, so a new host is seated.
   */
  private async refresh(
    info: RoomInfo,
    { broadcast, now = Date.now() }: { broadcast: boolean; now?: number },
  ): Promise<void> {
    const { session } = await loadTable(this.ctx.storage);
    let members = await this.members();
    const expired = expiredIds(members, session, now, AWAY_GRACE_MS);
    if (expired.length > 0) {
      for (const id of expired) members = memberGone(members, id);
      await this.saveMembers(members);
      // Each removal re-runs this (through the table's change), with the expired already gone.
      // Grace ran out: nobody holding a seat mid-game expires, so this never frees one.
      this.recordDepartures(info, expired, "timed_out");
      for (const id of expired) await this.table().memberRemoved(id);
    }

    const connected = this.connectedSet();
    const ordered = inOrder(members);
    const connectedIds = ordered.filter((m) => connected.has(m.id)).map((m) => m.id);
    const graceIds = inGraceIds(members, now, AWAY_GRACE_MS);
    if (connectedIds.length === 0) return;

    // Results with none of the game's players left: back to idle (its change re-runs this).
    await this.table().closeIfNoPlayers([...connectedIds, ...graceIds]);
    const current = await this.storedHostId(info);
    const latest = (await loadTable(this.ctx.storage)).session;
    const hostId = chooseHost({ current, connectedIds, graceIds, session: latest });
    if (hostId !== current) {
      await this.ctx.storage.put(HOST_KEY, hostId);
      if (info.recordId) this.records.add(hostWrites(latest, hostId));
    }

    if (broadcast || hostId !== current) {
      const snapshot: ServerMessage = {
        type: "snapshot",
        room: {
          code: info.code,
          hostId,
          players: ordered.map(({ id, name, isAdmin }) => ({
            id,
            name,
            connected: connected.has(id),
            isAdmin,
          })),
        },
      };
      for (const ws of this.openSockets()) this.send(ws, snapshot);
    }

    const host = members[hostId];
    if (host && connected.has(hostId)) await this.table().hostPlays(host);
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Socket closed between listing and sending; the close handler rebroadcasts.
    }
  }
}

function attachmentOf(ws: WebSocket): Attachment {
  return ws.deserializeAttachment() as Attachment;
}
