# Tasks

One small task per file: `NNN-<slug>.md`, numbered in build order. Format and the working loop are in `docs/PROJECT.md` under "Agent playbook".

Template:

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
