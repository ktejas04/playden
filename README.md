# PlayDen

A private, invite-only website where our WhatsApp community plays party and board games together, on a phone or a PC, for free.

This file explains the project in plain language. The technical design (every decision, the architecture, code rules and build phases) lives in [`docs/PROJECT.md`](docs/PROJECT.md).

## Why it exists

We used to jump between six different game sites, and Board Game Arena puts the good games behind a paywall. PlayDen puts our games in one place, with our own rules, and costs nothing to run at our size.

## What it does

- **Sign in with Google.** New members pick a display name and say who invited them. An admin approves them before they can play, so a forwarded link is useless to strangers.
- **Rooms.** Anyone approved can create a room and share its 4-letter code or link (`/r/ABCD`) in WhatsApp. Others tap the link and they're in.
- **Games.** v1 has one game, **Draw Battle**: two teams draw the same word at once and race their teammates to guess it. More games (Codenames, Secret Hitler, then Trio and Flip 7) come later.
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

Added in task 004 (server skeleton), once the code exists.
