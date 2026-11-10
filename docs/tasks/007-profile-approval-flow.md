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
- [x] Every test above passes
- [x] Manual on localhost: a non-admin account lands on Profile, then Waiting (checked with a seeded test session; real Google sign-in still waits on the owner's OAuth client)
- [x] pnpm typecheck, lint, test pass

## Notes
- shadcn/ui set up in `packages/ui` (D30): `components.json`, theme in `src/styles/globals.css`, components in `src/components/`. Add more with `pnpm --filter @playden/ui exec shadcn add <name>`. The CLI can't `init` a plain package, so the Nova theme CSS was generated once on a scratch Vite app and copied in.
- Light/dark themes with a header switch (D32): `theme-provider.tsx`, `theme-toggle.tsx`.
- Extra files: `apps/server/src/http.ts` gained `readJson`; guards (`requireUser`, `requireApproved`, `checkApproved`) live in `auth/session.ts`.
- Checked in the browser at 375 px: sign-in screen in light and dark.
