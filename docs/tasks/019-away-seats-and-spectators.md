# 019 — Away seats and mid-game spectators
Phase: 3 (Game platform)
Depends on: 017, 018
Touches: packages/protocol/src/{messages.ts, room.ts}, packages/protocol/tests/*, apps/server/src/room/{Room.ts, roomGame.ts}, apps/server/src/config.ts, apps/server/tests/room*.test.ts, apps/web/src/room/{closeOutcome.ts, useRoomSocket.ts}, apps/web/src/screens/Room.tsx, apps/web/src/components/PlayerAvatar.tsx, apps/web/tests/{roomSocket.test.ts, roomHelpers.test.ts}, docs/PROJECT.md
Spec: docs/PROJECT.md "Reconnects and leaving", D40, D46

## Rules

**Away seats**
- A player whose connection drops mid-game is marked **away** (shown on their avatar). Their seat and team place stay.
- They get the same seat back silently if they reconnect within `AWAY_GRACE_MS` (60 s). The game is not told.
- After 60 s away, the room calls the game's `onPlayerLeft`. The player keeps their team place (so they can come back later), and games skip away players where their spec says so.
- The game sees each player's `connected` flag through state the room maintains, not through clocks, so engines can skip away players.
- The 60 s away grace also applies to host handover (D40): the host passes on only after 60 s away. Note this in D40.

One device per player ("Play here") was built early in 014b (D49). Away seats must work with it: a takeover is never "away".

**Mid-game joiners**
- Anyone who joins while a game is playing is a spectator until the game ends (D46).

## Steps
1. Tests first:
   - away marking
   - return within grace (no `onPlayerLeft`)
   - grace expiry calls `onPlayerLeft` once
   - a mid-game joiner becomes a spectator
   - host handover after grace
   - a takeover (D49) never marks the player away
2. Server:
   - away timestamps in storage, with grace expiry folded into the room's alarm
   - the connection map passed to the game
3. Web:
   - an away badge on avatars, and a "watching" label for spectators
4. Update D40 in PROJECT.md.

## Done when
- [ ] Tests above pass
- [ ] Manual: turn a phone's Wi-Fi off mid-Tap-Race and back on within 60 s → same seat; leave it off for 70 s → the game is told
- [ ] pnpm typecheck, lint, test pass
