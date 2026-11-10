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
- [ ] Every test above passes
- [ ] Manual on localhost: two browsers (two accounts) see each other join and leave
- [ ] pnpm typecheck, lint, test pass
