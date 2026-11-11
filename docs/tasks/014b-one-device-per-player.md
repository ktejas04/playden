# 014b — One device per player in a room ("Play here")
Phase: 3 (Game platform), pulled forward from 019 because it needs no game code
Depends on: 013
Touches: packages/protocol/src/messages.ts, packages/protocol/tests/messages.test.ts, apps/server/src/room/Room.ts, apps/server/tests/room.test.ts, apps/web/src/main.tsx, apps/web/src/room/{closeOutcome.ts, earlySocket.ts, replacedHere.ts (new), useRoomSocket.ts}, apps/web/src/screens/{Home.tsx, Room.tsx}, apps/web/tests/roomSocket.test.ts, docs/PROJECT.md
Spec: D49

## Rules
- A player holds their seat from one connection at a time. When the same account opens the room on another device or tab, the new connection takes the seat at once, keeping the player's place in the seating order.
- The old connection gets a `replaced` notice and is closed with `ROOM_CLOSE.replaced` (4409). Its screen says "You're playing on another device" with **Play here** and **Back to the lobby**.
- Play here reconnects, which takes the seat back the same way.
- Taking over is not leaving: no host change, no close timer, and the others see no one leave.
- A replaced tab remembers it (sessionStorage, per room). A reload, or the phone restoring a discarded tab, stays on the "another device" screen instead of quietly taking the seat back. A new tab, a deliberate Join from the lobby, or Play here starts fresh.
- Removed players (D42) are still refused on every device.

## Done when
- [x] Tests: takeover closes the old connection as replaced; the host and seating order stay; Play here takes the seat back; a replaced close doesn't start the close timer; a removed player is refused on every device; the `replaced` notice parses; the close code maps to "replaced"; the early socket skips a replaced room; the per-tab memory survives a reload and tolerates blocked storage
- [x] Manual: same player on phone and PC → the first shows "playing on another device"; Play here moves the seat back; reloading the replaced tab stays replaced
- [x] pnpm typecheck, lint, test pass
