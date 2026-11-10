# 007 — Profile and approval flow
Phase: 2 (Setup)
Depends on: 006
Touches: packages/protocol/src/api.ts, packages/protocol/tests/api.test.ts, apps/server/src/api/me.ts, apps/server/src/auth/session.ts, apps/server/src/index.ts, apps/server/tests/me.test.ts, apps/web/src/{api.ts, useMe.ts, App.tsx}, apps/web/src/screens/{SignIn.tsx, Profile.tsx, Waiting.tsx, Banned.tsx}
Spec: docs/PROJECT.md#access-control-and-admin

## Steps
1. Tests first:
   - `profileSchema`: display name trimmed, 2–20 chars; "invited by" 1–40 chars
   - `PUT /api/me/profile` saves both for the signed-in user; invalid input returns 400 with a reason
   - `requireApproved` returns 403 for pending and banned users, passes approved users and admins
2. `protocol/src/api.ts`: `profileSchema` and the `/api/me` response type, shared by web and server.
3. Server: `PUT /api/me/profile`; `requireApproved(user)` helper for later routes.
4. Web, decided by `/api/me`:
   - signed out → SignIn ("Continue with Google")
   - no display name → Profile form
   - pending → Waiting ("An admin will let you in soon")
   - banned → Banned
   - approved → the route's screen
5. Sign-out button in the shell.

## Done when
- [ ] Every test above passes
- [ ] Manual on localhost: a non-admin account lands on Profile, then Waiting
- [ ] pnpm typecheck, lint, test pass
