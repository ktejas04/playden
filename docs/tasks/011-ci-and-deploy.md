# 011 — CI and first deploy
Phase: 2 (Setup)
Depends on: 010
Touches: .github/workflows/ci.yml, apps/server/wrangler.toml, README.md
Spec: docs/PROJECT.md#deployment-and-environments, D23

## Owner setup
1. Cloudflare: create a free account, pick a `workers.dev` subdomain.
2. In `D:\Projects\PlayDen`: `pnpm --filter server exec wrangler login`, then `pnpm --filter server exec wrangler d1 create playden`. Send me the `database_id` it prints (not a secret).
3. Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template, plus D1 Edit permission. Add it to GitHub repo secrets as `CLOUDFLARE_API_TOKEN`, and your account ID as a repo **variable** `CLOUDFLARE_ACCOUNT_ID` (it isn't secret; its presence switches deploys on).
4. Worker secrets, one at a time: `pnpm --filter server exec wrangler secret put GOOGLE_CLIENT_ID`, the same for `GOOGLE_CLIENT_SECRET` and `ADMIN_EMAILS`.
5. Google OAuth client: add `https://playden.<subdomain>.workers.dev/auth/callback` as a redirect URI.

## Steps
1. `wrangler.toml`: real `database_id`.
2. `ci.yml` on push and pull request: checkout, pnpm setup with cache, Node 20, `pnpm install --frozen-lockfile`, typecheck, lint, format check, test, build.
3. Same workflow, `main` only, after the checks: `wrangler d1 migrations apply playden --remote`, then `wrangler deploy`.
4. README: a "Deploying" section listing the owner setup above.

## Done when
- [x] Workflow written: checks on every push/PR; deploy on `main`, skipped until the repo variable `CLOUDFLARE_ACCOUNT_ID` exists
- [ ] CI passes on GitHub (needs the first push)
- [ ] Push to `main` deploys; `https://playden.<subdomain>.workers.dev/api/health` answers
- [ ] Sign-in works on the production URL
