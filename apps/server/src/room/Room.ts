import { DurableObject } from "cloudflare:workers";
import { type RoomPlayer, type ServerMessage, parseClientMessage } from "@playden/protocol";
import { ROOM_EMPTY_CLOSE_MS } from "../config";
import type { Env } from "../env";

export const ROOM_HEADERS = {
  userId: "x-playden-user-id",
  userName: "x-playden-user-name",
} as const;

interface RoomInfo {
  code: string;
  createdBy: string;
  createdAt: number;
}

interface Attachment {
  userId: string;
  name: string;
}

const INFO_KEY = "info";

/**
 * One room. It exists only after `create`; it closes itself (all storage deleted) once it
 * has been empty for ROOM_EMPTY_CLOSE_MS, after which its code reads as "not found".
 */
export class Room extends DurableObject<Env> {
  /** Returns false when the code is already taken by a live room. */
  async create(code: string, createdBy: string, now: number): Promise<boolean> {
    if (await this.info()) return false;
    const info: RoomInfo = { code, createdBy, createdAt: now };
    await this.ctx.storage.put(INFO_KEY, info);
    await this.ctx.storage.setAlarm(now + ROOM_EMPTY_CLOSE_MS);
    return true;
  }

  async exists(): Promise<boolean> {
    return (await this.info()) !== undefined;
  }

  override async fetch(request: Request): Promise<Response> {
    const info = await this.info();
    if (!info) return new Response("Room not found", { status: 404 });

    const userId = request.headers.get(ROOM_HEADERS.userId);
    const encodedName = request.headers.get(ROOM_HEADERS.userName);
    if (!userId || !encodedName) return new Response("Bad room request", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = { userId, name: decodeURIComponent(encodedName) };
    server.serializeAttachment(attachment);

    await this.ctx.storage.deleteAlarm();
    this.broadcastSnapshot(info.code);
    return new Response(null, { status: 101, webSocket: client });
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
    }
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
    this.broadcastSnapshot(info.code, ws);
    if (this.openSockets(ws).length === 0) {
      await this.ctx.storage.setAlarm(Date.now() + ROOM_EMPTY_CLOSE_MS);
    }
  }

  private info(): Promise<RoomInfo | undefined> {
    return this.ctx.storage.get<RoomInfo>(INFO_KEY);
  }

  private openSockets(exclude?: WebSocket): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== exclude && ws.readyState === WebSocket.OPEN);
  }

  private broadcastSnapshot(code: string, exclude?: WebSocket): void {
    const sockets = this.openSockets(exclude);
    const players = new Map<string, RoomPlayer>();
    for (const ws of sockets) {
      const attachment = ws.deserializeAttachment() as Attachment;
      players.set(attachment.userId, {
        id: attachment.userId,
        name: attachment.name,
        connected: true,
      });
    }
    const snapshot: ServerMessage = {
      type: "snapshot",
      room: { code, players: [...players.values()] },
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
