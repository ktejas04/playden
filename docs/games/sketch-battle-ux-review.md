# Sketch Battle — UX Review & Complete Simplification Plan

> **Status:** Implementation Plan for Owner Review  
> **Date:** 2026-11-14  
> **Reference:** Original Draw Battle gameplay screenshots (`C:\Users\Tejas Kumar\Downloads\draw battle` & `scratch/draw_battle_refs`)  
> **Goal:** Match the clean, spacious, full-width, single-surface experience of the original Draw Battle. Fix desktop cramping, round intermissions, drawer face-offs, and mobile keyboard layout.

---

## 1. Root Causes & Issues Identified

### Issue 1: Desktop Layout is Severely Squished (Not Using Screen Width)
* **Root Cause in Code:** `apps/web/src/Shell.tsx` hardcodes `<main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 sm:px-5">`.
* `max-w-xl` locks the entire application to **576px (36rem)**, even on a 1920×1080 desktop monitor!
* When we divided the screen into columns inside 576px, the main canvas was squeezed into a tiny ~250px box, squishing the toolbar swatches and causing tools to overlap into the right column.
* **Original Reference:** In the original `drawbattle.io` (`Screenshot 2026-11-11 225835.png`), the game uses the **entire screen width**:
  - The main drawing canvas is large, expansive, and takes **75%–80%** of the screen.
  - The tools and guess feed sit cleanly beside the canvas (or below it without cramping).
  - The opponent's box sits in a dedicated right column (20%–25% width) separated by a clean vertical divider line.
* **Fix:** In `Shell.tsx`, allow `main` to expand to `w-full max-w-7xl` or full-width during active game sessions so the desktop layout can breathe.

---

### Issue 2: Missing Drawer Face-Off ("Who is drawing against whom?")
* **Original Reference:** Look at `Screenshot 2026-11-11 225901.png` and `WhatsApp Image 2026-11-11 at 10.59.47 PM (1).jpeg`:
  - Before round 1 starts:
    ```
                    round 1
    ---------------------------------------
          0                          0
      next drawer                next drawer
        tinker                       ST
    ```
  - Before round 2:
    ```
                    round 2
    ---------------------------------------
          0                         200
    next challenger                winner
      bumblebee                       ST
       on deck                     on deck
       tinker                       Hubblr
    ```
  - During the round itself (`Screenshot 2026-11-11 225835.png`):
    - Top bar clearly states the current team and drawers:
      - Main section: `team 2` (with drawer and guesser status).
      - Opponent column: `team 1      ✏ tinker`.
* **Fix:** Display the face-off prominently:
  1. In the round start / intermission screen: Big score, winner vs next challenger, and on-deck players.
  2. During gameplay: Show the current drawer vs drawer matchup clearly in the header/strip.

---

### Issue 3: Auto-Advancing to Next Round Without a `[ continue ]` Button
* **Root Cause in Code:** In `packages/games/sketch-battle/engine.ts`, `endRound()` sets `phase: "result"` with a hardcoded 5-second timeout (`phaseEndsAt: now + seconds(RESULT_SECONDS)`). When the 5 seconds expire, `onDeadline` calls `afterResult()` which **automatically starts the next round**!
* Players never get to pause, review the final drawings, laugh at guesses, or tap `continue`.
* **Original Reference:** `Screenshot 2026-11-11 230156.png` shows:
  - Big score: `0` vs `200`
  - `next challenger: bumblebee` vs `winner: ST`
  - A bright blue **`[ continue ]`** button!
  - Both teams' final drawings side-by-side with a `↻ replay` button to replay the drawing strokes!
  - The round advances only when players tap `continue` (or an extended safety timeout of 15–20s passes).
* **Fix:** Add a proper `continue` move in `engine.ts` and render the Intermission screen with the `[ continue ]` button and side-by-side drawing replays.

---

### Issue 4: "Waiting for other team..." Missing When One Team Wins First
* **Original Reference:** In `Screenshot 2026-11-11 225847.png` and `WhatsApp Image 2026-11-11 at 10.59.46 PM.jpeg`:
  - When Team 2 solves the word while Team 1 is still drawing:
    - **Winning Team's Canvas:** Border turns green. Inside the canvas appears the orange 🏆 Trophy with `you win!` and `waiting for team 1...`.
    - **Losing / Guessing Team's Canvas:** Team 1 can continue drawing and guessing! In Team 1's view, the opponent's preview box on the right turns green with `✓ ✕ ✕ ✕ ✕` showing Team 2 already solved it!
    - **Top Bar:** Revealed word appears in green for the team that solved it.
* **Fix:** Ensure both sides are synchronized:
  - The winning team sees the canvas trophy overlay `you win! waiting for team X...` and green canvas border.
  - The opponent's preview box turns green for the other team with attempt marks, showing they already got it.
  - If the other team guesses before time expires: `You lost by X seconds` (rounded up to nearest whole second).
  - If the other team's timer expires: `time's up! the word was <word>` (with red word text).

---

### Issue 5: Mobile Layout Issues (Keyboard & Single-Surface Hierarchy)
* **Issues on Phone Screen:**
  1. **Keyboard Overlap:** When the virtual keyboard opens to type a guess, the opponent strip at the bottom of the feed gets pushed completely out of sight.
  2. **Word Choice Overlay:** Must stay firmly inside the canvas box (no page jumps or outer modal cards).
  3. **Under-Canvas Attempt Tracker:** Mini `✓` and `✕` indicators must sit directly underneath the canvas so players immediately see their team's attempt history.
  4. **Single-Surface Canvas:** No nested double-cards or heavy container shadows.

---

## 2. Definitive Screen Layout Specifications

### A. Desktop View (Spacious, Full-Width ~1200px)
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [P] PlayDen                                                                                  (T) │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│ target                                        0:19   Team 2                   │ Team 1   ✏ tinker│
│ ┌──────────────────────────────────────────┐  [ ✏ ] [ ⌫ ] [ 🗑 ]             │ ┌──────────────┐ │
│ │                                          │  •  •  •  •                     │ │              │ │
│ │                                          │  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■            │ │  Opponent    │ │
│ │              Main Canvas                 │  ─────────────────────────────── │ │  Chunky      │ │
│ │              (75% width)                 │  ! Hubblr is guessing           │ │  Pixel       │ │
│ │                                          │  ✕ Hubblr guessed tar           │ │  Preview     │ │
│ │                                          │  ✕ Hubblr guessed targ          │ └──────────────┘ │
│ └──────────────────────────────────────────┘  ✕ Hubblr guessed targedid      │ ✓ ✕ ✕ ✕ ✕        │
│ ✕ ✕ ✕ ✓                                       ┌───────────────────────┐ [send]│                  │
│                                               │ type your guess...    │       │                  │
│                                               └───────────────────────┘       │                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### B. Mobile View (Phone Viewport 390×844)
```
┌──────────────────────────────────────┐
│ [P] PlayDen                      (T) │
├──────────────────────────────────────┤
│ target                          0:19 │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │           Main Canvas            │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ ✕ ✕ ✕ ✓                              │
│                                      │
│ [ ✏ Pen ] [ ⌫ Eraser ] [ 🗑 ]  • • • │
│ [ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ] (10 swatches)│
│                                      │
│ ┌──────────────────────────┐ [ Send] │
│ │ type your guess...       │         │
│ └──────────────────────────┘         │
│                                      │
│ ✓ Hubblr guessed target              │
│ ✕ Hubblr guessed djrh                │
│ ✕ Hubblr guessed targ                │
│ ! Hubblr is guessing                 │
│ ✏ ST is drawing                      │
│                                      │
│ ──────────────────────────────────── │
│ Team 1                      ✏ tinker │
│ ┌──────────────────────────────────┐ │
│ │ Chunky Pixel Preview             │ │
│ └──────────────────────────────────┘ │
│ ✓ ✕ ✕ ✕ ✕                            │
└──────────────────────────────────────┘
```

### C. Round End / Intermission Screen (Both Desktop & Mobile)
```
┌──────────────────────────────────────────────────────────────────────┐
│                              round 2                                 │
│ ──────────────────────────────────────────────────────────────────── │
│                                                                      │
│                 0                                200                 │
│          next challenger                        winner               │
│             bumblebee                             ST                 │
│              on deck                            on deck              │
│               tinker                            Hubblr               │
│                                                                      │
│                         ┌──────────────────┐                         │
│                         │     continue     │                         │
│                         └──────────────────┘                         │
│                                                                      │
│   Team 1: tinker        ↻ replay    Team 2: ST          ↻ replay     │
│   ┌────────────────────────────┐    ┌────────────────────────────┐   │
│   │ Team 1 Drawing             │    │ Team 2 Drawing (Winner)    │   │
│   │                            │    │ (Green border)             │   │
│   └────────────────────────────┘    └────────────────────────────┘   │
│   ✕ tinker guessed cat              ✓ Hubblr guessed target          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

1. **Fix Shell Width on Desktop (`Shell.tsx` & `GameScreen.tsx`):**
   - Replace `<main className="... max-w-xl ...">` with wide container support (`w-full max-w-7xl` or dynamic wide layout for games) so desktop screens are not artificially restricted to 576px.
2. **Desktop Layout Optimization in `PlayerBoard` (`index.tsx`):**
   - Make the main drawing canvas large and prominent (75% width).
   - Place toolbar, input box, and feed in the desktop sidebar or right beside the canvas, leaving 25% for the opponent column with a clean vertical divider.
3. **Face-Off Header & Drawer Matchup (`StatusBar.tsx`):**
   - Display the active matchup clearly (e.g. `Team 1 (Asha) vs Team 2 (Ben)`).
4. **Intermission Phase & Continue Button (`engine.ts` & `Intermission.tsx`):**
   - In `engine.ts`, transition to `phase: "intermission"`.
   - Add `continue` move type so players can tap `[ continue ]` to advance.
   - Show big scores (`0 - 200`), roles (winner, next challenger, on deck), side-by-side final drawings with `↻ replay`, and the `[ continue ]` button.
5. **Synchronized Win/Loss Overlays (`Overlays.tsx` & `index.tsx`):**
   - Winning canvas: 🏆 `you win!` / `waiting for team X...` with green border.
   - Opponent box on loser's screen: turns green with attempt tracker.
   - Loser timeout: `time's up! the word was <word>` with red text.
6. **Verify with Multi-Player Playwright Script:**
   - Run simulation for desktop, mobile, light mode, dark mode, and spectators.
   - Generate full-width video recordings and screenshots.
