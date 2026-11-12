# 019 — Away players and host grace
Phase: 3 (Game platform)
Depends on: 017, 014b
Touches: apps/server/src/room/{Room.ts, host.ts, roomGame.ts, RoomTable.ts}, apps/server/src/config.ts, apps/server/tests/*, packages/protocol/src/messages.ts, apps/web/src/components/PlayerAvatar.tsx, apps/web/src/screens/Room.tsx, docs/PROJECT.md
Spec: docs/design/rooms-and-games.md sections 5 and 6

## Rules
- A member whose connection drops is **away**, not gone. They stay in the member list with an away marker for `AWAY_GRACE_MS` (60 s).
- **Playing:** a player keeps their seat for the whole game, however long they're away, and slides back in on return. The game is told who is away, so it can skip them.
- **Setup:** a joined player away for 60 s is moved out of the session. A Start within those 60 s still seats them.
- **Host:** passes on only after 60 s away (amends D40). Leaving the game or being removed still passes it at once.
- After 60 s away, a member who isn't holding a seat in a game leaves the member list.
- Play here (D49) is never "away".

## Steps
1. Tests first:
   - away marking and return within the grace
   - a seat held for 5 minutes
   - Setup expiry
   - host handover after the grace
   - a takeover never marks the player away
2. Server:
   - away timestamps in storage
   - grace expiries folded into the room's one alarm
   - presence passed to the game
3. Web: away markers on avatars and in the setup list.
4. Update D40 in PROJECT.md.

## Done when
- [ ] Tests above pass
- [ ] Manual: turn a phone's Wi-Fi off mid-Tap-Race for 10 s and for 2 minutes; both come back to the same seat. A host who drops passes host after 60 s
- [ ] pnpm typecheck, lint, test pass
