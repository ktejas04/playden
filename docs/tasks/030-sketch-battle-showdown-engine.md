# 030 — Sketch Battle engine: the showdown

Phase: 4.3 (Sketch Battle: showdown)
Depends on: 021, 028
Touches: packages/games/sketch-battle/{config.ts, types.ts, engine.ts, showdown.ts}, packages/games/sketch-battle/tests/{engine,showdown}.test.ts
Spec: docs/games/sketch-battle.md sections 6 (worked example 4), 9, 15–17, 20 (Showdown)

## Steps

1. Tests first, from section 20's Showdown list and worked example 4.
2. After the last round's summary: intro (10 s) → countdown (3 s) → showdown → result (5 s) → ended.
3. Words: every round word, in one seeded order shared by both teams.
4. Each team's first drawer follows the normal rotation from its last-round drawer; each correct guess scores 100, and the pencil passes to the next connected player after a 2 s handoff.
5. The first team to finish every word gets +100 and ends the showdown. Game total decides the winner.
6. Views: a team sees only its own canvas; its drawer sees its current word, its guessers blanks; spectators see both. Words a team hasn't reached stay hidden from it.
7. `recordSummary` gains the showdown result.

## Done when

- [ ] every Showdown test in section 20 passes, plus worked example 4
- [ ] the contract kit plays random games through the showdown to the end
- [ ] pnpm typecheck, lint, test pass
