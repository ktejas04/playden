# 006 — Google sign-in
Phase: 2 (Setup)
Depends on: 005
Touches: apps/server/src/auth/{google.ts, cookies.ts, admins.ts, routes.ts, session.ts}, apps/server/src/index.ts, apps/server/src/env.ts, apps/server/tests/{cookies.test.ts, admins.test.ts, auth.test.ts}
Spec: docs/PROJECT.md#access-control-and-admin, D10, D20, D22, D24, D25

## Owner setup (before the manual check)
1. Google Cloud Console → new project "PlayDen" → APIs & Services → OAuth consent screen: External, app name PlayDen, scopes `openid`, `email`, `profile` only → Publish app (D20).
2. Credentials → Create OAuth client ID → Web application. Redirect URIs: `http://localhost:5173/auth/callback` (production URI is added in task 011).
3. Put the client ID, secret and your admin email(s) in `apps/server/.dev.vars`. Never commit them.

## Steps
1. Add `arctic` (D24).
2. Tests first:
   - cookie serialise/parse round-trips; session cookie is `HttpOnly; Secure; SameSite=Lax; Path=/`
   - `isAdmin(email, ADMIN_EMAILS)` ignores case and spaces
   - `/auth/callback` with a missing or wrong `state` returns 400 and creates no session
   - callback with a stubbed Google response creates a user and a session cookie; an admin email arrives `approved`
   - `/api/me` returns 401 without a session and the user with one
3. `GET /auth/login`: state + PKCE verifier in short-lived cookies, redirect to Google. Redirect URI is built from the request origin.
4. `GET /auth/callback`: check state, exchange code (behind a small function so tests stub it), read `sub`, `email`, `email_verified` from the ID token, reject unverified emails, upsert user, create session, redirect to `/`.
5. `POST /auth/logout`, `GET /api/me` → `{ id, email, displayName, invitedBy, status, isAdmin }`.
6. `session.ts`: `getCurrentUser(request, env, now)` used by every protected route.

## Done when
- [x] Every test above passes
- [x] Manual: sign in with Google on `localhost:5173`; the admin account reaches home with the Admin button, a test account reaches "You're on the list" (owner, 2026-11-10)
- [x] pnpm typecheck, lint, test pass

## Notes
- Routing moved into `src/app.ts` (`createApp(deps)` with a route table), so tests inject a fake Google; `src/api/me.ts` holds `/api/me`. `Me` type lives in `packages/protocol/src/api.ts`.
- Checked through the Vite proxy: the redirect URI is `http://localhost:5173/auth/callback`.
- Added `db:migrate:local` script for the local D1.
