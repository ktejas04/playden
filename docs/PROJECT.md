# PlayDen — Master Project Doc

Last updated: 2026-11-10 · Owner: Tejas Kumar

## How to use this doc

This is the single source of truth for PlayDen. Everything (code, docs, plans, tasks, agent instructions, local setup) lives in one folder, `D:/Projects/PlayDen`, and this doc is `docs/PROJECT.md` there. If code, a task or a model's idea disagrees with this doc, the doc wins until the doc is changed.

**Doc set**

| Path in D:/Projects/PlayDen | What it holds | Who updates it |
| --- | --- | --- |
| `AGENTS.md` | Short rules for any AI agent, pointing here | Rarely |
| `CLAUDE.md` | Points Claude to `AGENTS.md` | Never |
| `README.md` | Plain-language explanation of the project for humans, plus how to run it | When features or setup change |
| `docs/PROJECT.md` | This doc: the technical design: decisions, architecture, practices, phases | Owner, or an agent when a decision changes |
| `docs/games/<game-id>.md` | One spec per game: rules, scoring, edge cases, UI flow, tests | Written before the game is built |
| `docs/plans/<phase>.md` | Plan for one build phase, broken into tasks | Before each phase starts |
| `docs/tasks/NNN-<slug>.md` | One small task each, with steps and done criteria | Created per phase; ticked when done |
| `docs/explanations/<topic>.md` | Plain-language notes on how a part works, for humans | After a part is built |

**Reading order for any new session (human or AI)**

1. `AGENTS.md`
2. This doc: Decisions log, System architecture, Code practices, Agent playbook
3. The spec of the game you are touching, if any
4. The task file you were given

**Rules**

- Never change a decision silently. Changing one means updating the Decisions log in the same change.
- Anything not decided here: choose the simplest option, then add it to the log.
- Sections are short on purpose. Don't add background; add decisions.

## Overview and goals

PlayDen is a private, invite-only web platform where our WhatsApp community of 50–100 players creates or joins a room and plays together, on phone or PC, with no paywall. It replaces six scattered game sites and Board Game Arena's premium gate with one place, our own rules and our own games.

**Who it's for:** our community only. Peak target is 100–200 players online at once across many rooms.

**Principles**

- **Ship small, ship fast.** A playable v1 in hours beats a polished v1 in weeks. Every feature in this doc is tagged v1 or later.
- **Free to run.** Everything fits free tiers at our size. If we outgrow them, we pay roughly $5–20/month, covered by members.
- **Server is the referee.** The server holds the true game state, checks every move and sends each player only what they may see.
- **Mobile first.** Every screen works one-handed in portrait on a phone, and scales up to PC.
- **Games are plugins.** The platform never knows game rules. A new game is one folder that implements a fixed contract.
- **Tunable by config.** Timers, points and caps live in per-game settings files, so we tune after real game nights without code changes.

## Decisions log

Every agreed decision in one place. Sections below explain the details.

| # | Area | Decision | Date |
| --- | --- | --- | --- |
| D1 | Product | Private, invite-only site for our WhatsApp community; no paywall | 2026-11-10 |
| D2 | Product | v1 = platform basics + Sketch Battle only; ship in hours, iterate | 2026-11-10 |
| D3 | Product | Game order: Sketch Battle (v1); Codenames, Secret Hitler (v2); Trio, Flip 7 (v3) | 2026-11-10 |
| D4 | Hosting | Everything on Cloudflare free tier: one Worker (static assets + API + WebSockets), Durable Objects, D1, Realtime SFU | 2026-11-10 |
| D5 | Hosting | One free `*.workers.dev` address for site and server; no domain until needed | 2026-11-10 |
| D6 | Stack | TypeScript monorepo, pnpm, React + Vite + Tailwind, Vitest | 2026-11-10 |
| D7 | Realtime | WebSockets; one Durable Object per room, one Lobby object; server is authoritative | 2026-11-10 |
| D8 | Engine | Games are pure, deterministic modules implementing one `GameDefinition` contract | 2026-11-10 |
| D9 | Fairness | All timing and scoring use server receive time | 2026-11-10 |
| D10 | Access | v1 Google sign-in + admin approval queue; no passcode, no phone OTP | 2026-11-10 |
| D11 | Voice | v2, Cloudflare Realtime SFU (raw, not RealtimeKit); phase-based muting by game | 2026-11-10 |
| D12 | UX | Mobile-first portrait layouts; learn controls tour via `data-tour` tags | 2026-11-10 |
| D13 | Code | Modular: games never import each other or server code; comments only where non-obvious | 2026-11-10 |
| D14 | Sketch Battle | First team to guess 200, second team a flat 100 however late, no guess 0 (replaces the time-ratio formula) | 2026-11-11 |
| D15 | Sketch Battle | Winner's drawer stays; the losing team rotates to its next connected player, who picks the word. No streak points: a streak of 2+ gives the challenger a head start of `3 + (streak − 2)` s, uncapped by default (cap in `config.ts`) | 2026-11-11 |
| D16 | Sketch Battle | Final round "the showdown": all round words in one shared shuffled order, drawers rotate per word, no timer, ends when one team finishes; 100 per word guessed, +100 for finishing (replaces the 2000 bonus) | 2026-11-11 |
| D17 | Copyright | PlayDen stays private to our WhatsApp community (about 100, never more than 200) and free, so games based on existing titles keep their real names (Codenames, Secret Hitler, Flip 7, Trio…) so players recognise them. Conditions: brand names appear only behind sign-in, never in the domain, the public sign-in page or page titles; search engines are blocked (`robots.txt` disallow-all plus a `noindex` meta, not added yet); we copy rules only, never a publisher's art, card text, word lists, code or assets. Secret Hitler is CC BY-NC-SA 4.0, so we credit its creators and stay non-commercial. Sketch Battle's rules follow drawbattle.io; its name, look, animations and word list are our own. If PlayDen ever opens to strangers or takes money (ads, paid tiers, donations tied to games), brand-named games get original names first | 2026-11-12 |
| D18 | Workspace | Everything lives in `D:/Projects/PlayDen`; `AGENTS.md` holds agent rules, `CLAUDE.md` points to it | 2026-11-10 |
| D19 | Access | Site, API and WebSockets share one origin so the login cookie is first-party (Safari blocks third-party cookies) | 2026-11-10 |
| D20 | Access | Google OAuth app published to production (testing mode needs a tester list and caps at 100 users); basic scopes only, no logo (a logo forces Google review). Publishing needs a homepage and `/privacy` page, so it happens after the first deploy; until then, Testing mode with test users | 2026-11-10 |
| D21 | Process | Phase 2 (Setup) includes Google sign-in, the approval queue and the admin page; the Sketch Battle spec is written right after Setup, before phase 4 | 2026-11-10 |
| D22 | Access | Admins are the emails in the `ADMIN_EMAILS` secret, auto-approved on sign-in and never bannable; every other account is `pending`, `approved` or `banned` in D1 | 2026-11-10 |
| D23 | Hosting | No per-PR preview deploys in v1 (Worker preview URLs don't support Durable Objects); pushes to `main` deploy production; try changes locally first | 2026-11-10 |
| D24 | Stack | Google OAuth via `arctic`; plain fetch handler on the server and a tiny path router on the web (no Hono, no React Router); git hooks via `core.hooksPath`, no hook package | 2026-11-10 |
| D25 | Access | Session = random token in an HttpOnly, Secure, SameSite=Lax cookie; only its SHA-256 hash is stored in D1; 30-day expiry | 2026-11-10 |
| D26 | Docs | `README.md` explains the project in plain language; `docs/PROJECT.md` stays the technical design and decisions doc | 2026-11-10 |
| D27 | Local dev | Vite (5173) proxies `/api` and `/auth`, WebSockets included, to Wrangler dev (8787) so the browser sees one origin, as in production | 2026-11-10 |
| D28 | Process | The agent decides when to commit, but anything the owner can try (a feature, screen or flow) is committed only after the owner has tested it and confirmed. Pure docs can be committed when done. Messages are short `[ADD] …`, `[FIX] …` or `[UPDATE] …` | 2026-11-11 |
| D29 | Stack | Pinned: TypeScript ~6.0 (typescript-eslint doesn't support 7 yet), Vitest ^4.1; ESLint 10, Prettier 3, Node 20+, pnpm 11. Workers tests use `@cloudflare/vitest-plugin` (the renamed vitest-pool-workers) | 2026-11-10 |
| D30 | UI | Use a component library, never hand-rolled widgets or animations: shadcn/ui (Radix + Tailwind) in `packages/ui`, added with the `shadcn` CLI as a dev dependency. We design flows and layouts, not components | 2026-11-10 |
| D31 | Database | Drizzle ORM: `apps/server/src/db/schema.ts` is the single source of truth for tables and DB types; `drizzle-kit generate` writes the SQL migrations that Wrangler applies to D1; no hand-written SQL | 2026-11-10 |
| D32 | UX | Light and dark themes; follows the phone's setting by default, with a Light / Dark / Phone setting switch in the header, remembered per device (`next-themes`) | 2026-11-10 |
| D33 | Hosting | Checked Cloudflare pricing: incoming WebSocket messages bill 20:1 as requests, outgoing are free, hibernating rooms cost no duration; Sketch Battle fits the free tier comfortably | 2026-11-10 |
| D34 | UX | Visual identity "card table under a lamp": felt green (dark `#0F211B`, light sage `#EEF4EF`), game-token yellow for main actions, ivory letter tiles for room codes and the join box, coral/teal/sky/lilac player colours (stable per player). Bricolage Grotesque for headings, Geist for text. Buttons are game pieces (bottom edge, lift on hover, press on tap; motion off for reduced-motion). Lists sit in one panel with dividers. Page scrolls with hidden scrollbar; header has "‹ Lobby" and an avatar menu; main actions in a sticky bottom bar | 2026-11-10 |
| D35 | Rooms | A room exists only once created (`POST /api/rooms` picks a free code); unknown or closed codes return "Room not found". A room closes 60 s after it becomes empty (`ROOM_EMPTY_CLOSE_MS`), replacing "30 minutes". Joining needs the Join button; no auto-join on the 4th letter | 2026-11-10 |
| D36 | Access | Statuses: pending, approved, declined, banned. Decline (waiting only) lets the person ask again after `ASK_AGAIN_AFTER_MS` (5 s while testing; raise before launch). Block = ban for someone never approved; Unblock returns them to Waiting, Let back in restores a former member. Sign out lives in the avatar menu | 2026-11-10 |
| D37 | Database | Drizzle rebuilds a SQLite table to change a CHECK constraint; on D1 that drops the old table, which cascades and deletes all sessions (everyone is signed out once). Avoid CHECK changes on `users` after launch, or accept a one-time sign-out. Generate column additions and constraint changes as separate migrations | 2026-11-10 |
| D38 | Brand | Logo: ivory "P" letter tile on a felt-green rounded square (`apps/web/public/favicon.svg`), used as favicon and header mark. No logo on the Google consent screen until we own a domain (a logo triggers Google review). PNG app icons come with the PWA in phase 3 | 2026-11-11 |
| D39 | Hosting | `wrangler.toml` top level is local dev (placeholder D1 id, secrets from `.dev.vars`); production is `[env.production]` (real D1 id, secrets via `wrangler secret put --env production`). Remote commands pass `--env production`, so local work never touches the production database | 2026-11-11 |
| D40 | Rooms | The room's creator is host (or the first player in, if the creator never joins). When the host is not in the room, host passes at once to the longest-seated player and stays with them if the old host returns. The 60 s away grace comes with reconnect seats in Platform v1. In a room, admins open Members in a side sheet so the room stays connected | 2026-11-11 |
| D41 | Rooms | Joining a room is one WebSocket: the Worker reads the session once and forwards to the room, which answers with a snapshot or refuses with a close code (4401 signed out, 4403 not allowed, 4404 not found), since browsers can't read a failed upgrade's HTTP status. A room link starts its socket before React loads, the last known account is kept in localStorage so screens draw at once while `/api/me` revalidates, and hashed assets are cached for a year (`_headers`) | 2026-11-11 |
| D42 | Rooms | The host or an admin can remove a player from a room, in the lobby or mid-game. Nobody can remove themselves or an admin (admins are never bannable, D22), so a host can't remove an admin but an admin can remove the host, and host then passes on as usual. The removed player's tabs all close with `ROOM_CLOSE.removed` (4410) and they can't rejoin that room until it closes; the list lives only in the room's storage. Removing is not banning: the account is untouched | 2026-11-11 |
| D43 | Product | The first game is **Sketch Battle** (id `sketch-battle`, replacing the "Draw Battle" working name), built in five game phases: core round, full match, showdown, settings and words, polish. Spec: `docs/games/sketch-battle.md` | 2026-11-11 |
| D44 | Sketch Battle | In round 1, and after a round nobody guessed, a random team (from the game seed) picks the word, with no head start. Teams are 2–8 players each and differ by at most 1 | 2026-11-11 |
| D45 | Sketch Battle | Words come from our own strict English list. Hindi or Hinglish packs come later, only if asked for | 2026-11-11 |
| D46 | Rooms | Anyone not on a team when a game starts, or who joins mid-game, is a spectator: they see the word, both canvases and both guess logs, and can't guess. They join a team in the next game; no moving onto teams between rounds for now | 2026-11-11 |
| D47 | Fairness | The other team's canvas reaches players only as a coarse block preview the server builds, never as strokes, until their own team has guessed the word. Hidden information never leaves the server | 2026-11-11 |
| D48 | Local dev | Test-player sign-in for local testing: on only with `DEV_LOGIN=true` in `.dev.vars` and only for localhost or private network addresses (404 everywhere else). A test player is an approved account `<slug>@dev.playden.invalid`, admin only if listed in `ADMIN_EMAILS`. For those requests over plain http the session cookie drops `Secure`, so phones on the Wi-Fi keep it; every other cookie stays Secure. Kept out of production three ways: `[env.production.vars]` pins `DEV_LOGIN = "false"`, production hosts are never local, and the sign-in card exists only in Vite dev builds | 2026-11-11 |
| D49 | Rooms | One connection per player in a room: opening the room on another device or tab moves the seat there (keeping its place in the seating order, no host change), and the old one shows "You're playing on another device" with Play here, like Meet's "Switch here". Close code `ROOM_CLOSE.replaced` (4409). A replaced tab remembers it per room until Play here or a deliberate Join, so a reload doesn't take the seat back. Accounts stay signed in on every device | 2026-11-12 |
| D50 | Engine | Each game is a package `@playden/game-<id>` with a rules entry (pure, server-safe) and a `/view` entry (React, web only), created by `pnpm new-game`. The contract gains name, summary, teams, devOnly, configSchema, moveSchema, and `setup(seats, config, seed, now)`. Every game passes the shared contract kit (`@playden/engine/testing`), and `checks/` machine-checks isolation, engine purity, layout and registries in `pnpm test`. Tap Race is a dev-only test game | 2026-11-12 |

## Scope: v1 vs later

v1 is one game, room codes and Google sign-in with approval: enough to run a real game night, and auth is done once. Everything else is built later on the same foundation, so nothing in v1 is thrown away.

| Feature | Version | Notes |
| --- | --- | --- |
| Create/join room by code or link | v1 | 4-letter code, shareable link |
| Google sign-in + approval queue | v1 | Only approved members can create or join rooms |
| Display name | v1 | Chosen at first sign-in; used in every room |
| Admin page: approve, ban | v1 | Minimal list with buttons |
| Reconnect after drop | v1 | Rejoin the same seat within 60 s |
| Sketch Battle | v1 | Full rules incl. streaks, head starts, the showdown; built in five game phases (D43) |
| Spectators | v1 | Watch both teams; join a team in the next game (D46) |
| Mobile-friendly layout | v1 | Portrait-first |
| In-room text chat | v1 | Also used for guesses in Sketch Battle |
| Codenames | v2 | Text clues; voice later |
| Secret Hitler | v2 | Needs voice |
| Voice chat | v2 | Cloudflare SFU, phase-based muting |
| Learn controls tour | v2 | Per game, phone and PC |
| Rules card + hints toggle | v2 | Per game |
| Capacity caps + kill switch | v2 | Admin page grows these |
| Trio, Flip 7 | v3 | UI-only games |
| Stats and leaderboards | v3 | Needs the database |
| Interactive tutorials, bots | Later | Only if people ask |
| Heavier games (Catan, Splendor, …) | Later | One at a time, by demand |

## System architecture

Players load the site and open one WebSocket, all from one Worker address; the Worker checks the login cookie and routes that socket to the right Room object, which runs the game.

```
                         +------------------------+
                         |        Players         |
                         |  phone or PC browser   |
                         +------------------------+
                pages    |        WebSocket       |   audio (v2)
          +--------------+            |           +---------------+
          v                           v                           v
+-------------------- Cloudflare, free tier -------------------------------+
|  +----------------+      +------------------+      +-----------------+   |
|  |    Web app     |      |    API worker    |      | Voice relay (v2)|   |
|  | static assets, |      | Google login,    |      | Realtime SFU    |   |
|  | PWA, screens   |      | routes sockets   |      +-----------------+   |
|  +----------------+      +------------------+               ^ mute rules |
|                       /           |           \             |            |
|                      v            v            v            |            |
|  +----------------+      +------------------+      +-----------------+   |
|  |   Database     |      |   Lobby object   | ---> |   Room object   |   |
|  | D1: users,     |      | room codes, live |      | one per room:   |   |
|  | sessions       |      | list, caps       |      | sockets, state, |   |
|  +----------------+      +------------------+      | timers, hidden  |   |
|                                                    | info            |   |
|                                                    +-----------------+   |
|                                                             | loads rules|
|                                                             v            |
|                                                    +-----------------+   |
|                                                    |  Game modules   |   |
|                                                    | pure rules, one |   |
|                                                    | folder per game |   |
|                                                    +-----------------+   |
+--------------------------------------------------------------------------+
```

**What happens on one move**

1. A player taps "guess"; the browser sends `move` over its WebSocket.
2. The Room object calls the game's `validate`, then `apply`, timed with server time.
3. The Room calls `view` once per player and sends each their own `patch`.
4. Browsers re-render from the patch; the Room sets an alarm for the next deadline, if any.

| Component | Owns | Never does |
| --- | --- | --- |
| Web app | Screens, input, drawing canvas, countdown display | Decide anything about the game |
| API worker | Serving the site, Google login, sessions, room routing | Hold game state |
| Lobby object | Room codes, live room list, caps | Run games |
| Room object | One room's players, state, timers, voice rules | Contain game rules |
| Game modules | Rules, scoring, what each player may see | Network, storage, clocks |
| Database | Users, approvals, sessions; stats later | Live game state |
| Voice relay (v2) | Forwarding audio | Decide who may speak |

## Tech stack and repo layout

One TypeScript monorepo, all deployed to Cloudflare. TypeScript end to end means the server and browser share game types, and AI models write React and TypeScript better than anything else.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite + Tailwind | Fast to build, mobile-friendly, best AI support |
| App shell | Installable PWA | "Add to home screen" on phones |
| Hosting + realtime server | One Cloudflare Worker with static assets + Durable Objects | Site, API and sockets on one origin; one object per room; WebSockets with hibernation |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM | Users, approvals, sessions; stats later. One schema file drives types and migrations |
| Auth | Google OAuth (free) via a small OAuth library + our own session cookie | No auth service to pay for or depend on |
| Voice (v2) | Cloudflare Realtime SFU | 1,000 GB/month free |
| Package manager | pnpm workspaces | Monorepo with shared packages |
| Tests | Vitest | Game engines are pure functions, easy to test |
| CI/CD | GitHub Actions | Run tests and deploy on every push to main |
| Local dev | Wrangler dev | Runs the Worker and objects on your machine |

**Repo layout**

```
PlayDen/              D:/Projects/PlayDen
  apps/
    web/              React frontend (lobby, room, game UIs)
    server/           Worker (serves web build, auth, API), Lobby object, Room object
  packages/
    engine/           Game contract, seeded RNG, view props, contract test kit (/testing)
    protocol/         WebSocket message types shared by web + server
    ui/               Shared components (timer, scoreboard, canvas, tour)
    games/
      tap-race/       dev-only test game; same layout for every game (see Code practices)
      sketch-battle/
  checks/             architecture checks: game isolation, engine purity, layout, registries
  scripts/            start-local.mjs (pnpm start), new-game.mjs (pnpm new-game)
  docs/               PROJECT.md, games/, plans/, tasks/, explanations/
  AGENTS.md           rules every AI agent follows
  CLAUDE.md           points to AGENTS.md
  README.md           how to run locally
```

Each game folder is its own package, `@playden/game-<id>`, holding its rules, UI, settings, rules card, controls tour and tests. `pnpm new-game <id> "<Name>"` creates it and registers it; nothing else in `apps/` changes (D50).

## Game engine contract

Every game implements the same small interface, as pure deterministic functions with no networking or UI inside. The Room object calls these; it never knows the rules itself.

The full, commented contract is `packages/engine/src/GameDefinition.ts`; this is its shape.

```ts
interface GameDefinition<State, Move, View, Config> {
  id: string;                    // "sketch-battle", lowercase-hyphenated, never changes
  name: string;                  // "Sketch Battle"
  summary: string;               // one line for the game picker
  minPlayers: number;
  maxPlayers: number;
  teams?: TeamRules;             // count, min/max size, largest allowed size gap
  devOnly?: boolean;             // listed only on local dev servers
  defaultConfig: Config;         // timers, points, caps
  configSchema: ZodType<Config>; // the room validates host settings with it
  moveSchema: ZodType<Move>;     // the room parses every move with it before validate

  setup(seats: Seat[], config: Config, seed: number, now: number): State;
  validate(state: State, playerId: string, move: Move, now: number): { ok: true } | { ok: false; reason: string };
  apply(state: State, playerId: string, move: Move, now: number): { state: State; events: GameEvent[] };
  view(state: State, playerId: string | "spectator"): View;
  nextDeadline(state: State): number | null;   // when the server should wake up
  onDeadline(state: State, now: number): { state: State; events: GameEvent[] };
  onPlayerLeft(state: State, playerId: string): { state: State; events: GameEvent[] };
  result(state: State): GameResult | null;     // null while in progress
}
```

**Rules every game follows**

- **Server time only.** `now` comes from the server. Clients never report times, so speed scoring is fair and can't be faked.
- **Seeded randomness.** All shuffles use the seed, so any game can be replayed exactly from its seed + move log to reproduce a bug.
- **Human-readable rejections.** `validate` returns reasons like "Only the drawer can draw". The UI shows them, and learn mode reuses them.
- **Hidden information stays on the server.** `view` strips everything a player may not see (the word for guessers, roles in Secret Hitler, the key card for Codenames operatives). Never send full state to a browser.
- **Events drive the UI.** `apply` returns events ("team A guessed", "streak 3") that the UI animates and the game log records.
- **Tests first.** Each game's spec doc lists its edge cases; each becomes a Vitest test against `setup` / `apply`.
- **Plain JSON, never changed in place.** State, views and events are plain JSON (rooms store and send them as JSON), and every function returns new state instead of editing what it was given.
- **The contract kit checks all of this.** Every game's tests call `describeGameContract(game, fixture)` from `@playden/engine/testing`. It checks metadata, same-seed setup, plain JSON, no in-place changes, reasons on every rejection, no leaked hidden text, and plays seeded random games to the end.

## Rooms, lobby and realtime protocol

Each room is one Durable Object holding one WebSocket per player; a single Lobby object tracks which rooms exist. All messages are small JSON over WebSockets.

**Room lifecycle**

1. **Create:** host picks a game; the Lobby issues a 4-letter code (no look-alike letters such as O/0, I/1) and a link `/r/ABCD`.
2. **Join:** player opens the link, is signed in and approved, and gets a seat under their display name.
3. **Setup:** host sets teams (or shuffles them) and settings; players tap ready.
4. **Play:** host taps start; the Room calls `setup` and the game runs.
5. **Results:** final scores and highlights; host can tap rematch (same room, same players).
6. **Close:** the room deletes itself 60 seconds after the last player leaves (or 60 s after creation if nobody joins); its code then shows "Room not found" (D35).

**Reconnects and leaving**

- The browser stores a `playerToken` per room. Reopening the link or regaining network rejoins the same seat silently.
- A dropped player is marked away. After 60 s away, the game's `onPlayerLeft` decides what happens (e.g. Sketch Battle rotates to the next drawer).
- If the host leaves, host passes to the longest-seated player.
- Late joiners can join as spectators mid-game; they join teams in the next game.

**Message types (shared `protocol` package)**

| Direction | Message | Purpose |
| --- | --- | --- |
| Client → server | `join` | Seat + token (name comes from the account) |
| Client → server | `lobby.*` | Ready, change team, change settings (host) |
| Client → server | `move` | A game move, e.g. `{type:"guess", text:"elephant"}` |
| Client → server | `stroke` | A batch of drawing points (Sketch Battle) |
| Client → server | `chat` | Room chat message |
| Server → client | `snapshot` | Full view for this player (on join and reconnect) |
| Server → client | `patch` | Changed parts of the view after a move |
| Server → client | `events` | Game events for animations and the log |
| Server → client | `error` | A rejected move with its reason |

The client never assumes a move worked; it waits for the server's `patch`. Each move carries a client sequence number so duplicates after a reconnect are ignored.

## Timers, fairness and drawing data

All timing is decided on the server; phones only display it. This is what makes speed-based scoring fair between a fast PC and a slow phone.

**Timers**

- The server sends a deadline as a timestamp, not a countdown. Each client counts down to it after correcting for its clock offset (measured with a ping on join).
- When the deadline passes, a Durable Object alarm fires `onDeadline` even if nobody sends anything.
- Every scored action (a correct guess, a finished showdown word) is timed by when the server received it.

**Fairness limits.** Network delay between players is typically 50–150 ms. That's fine for guessing games where gaps are seconds long. Reflex games like Dobble would need extra handling and are out of scope.

**Drawing data (Sketch Battle)**

- Strokes are sent as point batches about every 100 ms, not point by point, to keep message counts low on the free tier.
- Points are stored relative to the canvas (0–1 on each axis), so a drawing looks the same on a phone and a PC.
- The server keeps each round's stroke list, so a reconnecting or late player sees the full drawing replayed.
- A team's strokes go only to that team and to spectators. The other team gets a coarse block preview built on the server until they've guessed the word themselves, so nobody can peek with dev tools (D47).

## Access control and admin

The site gates people, not links: a forwarded room link is useless to anyone who isn't approved.

**v1: Google sign-in + approval queue** (no passcode)

1. Member signs in with Google and enters a display name and who invited them.
2. Account stays pending until an admin approves it from the admin page.
3. Approved accounts can create and join rooms; pending ones see a waiting screen; banned ones see "access removed".
4. Admins can **decline** a waiting request: the person sees "Your request wasn't approved" and may **ask again** after `ASK_AGAIN_AFTER_MS`; repeat requests show an "Asked again" tag (D36).
5. Admins can **block** a request (spam, strangers) or **ban** a member. Both end their sessions and stop them asking again. In the Banned tab, former members get **Let back in** (member again) and blocked requests get **Unblock** (back to Waiting). In a room, the host or an admin can remove a player (D42); a ban also ending the person's live room seat arrives with the Lobby in phase 3.
6. Admins are the emails in the `ADMIN_EMAILS` secret (comma-separated): auto-approved, never bannable.

Phone/OTP login is avoided because SMS and WhatsApp messages cost money per message.

**Capacity caps (config values, enforced by the Lobby)**

| Cap | Starting value |
| --- | --- |
| Live rooms at once | 25 |
| Players per room | Per game (e.g. Sketch Battle 4–16) |
| Active rooms per user | 1 |
| Players in voice at once (v2) | 100 |
| New rooms per user per hour | 10 |

When a cap is hit, the player sees "Server's full" with a queue position instead of an error. An admin kill switch stops new rooms without ending games in progress.

Cloudflare's free plan fails requests instead of billing when its limits are exceeded, so a leak can't produce a surprise bill.

## Voice chat (v2)

Voice runs through Cloudflare's Realtime SFU: each player uploads one audio stream and the SFU forwards it to the others in the room. This works for any room size, unlike peer-to-peer, which breaks down past about 6 people on mobile data.

**Why the raw SFU.** Its first 1,000 GB per month are free and traffic sent into Cloudflare is never charged. Cloudflare's ready-made voice kit (RealtimeKit) has no free tier, so we write a small connection layer ourselves, with the Room object doing the signalling.

**Budget.** One audio stream is roughly 15 MB/hour. A 10-player hour uses about 1.3 GB; 100 people in voice 3 hours a night is about 900 GB/month, inside the free 1,000 GB. Past that it costs $0.05/GB.

**Speaking rules, set by the game per phase**

- Secret Hitler: executed players are muted for the rest of the game.
- Codenames (later): spymasters muted while their team is guessing.
- Mafia (later): everyone muted at night except the mafia's own channel.

**Player controls:** mute/unmute, push-to-talk option, per-player volume, a speaking indicator on each seat. Voice is off by default in non-voice games.

## Mobile UX, learn controls and learn mode

Phones are the default device. A first-timer should go from a WhatsApp link to playing in under 30 seconds, with nothing to install.

**Mobile rules (v1)**

- Portrait-first layouts; PC gets a wider version of the same screen, not a different app.
- Light and dark themes, following the phone's setting unless the player picks one (D32).
- Touch targets at least 44 px; the main actions sit in a bottom bar within thumb reach.
- No hover-only controls; everything works by tap.
- Screen stays awake during play (Wake Lock API).
- Reconnect is invisible: phones drop sockets when the screen locks, so returning to the tab silently restores the seat.
- Drawing canvas works with finger, stylus and mouse; page scroll is locked while drawing.
- Keyboard-friendly guessing: the guess box stays visible above the phone keyboard.

**Learn controls tour (v2).** Every interactive element in a game screen carries a tag such as `data-tour="guess-box"`. Each game's `tour.ts` lists those tags with three lines each: what it is, what it does, when to use it. The tour finds each element wherever it sits on the current screen, so one script works for both phone and PC layouts. It starts from a "Learn controls" button in the room, and runs once automatically for first-time players of that game.

**Learn mode (v2)**

1. **Rules card:** a 60-second summary per game: goal, a turn, how you win, scoring.
2. **Hints toggle:** first-game hints shown on screen at key moments ("You're the drawer — pick a word").
3. **"Why can't I?"** Rejected moves show the engine's reason inline.
4. **Practice room:** a solo or small room with the hints toggle forced on.

Scripted tutorials and bots come later, only if people ask.

## Code practices and modularity

The codebase is built so a change to one game can never break another, and any model can make a change by touching the fewest files possible.

**Module boundaries (enforced by lint rules)**

| Package | May import | Must never import |
| --- | --- | --- |
| `packages/engine` | Nothing in the repo | Anything |
| `packages/protocol` | `engine` | `apps/*`, `games/*` |
| `packages/ui` | `engine`, `protocol` | `apps/*`, `games/*` |
| `packages/games/<id>` | `engine`, `protocol`, `ui` | `apps/*`, any other game |
| `apps/server` | `engine`, `protocol`, game registry | Game UI files |
| `apps/web` | Everything above | Server code |

**Adding a game:** run `pnpm new-game <id> "<Name>"`. It creates `packages/games/<id>/` with the standard layout and a small working game that already passes every check, adds one line to each registry (`apps/server/src/games.ts`, `apps/web/src/games.ts`) and the workspace dependency in each app. Then write the spec and replace the template rules, tests first. **Removing a game:** delete its folder, its registry lines and the two app dependencies; the architecture checks catch anything left behind. If a new game seems to need platform changes, stop and update this doc first.

**Each game is a package with two entry points:** `@playden/game-<id>` (rules: pure TypeScript, imported by the server) and `@playden/game-<id>/view` (React screens, imported only by the web app).

**Machine-checked rules** (`checks/architecture.test.mjs`, part of `pnpm test`):

- a game never imports another game, an app, or anything outside its folder
- a game's rules import only `@playden/engine` and `zod`; never React, its own `view/`, or the test kit
- engine code and game rules never use `Date.now`, `new Date`, `Math.random`, `performance.now`, `fetch`, timers, `crypto` or storage
- every game has the standard files and tests, and its package is named `@playden/game-<id>`
- the server and web registries list exactly the games that have folders

**Game folder layout (same for every game)**

```
packages/games/<id>/
  package.json   @playden/game-<id>, entry points "." and "./view"
  index.ts       exports the definition and types (the rules entry point)
  config.ts      settings, numbers and the settings schema (timers, points, caps)
  types.ts       State, Move, View, Config types
  engine.ts      the GameDefinition (rules only, no I/O)
  scoring.ts     pure scoring functions (when scoring is more than a line)
  view/index.tsx the screen component (the "./view" entry point)
  tour.ts        learn-controls steps (v2)
  rules.md       60-second rules card
  tests/         Vitest tests, including describeGameContract
```

**Practices**

- **Small files, one job each.** Split any file past about 300 lines.
- **Pure engine code.** No `Date.now()`, `Math.random()`, network or storage inside a game engine; time and randomness come in as arguments.
- **Types first.** Strict TypeScript (`strict: true`, no `any`). Messages are validated at the server boundary with Zod.
- **Names say what things are.** `calculateSecondTeamPoints`, not `calc2`. Files named after their main export.
- **Comments only where the code can't explain itself:** a formula's source, a non-obvious rule, a workaround for a platform bug. No comments that restate code.
- **No magic numbers.** Every tunable number lives in the game's `config.ts`.
- **Few dependencies.** Add a package only when it replaces a lot of code; record why in the Decisions log.
- **Formatting is automatic:** Prettier + ESLint run on commit; nobody argues about style.
- **Errors are visible.** The server never crashes a room on a bad move; it rejects the move with a reason and logs it.

## Testing

Game rules are where bugs hurt most (five friends waiting mid-game), so engine tests are mandatory; everything else is tested lightly.

| Layer | Tool | What is tested | Required? |
| --- | --- | --- | --- |
| Game engines | Vitest | Every rule, scoring formula and edge case in the game's spec | Yes, before merge |
| Scoring functions | Vitest | Worked examples from the spec (e.g. 25 s vs 30 s gives 200 and 154) | Yes |
| Protocol | Vitest | Message schemas accept valid and reject invalid messages | Yes |
| Room object | Vitest + Wrangler test pool | Join, reconnect, host leaves, deadline alarms | Yes for platform changes |
| UI | Playwright, phone + desktop sizes | One smoke test per game: create room, join, play one round | From v2 |
| Manual | Two phones + one PC | Real game before every game night release | Yes |

**Rules**

- Each edge case listed in a game spec becomes one named test, e.g. `second team scores 0 when it never guesses`.
- Engine tests use fixed seeds and fixed times, so they never flake.
- A bug fix starts with a failing test that reproduces it.
- `pnpm test` must pass locally and in CI before anything merges.

## Deployment and environments

Pushing to `main` deploys to production automatically after tests pass. There are no per-PR preview deploys in v1 (D23).

| Environment | How it runs | Used for |
| --- | --- | --- |
| Local | `pnpm dev` (Vite proxying to Wrangler dev, D27) | Building and testing on your machine and on phones on the same Wi-Fi. Google sign-in works on `localhost` only; test players cover phones and multi-player testing (D48) |
| Production | One Cloudflare Worker (site + API + sockets) from `main` | Game nights |

**CI pipeline (GitHub Actions, on every push and pull request)**

1. Install with pnpm (cached).
2. Typecheck, lint, format check.
3. `pnpm test`.
4. Build web and server.
5. On `main` only: apply D1 migrations, then deploy the Worker (Wrangler), which ships the web build as its static assets. Both run with `--env production` (D39).

**Rules**

- Secrets (Cloudflare API token, Google OAuth keys, `ADMIN_EMAILS`) live in GitHub and Cloudflare secrets, never in the repo. Locally they go in `apps/server/.dev.vars` (gitignored); production Worker secrets are set with `wrangler secret put <NAME> --env production` (D39).
- Don't deploy during a live game night. Deploys restart room objects, which can drop games in progress.
- **Rollback:** revert the commit on `main`; CI redeploys the previous version in a few minutes. Cloudflare's dashboard can also roll back to the previous deployment instantly.
- Durable Object data changes need a migration entry in `wrangler.toml`; never rename an object class without one.

## Hosting, free-tier budget and costs

v1 costs ₹0. The one limit to watch is Durable Object messages during Sketch Battle; if we hit it, the fix is Cloudflare's paid plan at about $5/month.

**Hosting**

- One Worker serves the web build as static assets, plus the API and WebSockets; Durable Objects and D1 on the same account.
- Free address to start: `<name>.<account>.workers.dev` for everything. Buy a domain only once the community sticks with it.
- GitHub Actions runs tests and deploys on every push to `main`. It does not host anything.

**Free-tier limits that matter** ([Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing), [Realtime pricing](https://developers.cloudflare.com/realtime/sfu/pricing))

| Limit | Free allowance | What uses it |
| --- | --- | --- |
| Durable Object requests | 100,000/day, incl. WebSocket messages | Every move, chat line and stroke batch |
| Durable Object duration | 13,000 GB-s/day | Rooms with open sockets; hibernation keeps idle rooms free |
| Durable Object storage | 5 GB total | Tiny for us |
| Realtime SFU + TURN | 1,000 GB/month | Voice |

Over a free limit, Cloudflare fails the request instead of charging; limits reset daily at 00:00 UTC (05:30 IST).

**The one hot spot: Sketch Battle strokes.** Two drawers sending 10 batches/s for 15 rounds plus the relay comes to roughly 10,000–15,000 incoming messages per game. Checked during setup (D33): incoming WebSocket messages count 20:1 toward requests, outgoing messages are free, and each connection costs one request, so a game costs roughly 500–750 requests, about 130+ full games per day on the free plan. Keep batching strokes (100–200 ms) and hibernation on; the paid plan is only a fallback.

**Where money may be needed**

| Item | When | Rough cost |
| --- | --- | --- |
| Cloudflare Workers paid plan | Regular game nights exceed free limits | ~$5/month |
| Voice beyond 1,000 GB | 100+ people in voice most nights | $0.05/GB over |
| Domain | Optional, once the site sticks | ~₹500–1,200/year |
| Error tracking, uptime | Optional | Free tiers exist |

Realistic steady state: $0–7/month, well inside the $20/month budget.

## Game catalog and sub-doc index

Each game gets its own spec doc in `docs/games/` (rules, edge cases, scoring formulas, settings, UI flow, controls tour, tests), written in a fresh session so each one has full focus.

| Game | Version | Players | Voice | Spec doc |
| --- | --- | --- | --- | --- |
| Sketch Battle | v1 | 4–16, two teams | No | [`docs/games/sketch-battle.md`](games/sketch-battle.md) |
| Codenames | v2 | 4–16, two teams | Later | To write |
| Secret Hitler | v2 | 5–10 | Yes | To write |
| Trio | v3 | 3–6 | No | To write |
| Flip 7 | v3 | 3–18 | No | To write |

**Sketch Battle in short** (the spec has every detail)

- Two teams. Each round one drawer per team draws the **same word** at once while teammates guess. The rules follow drawbattle.io so players feel at home; the name, look and words are ours (D17).
- 15 rounds, then **the showdown**.
- **Round points:** first team to guess 200, second team 100, no guess 0 (D14).
- **Drawers:** the winning drawer stays; the losing team rotates to its next player, the "challenger", who picks the word (D15).
- **Head start:** if the staying drawer has won 2+ rounds in a row, the challenger starts drawing `3 + (streak − 2)` seconds early. There are no streak points (D15).
- **The showdown:** all round words in one shared shuffled order, drawers rotating per word, no timer; 100 per word, +100 for finishing; ends when one team finishes (D16).
- Every number lives in `config.ts` and can be tuned after game nights.

## Agent playbook

Any model (Claude, an open-source model, a human) follows the same loop, so work stays consistent no matter who picks it up.

**Task file format (`docs/tasks/NNN-<slug>.md`)**

```md
# 012 — Sketch Battle: second-team scoring
Phase: 4 (Sketch Battle v1)
Depends on: 010, 011
Touches: packages/games/sketch-battle/scoring.ts, tests/scoring.test.ts
Spec: docs/games/sketch-battle.md#round-points

## Steps
1. ...
2. ...

## Done when
- [ ] tests for every worked example in the spec pass
- [ ] pnpm typecheck, lint, test pass
```

**The loop, every task**

1. Read `AGENTS.md`, the Decisions log and the task file. Read the game spec if the task names one.
2. Check the task's dependencies are done. If not, stop and say so.
3. Touch only the files listed under "Touches". Needing another file is fine if small; say which and why in the summary.
4. Write or update tests first for any rule or formula, then the code.
5. Run `pnpm typecheck && pnpm lint && pnpm test`. Fix until all pass.
6. Tick the task's "Done when" boxes; write a 3–5 line summary of what changed.
7. Hand the work to the owner to test (what to try and where). Commit once they confirm, message `[ADD] second-team scoring` (D28). Pure docs can be committed when done.

**Guardrails**

- Don't change behaviour the spec doesn't ask for. Spot a problem in the spec? Note it in the summary; don't silently "fix" it.
- Don't edit another game's folder or the platform from a game task.
- Don't add dependencies, rename packages or restructure folders unless the task says so.
- Don't remove or weaken a test to make it pass.
- Unsure between two approaches: pick the simpler one and note it.
- Never commit secrets or put them in code.

## Build phases and next steps

Work happens in focused sessions, one doc or one build step per session, so each gets full context.

1. **Planning:** this doc (done).
2. **Setup:** monorepo, Google sign-in + approval queue + admin page, one Room object, Worker deploy via GitHub Actions; a deployed "hello room" where two phones on different networks see each other join. Plan: `docs/plans/02-setup.md`. Then write the Sketch Battle spec (D21).
3. **Game platform:** dev test-player sign-in, seeded randomness, game registry with the dev-only Tap Race, rooms that run games, teams and spectators, away seats. Plan: `docs/plans/03-game-platform.md`. Caps, kill switch, live room list, ban kicks from live rooms and PWA move to "Platform extras" before the first full community release.
4. **Sketch Battle v1:** plan `docs/plans/04-sketch-battle.md`, in five game phases (D43), each playable on its own: core round, full match, showdown, settings and words, polish. Engine + tests from the spec first in each, then the UI.
5. **Game night 1:** play with 8–12 people; collect feedback; tune `config.ts`.
6. **v2:** voice, Codenames and Secret Hitler specs and builds, learn controls tour, admin caps + kill switch.
7. **v3:** Trio, Flip 7, stats and leaderboards.

**Success check after 3–4 weeks:** do people come back for game night without being pushed? If yes, keep adding games by demand. If no, stop and keep what we learned.

**Open questions**

- Who besides the owner will be an admin?
