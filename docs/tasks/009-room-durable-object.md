# 009 — Room Durable Object (hello room)
Phase: 2 (Setup)
Depends on: 007
Touches: apps/server/src/room/{Room.ts, roomCode.ts}, apps/server/src/api/rooms.ts, apps/server/src/index.ts, apps/server/src/env.ts, apps/server/wrangler.toml, apps/server/tests/{room.test.ts, roomCode.test.ts}
Spec: docs/PROJECT.md#rooms-lobby-and-realtime-protocol, D7

## Steps
1. Tests first:
   - `generateRoomCode(randomBytes)` returns 4 letters from `ROOM_CODE_ALPHABET`
   - `POST /api/rooms` returns `{ code }` for approved users, 403 otherwise
   - WebSocket upgrade on `/api/rooms/:code/ws`: 401 signed out, 403 pending, 400 bad code, 426 without `Upgrade`
   - two approved users connect → each receives a `snapshot` listing both players
   - one disconnects → the other gets a snapshot with that player gone
   - the same user in two tabs counts as one player
   - `ping` gets `pong` with server time; a malformed message gets `error` and the socket stays open
2. `roomCode.ts`: random code using `crypto.getRandomValues`. Collisions are accepted until the Lobby (phase 3): the same code means the same room.
3. Worker: check session + approval, then forward to `ROOM.idFromName(code)`. Build a new request carrying trusted `X-PlayDen-User-Id` / `-Name` headers, so client-sent ones never pass through.
4. `Room.ts`: hibernation API (`ctx.acceptWebSocket`, `serializeAttachment`), broadcast a snapshot on join and close, validate input with `parseClientMessage`.
5. `wrangler.toml`: `ROOM` binding plus migration `v1` with `new_sqlite_classes = ["Room"]`.
6. Check Cloudflare's current rules for how WebSocket messages count toward free-tier requests. Note the result in the Decisions log if it changes the budget section.

## Done when
- [ ] Every test above passes
- [ ] pnpm typecheck, lint, test pass
