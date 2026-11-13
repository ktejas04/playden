# Sketch Battle — game spec

Id: `sketch-battle` · Version: v1 · Players: 4–16 in two teams · Voice: no · Last updated: 2026-11-13

Two teams race to guess the same word, each from its own drawer's sketch. The mechanics copy drawbattle.io, checked against its game code on 2026-11-13, so the game plays exactly like the original. The name, look, animations, sounds and word list are our own (D17). Where we deliberately differ, section 2 says so and why. Rules marked **(ours)** are ones the original decides on its server, where we can't see them.

## 1. Rules card (60 seconds)

> **Goal:** score more points than the other team.
>
> **A round:** each team has one drawer. Both drawers sketch the **same word** at the same time while their teammates guess. First team to guess gets **200**, the second gets **100**, a team that never guesses gets **0**.
>
> **Drawers:** win the round and you keep drawing. Lose and the pencil passes to your team's next player, the **challenger**, who picks the next word.
>
> **Streaks:** keep winning and the challenger gets a **head start**: 3 seconds of drawing alone at 2 wins in a row, then 1 more second per extra win.
>
> **The showdown:** after the last round, every word comes back. Teams race through them with a new drawer each word. 100 points per word, +100 for finishing first. First team done ends the game.

## 2. Decisions

Game rule decisions live here (D57). Platform decisions stay in `docs/PROJECT.md`.

| # | Decision | Date |
| --- | --- | --- |
| SB1 | Scoring as the original: first team 200, second team a flat 100 however late, no guess 0 (D14) | 2026-11-11 |
| SB2 | Winner's drawer stays, the losing team rotates and its challenger picks the word. Head start `3 + (streak − 2)` s from a streak of 2, no streak points (D15, same as the original) | 2026-11-11 |
| SB3 | Showdown as the original: 100 per word, +100 for finishing, ends when one team finishes (D16) | 2026-11-11 |
| SB4 | Copied from the original: the head start is private (only the chooser sees their canvas, nobody guesses until both draw); no opponent canvas in the showdown; a drawer's canvas locks once their team guesses; both drawers see the two word choices; replays are a quick redraw; everyone taps Continue after a round | 2026-11-13 |
| SB5 | Our timer differences: any player may force the next round after **10 s** and the showdown title card lasts **10 s** (the original uses 11 s for both) | 2026-11-13 |
| SB6 | Our fairness differences: guesses are limited to 3 in any 3 s, at most 36 characters, no pasting, all checked on the server (the original checks only in the browser). The opponent's pixel view is built on the server from strokes it never sends (the original sends the full strokes and the word to every browser and hides them there) | 2026-11-13 |
| SB7 | Our look: the same tools (10 colours, eraser, clear, 4 sizes) in our own shades and styling | 2026-11-13 |
| SB8 | Platform differences: the host keeps Start, settings and End game (D51); seats belong to accounts, so nobody takes over another player's seat; one word list of our own (~2,500 words); no word packs, streamer mode or player-written words for now | 2026-11-13 |
| SB9 | Teams are 2–8 players each with no size-gap rule (D44, as the original) | 2026-11-13 |
| SB10 | Strokes and wrong guesses are live moves (D55): kept in memory and sent as small changes. The game is saved when the word is chosen, on each correct guess, at round end, on Continue taps and at every phase change | 2026-11-13 |
| SB11 | Drawing is sent in 150 ms batches, with pen-down and pen-up sent at once; phones play each batch back smoothly. Teammates and opponents get each batch's update in the same message cycle | 2026-11-13 |
| SB12 | A team that loses its connected players mid-round doesn't stop the round: it plays on and times out normally. The next round doesn't start until **each team has at least 2 connected players**: until then the result stays up with "Waiting for <team>", and Continue and Start next round are locked for everyone. The host can always End game (answers section 22) | 2026-11-13 |

## 3. Terms

| Term | Meaning |
| --- | --- |
| Drawer | The one player per team who draws this round |
| Guesser | Everyone else on a team; types guesses |
| Chooser | The drawer who picks the word this round |
| Challenger | The losing team's new drawer after a round with a winner; always the chooser |
| Streak | Rounds in a row won by the same drawer for the same team |
| Head start | Seconds the chooser draws alone before the round starts for everyone |
| Rotation | A team's drawing order: its order in setup (join order, or the shuffle) |
| On deck | The player after the next drawer in a team's rotation |
| Away | A player whose connection dropped; they keep their seat (D51) |
| Spectator | Someone who chose Spectate; sees everything, can't guess (D51) |

## 4. Setup

The platform's setup screen (D51) runs this:

- Everyone chooses **Join game** or **Spectate**. Players pick a team (to the end of its rotation); the host can **Shuffle teams**.
- **Start** is host-only and enabled when each team has 2–8 players, otherwise disabled with the reason ("Team 2 needs 1 more"). Uneven teams are fine.
- **Settings** (D53 popup; host edits, everyone views): rounds 10 / **15** / 20 / 25, seconds per round 15–120 in 15 s steps (default **60**), show word lengths (**on**).
- After Start comes the platform's 3-2-1 (D51), then round 1's choose stage. The engine gets the players, teams, settings and a seed; everything random (word order, word choices, the round-1 chooser team) comes from the seed.

## 5. A round

| # | Stage | Length | What happens |
| --- | --- | --- | --- |
| 1 | Choose | 15 s | Both drawers see the two words; only the chooser can tap one. Guessers and spectators see the matchup "<drawer A> vs <drawer B>" with streak and head start badges and "<name> is choosing…". On timeout the first word is picked **(ours)** |
| 2 | Countdown | 3 s | 3-2-1 for everyone. Both drawers now see the word |
| 3 | Head start | `h` s, only if `h > 0` | Only the chooser draws, and only the chooser sees that canvas. Everyone else, including the chooser's teammates, sees "<name>'s head start" with a countdown. Nobody can guess |
| 4 | Drawing | round length | Both drawers draw, guessers guess. The deadline is round length after the head start ends, so the chooser draws round length + `h` in total |
| 5 | Round end | — | When the deadline passes, or the moment both teams have guessed |
| 6 | Result | 5 s | Overlay on each canvas: "you won by 2.4 seconds! +200 points" / "you lost by 6 seconds! +100 points" / "time's up! the word was …" |
| 7 | Summary | until ready | Section 10. The next round starts when every connected player has tapped Continue, or when any player taps Start next round, available after 10 s |

After the last round, the showdown begins (section 9).

**Who chooses**

- Round 1, or after a round nobody guessed: a random team, picked with the seed, and its drawer chooses. Head start 0 (D44).
- After a round with a winner: the losing team's new drawer (the challenger) chooses, with head start `h` from section 7.

**Who sees the word**

- Both drawers from the countdown on. Spectators always. Guessers once their own team has guessed it.
- Before that, guessers see blanks: every letter or digit becomes `_`, and spaces and punctuation stay (`_ _ _   _ _   _ _ _ _`, `_-_ _ _`). With "show word lengths" off they see a single blank line instead.

**Who can draw**

- The chooser from the head start on (or from the drawing stage when `h = 0`); the other drawer from the drawing stage.
- A drawer's canvas locks the moment their team guesses the word.

## 6. Guessing and scoring

**Matching.** A guess is correct when, after normalising both, it equals the word. Normalising means: strip accents, lowercase, then remove everything except letters and digits. So "X-Ray!" and "xray" both match `x-ray`.

**Rules**

- Only guessers can guess, and only during the drawing stage (not during the choose, countdown or head start stages).
- Once a team has guessed, its guess box locks ("You got it!"). One correct guess per team is enough.
- Your team's guesses show to your team and to spectators. Once your team has guessed, you also see the other team's guesses and its real canvas.
- Each guess in the feed shows how long after that team's drawing started it came ("+12.3 s").
- A guess is at most 36 characters. Each player may send at most 3 guesses in any 3 s; faster ones are refused with "Slow down". Pasting into the guess box is blocked. The browser stops these before sending; the server checks them again.
- All timing uses the server's receive time (D9). If two correct guesses carry the same millisecond, the one the room processed first wins.

**Round points (SB1)**

| Outcome | First team | Second team |
| --- | --- | --- |
| Both guess | 200 | 100, however late |
| Only one guesses | 200 | 0 |
| Nobody guesses | 0 | 0 |

The result's "won by" gap is the time between the two teams' correct guesses. Under 1 s it shows one decimal ("0.4 seconds"); otherwise it rounds up to whole seconds.

**Worked examples**

1. Team A guesses at 12.3 s, team B at 47.0 s → A 200, B 100. A "won by 35 seconds".
2. Team A guesses at 20 s, team B never does → A 200, B 0. B sees "time's up! the word was …".
3. Nobody guesses → 0 and 0. Both teams rotate drawers and a random team chooses next.
4. Showdown with 15 words: A finishes all 15 while B has finished 9 → A 15 × 100 + 100 = **1600**, B 9 × 100 = **900**. B's half-drawn 10th word doesn't count.

**Game total** = sum of all round points + showdown points. Higher total wins; equal totals are a draw.

## 7. Streaks and head starts (SB2)

**Streak.** Look back from the last round. Count rounds in a row won by the same team **with the same drawer**. It counts only if that drawer is drawing for that team again in the coming round. A round with no winner, a loss or a drawer change breaks it.

**Head start** for the coming round's challenger:

```
h = 0                                  if streak < 2
h = 3 + (streak − 2) × 1               otherwise
h = min(h, HEAD_START_MAX_SECONDS)     only if a cap is set (default: no cap)
```

| Opponent's streak | 0–1 | 2 | 3 | 4 | 5 | 10 |
| --- | --- | --- | --- | --- | --- | --- |
| Head start | 0 s | 3 s | 4 s | 5 s | 6 s | 11 s |

There are no streak points. A streak shows as a badge ("3x streak") and feeds the head start.

## 8. Drawer rotation

- Each team's rotation is its setup order. Round 1's drawers are each team's first player.
- After a round:
  - **Winning team:** the drawer stays, unless they're away or have left; then the next connected player.
  - **Losing team:** the next connected player after the current drawer.
  - **No winner:** both teams move to their next connected player.
- "Next connected" walks the rotation from the current drawer, wrapping around and skipping away and departed players. If nobody else is connected, the same drawer goes again.
- **On deck** is the next connected player after the next drawer.

**Example.** Team A rotation [Asha, Ben, Chi], team B [Dev, Esha, Faiz]. Round 1: Asha vs Dev; A wins. Round 2: Asha stays, Esha is the challenger and picks the word, Faiz is on deck. A wins again (Asha's streak is 2). Round 3: Asha vs Faiz, and Faiz gets a 3 s head start. B wins. Round 4: Faiz stays, Ben is A's challenger with no head start (Faiz's streak is 1).

## 9. The showdown (SB3)

- **Words:** every word from the rounds played, including unguessed ones, in one seeded shuffle that is the same for both teams.
- **Intro:** a 10 s title card showing each team's lineup, then a 3 s countdown.
- **Play:** each team's first drawer is its next drawer under the normal rotation rules. When a team guesses a word, a 2 s handoff **(ours)** passes the pencil to its next connected player, who sees the next word. No timer, no passing, no head starts.
- **What players see:** only their own team's canvas and feed, plus the running score in words finished ("9 – 7") and a word track per team. A team sees the text of the words it has finished. Spectators see both canvases.
- **End:** the moment one team guesses its last word. A 5 s result overlay ("you win! final score 1600"), then the results screen.

## 10. Round summary and ready-up

- Round number and both team scores, counting up from the previous scores.
- **Drawer handoff:** the staying drawer, marked "winner" with the streak badge. On the losing side, the last drawer hands the pencil to the "next challenger", who shows their head start badge if any. When nobody won, both sides show "next drawer". The animation is our own (section 13).
- On deck for each team.
- **Replays:** both canvases from this round with a Replay button that quickly redraws the strokes in order, plus each team's guess log with times.
- **Continue:** every player taps it and a tick appears next to their name. The next round starts when every connected player has ticked; away players aren't waited for.
- **Start next round:** after 10 s, every player gets this button, so one inattentive person (host included) can't hold the room up. Spectators get neither button.
- **Both teams need 2 connected players (SB12):** until each team has at least 2 connected players, Continue and Start next round are locked for everyone and the screen says who it's waiting for.

## 11. Results

- Final totals, the winning team (or "It's a draw"), and highlights **(ours)**: fastest guess, longest streak, most rounds won as drawer.
- The platform's Results controls (D51): the host gets **Play again** (setup again with the same game, settings and players) or **Return to room**.
- If the host ends the game early (D51), it shows the scores so far with no winner (`standings`).

## 12. Disconnects and edge cases

| Case | What happens |
| --- | --- |
| A player reloads, switches apps or loses signal | They keep their seat for the whole game (D51) and are shown as away. On return they get the full current view and slide back in |
| Drawer drops mid-round | Their canvas stays; their team keeps guessing from it. Next round, rotation skips them while they're away |
| Chooser drops while choosing | The 15 s timeout picks the first word |
| Player leaves the game (or the room) or is banned | `onPlayerLeft`: out of the rotation for good. If they were drawing, it's treated like a drop. A seated player can't be removed from the room mid-game; the host bans first (D59) |
| A team has fewer than 2 connected players | The game continues; a lone drawer can draw but nobody on that team can guess |
| A team has no connected players | The round plays on and times out for that team. The next round waits until each team has at least 2 connected players; the host can End game (SB12) |
| A team has fewer than 2 connected players when a round should start | The result stays up with "Waiting for <team>"; Continue and Start next round are locked until both teams have 2 connected players (SB12) |
| Host drops or leaves | Host passes on as usual (D51); host-only controls move with it. Ready-up and Start next round don't need the host |
| Someone arrives mid-game | They can spectate (D51) |
| Words | No word is offered twice in a game. Both offered words leave the pool |
| Drawer types in the guess box | Not possible: drawers get no guess box |
| Guess with different spacing, case or punctuation | Correct (section 6) |
| Same-millisecond guesses | First processed wins |
| The room restarts mid-round (crash or deploy) | That round's strokes and wrong guesses since the last save are lost; scores, correct guesses and the phase are saved. The round carries on |

## 13. Screens and interactions

Mobile-first portrait, PC gets a wider version of the same screen. Look: PlayDen's card-table identity (D34), designed in the mockup task (020) and approved before building. Only the original's rules were read; nothing from its look, markup, art or animations is copied.

**Feel: a lively, relaxed party game**

- Warm and playful: bold team colours, big readable word cards, chunky game-piece buttons (D34), friendly copy ("you got it!", "so close").
- Motion is subtle and has a job: it shows what just happened (a correct guess, a score change, who draws next). Nothing loops or moves for decoration while people are drawing or guessing.
- Short and soft: most motion runs 150–300 ms with gentle easing; only the round summary and the showdown title card take longer, and both can be skipped.
- At most one animation per moment, never two competing for attention. The canvas and the guess box never move.
- Reduced motion turns it all off (D30).

| # | Screen | Phone layout and interactions |
| --- | --- | --- |
| S1 | Setup | The platform's setup screen with team columns, Start and its disabled reason, Settings popup |
| S2 | Choose | Drawers: two large word cards (only the chooser's are tappable) and a 15 s ring. Others: the matchup with streak and head start badges, and "<name> is choosing…" |
| S3 | Countdown | 3-2-1 over the canvas |
| S4 | Head start | Chooser draws as normal. Everyone else's canvas is covered by "<name>'s head start" with a countdown |
| S5 | Drawer | Header: the word and timer. Canvas full width at 3:2. Toolbar: pen, eraser, clear, 4 sizes, 10 colours. Team feed. The other team's pixel view in a compact strip |
| S6 | Guesser | Header: blanks and timer. Canvas, then the guess box pinned above the phone keyboard, then the team feed, then the opponent strip |
| S7 | Round result | Overlay on the canvas; the canvas border turns the team's win or lose colour |
| S8 | Round summary | Section 10. Scrollable on phone: scores and handoff on top, Continue / Start next round in the bottom bar, replays below |
| S9 | Showdown intro | Title card, lineups, countdown |
| S10 | Showdown | Like S5/S6 with the running score and word tracks; no opponent canvas |
| S11 | Results | Totals, winner celebration, highlights, the platform's Results controls |
| S12 | Spectator | PC: both canvases side by side with the word and both feeds. Phone: the two teams as tabs |

**Chosen layout (020, built straight into the screens in 4.1; review on devices)**

- **Teams:** "Team 1" and "Team 2", as on the platform's setup screen, with coral and teal accents (the first two player colours, D34): a dot by each score, the canvas border, the matchup names.
- **Phone, players:** status bar (round, both scores, then the word or blanks and the timer), the own team's canvas full width, then the drawer's toolbar or the guesser's guess box (sticky at the bottom, so it stays above the keyboard), then the team feed, then the opponent strip.
- **Opponent strip:** a compact card below the feed: the 24 × 16 pixel view (or, once your team has guessed, their real drawing) at 128 px wide, the team name, who draws, and "Got it +8.7 s" once they have.
- **Guess feed:** newest first; name, guess, and "+12.3 s" since the team's drawing started; a correct guess shows as "got it!" in green, never the word; your own guesses show faded until the server confirms them.
- **Result:** an overlay on your canvas, "You won by 3 seconds! +200 points" in green, "You lost by 3 seconds +100 points" in red, or "Time's up! The word was …"; the canvas border turns green or red.
- **Spectators:** both teams as tabs on a phone, side by side from 640 px wide.
- **Motion:** each moment has one short animation (150–300 ms): the word cards and overlays fade in, the 3-2-1 zooms, a correct guess pulses the canvas border once, a score slides up when it changes. All off with reduced motion.

**Our own animations (designed in the mockup task)**

- **Drawer handoff:** the pencil token slides from the outgoing drawer's name chip to the challenger's chip, like moving a game piece. The staying drawer's token gets a small streak flare.
- **Showdown title card:** dealt onto the table like a card.
- **Correct guess:** the team's canvas border pulses and the score ticks up. The other team gets a subtle "Team A got it" toast.
- **Game card on Home:** a short sketch animation that draws the Sketch Battle mark.
- All motion is off with reduced motion, and comes from the component library or CSS (D30).

**Sounds (phase 5, our own or freely licensed):** countdown beeps, start, last-5-seconds tick, buzzer, your team correct, other team correct, score tally, confetti, win fanfare. A mute toggle sits in the room header.

## 14. Drawing

**Tools (SB7)**

- Pen, eraser, clear. Eraser paints the background colour.
- 4 sizes: 1%, 2%, 5% and 10% of the canvas width.
- 10 colours in our own shades (chosen in 020): black `#22201c`, light grey `#b9b6ae`, pink `#f286b4`, red `#e0493c`, orange `#f28a2e`, yellow `#f2c230`, green `#3c9c5a`, blue `#2f7ed6`, purple `#8a5bc8`, brown `#8b5a3a`, on warm paper `#fffcf3` in both themes (so a drawing looks the same on every screen; the eraser paints the paper). Each starts black, size 1.
- No undo in v1.

**Coordinates.** The canvas is 3:2. Points are whole numbers, x from 0 to 1500 and y from 0 to 1000, so a drawing looks the same on any screen. The drawer's phone drops points closer than 4 units to the last one.

**Sending (SB11)**

- The drawer's phone sends a `draw` move at most every `STROKE_BATCH_MS` (150 ms) while the pen moves.
- The first point after a pause goes at once (pen-down), and the pen-up goes at once with the remaining points, so lines start and end without waiting for a batch.
- A batch's points are delta-encoded: the first point is absolute, the rest are differences from the point before.
- Receiving phones add the new points to their canvas and spread them over the next 150 ms, so lines flow instead of jumping. Nothing already drawn is redrawn.
- Sketch Battle allows `STROKE_MOVE_LIMIT` (15 a second, burst 15) per connection instead of the platform's 10 (D54), because a fast dotting drawer can briefly send about 10.

**Opponent pixel view (SB6, D47)**

- The server keeps a 24 × 16 grid per team. Each stroke segment marks the cells it crosses, 1 cell wide whatever the brush size, with the stroke's colour. The eraser empties cells; clear empties all.
- The other team gets only the cells that changed, in the same message cycle as the batch that changed them, so it looks live. The real strokes never reach them until their own team has guessed; then they get the full drawing so far once, and live points after.
- No pixel view in the showdown (SB4).

**Replays.** The summary's Replay button redraws a canvas's strokes in order, one step every 10 ms.

## 15. Data and storage

**What the room stores.** No new database tables. Sketch Battle's whole state lives inside the room's existing `table` key as `session.state`, so each save is one row (D55). The room's other keys are unchanged.

| Room storage key | Holds | Written when |
| --- | --- | --- |
| `info` | Room code, creator, created time | Room created |
| `host` | Current host id | Host changes |
| `members` | Everyone in the room, connected or away | Someone arrives, drops, returns or leaves |
| `removed` | Players removed from this room (D42) | A removal |
| `table` | The game session (players, teams, settings, phase) and `state`, the Sketch Battle state below | Every saved change (section 15, "When the game is saved") |
| (the alarm) | The room's one wake-up time | Only when that time changes (D55) |

D1 keeps the permanent record (D58): the platform writes `rooms`, `games` and `game_participants` for every game. Sketch Battle adds only its `recordSummary(state)`, stored in `games.summary`: each round's word, drawers, winning team and gap, the showdown result and the highlights. Never the drawings or the live state. Login data (`users`, `sessions`) is unchanged; the room gets player ids and names from the login at connect time, as for every game.

**The game state (`types.ts`, plain JSON)**

```ts
type Tool = "pen" | "eraser";

/** One continuous line. Points are absolute x,y pairs (x 0–1500, y 0–1000). */
interface Stroke {
  id: number;
  tool: Tool;
  colour: number; // 0–9, an index into the palette
  size: 1 | 2 | 3 | 4;
  points: number[];
}
type CanvasOp = Stroke | { clear: true };

interface Guess {
  by: string;
  text: string;
  at: number; // server time
  correct: boolean;
}

/** One team's side of a round, or of one showdown word. */
interface TeamTurn {
  drawerId: string;
  drawFrom: number; // server time this drawer may start
  ops: CanvasOp[];
  cells: string; // 24 × 16 pixel view, one character per cell: "." empty, "0"–"9" colour
  guesses: Guess[];
  solvedAt: number | null;
}

interface Round {
  number: number; // 1-based
  chooserId: string;
  choices: [string, string];
  word: string | null;
  headStartSeconds: number;
  wordChosenAt: number | null;
  solvedOrder: (0 | 1)[]; // teams in the order they guessed: 200, then 100
  turns: [TeamTurn, TeamTurn];
}

/** What later rounds, streaks and highlights need from a finished round. */
interface RoundRecord {
  word: string;
  drawerIds: [string, string];
  winnerTeam: number | null;
  solvedAt: [number | null, number | null];
  drawingStartedAt: [number, number];
  points: [number, number];
}

type Phase =
  | "choose" | "countdown" | "headStart" | "drawing" | "result" | "summary"
  | "waiting" // the next round waits for 2 connected per team (SB12)
  | "showdownIntro" | "showdownCountdown" | "showdown" | "showdownResult" | "ended";

interface SketchBattleState {
  config: SketchBattleConfig;
  rng: Rng;
  phase: Phase;
  phaseEndsAt: number | null;
  rotations: [string[], string[]]; // each team's rotation
  away: string[]; // from the presence hook (D56)
  left: string[];
  wordOrder: number[]; // seeded shuffle of all word indexes, kept to the 2 × rounds a game can offer
  wordCursor: number;
  round: Round | null; // the current round, strokes included
  history: RoundRecord[]; // finished rounds, without strokes
  ready: string[]; // Continue ticks on the summary
  forceStartFrom: number | null; // when Start next round unlocks
  recentGuesses: Record<string, number[]>; // last 3 guess times per player
  showdown: {
    words: string[];
    turns: [TeamTurn[], TeamTurn[]]; // one per word reached; strokes kept for the current word only
    finishedAt: number | null;
    winnerTeam: number | null;
  } | null;
  nextStrokeId: number;
}
```

Size: a round's strokes are about 5–20 KB per team; finished rounds keep only their record (well under 1 KB). The whole state stays at tens of KB, so one save is one row.

**Moves (`moveSchema`)**

| Move | Shape | Who | Live? |
| --- | --- | --- | --- |
| Choose | `{ type: "choose", index: 0 \| 1 }` | The chooser, in the choose stage | No |
| Draw | `{ type: "draw", stroke: number, start?: { tool, colour, size }, points: number[], end?: true }` | A drawer who may draw | Yes |
| Clear | `{ type: "clear" }` | A drawer who may draw | Yes |
| Guess | `{ type: "guess", text: string }` | A guesser in the drawing stage | Yes when wrong; a correct guess is saved |
| Continue | `{ type: "ready" }` | A player on the summary | No (D55: saved, so ticks survive the room sleeping) |
| Start next round | `{ type: "forceStart" }` | A player, 10 s into the summary | No |

**When the game is saved** (D55; each save is one row)

| Moment | Why |
| --- | --- |
| Word chosen (or choose timeout) | Starts the round's clock |
| Each phase change from a deadline | Countdown end, head start end, round end, result end, force-start unlock, showdown stages |
| A correct guess | Decides the 200 and the 100 |
| Round end | Both teams' results, all guesses and both canvases, for the summary and replays |
| Each Continue tap | So ticks survive the room sleeping on the summary screen |
| Strokes and wrong guesses | Not saved one by one; they go in with the next save above. While any are unsaved the room stays awake (D55) |

**Views and changes**

- `view(state, viewer)` is the full picture for one viewer, sent on join, reconnect and resync.
- `delta(before, after, viewer)` is what changed for that viewer, sent after every change (D55). For a draw move: new points to the drawer's team and spectators, changed cells to the other team (unless they've guessed). For a correct guess: the guess, the score, the locked box, and for the guessing team the other team's full drawing so far.
- Hidden information never leaves the server: the word only to drawers, spectators and teams that guessed; word choices only to the two drawers; the other team's strokes only once your team guessed; the head-start canvas only to the chooser and spectators.

## 16. Engine notes

- `nextDeadline` covers: choose timeout, countdown end, head start end, round deadline, result end, the 10 s force-start unlock, showdown intro, countdown, handoffs and the showdown result.
- A live move never changes `nextDeadline` (checked by the contract kit, D55).
- `onPresence` (D56) updates `away`, so rotation and ready-up skip away players. If everyone left to tick is away, the round starts.
- `standings` gives the scores so far for an early end.
- Events (for animations and the log): `round.choosing`, `word.chosen`, `headStart.started`, `drawing.started`, `guess.correct`, `round.ended`, `drawer.handoff`, `showdown.started`, `showdown.wordDone`, `game.ended`. Wrong guesses reach the feed through `delta`, not as events.

## 17. Settings (`config.ts`)

| Name | Default | Notes |
| --- | --- | --- |
| `ROUND_OPTIONS` / `DEFAULT_ROUNDS` | 10, 15, 20, 25 / 15 | Host setting |
| `ROUND_SECONDS_OPTIONS` / `DEFAULT_ROUND_SECONDS` | 15–120 step 15 / 60 | Host setting |
| `DEFAULT_SHOW_WORD_LENGTHS` | true | Host setting |
| `WORD_CHOICES` | 2 | |
| `CHOOSE_SECONDS` | 15 | |
| `COUNTDOWN_SECONDS` | 3 | |
| `HEAD_START_MIN_STREAK` | 2 | |
| `HEAD_START_BASE_SECONDS` | 3 | |
| `HEAD_START_PER_EXTRA_WIN_SECONDS` | 1 | |
| `HEAD_START_MAX_SECONDS` | null | No cap until players ask |
| `RESULT_SECONDS` | 5 | |
| `FORCE_START_AFTER_SECONDS` | 10 | |
| `FIRST_TEAM_POINTS` / `SECOND_TEAM_POINTS` | 200 / 100 | |
| `SHOWDOWN_WORD_POINTS` / `SHOWDOWN_FINISH_BONUS` | 100 / 100 | |
| `SHOWDOWN_INTRO_SECONDS` / `SHOWDOWN_COUNTDOWN_SECONDS` | 10 / 3 | |
| `SHOWDOWN_HANDOFF_SECONDS` | 2 | |
| `TEAM_MIN_PLAYERS` / `TEAM_MAX_PLAYERS` | 2 / 8 | No size-gap rule |
| `MAX_GUESS_LENGTH` | 36 | |
| `GUESS_BURST` / `GUESS_WINDOW_MS` | 3 / 3000 | At most 3 guesses in any 3 s |
| `STROKE_BATCH_MS` | 150 | Try 100 on phones in 023; keep whichever feels better |
| `STROKE_MOVE_LIMIT` | 15 a second, burst 15 | Per connection |
| `MIN_POINT_DISTANCE` | 4 | Canvas units |
| `CANVAS_WIDTH` / `CANVAS_HEIGHT` | 1500 / 1000 | Coordinate units |
| `BRUSH_SIZES` | 0.01, 0.02, 0.05, 0.1 | Fraction of canvas width |
| `PALETTE_SIZE` | 10 | Shades chosen in 020 |
| `PREVIEW_COLS` / `PREVIEW_ROWS` | 24 / 16 | |
| `REPLAY_STEP_MS` | 10 | |

## 18. Words

- Our own list of 2,500: 2,000 easy (80%), 350 medium, 150 hard. Everything is drawable: everyday objects, animals, food, places, actions, scenes and idioms. Each entry is 1 to 4 words; about 1,100 are phrases ("cat in a box", "raining cats and dogs") and some are hyphenated (`x-ray`, `t-shirt`, `jack-in-the-box`). No proper names, brands or anything copied from another game's list (D17).
- **Where it lives.** `packages/games/sketch-battle/words/english.ts`, as `{ word, difficulty }` entries: the source of truth since task 022. A printable copy of the list as first approved is `docs/games/sketch-battle-words.pdf`. It ships inside the server code: no database, and browsers never get the list.
- **How a game picks words.** At setup the engine shuffles all 2,500 entries with the game's seed (`wordOrder`). Each choose stage offers the next two from that order (`wordCursor` moves by 2) and both leave the pool, whichever is chosen. So the order is fixed when the game starts, but which word gets played depends on each chooser's pick. A 15-round game offers 30 and plays 15; the showdown reuses those 15. Every game has a new seed, so a new order; no entry repeats within a game. Difficulty is kept for later settings.

## 19. Free-tier budget

One hour of an 8-player room, with the platform fixes (D55): about 1,300 Durable Object requests, 1,000 rows written, a few hundred rows read and 250 GB-s of running time. The daily free limits allow about 52 such room-hours, with running time the first limit reached; a normal game night uses about 6. Details in `docs/PROJECT.md`, "Hosting, free-tier budget and costs".

## 20. Tests (each becomes one named test)

**Scoring**

- first team to guess scores 200
- second team scores 100 however late
- team that never guesses scores 0
- nobody guessing scores 0 for both
- same-millisecond guesses go to the first processed
- the won-by gap shows one decimal under a second and whole seconds rounded up otherwise

**Guessing**

- guess matching ignores case, accents, spaces and punctuation
- drawers and spectators can't guess
- guesses are refused outside the drawing stage
- a team can't guess again after guessing
- a 4th guess within 3 s is refused
- guesses over 36 characters are refused
- blanks hide letters and digits and keep spaces and punctuation

**Round flow**

- the round ends early once both teams have guessed
- the round deadline counts from the end of the head start
- during the head start only the chooser draws and nobody guesses
- a drawer can't draw after their team guesses
- the choose timeout picks the first word
- both drawers get the word choices and only the chooser can pick

**Choosing and rotation**

- round 1 chooser team comes from the seed
- the chooser after a no-winner round comes from the seed
- the challenger chooses after a round with a winner
- the winning drawer stays
- the winning drawer is replaced when away
- the losing team rotates to its next connected player
- both teams rotate after a no-winner round
- rotation skips away and departed players and wraps around
- a lone connected player draws again

**Streaks and head starts**

- the streak counts consecutive wins by the same drawer and team
- the streak resets after a loss, a no-winner round or a drawer change
- the head start is 0 below a streak of 2
- the head start is 3 s at streak 2 and +1 s per extra win
- the head start respects the cap only when one is set

**Ready-up**

- the next round starts when every connected player is ready
- away players aren't waited for
- any player can force the next round after 10 s and not before
- spectators can't ready up or force the next round

**Showdown**

- showdown words are all round words in one shared seeded order
- the showdown rotates drawers per word
- the showdown scores 100 per word plus 100 for finishing
- the showdown ends when one team finishes
- an unfinished word doesn't count
- players get no opponent canvas in the showdown

**Hidden information and drawing**

- view hides the word from guessers until their team guesses
- the other team gets only pixel cells before they guess, and the full drawing after
- word choices go only to the two drawers
- the head-start canvas goes only to the chooser and spectators
- spectators see both canvases and the word
- a segment marks the cells it crosses, 1 cell wide
- the eraser and clear empty cells, and the last colour wins in a cell
- draw and wrong-guess moves are live and never change the next deadline

**Setup and disconnects**

- start needs 2–8 players per team, with no size-gap rule
- no word is offered twice in a game
- an away drawer's canvas stays and their team can still guess
- a round plays on and times out when a team has nobody connected
- the next round waits until each team has 2 connected players

## 21. Learn-controls tour (v2)

`data-tour` tags: `canvas`, `pen`, `eraser`, `clear`, `sizes`, `colours`, `guess-box`, `team-feed`, `opponent-preview`, `timer`, `streak-badge`, `continue`. `tour.ts` holds three lines each: what it is, what it does, when to use it.

## 22. Open questions

None. (A team with no connected players was answered by SB12 on 2026-11-13.)

## 23. Implementation checklist

Each step is one task file in `docs/tasks/`, done in this order. Each phase ends playable with the community (D43).

**Platform first** (needed by every fast-moving game; Tap Race benefits too)

- [ ] **019b — Live moves and lean saves (D55).** The room keeps the table in memory; live transitions update memory and send `delta`s without saving; every other change saves once; the alarm is booked only when its time changes; a game may set its own move limit; contract kit checks that live moves never change the deadline.
- [ ] **019c — Presence for games (D56).** The room calls `onPresence` when a player drops or returns mid-game.
- [x] **019d — Game records in D1 (D58).** Rooms, games and participants are recorded in D1. Sketch Battle's `recordSummary(state)` comes with its engine: the rounds part in 021 (each round's word, drawers, winner and gap), the showdown result in 030 and highlights in 032.

**4.1 Core round** — two teams play rounds end to end

- [ ] **020 — Mockups:** setup, choose, drawer, guesser, head start, round result, opponent strip; the 10-colour palette and team colours.
- [ ] **021 — Engine: round flow, guessing, scoring.** Choose → countdown → drawing → result → next round, simple rotation, live draw and guess moves, `delta`, the next round waiting for 2 connected per team (SB12), `recordSummary` for the rounds.
- [ ] **022 — Word list.** Move `sketch-battle-words.txt` into `words/english.ts` with tests.
- [ ] **023 — Canvas and stroke sending.** Pointer input, batching, pen-down/up at once, playback smoothing, tools.
- [ ] **024 — Opponent pixel view.** 24 × 16 cells on the server, sent with every batch.
- [ ] **025 — Round screens wired to the room.** S2, S3, S5–S7, blanks, guess box rules, feed with times.

**4.2 Full match** — a 15-round match plays like the original

- [ ] **026 — Engine: winner stays, streaks, head starts** (private head start).
- [ ] **027 — Head start stage and matchup badges.**
- [ ] **028 — Round summary, replays, Continue and Start next round.**
- [ ] **029 — Disconnect rules and the spectator view** (SB12 answers section 22).

**4.3 Showdown** — the complete game

- [ ] **030 — Engine: showdown.**
- [ ] **031 — Showdown screens.**
- [ ] **032 — Results, highlights, Play again.**

**4.4 Settings**

- [ ] **033 — Host settings and the word-length toggle.**

**4.5 Polish**

- [ ] **035 — Our animations.**
- [ ] **036 — Sounds and mute.**
- [ ] **037 — Home game card and PC layout tuning.**

**Before the first game night**

- [ ] A full 15-round game and the showdown with 4–8 people on phones and PCs.
- [ ] Check the Cloudflare dashboard after it: requests, rows written and running time against section 19.
