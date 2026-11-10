import { roomCodeSchema } from "@playden/protocol";
import type { Route } from "../app";
import { requireApproved } from "../auth/session";
import { errorJson, json } from "../http";
import { ROOM_HEADERS } from "../room/Room";
import { generateRoomCode } from "../room/roomCode";

export const roomRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/rooms",
    handler: async (ctx) => {
      const { response } = await requireApproved(ctx);
      if (response) return response;
      return json({ code: generateRoomCode(crypto.getRandomValues(new Uint8Array(4))) });
    },
  },
  {
    method: "GET",
    path: /^\/api\/rooms\/(?<code>[^/]+)\/ws$/,
    handler: async (ctx) => {
      const { user, response } = await requireApproved(ctx);
      if (response) return response;

      const code = ctx.params.code ?? "";
      if (!roomCodeSchema.safeParse(code).success) return errorJson(400, "Not a valid room code");
      if (ctx.request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return errorJson(426, "Expected a WebSocket");
      }

      // Identity headers are always overwritten here, so a client can't spoof them.
      const headers = new Headers(ctx.request.headers);
      headers.set(ROOM_HEADERS.userId, user.id);
      headers.set(ROOM_HEADERS.userName, encodeURIComponent(user.displayName ?? "Player"));
      headers.set(ROOM_HEADERS.roomCode, code);

      const room = ctx.env.ROOM.get(ctx.env.ROOM.idFromName(code));
      return room.fetch(new Request(ctx.request.url, { method: "GET", headers }));
    },
  },
];
