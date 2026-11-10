import { DurableObject } from "cloudflare:workers";
import { type RoomPlayer, type ServerMessage, parseClientMessage } from "@playden/protocol";
import type { Env } from "../env";

export const ROOM_HEADERS = {
  userId: "x-playden-user-id",
  userName: "x-playden-user-name",
  roomCode: "x-playden-room-code",
} as const;

interface Attachment {
  userId: string;
  name: string;
  code: string;
}

export class Room extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    const userId = request.headers.get(ROOM_HEADERS.userId);
    const encodedName = request.headers.get(ROOM_HEADERS.userName);
    const code = request.headers.get(ROOM_HEADERS.roomCode);
    if (!userId || !encodedName || !code) return new Response("Bad room request", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = { userId, name: decodeURIComponent(encodedName), code };
    server.serializeAttachment(attachment);

    this.broadcastSnapshot();
    return new Response(null, { status: 101, webSocket: client });
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
    this.broadcastSnapshot(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcastSnapshot(ws);
  }

  private openSockets(exclude?: WebSocket): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== exclude && ws.readyState === WebSocket.OPEN);
  }

  private broadcastSnapshot(exclude?: WebSocket): void {
    const sockets = this.openSockets(exclude);
    const players = new Map<string, RoomPlayer>();
    let code = "";
    for (const ws of sockets) {
      const attachment = ws.deserializeAttachment() as Attachment;
      code = attachment.code;
      players.set(attachment.userId, {
        id: attachment.userId,
        name: attachment.name,
        connected: true,
      });
    }
    if (!code) return;

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
