import { DurableObject } from "cloudflare:workers";
import {
  ROOM_CLOSE,
  type RoomPlayer,
  type ServerMessage,
  canRemovePlayer,
  parseClientMessage,
} from "@playden/protocol";
import { roomEmptyCloseMs } from "../config";
import type { Env } from "../env";
import { refuseSocket } from "../http";

export const ROOM_HEADERS = {
  userId: "x-playden-user-id",
  userName: "x-playden-user-name",
  isAdmin: "x-playden-user-admin",
} as const;

interface RoomInfo {
  code: string;
  createdBy: string;
  createdAt: number;
}

interface Attachment {
  userId: string;
  name: string;
  isAdmin: boolean;
  joinedAt: number;
}

const INFO_KEY = "info";
const HOST_KEY = "host";
/** User ids removed by the host or an admin; refused until the room closes (D42). */
const REMOVED_KEY = "removed";

/**
 * One room. It exists only after `create`; it closes itself (all storage deleted) once it
 * has been empty for ROOM_EMPTY_CLOSE_MS (or its env override), after which its code reads as "not found".
 * The creator is host; when the host is not in the room, host passes to the player who
 * has been seated longest, and stays with them even if the old host comes back.
 * The host or an admin can remove a player, who then can't rejoin this room.
 * Each player holds their seat from one connection; opening the room elsewhere moves it there.
 */
export class Room extends DurableObject<Env> {
  /** Returns false when the code is already taken by a live room. */
  async create(code: string, createdBy: string, now: number): Promise<boolean> {
    if (await this.info()) return false;
    const info: RoomInfo = { code, createdBy, createdAt: now };
    await this.ctx.storage.put(INFO_KEY, info);
    await this.ctx.storage.setAlarm(now + this.closeAfterMs());
    return true;
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
    // One connection per player (D49): a new device or tab takes the seat from the old one,
    // keeping its place in the seating order.
    const previous = this.openSockets().filter((ws) => attachmentOf(ws).userId === userId);
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = {
      userId,
      name: decodeURIComponent(encodedName),
      isAdmin: request.headers.get(ROOM_HEADERS.isAdmin) === "1",
      joinedAt: Math.min(Date.now(), ...previous.map((ws) => attachmentOf(ws).joinedAt)),
    };
    server.serializeAttachment(attachment);
    this.replace(previous);

    await this.ctx.storage.deleteAlarm();
    await this.broadcastSnapshot(info, previous);
    return new Response(null, { status: 101, webSocket: client });
  }

  private replace(sockets: WebSocket[]): void {
    for (const ws of sockets) {
      // As with removal, the notice arrives at once; the close can be reported seconds later.
      this.send(ws, { type: "replaced" });
      try {
        ws.close(ROOM_CLOSE.replaced, "Playing on another device");
      } catch {
        // Already closing.
      }
    }
  }

  override async alarm(): Promise<void> {
    if (this.openSockets().length === 0) await this.ctx.storage.deleteAll();
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
    }
  }

  private async removePlayer(ws: WebSocket, playerId: string): Promise<void> {
    const info = await this.info();
    if (!info) return;
    const actor = attachmentOf(ws);
    const targetSockets = this.openSockets().filter((s) => attachmentOf(s).userId === playerId);
    const target = targetSockets[0];
    if (!target) {
      this.send(ws, { type: "error", reason: "That player isn't in the room" });
      return;
    }
    const { name, isAdmin } = attachmentOf(target);
    const hostId = await this.storedHostId(info);
    if (
      !canRemovePlayer(
        { id: actor.userId, isAdmin: actor.isAdmin },
        { id: playerId, isAdmin },
        hostId,
      )
    ) {
      this.send(ws, { type: "error", reason: "You can't remove that player" });
      return;
    }

    await this.ctx.storage.put(REMOVED_KEY, [...(await this.removedIds()), playerId]);
    // The removed player gets the notice too: a close can take seconds to be reported
    // (the client waits on the TCP teardown), the notice arrives at once.
    const notice: ServerMessage = { type: "removed", playerId, name };
    for (const socket of this.openSockets()) this.send(socket, notice);
    for (const socket of targetSockets) {
      try {
        socket.close(ROOM_CLOSE.removed, "Removed from this room");
      } catch {
        // Already closing.
      }
    }
    await this.broadcastSnapshot(info, targetSockets);
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed by the runtime.
    }
    await this.playerLeft(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.playerLeft(ws);
  }

  private async playerLeft(ws: WebSocket): Promise<void> {
    const info = await this.info();
    if (!info) return;
    await this.broadcastSnapshot(info, [ws]);
    if (this.openSockets([ws]).length === 0) {
      await this.ctx.storage.setAlarm(Date.now() + this.closeAfterMs());
    }
  }

  private closeAfterMs(): number {
    return roomEmptyCloseMs(this.env.ROOM_EMPTY_CLOSE_MS);
  }

  private info(): Promise<RoomInfo | undefined> {
    return this.ctx.storage.get<RoomInfo>(INFO_KEY);
  }

  private async removedIds(): Promise<string[]> {
    return (await this.ctx.storage.get<string[]>(REMOVED_KEY)) ?? [];
  }

  private async storedHostId(info: RoomInfo): Promise<string> {
    return (await this.ctx.storage.get<string>(HOST_KEY)) ?? info.createdBy;
  }

  private openSockets(exclude: WebSocket[] = []): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => !exclude.includes(ws) && ws.readyState === WebSocket.OPEN);
  }

  /** One entry per player, longest-seated first. */
  private seatedPlayers(sockets: WebSocket[]): (RoomPlayer & { joinedAt: number })[] {
    const players = new Map<string, RoomPlayer & { joinedAt: number }>();
    for (const ws of sockets) {
      const { userId, name, isAdmin, joinedAt } = attachmentOf(ws);
      const seen = players.get(userId);
      if (!seen || joinedAt < seen.joinedAt) {
        players.set(userId, { id: userId, name, connected: true, isAdmin, joinedAt });
      }
    }
    return [...players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  private async broadcastSnapshot(info: RoomInfo, exclude: WebSocket[] = []): Promise<void> {
    const sockets = this.openSockets(exclude);
    const seated = this.seatedPlayers(sockets);
    const first = seated[0];
    if (!first) return;

    let hostId = await this.storedHostId(info);
    if (!seated.some((player) => player.id === hostId)) {
      hostId = first.id;
      await this.ctx.storage.put(HOST_KEY, hostId);
    }

    const snapshot: ServerMessage = {
      type: "snapshot",
      room: {
        code: info.code,
        hostId,
        players: seated.map(({ id, name, connected, isAdmin }) => ({
          id,
          name,
          connected,
          isAdmin,
        })),
      },
    };
    for (const ws of sockets) this.send(ws, snapshot);
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
