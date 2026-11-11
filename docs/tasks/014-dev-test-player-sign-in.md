# 014 — Dev test-player sign-in
Phase: 3 (Game platform)
Depends on: —
Touches: apps/server/src/env.ts, apps/server/src/auth/{cookies.ts, devLogin.ts, routes.ts}, apps/server/src/db/users.ts, apps/server/tests/devLogin.test.ts, apps/server/.dev.vars.example, apps/web/src/api.ts, apps/web/src/screens/SignIn.tsx, apps/web/src/screens/Room.tsx, apps/web/src/copyText.ts, docs/PROJECT.md, README.md
Spec: this file

## Why

Google sign-in only works on `localhost`, and the session cookie is `Secure`, which browsers drop over `http://<pc-ip>`. So phones on the local network can't sign in. Sketch Battle also needs 4+ players, which means several accounts on one PC. A local-only sign-in fixes both.

## Rules

- On only when `DEV_LOGIN=true` is set in `apps/server/.dev.vars`. Production never sets it.
- Even when on, it only answers requests whose host is `localhost`, `127.0.0.1`, `[::1]` or a private IPv4 address (`10.x`, `172.16–31.x`, `192.168.x`). Anything else gets 404, as if the route didn't exist.
- A test player is a normal approved account: Google id `dev:<slug>`, email `<slug>@dev.playden.invalid`, display name as typed, invited by "test". Signing in with the same name again reuses the account.
- A test player is an admin only if their email is in `ADMIN_EMAILS` (so add `asha@dev.playden.invalid` there to test admin features).
- Only for dev-allowed requests over `http:` does the session cookie drop `Secure`, so phones on the network keep it. Every other cookie stays exactly as it is.

## Steps

1. Tests first (`devLogin.test.ts`):
   - the route is 404 when `DEV_LOGIN` is unset, and 404 for a public host even when it's set
   - it works for `localhost` and `192.168.1.5`
   - the user is approved with the given name
   - the same name gives the same account
   - names are validated like profile display names
   - the cookie has no `Secure` over http on a network IP, and keeps it over https and on localhost
   - logout clears the cookie on a network IP
2. Server:
   - `devLogin.ts`: `isDevLoginAllowed(env, url)` and `cookieIsSecure(env, url)`.
   - `GET /auth/dev` returns `{ enabled: true }` when allowed (404 otherwise).
   - `POST /auth/dev { name }` creates or reuses the test user and a session.
   - `serializeCookie` gets a `secure` option, default true. Logout uses `cookieIsSecure`.
   - `upsertDevUser` in `users.ts`.
3. Web: the sign-in screen asks `GET /auth/dev`. When it's enabled, it shows a "Test player (local only)" card under the Google button: a name field, quick-pick chips (Asha, Ben, Chi, Dev, Esha, Faiz) and a Sign in button. On success it reloads into the app (the `next` path if present).
4. Copy room link: `copyText.ts` uses `navigator.clipboard` when available, else falls back to a temporary textarea and `execCommand("copy")`. Room.tsx uses it.
5. Docs:
   - D48 in PROJECT.md.
   - `DEV_LOGIN` in `.dev.vars.example`.
   - README: how to test on a phone (same Wi-Fi, `http://<pc-ip>:5173`, allow Node through the Windows firewall on private networks only) and how to run several players on one PC (`localhost`, `127.0.0.1`, the network IP and incognito windows each keep their own sign-in).

## Done when

- [x] Tests above pass
- [x] Manual: two test players on one PC (`localhost` and `127.0.0.1`) see each other in a room
- [x] Manual: a phone on the same Wi-Fi signs in as a test player and joins the room
- [x] With `DEV_LOGIN` unset, the card doesn't show and `/auth/dev` is 404 (tests, plus a production build with no card and a production config pinned to `false`)
- [x] pnpm typecheck, lint, test pass
