# 013 — Remove a player from a room
Phase: 2 (Setup), pulled forward from Platform v1
Depends on: 009, 010
Touches: packages/protocol/src/{messages.ts, room.ts, index.ts}, packages/protocol/tests/{messages.test.ts, room.test.ts}, apps/server/src/api/rooms.ts, apps/server/src/room/Room.ts, apps/server/tests/room.test.ts, apps/web/src/room/{closeOutcome.ts, useRoomSocket.ts}, apps/web/src/screens/Room.tsx, apps/web/tests/{roomSocket.test.ts, roomHelpers.test.ts}, docs/PROJECT.md
Spec: docs/PROJECT.md D42

## Steps
1. Tests first for `canRemovePlayer`: the host removes non-admins, an admin removes non-admins, nobody removes themselves or an admin.
2. Protocol: `remove { playerId }` client message, `removed { playerId, name }` server message, `isAdmin` on room players, close code `ROOM_CLOSE.removed`.
3. Server: the Worker tells the room whether the player is an admin. The room checks `canRemovePlayer`, closes every tab of the removed player with `ROOM_CLOSE.removed`, remembers them so they are refused on rejoin, and tells everyone else. Host passes on as usual if the host was removed.
4. Web: a removed close stops reconnecting and shows "You were removed from this room". Player rows get a menu with "Remove from room" (host and admins only) and a confirm dialog; everyone else gets a toast.

## Done when
- [x] Rule, protocol and room tests pass (host removes, admin removes host, refused removals, removed player can't rejoin, all tabs closed)
- [x] Manual on localhost: host removes a second player, who sees the removed screen and can't rejoin
- [x] pnpm typecheck, lint, test pass

## Notes
- Locally, a client only reported the server's close about 10 s later (it waits on the TCP teardown). So the removed player is also sent the `removed` notice, and the screen stops on that at once; the close code covers clients that miss it, and rejoining.
- The player menu shows only where a removal is allowed, so no menu on admins' rows or your own.
