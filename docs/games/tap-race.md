# Tap Race — game spec

Id: `tap-race` · Dev-only (never shown in production) · Players: 2–16 in two teams · Last updated: 2026-11-12

A throwaway game that exists only to prove the platform: rooms, teams, moves, per-player views, hidden information and deadlines. It is listed only on local dev servers (test-player sign-in on).

## Rules

- Two teams, 1–8 players each, sizes at most 2 apart.
- Every tap adds 1 to your team's count. Spectators can't tap.
- You see your own team's exact count. The other team's count is hidden: you only see whether your team is **ahead**, **behind** or **level**. Spectators see both counts, and everyone sees both once the race is over.
- The first team to reach `TARGET_TAPS` (30) wins at once.
- Otherwise the game ends `ROUND_SECONDS` (20) after it starts. The higher count wins; equal counts are a draw.
- A player who leaves keeps their team's taps; the game goes on.

## Result

- Each player's score is their team's count.
- Winners are the players of the winning team; a draw has no winners.

## Settings (`config.ts`)

| Name | Default | Host can change |
| --- | --- | --- |
| `TARGET_TAPS` | 30 | Yes, 5–200 |
| `ROUND_SECONDS` | 20 | Yes, 5–120 |

## Edge cases (each becomes a test)

- a tap adds 1 to the tapper's team only
- a spectator's tap is rejected with a reason
- a tap after the game ended is rejected with a reason
- reaching the target ends the game at once with that team winning
- the deadline ends the game with the higher count winning
- equal counts at the deadline are a draw
- the view shows the exact count only for your own team
- spectators see both counts
- everyone sees both counts once the race is over
- every seat must be on a team
- a leaving player's taps stay with their team

## Screen

One large tap button for players, the two scores (your team exact, the other as ahead/behind/level), a countdown, and the result when it ends.
