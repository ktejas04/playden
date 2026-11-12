# Rooms and games — system design

Status: agreed with the owner on 2026-11-12 (D51). This doc is the source of truth for how the lobby, rooms, players and game sessions fit together. Where an older section of `docs/PROJECT.md` or a task disagrees, this doc wins until they are updated.

## 1. The three places

| Place | What it is | Lives in |
| --- | --- | --- |
| **Lobby** | The home screen: create a room or join one by code. Later also the live room list and caps. | Home screen today; one Lobby Durable Object later (D7) |
| **Room** | The people present, one host, and at most one game session at a time. | One Durable Object per room code |
| **Game session** | One game being set up, played or finished in a room, with its own players and spectators. | Inside the room's Durable Object |

A room runs **one game at a time**. To play something different at the same time, people create another room.

## 2. Entities and relations

```
USER                          D1, permanent
  id PK, email, displayName, status (pending|approved|declined|banned)
  admin = email listed in ADMIN_EMAILS (D22)
  1 ── * AUTH_SESSION         D1: tokenHash, userId FK, expiresAt

LOBBY                         home screen today; one Durable Object later
  1 ── * ROOM                 index of live rooms: code, gameId, state, player count
  currentRoom: userId → roomCode   one room at a time per person (section 6, "One room at a time")

ROOM                          one Durable Object per code; closes 60 s after it empties (D35)
  code PK, createdBy FK→USER, createdAt
  hostId FK→ROOM_MEMBER       one host for the room and its game (section 5)
  removedUserIds[]            removed from the ROOM, can't come back until it closes (D42)
  state: idle | setup | playing | results
  1 ── * ROOM_MEMBER
  1 ── 0..1 GAME_SESSION      the current session; none while idle

ROOM_MEMBER                   everyone present in the room
  PK (roomCode, userId)
  name, joinedAt              joinedAt = seniority for host handover
  connection: connected | away (since awayAt)
  one live device (D49 Play here)

GAME_SESSION                  one game set up, played and finished in a room
  id PK (1, 2, 3… within the room), roomCode FK
  gameId → GAME_DEFINITION, config, seed
  phase: setup | playing | results
  state (engine state, never sent to browsers), result, endedEarly
  createdAt, startedAt, endedAt
  1 ── * GAME_PARTICIPANT

GAME_PARTICIPANT              a room member's part in one session
  PK (sessionId, userId), userId FK→ROOM_MEMBER
  role: player | spectator
  team, seatOrder             players only; seatOrder = join order (team rotation order)
  status: active | away | left
  banned                      can't be a player again in this session
  sawHiddenInfo               later: set when spectating a hiddenInfo game

GAME_DEFINITION               code, not data: packages/games/<id> (D50)
  id, name, summary, minPlayers, maxPlayers, teams?, devOnly?, configSchema, moveSchema
  later: hiddenInfo, seatRefill (section 9)

GAME_RECORD                   D1, later (stats, v3)
  sessionId, roomCode, gameId, playerIds, result, startedAt, endedAt
  sessions that ended early are not recorded
```

**Relations in words**

- A user is in **at most one room at a time** (D52), with one live device in it (D49). Over time they can be in many rooms.
- A room has many members and at most one current game session.
- A session has many game participants, and each game participant is one member of that room.
- A member with no game participant row in the current session is **in the room**: neither playing nor spectating.
- A session runs exactly one game definition and never changes game. Picking a different game in setup replaces the session before it starts (section 4).

## 3. Roles

During a session, everyone in the room is in exactly one role:

| Role | Who | Sees |
| --- | --- | --- |
| **Playing** | Joined the game in setup | The game, with their own player view |
| **Spectating** | Chose Spectate: in setup, from the popup or card mid-game, or after leaving or being banned | The game, with the spectator view; can't move |
| **In room** | Everyone else | The room screen, plus a card for the current game |

The room screen's member list shows a **Playing** or **Spectating** badge next to each member, at every stage. People in the room get no badge. The host keeps the crown.

## 4. Room states and flow

```
IDLE        no game picked. Room screen, same as today.
  │ host picks a game
SETUP       game picked, not started. Join game and Spectate are open; anyone can switch between them.
  │         People just in the room get a Join game / Spectate popup; arrivals by link too.
  │         Host: change the game, change settings, cancel back to Idle, Start.
  │ host taps Start (enabled once player count and team rules are met)
PLAYING     players are locked. Everyone else (arrivals too) gets a Spectate popup.
  │ game ends on its own │ host taps End game │ no players are left
RESULTS     host: [Play again] [Return to room]
  ├─ Play again      → SETUP with the same game and settings. The last game's players and spectators
  │                    carry over in their roles (players with their teams); people just in the room can join.
  └─ Return to room  → IDLE. Roles clear; the host picks a game again.
```

### Idle

- The room screen: code, invite, member list, and a game picker for the host. Everyone else sees "The host is picking a game".

### Setup

- Picking a game opens a session in `setup` and **joins the host as a player automatically**. The host can't spectate their own game.
- **The setup popup:** everyone just in the room gets a popup naming the game, with two buttons, **Join game** (main) and **Spectate**, and a **close icon (✕)** in the corner. Join game or Spectate takes them to the setup screen.
  - Closing the popup means "not interested": they stay on the room screen, just in the room. Tapping outside the popup or the phone's back gesture does the same.
  - The ✕ is labelled "Not interested" for screen readers and has a full-size touch target.
  - It appears when the host picks a game from Idle (everyone but the host is just in the room then), when Play again opens setup, and for anyone who arrives during setup.
  - After closing it, a "Setting up <game> · Join game / Spectate" card stays on the room screen, so they can still join until Start.
- **Switching is free until Start:** a player can switch to Spectate and a spectator to Join game, as often as they like, or back out to the room. The host is the only exception, always joined.
- **Joining is open until Start**, through the popup or the card.
- **Game full:** Join is disabled with "Game is full", and Spectate still works.
- **Teams** (games with `teams`, task 018): joining puts you on the smaller team, the first team on a tie. Players can switch teams, and the host can shuffle or move people. Start shows the reason when the team rules aren't met.
- **Host changes the game:** the setup session is replaced. Joined players stay joined. If the new game has fewer seats, the last to join move to spectating. Teams are rebalanced.
- **Host cancels:** back to Idle, and all roles clear.
- **Leaving the room** during setup removes you from the session.
- **Start** (host only) checks player count and team rules, creates the seed and calls `setup`.

### Playing

- Players are fixed. Anyone who arrives lands in the room, like everyone else, and gets the popup with **Spectate** only (✕ for not interested). Nobody becomes a spectator without choosing. Being admitted mid-game as a player comes later (section 9).
- The popup never comes back to someone who already played or spectated in this session (a player who leaves, or a banned one, uses the card instead).
- People in the room who aren't spectating see a "Game in progress · Spectate" card on the room screen.
- **Leave game** (player, with a confirm): the seat is freed at once, `onPlayerLeft` runs, and the player is back in the room. They can spectate.
- **End game** (host, with a confirm): ends the session as **Ended early**. The game's standings so far are shown with no winner, and it is never recorded in stats.
- **No players left** (everyone left or was banned): the session ends on its own as Ended early.

### Results

- The server ends the game, and the results screen comes up **automatically for players and spectators**. There's no "See results" button.
- People just in the room stay on the room screen and see nothing about the results. Someone who arrives during results is also just in the room.
- **Play again** (host): a new session in setup with the same game and settings.
  - **Only the last game's players and spectators carry over**, in their roles: players are joined already (with their teams), spectators are spectating. They go straight to the setup screen.
  - People just in the room get the setup popup, as when a game is picked from Idle.
  - As in any setup, players and spectators can switch until Start.
  - The host taps Start again.
  - Bans from the last session don't carry over.
- **Return to room** (host): back to Idle.

## 5. Host

One host for the room and its game. There is no separate game host.

| Room state | Who can be host | Handover |
| --- | --- | --- |
| Idle, Setup | Any member (D40) | When the host leaves or is removed: at once. When the host drops: after 60 s away. The new host is the longest-present connected member |
| Playing | **Players only.** Spectators and people in the room never control the room | When the host leaves the game, leaves the room or is removed: at once. When the host drops: after 60 s away. The new host is the active player who has been longest in the room |
| Results | **Players only**, as while Playing: the host's controls (Play again, Return to room) are on the results screen | As while Playing. If none of the game's players is left in the room, the game closes and the room is Idle again, where anyone can be host |

- If no player is connected while Playing, host stays where it is until a player is back. The game itself keeps running on its deadlines.
- A host who returns doesn't get host back; it stays with the new host (D40).
- This changes D40: host handover now waits for the 60 s away grace (planned in task 019) instead of happening at once on a drop.

**Host-only actions:**

- pick, change or cancel the game
- change settings
- shuffle and move players between teams
- Start
- ban from the game
- End game
- Play again
- Return to room
- remove from the room (D42, which admins can also do)

## 6. Leaving, dropping, banning

| Event | Effect on the game | Effect in the room |
| --- | --- | --- |
| **Drop** (an accident: lost signal, the phone in the background, a closed or reloaded tab) | The player keeps their seat for the whole game, shown as **away**. They slide straight back in whenever they return. Each game decides what an away player's turn means (Sketch Battle picks another drawer; a turn-based game waits) | Shown as away. The host passes on after 60 s (section 5) |
| **Play here** (device switch, D49) | Not a drop; the seat carries straight on | Nothing changes |
| **Leave game** (button) | The seat is freed at once; `onPlayerLeft` runs | They stay in the room and can spectate |
| **Ban from game** (host) | Same as Leave game, and they can't be a player again **in this session** | They stay in the room and can spectate. They can join the next session |
| **‹ Lobby / Leave on the room screen** (a choice) | Same as Leave game, with the same warning for a player mid-game. Outside play there's nothing to lose, so no warning. The host in setup or results just hands host on | Gone from the member list |
| **Removed from room** (D42) | Same as Leave game, at once | Gone, and can't come back until the room closes |

More rules:

- During setup, a joined player who stays away for 60 s is moved out of the session. A Start within those 60 s still seats them.
- The host can ban anyone but themselves, admins included: a game ban only costs a seat in one session. Removing an admin from the room is still not allowed (D42).
- Spectators who drop come back spectating. Roles return as they were while the session is the same.
- An empty room closes 60 s after the last connection, with its game, even if seats are held (D35).

### One room at a time (D52)

A person is in at most one room at a time, so nobody plays two games at once (for example a Splendor turn in one room and Sketch Battle in another). A seat is held for the whole game, so a player busy in a second room would leave their first game stuck.

- Opening another room while already in one shows a prompt: "You're in room ABCD (playing Tap Race). Leave it and join WXYZ?" If you're only in the room, it says so instead of naming the game.
- **Join WXYZ** leaves ABCD at once, exactly like Leave room: the seat is freed, `onPlayerLeft` runs, and host passes on if you were host. **Cancel** keeps you in ABCD.
- This is Play here (D49) applied across rooms instead of across devices in one room.
- It covers every role, including spectating and being just in the room: one room at a time, with no exceptions.
- **Enforced by the Lobby object**, which knows each person's current room. Until the Lobby is built, a second room is technically possible but not supported.
- Test players are separate accounts, so several test players in one browser still work.

## 7. Screens

| Room state | Players and spectators | People in the room |
| --- | --- | --- |
| Idle | Room screen | Room screen |
| Setup | **Game screen, setup** | Room screen with the setup popup (Join game / Spectate, ✕ to close); after closing it, a "Setting up" card |
| Playing | **Game screen** | Room screen; arrivals get the Spectate popup (✕ to close); a "Game in progress · Spectate" card stays |
| Results | **Game screen, results** (automatic) | Room screen, unchanged |

**Room screen** (Idle, and for people in the room): code, invite, member list with Playing and Spectating badges and the host crown, the game picker for the host, and a card for the current game.

**Setup screen:**
- the game's name and one-line rules
- settings (the host edits, others read)
- the joined list, or team columns for team games
- an Invite button, since link joins still work

A game can provide its own setup panel. Sketch Battle will, with two team columns. Other games get the standard one: player list plus settings.

The bottom bar:
- players and spectators get **Join game** and **Spectate**, with the current choice marked
- the host gets **Start**, or "Need 2 more" or the team rule that is missing, plus a back arrow to change the game or cancel

**Game screen:**
- the game's own view, a Spectating label for spectators, and away markers on avatars
- the menu has **Leave game** for players, plus **End game** and **Ban from game** for the host

**Results:** results card. The host gets **Play again** and **Return to room**, and everyone else sees "Waiting for the host".

**Exits: one per screen, always in the bottom bar** (except players mid-game, whose exit sits behind ⋯, away from the game's controls). Room pages have no back button in the header, and the wordmark there is not a link. The phone's back gesture counts as a drop.

| Where | Exit | Goes to |
| --- | --- | --- |
| Room screen | Leave | Lobby |
| Setup, player or spectator | Leave | Room |
| Setup, host | Cancel (with a warning) | Room, for everyone |
| Playing, player or host | ⋯ → Leave game (with a warning) | Room |
| Playing, spectator | Leave | Room |
| Results | ← (others), Room (host) | Room |

## 8. What this changes in the code

### Engine contract (`packages/engine`)
- **`standings(state)`**: scores so far, for Ended early. Or `result` may be called mid-game; decided in the task.
- **Presence:** the room tells the game which players are away, so games can skip them. `onPlayerLeft` keeps meaning "this seat is gone for good" (Leave, ban, removal).
- **Optional setup panel** on the web entry (`/view`).

### Protocol
- The room snapshot carries each member's role: `player`, `spectator` or none.
- `game.status` carries the session phase, the game, its settings, game participants (role, team, status, banned) and `endedEarly`.
- New client messages:
  - `game.pick`, `game.setConfig`, `game.join`, `game.spectate`, `game.leave` (back to just being in the room: un-join in setup, stop spectating, or Leave game mid-game), `game.start`, `game.ban`, `game.end`, `game.playAgain`, `game.returnToRoom` (cancel setup, or leave the results)
  - team messages from 018
- `lobby.*` messages are renamed so "lobby" only means the home screen.

### Room server
- `roomGame.ts` holds the session and game participants.
- Seating comes from joins, replacing the "everyone present plays" stopgap and its alternating teams.
- Host rules are per section 5.
- Away and grace handling is folded into the one alarm (019).

### Web
- The room screen becomes Idle-only.
- New setup, game and results screens.
- Badges on the room screen.

## 9. Designed now, built later

- **Admit mid-game:** the host lets a spectator or someone in the room take a free seat while Playing.
- **Seat refill:** a game declares `seatRefill: never | openSeats`. With `openSeats`, a spectator or the player who left can take a free seat mid-game.
- **Hidden-information games** (Mafia, Secret Hitler, Codenames): the game declares `hiddenInfo: true`.
  - Spectating sets `sawHiddenInfo`, and anyone with it can't take a seat in that session.
  - This includes a player who left and then spectated, because they saw everyone's cards.
  - It resets every session.
  - Each game decides what its spectator view shows.
- **One room at a time** (D52): the leave-and-join prompt, enforced by the Lobby object.
- **Lobby room list:** the home screen lists live rooms with their game and state ("Setting up · 3 joined", "Playing").
- **Stats:** finished sessions are written to `GAME_RECORD` in D1.

## 10. Test scenarios (each becomes a test)

1. Host picks a game: the host is joined, everyone else gets the setup popup (Join game / Spectate, ✕ to close), and Start is disabled until enough players join. The host has no Spectate option.
2. Someone arrives by link during setup and gets Join game / Spectate; someone arriving during play is just in the room, gets the Spectate popup, and only spectates after choosing it.
3. Game full: a further Join is refused with "Game is full".
4. Host changes the game in setup: joins are kept, and any overflow moves to spectating.
5. Start with 3 players and 1 spectator: only the 3 can move. The spectator's move is refused with "You're spectating this game".
6. A player drops for 30 s mid-game and comes back to the same seat, with no `onPlayerLeft`. A player who drops for 5 minutes also comes back to their seat.
7. Leave game frees the seat and runs `onPlayerLeft` once; the player can then spectate.
8. Host bans a player: they're back in the room, can spectate, can't join this session, and can join after Play again.
9. The host drops mid-game: host passes to the longest-present active player after 60 s, never to a spectator. With no connected player, host stays put.
10. The host leaves the game mid-game: host passes at once to a player.
11. End game: results show Ended early with no winner.
12. All players leave: the session ends on its own as Ended early.
13. Play again: previous players are pre-joined with their teams and previous spectators are spectating, both on the setup screen. Someone just in the room gets the setup popup, closes it, then joins from the card. Start works.
14. Return to room: roles clear and the room is Idle.
15. Play here mid-game: the seat moves to the new device and the player is never marked away.
16. Every move from each of 3 players on 2 teams is accepted. This is a regression test for the "Asha couldn't tap" bug.
17. A room reload (Durable Object eviction) mid-setup and mid-game keeps the session, game participants and host.
18. Setup switching: a player switches to Spectate and back, and a spectator switches to Join game. The host can't switch away from playing. After Start, switching is refused.
