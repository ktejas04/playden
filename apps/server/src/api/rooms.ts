import { ROOM_CLOSE, ROOM_CODE_LENGTH, roomCodeSchema } from "@playden/protocol";
import type { RequestContext, Route } from "../app";
import { checkApproved, getCurrentUser, requireApproved } from "../auth/session";
import { ROOM_CODE_ATTEMPTS } from "../config";
import { errorJson, json, refuseSocket } from "../http";
import { ROOM_HEADERS } from "../room/Room";
import { generateRoomCode } from "../room/roomCode";

function roomFor(ctx: RequestContext, code: string) {
  return ctx.env.ROOM.get(ctx.env.ROOM.idFromName(code));
}

function validCode(ctx: RequestContext): string | null {
  const code = ctx.params.code ?? "";
  return roomCodeSchema.safeParse(code).success ? code : null;
}

export const roomRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/rooms",
    handler: async (ctx) => {
      const { user, response } = await requireApproved(ctx);
      if (response) return response;

      for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt++) {
        const code = generateRoomCode(ctx.deps.randomBytes(ROOM_CODE_LENGTH));
        if (await roomFor(ctx, code).create(code, user.id, ctx.now)) return json({ code });
      }
      return errorJson(503, "Couldn't find a free room code. Try again.");
    },
  },
  {
    method: "GET",
    path: /^\/api\/rooms\/(?<code>[^/]+)$/,
    handler: async (ctx) => {
      const { response } = await requireApproved(ctx);
      if (response) return response;

      const code = validCode(ctx);
      if (!code) return errorJson(400, "Not a valid room code");
      return (await roomFor(ctx, code).exists())
        ? json({ code })
        : errorJson(404, "Room not found");
    },
  },
  {
    method: "GET",
    path: /^\/api\/rooms\/(?<code>[^/]+)\/ws$/,
    // One database read and one hop to the room: the room itself refuses a code that
    // doesn't exist, so joining needs no separate existence check.
    handler: async (ctx) => {
      if (ctx.request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return errorJson(426, "Expected a WebSocket");
      }
      const user = await getCurrentUser(ctx);
      if (!user) return refuseSocket(ROOM_CLOSE.signedOut, "Signed out");
      const check = checkApproved(user, ctx.env.ADMIN_EMAILS);
      if (!check.ok) return refuseSocket(ROOM_CLOSE.notAllowed, check.reason);

      const code = validCode(ctx);
      if (!code) return refuseSocket(ROOM_CLOSE.notFound, "Not a valid room code");
      const room = roomFor(ctx, code);

      // Identity headers are always overwritten here, so a client can't spoof them.
      const headers = new Headers(ctx.request.headers);
      headers.set(ROOM_HEADERS.userId, user.id);
      headers.set(ROOM_HEADERS.userName, encodeURIComponent(user.displayName ?? "Player"));
      return room.fetch(new Request(ctx.request.url, { method: "GET", headers }));
    },
  },
];
