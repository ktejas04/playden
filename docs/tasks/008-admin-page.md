# 008 — Admin page
Phase: 2 (Setup)
Depends on: 007
Touches: apps/server/src/api/admin.ts, apps/server/src/index.ts, apps/server/tests/admin.test.ts, apps/web/src/screens/Admin.tsx, apps/web/src/api.ts, apps/web/src/App.tsx
Spec: docs/PROJECT.md#access-control-and-admin, D22

## Steps
1. Tests first:
   - non-admins get 403 on every admin route
   - `GET /api/admin/users?status=pending` lists only pending users, newest first
   - approve moves pending → approved; ban moves any non-admin → banned and ends their sessions
   - banning an admin email returns 400 "Admins can't be banned"
   - unknown user id returns 404
2. Routes: `GET /api/admin/users`, `POST /api/admin/users/:id/approve`, `POST /api/admin/users/:id/ban`.
3. `/admin` screen (admins only; link in the shell): tabs Pending / Approved / Banned; each row shows name, email, invited by, with Approve or Ban buttons (44 px targets). Ban asks for a confirm.

## Done when
- [x] Every test above passes
- [x] Manual on localhost: approve a waiting account; it leaves the list (checked with seeded test sessions, not real Google sign-in)
- [x] pnpm typecheck, lint, test pass

## Notes
- Tabs are "Waiting / Members / Banned"; a banned member can be let back in (approve).
- Statuses come from `userStatuses` in the DB schema (D31).
