# Sketch Battle — game spec

Id: `sketch-battle` · Version: v1 · Players: 4–16 in two teams · Voice: no · Last updated: 2026-11-11

Two teams race to guess the same word, each from its own drawer's sketch. The rules follow drawbattle.io so our players feel at home; the name, look, animations, sounds and word list are our own (D17). Rules marked **(ours)** are ones the original doesn't show publicly, so we decided them.

## 1. Rules card (60 seconds)

> **Goal:** score more points than the other team.
>
> **A round:** each team has one drawer. Both drawers sketch the **same word** at the same time while their teammates guess. First team to guess gets **200**, the second gets **100**, a team that never guesses gets **0**.
>
> **Drawers:** win the round and you keep drawing. Lose and your team passes the pencil to the next player, the **challenger**, who picks the next word.
>
> **Streaks:** keep winning and the challenger gets a **head start**: 3 seconds at 2 wins in a row, then 1 more second per extra win.
>
> **The showdown:** after the last round, every word comes back. Teams race through them with a new drawer each word. 100 points per word, +100 for finishing first. First team done ends the game.

## 2. Terms

| Term | Meaning |
| --- | --- |
| Drawer | The one player per team who draws this round |
| Guesser | Everyone else on a team; types guesses |
| Chooser | The drawer who picks the word this round |
| Challenger | The losing team's new drawer after a round with a winner; always the chooser |
| Streak | Rounds in a row won by the same drawer for the same team |
| Head start | Seconds the challenger draws before the other drawer may start |
| Rotation | A team's drawing order: the order players joined the team |
| On deck | The player after the next drawer in a team's rotation |
| Spectator | Anyone in the room not on a team; watches everything, can't guess (D46) |

## 3. Lobby and setup

- The room lobby shows two team columns. A player taps **Join** on a team to move there; joining appends them to that team's rotation. The host can also **shuffle** teams.
- Players not on a team are listed as spectators.
- **Start** is host-only and enabled when each team has 2–8 players and team sizes differ by at most 1. Otherwise the button is disabled with the reason underneath ("Each team needs at least 2 players", "Teams can differ by 1 player at most").
- **Settings (host only):** rounds (10 / **15** / 20 / 25), seconds per round (15–120 in 15 s steps, default **60**), show word lengths (**on**). One word list for now (D45).
- On start, the engine gets the players, teams, settings and a seed. Everything random (word order, word choices, the round-1 chooser) comes from the seed.

## 4. A round

| # | Stage | Length | What happens |
| --- | --- | --- | --- |
| 1 | Choose | 15 s | The chooser sees 2 words and taps one. Everyone else sees "<name> is choosing…". On timeout the first of the two is picked **(ours)** |
| 2 | Countdown | 3 s | 3-2-1 for everyone. Both drawers now see the word |
| 3 | Head start | `h` s, only if `h > 0` | Only the chooser draws. Their team sees the canvas and may guess. The other team sees "<name>'s head start" with a countdown and can't draw yet |
| 4 | Drawing | round length | Both drawers draw, guessers guess. The deadline is round length after the **later** drawer's start, so the chooser gets round length + `h` in total |
| 5 | Round end | — | When the deadline passes, or as soon as both teams have guessed |
| 6 | Result | 5 s | Overlay on each canvas: "You won by 2.4 s, +200" / "You lost by 6 s, +100" / "Time's up! The word was …" |
| 7 | Summary | until ready | Scores, who draws next, replays (section 10). Next round starts when every connected player taps Continue, or when the host taps Start next round, available after 11 s |

After the last round, the showdown begins (section 8).

**Who chooses**

- Round 1, or after a round nobody guessed: a random team, picked with the seed, and its drawer chooses. Head start 0 (D44).
- After a round with a winner: the losing team's new drawer (the challenger) chooses, with head start `h` from section 6.

**Who sees the word**

- Both drawers, from the countdown on. Spectators always. Guessers once their own team has guessed it. With "show word lengths" on, guessers see blanks per letter with spaces shown (`_ _ _   _ _   _ _ _ _`).

## 5. Guessing and scoring

**Matching.** A guess is correct when, after normalising both, it equals the word. Normalising means: lowercase, strip accents, then remove everything except letters and digits. So "Pot of Gold!" and "potofgold" both match `pot of gold`.

**Rules**

- Only guessers can guess. Drawers and spectators can't.
- Once a team has guessed, its guess box locks ("You got it!"). One correct guess per team is enough.
- A team's guesses show to that team and to spectators. Once your team has guessed, you also see the other team's guesses and its full canvas.
- Guesses are capped at 40 characters, and one guess per 300 ms per player is accepted **(ours)**. Faster ones are rejected with "Slow down".
- All timing uses the server's receive time (D9). If two correct guesses carry the same millisecond, the one the room processed first wins.

**Round points (D14)**

| Outcome | First team | Second team |
| --- | --- | --- |
| Both guess | 200 | 100, however late |
| Only one guesses | 200 | 0 |
| Nobody guesses | 0 | 0 |

The time differential shown in the result is the gap between the two teams' correct guesses. Under 1 s it shows one decimal ("0.4 s"); otherwise it rounds up to whole seconds.

**Worked examples**

1. Team A guesses at 12.3 s, team B at 47.0 s → A 200, B 100. A "won by 35 seconds".
2. Team A guesses at 20 s, team B never does → A 200, B 0. B sees "Time's up! The word was …".
3. Nobody guesses → 0 and 0. Both teams rotate drawers and a random team chooses next.
4. Showdown with 15 words: A finishes all 15 while B has finished 9 → A 15 × 100 + 100 = **1600**, B 9 × 100 = **900**. B's half-drawn 10th word doesn't count.

**Game total** = sum of all round points + showdown points. Higher total wins; equal totals are a draw.

## 6. Streaks and head starts (D15)

**Streak.** Look back from the last round. Count rounds in a row won by the same team **with the same drawer**. It counts only if that drawer is drawing for that team again in the coming round (if they disconnected and rotation moved on, the streak is 0). A round with no winner, a loss or a drawer change breaks it.

**Head start** for the coming round's challenger:

```
h = 0                                  if streak < 2
h = 3 + (streak − 2) × 1               otherwise
h = min(h, HEAD_START_MAX_SECONDS)     only if a cap is set (default: no cap)
```

| Opponent's streak | 0–1 | 2 | 3 | 4 | 5 | 10 |
| --- | --- | --- | --- | --- | --- | --- |
| Head start | 0 s | 3 s | 4 s | 5 s | 6 s | 11 s |

There are no streak points. A streak only shows as a badge ("3 in a row") and feeds the head start.

## 7. Drawer rotation

- Each team's rotation is its join order. Round 1's drawers are each team's first player.
- After a round:
  - **Winning team:** the drawer stays, unless they're away; then the next connected player.
  - **Losing team:** the next connected player after the current drawer.
  - **No winner:** both teams move to their next connected player.
- "Next connected" walks the rotation from the current drawer, wrapping around and skipping away players. If nobody else is connected, the same drawer goes again.
- **On deck** is the next connected player after the next drawer.

**Example.** Team A rotation [Asha, Ben, Chi], team B [Dev, Esha, Faiz]. Round 1: Asha vs Dev; A wins. Round 2: Asha stays, Esha is the challenger and picks the word, Faiz is on deck. A wins again (Asha streak 2). Round 3: Asha vs Faiz, and Faiz gets a 3 s head start. B wins. Round 4: Faiz stays, Ben is A's challenger with no head start (Faiz's streak is 1).

## 8. The showdown (D16)

- **Words:** every word from the rounds played, including unguessed ones, in one seeded shuffle that is the same for both teams.
- **Intro:** an 11 s title card showing each team's lineup, then a 3 s countdown.
- **Play:** each team's first drawer is its next drawer under the normal rotation rules. When a team guesses a word, a 2 s handoff passes the pencil to its next connected player, who sees the next word **(ours: the handoff length)**. No timer, no passing, no head starts.
- **Progress:** both teams see a word track (one pip per word) for each team and a running score ("9 – 7"). A team sees the text of the words it has finished.
- **Visibility:** same rules as rounds. Your own canvas is live; the other team's is a block preview.
- **End:** the moment one team guesses its last word. A 5 s result overlay ("You win! Final score 1600"), then the results screen.

## 9. Results

- Final totals, the winning team (or "It's a draw"), and highlights **(ours)**: fastest guess, longest streak, most rounds won as drawer.
- The host gets **Play again** (a new game with the same teams and settings, started at once) and **Back to lobby** (teams cleared). Spectators can join a team in the lobby before the next game.

## 10. Round summary screen

- Round number and both team scores, counting up from the previous scores.
- **Drawer handoff:** the staying drawer, marked "stays" with the streak badge. On the losing side, the outgoing drawer hands the pencil to the challenger, who shows their head start badge if any. When nobody won, both sides show "next drawer". The animation is our own (section 12).
- On deck for each team.
- **Replays:** both canvases from this round, with a Replay button that redraws the strokes at their real pace, plus each team's guess log.
- **Continue:** each player taps it; a tick appears next to their name. Away players aren't waited for.

## 11. Disconnects and edge cases

| Case | What happens |
| --- | --- |
| Drawer drops mid-round | Their canvas stays; their team can keep guessing what's drawn. Next round, rotation skips them while they're away |
| Chooser drops while choosing | The 15 s timeout picks the first word |
| Player returns | Same team, same place in rotation (seats are per account) |
| Player removed by host or admin (D42) | Leaves their team. If they were drawing, it's treated like a drop |
| A team has fewer than 2 connected players | The game continues; a lone drawer can draw but nobody on that team can guess |
| A team has no connected players for 60 s | The game ends with current scores and the results screen shows "<team> left" |
| Host leaves | Host passes on as usual (D40); host-only buttons move with it |
| Late joiner | Becomes a spectator (D46) |
| Words | No word is offered twice in a game. Both offered words leave the pool. The pool must hold at least `2 × rounds` words |
| Drawer types in the guess box | Not possible: drawers get no guess box |
| Guess equals the word with different spacing or case | Correct (section 5) |
| Same-millisecond guesses | First processed wins |

## 12. Screens and interactions

Mobile-first portrait, PC gets a wider version of the same screen. Look: PlayDen's card-table identity (D34), designed in a mockup pass before building. Nothing from the original's visual style is copied.

| # | Screen | Phone layout and interactions |
| --- | --- | --- |
| S1 | Lobby | Two team columns with Join buttons and players' avatars; spectators below; host settings card; room code tiles and invite; sticky bottom bar with **Start** and its disabled reason |
| S2 | Choose | Chooser: two large word cards and a 15 s ring. Others: the matchup "<drawer A> vs <drawer B>" with streak and head start badges, and "<name> is choosing…" |
| S3 | Countdown | 3-2-1 over the canvas |
| S4 | Head start | Chooser draws as normal. The other team's canvas is covered by "<name>'s head start" with a countdown |
| S5 | Drawer | Header: the word and timer. Canvas full width at 3:2. Toolbar under it: pen, eraser, clear, 4 sizes, colour row. Team feed under that. The other team's block preview in a compact strip |
| S6 | Guesser | Header: blanks and timer. Canvas, then the guess box pinned above the phone keyboard, then the team feed, then the opponent strip |
| S7 | Round result | Overlay on the canvas; the canvas border turns the team's win or lose colour |
| S8 | Round summary | Section 10. Scrollable on phone: scores and handoff on top, Continue in the bottom bar, replays below |
| S9 | Showdown intro | Title card animation, lineups, countdown |
| S10 | Showdown | Like S5/S6, plus both word tracks and the running score |
| S11 | Results | Totals, winner celebration, highlights, Play again / Back to lobby for the host |
| S12 | Spectator | PC: both canvases side by side with the word and both feeds. Phone: the two teams as tabs or stacked, no guess box |

**Our own animations (to design in the mockup pass)**

- **Drawer handoff:** the pencil token slides from the outgoing drawer's name chip to the challenger's chip, like moving a game piece. The staying drawer's token gets a small streak flare.
- **Showdown title card:** dealt onto the table like a card.
- **Correct guess:** the team's canvas border pulses and the score ticks up. The other team gets a subtle "Team A got it" toast.
- **Game card on Home:** a short sketch animation that draws the Sketch Battle mark.
- All motion is off with reduced motion, and comes from the component library or CSS (D30).

**Sounds (phase 5, our own or freely licensed):** countdown beep, start, last-5-seconds tick, buzzer, your team correct, other team correct, score tally, win fanfare. A mute toggle sits in the room header.

## 13. Drawing data

- Tools: pen, eraser, clear canvas; 4 sizes; a 12-colour palette **(ours)**. No undo in v1.
- Points are 0–1 relative to the canvas. The client sends `stroke` moves in 100 ms batches. The server stamps each batch with its receive time, for replays.
- **Block preview (D47):** for the other team, the engine builds a 30 × 20 grid of coloured cells from the strokes (each segment marks the cells it crosses; the eraser and clear empty cells). It's sent at most every 500 ms. Strokes themselves never reach the other team before they've guessed.
- Spectators and the drawer's own team get the strokes live.

## 14. Engine notes

- Strokes, guesses and word picks are all moves through `validate` / `apply`, with server time as `now`.
- `view(state, playerId)`:
  - The word goes only to drawers, spectators and teams that have guessed.
  - Other-team strokes are replaced by the block preview until that team has guessed.
  - Word choices go only to the chooser.
- `nextDeadline` covers: choose timeout, countdown end, head start end, round deadline, result end, the 11 s force-start unlock, showdown intro, countdown and handoffs.
- Events (for animations and the log): `round.choosing`, `word.chosen`, `headStart.started`, `drawing.started`, `guess.wrong`, `guess.correct`, `round.ended`, `drawer.handoff`, `showdown.started`, `showdown.wordDone`, `game.ended`.

## 15. Settings (`config.ts`)

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
| `FORCE_START_AFTER_SECONDS` | 11 | |
| `FIRST_TEAM_POINTS` / `SECOND_TEAM_POINTS` | 200 / 100 | |
| `SHOWDOWN_WORD_POINTS` / `SHOWDOWN_FINISH_BONUS` | 100 / 100 | |
| `SHOWDOWN_INTRO_SECONDS` / `SHOWDOWN_COUNTDOWN_SECONDS` | 11 / 3 | |
| `SHOWDOWN_HANDOFF_SECONDS` | 2 | |
| `TEAM_MIN_PLAYERS` / `TEAM_MAX_PLAYERS` / `TEAM_MAX_SIZE_GAP` | 2 / 8 / 1 | |
| `EMPTY_TEAM_END_SECONDS` | 60 | |
| `MAX_GUESS_LENGTH` / `GUESS_MIN_INTERVAL_MS` | 40 / 300 | |
| `STROKE_BATCH_MS` | 100 | Free-tier budget |
| `PREVIEW_COLS` / `PREVIEW_ROWS` / `PREVIEW_INTERVAL_MS` | 30 / 20 / 500 | |
| `CANVAS_ASPECT` | 3 / 2 | |

## 16. Words (D45)

- Our own strict English list, family-friendly: everyday nouns, actions and short phrases of up to 3 words, no proper names.
- Lives in `packages/games/sketch-battle/words/english.ts`. We start with about 500 words and grow it from game-night feedback.
- No words are copied from the original's packs.

## 17. Game phases (D43)

Each phase ends playable with the community.

| Phase | Contains | Playable result |
| --- | --- | --- |
| 1. Core round | Lobby teams and Start; choose → countdown → draw → guess → 200/100 → result; block preview; simple drawer rotation; a fixed set of rounds then plain results | Two teams can play rounds end to end |
| 2. Full match | Winner-stays rotation, streaks, head starts, round summary with replays, ready-up, spectators, disconnect rules | A full 15-round match plays like the original |
| 3. Showdown | Intro, per-word rotation, word tracks, finish bonus, results with highlights, Play again | Complete game |
| 4. Settings and words | Host settings, the full English list, word-length toggle | Host can tune games |
| 5. Polish | Our animations, sounds and mute, Home game card animation, PC layout tuning | Feels finished |

## 18. Tests (each becomes one named test)

**Scoring**

- first team to guess scores 200
- second team scores 100 however late
- team that never guesses scores 0
- nobody guessing scores 0 for both
- same-millisecond guesses go to the first processed

**Guessing**

- guess matching ignores case, accents, spaces and punctuation
- drawers and spectators can't guess
- a team can't guess again after guessing
- guesses faster than the minimum interval are rejected
- guesses over the length cap are rejected

**Round flow**

- the round ends early once both teams have guessed
- the round deadline counts from the later drawer's start
- the chooser's head start delays the other drawer only
- the choose timeout picks the first word

**Choosing and rotation**

- round 1 chooser team comes from the seed
- the chooser after a no-winner round comes from the seed
- the challenger chooses after a round with a winner
- the winning drawer stays
- the winning drawer is replaced when away
- the losing team rotates to its next connected player
- both teams rotate after a no-winner round
- rotation skips away players and wraps around
- a lone connected player draws again

**Streaks and head starts**

- the streak counts consecutive wins by the same drawer and team
- the streak resets after a loss, a no-winner round or a drawer change
- the head start is 0 below a streak of 2
- the head start is 3 s at streak 2 and +1 s per extra win
- the head start respects the cap only when one is set

**Showdown**

- showdown words are all round words in one shared seeded order
- the showdown rotates drawers per word
- the showdown scores 100 per word plus 100 for finishing
- the showdown ends when one team finishes
- an unfinished word doesn't count

**Hidden information**

- view hides the word from guessers until their team guesses
- view sends the other team only the block preview before they guess
- word choices go only to the chooser
- spectators see both canvases and the word

**Lobby and disconnects**

- start needs 2–8 players per team and a size gap of at most 1
- players not on a team become spectators
- no word is offered twice in a game
- a team empty for 60 s ends the game

## 19. Learn-controls tour (v2)

`data-tour` tags: `canvas`, `pen`, `eraser`, `clear`, `sizes`, `colours`, `guess-box`, `team-feed`, `opponent-preview`, `timer`, `streak-badge`, `continue`. `tour.ts` holds three lines each: what it is, what it does, when to use it.
