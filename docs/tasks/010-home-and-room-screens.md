# 010 — Home and room screens
Phase: 2 (Setup)
Depends on: 009
Touches: apps/web/src/screens/{Home.tsx, Room.tsx}, apps/web/src/room/{useRoomSocket.ts, socketUrl.ts, backoff.ts}, apps/web/src/api.ts, apps/web/tests/{socketUrl.test.ts, backoff.test.ts, joinCode.test.ts}
Spec: docs/PROJECT.md#rooms-lobby-and-realtime-protocol, #mobile-ux-learn-controls-and-learn-mode

## Steps
1. Tests first:
   - `socketUrl(location, code)` gives `wss://` on https and `ws://` on http, same host
   - `backoffDelay(attempt)` grows 0.5 s, 1 s, 2 s … capped at 10 s
   - join-code input normalises case and spaces and rejects look-alike letters
2. Home: big "Create room" button (POST, then go to `/r/CODE`); "Join" with a 4-letter code box. Both in the bottom bar.
3. Room: shows the code, a Share button (Web Share API, falls back to copy link), and the live player list with connected dots.
4. `useRoomSocket`: connect, parse server messages with protocol schemas, reconnect with backoff, reconnect at once when the tab becomes visible again, ping every 25 s.

## Done when
- [x] Every test above passes
- [x] Manual on localhost: two accounts see each other join and leave (browser as one seeded test account, a Node WebSocket client as the other)
- [x] pnpm typecheck, lint, test pass

## Notes
- Tests live in one file, `tests/roomHelpers.test.ts`.
- `Shell.tsx` gained `BottomBar` (sticky, thumb-reach actions); the Shell `bottomBar` prop was removed.
- Room screen: big code, live/reconnecting badge, player list with "You", Leave + "Invite players" (Web Share, falls back to copying the link).
