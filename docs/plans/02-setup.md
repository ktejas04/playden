# Phase 2 — Setup

## Goal

A deployed "hello room": two approved members on different networks (one on Wi-Fi, one on mobile data) open the same room link and see each other join and leave live. The monorepo, sign-in and approval are done for good along the way.

## In scope

- pnpm monorepo matching the repo layout in `docs/PROJECT.md`: `apps/web`, `apps/server`, `packages/engine`, `packages/protocol`, `packages/ui`.
- Tooling: strict TypeScript, ESLint with the module-boundary rules, Prettier, Vitest, a pre-commit hook.
- One Cloudflare Worker serving the web build, the API and WebSockets from one origin (D4, D19).
- Google sign-in, sessions in D1, display name + "who invited you", pending / approved / banned, admins from `ADMIN_EMAILS` (D10, D22, D25).
- Admin page: list accounts, approve, ban.
- One Room Durable Object with hibernatable WebSockets that broadcasts who is in the room.
- Home screen: create a room, join by code; room screen: code, share link, live player list, silent reconnect.
- GitHub Actions: checks on every push; deploy on `main`.

## Out of scope (later phases)

- Lobby object, collision-free room codes, caps, kill switch (phase 3).
- Teams, ready, chat, host handover, 60 s seat hold, spectators (phase 3).
- Kicking a banned player out of a live room (phase 3).
- PWA install, Wake Lock (phase 3).
- Seeded RNG and any game code (phase 4).
- Per-PR preview deploys (D23).

## What I need from you, and when

| Before task | What | Notes |
| --- | --- | --- |
| 001 | Node 20+ and pnpm on your PATH | I'll check versions; installing them is your call |
| 006 | Google Cloud OAuth client + admin email | Steps in task 006 |
| 011 | Cloudflare account, API token, GitHub secrets | Steps in task 011 |
| 012 | Two phones, a second Google account | Manual test |

## Tasks

| # | Title | Depends on |
| --- | --- | --- |
| 001 | Workspace tooling | — |
| 002 | Shared packages: engine, protocol, ui | 001 |
| 003 | Web app skeleton | 002 |
| 004 | Server Worker skeleton | 003 |
| 005 | D1 schema: users and sessions | 004 |
| 006 | Google sign-in | 005 |
| 007 | Profile and approval flow | 006 |
| 008 | Admin page | 007 |
| 009 | Room Durable Object (hello room) | 007 |
| 010 | Home and room screens | 009 |
| 011 | CI and first deploy | 010 |
| 012 | Two-phone check and explanations | 011 |

After 012: write `docs/games/sketch-battle.md` (D21).
