# PlayDen

A private, invite-only website where our WhatsApp community plays party and board games together, on a phone or a PC, for free.

This file explains the project in plain language. The technical design (every decision, the architecture, code rules and build phases) lives in [`docs/PROJECT.md`](docs/PROJECT.md).

## Why it exists

We used to jump between six different game sites, and Board Game Arena puts the good games behind a paywall. PlayDen puts our games in one place, with our own rules, and costs nothing to run at our size.

## What it does

- **Sign in with Google.** New members pick a display name and say who invited them. An admin approves them before they can play, so a forwarded link is useless to strangers.
- **Rooms.** Anyone approved can create a room and share its 4-letter code or link (`/r/ABCD`) in WhatsApp. Others tap the link and they're in.
- **Games.** v1 has one game, **Sketch Battle**: two teams draw the same word at once and race their teammates to guess it. More games (Codenames, Secret Hitler, then Trio and Flip 7) come later.
- **Phones first.** Every screen works one-handed in portrait. If your phone locks or drops signal, reopening the page puts you back in your seat.

## How it works

- **One server is the referee.** Your phone only shows the game; the server holds the real state, checks every move and sends each player only what they're allowed to see. You can't peek at the other team's drawing, and you can't fake a fast guess.
- **One room = one small server process.** Each room runs in its own Cloudflare Durable Object, which keeps everyone's live connection and the game's timers.
- **Games are plugins.** Each game is one folder with its rules, scoring and screens. Adding a game never touches another game.
- **Settings, not code.** Timers and points live in each game's settings file, so we can tune them after a game night.
- **Free hosting.** Everything runs on Cloudflare's free tier. If we outgrow it, the paid plan is about $5 a month.

## Status

Phase 2 (Setup) is in progress. See [`docs/plans/02-setup.md`](docs/plans/02-setup.md).

## Folder guide

| Path | What it holds |
| --- | --- |
| `apps/web` | The website people see (React) |
| `apps/server` | The Cloudflare Worker: sign-in, API, rooms |
| `packages/` | Shared code: game contract, message types, UI pieces, one folder per game |
| `docs/PROJECT.md` | Technical design: decisions, architecture, practices, phases |
| `docs/games/` | One rules spec per game |
| `docs/plans/` | One plan per build phase |
| `docs/tasks/` | Small numbered build tasks |
| `docs/explanations/` | Plain-language notes on how each part works |
| `AGENTS.md` | Rules every AI agent follows |

## Running locally

Needs Node 20+ and pnpm. In PowerShell, from `D:\Projects\PlayDen`:

```powershell
pnpm start
```

That one command installs packages, creates `apps/server/.dev.vars` from the example if it's missing (and warns about empty values), builds the web app once if needed, applies any new database migrations to the local database, and starts the site. Every step is safe to repeat and never deletes local data. Stop it with Ctrl+C.

Open http://localhost:5173. The site runs on Vite and forwards `/api` and `/auth` to the local Worker on port 8787, so both share one address, as in production. Everything runs on your machine: the Worker, rooms and the database (in `apps/server/.wrangler`), with secrets from `.dev.vars`. Nothing local touches production.

Before pushing: `pnpm check` runs typecheck, lint, format check and tests in one go. `pnpm dev` alone starts the site without the setup steps.

## Deploying

Every push to `main` runs the checks on GitHub; once Cloudflare is set up it also deploys. One-time setup, done by the owner:

**Google sign-in**

1. Google Cloud Console → new project "PlayDen" → APIs & Services → OAuth consent screen: External, app name PlayDen, scopes `openid`, `email`, `profile` only → Publish app.
2. Credentials → Create OAuth client ID → Web application. Authorised redirect URIs: `http://localhost:5173/auth/callback` and `https://playden.<your-subdomain>.workers.dev/auth/callback`.
3. Put the client ID and secret, and the admin email(s), in `apps/server/.dev.vars` for local use.

**Cloudflare**

1. Create a free account and pick a `workers.dev` subdomain.
2. In `D:\Projects\PlayDen`: `pnpm --filter @playden/server exec wrangler login`, then `pnpm --filter @playden/server exec wrangler d1 create playden`. Put the printed `database_id` under `[env.production]` in `apps/server/wrangler.toml` (the top-level id is the local placeholder; leave it).
3. Worker secrets, one at a time: `pnpm --filter @playden/server exec wrangler secret put GOOGLE_CLIENT_ID --env production` (then `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`). These are the production values; local ones stay in `.dev.vars`.

**GitHub** (repo → Settings → Secrets and variables → Actions)

1. Secret `CLOUDFLARE_API_TOKEN`: Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" template, plus D1 Edit.
2. Variable `CLOUDFLARE_ACCOUNT_ID`: from the Cloudflare dashboard. Deploys stay off until this is set.

Production commands always need `--env production`; the scripts `pnpm --filter @playden/server db:migrate:remote` and `... run deploy` include it. Without it, a remote command hits the placeholder database and fails.

Don't push to `main` during a live game night: a deploy restarts rooms.
