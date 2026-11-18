import { type Seat, seatProblem } from "@playden/engine";
import { describeGameContract } from "@playden/engine/testing";
import { describe, expect, it } from "vitest";
import {
  CHOOSE_SECONDS,
  COUNTDOWN_SECONDS,
  DEFAULT_CONFIG,
  FORCE_START_AFTER_SECONDS,
  GUESS_WINDOW_MS,
  RESULT_SECONDS,
  STROKE_MOVE_LIMIT,
} from "../config";
import { sketchBattle as game } from "../engine";
import { EMPTY_CELLS } from "../preview";
import type {
  SketchBattleConfig,
  SketchBattleMove,
  SketchBattleState,
  SketchBattleSummary,
  SketchBattleView,
  TeamIndex,
} from "../types";

/**
 * Sketch Battle's rules for phase 4.1 (task 021): a round end to end, guessing, scoring,
 * hidden information, simple rotation and SB12. Test names follow spec section 20.
 * Team 1: Asha, Ben, Chi. Team 2: Dev, Esha, Faiz.
 */
const seats: Seat[] = [
  { id: "asha", name: "Asha", team: 0 },
  { id: "ben", name: "Ben", team: 0 },
  { id: "chi", name: "Chi", team: 0 },
  { id: "dev", name: "Dev", team: 1 },
  { id: "esha", name: "Esha", team: 1 },
  { id: "faiz", name: "Faiz", team: 1 },
];
const START = 1_000_000;
const ROUND_MS = DEFAULT_CONFIG.roundSeconds * 1000;
type State = SketchBattleState;

function start(config: Partial<SketchBattleConfig> = {}, seed = 7): State {
  return game.setup(seats, { ...DEFAULT_CONFIG, rounds: 10, ...config }, seed, START);
}

function move(state: State, playerId: string, m: SketchBattleMove, at: number): State {
  const verdict = game.validate(state, playerId, m, at);
  if (!verdict.ok) throw new Error(`${playerId} ${m.type}: ${verdict.reason}`);
  return game.apply(state, playerId, m, at).state;
}

function refusal(state: State, playerId: string, m: SketchBattleMove, at: number): string {
  const verdict = game.validate(state, playerId, m, at);
  if (verdict.ok) throw new Error(`Expected ${m.type} by ${playerId} to be refused`);
  return verdict.reason;
}

/** Fires the next deadline at its time. */
function tick(state: State): State {
  const at = game.nextDeadline(state);
  if (at === null) throw new Error(`No deadline in phase ${state.phase}`);
  return game.onDeadline(state, at).state;
}

const round = (state: State) => {
  if (!state.round) throw new Error("No round");
  return state.round;
};
const word = (state: State) => round(state).word ?? "";
const drawer = (state: State, team: TeamIndex) => round(state).turns[team].drawerId;
const teamOf = (id: string): TeamIndex => (seats.find((s) => s.id === id)?.team ?? 0) as TeamIndex;
const view = (state: State, viewer: string): SketchBattleView => game.view(state, viewer);
/** Guessers of a team this round. */
const guessers = (state: State, team: TeamIndex) =>
  state.rotations[team].filter((id) => id !== drawer(state, team));

/**
 * From the choose stage to the drawing stage: the chooser picks word `index`, the countdown
 * runs out, then the head start if there is one. `drawingAt` is when both teams draw.
 */
function toDrawing(state: State, index: 0 | 1 = 0): { state: State; drawingAt: number } {
  const chosenAt = (state.phaseEndsAt ?? START) - 1_000;
  let next = move(state, round(state).chooserId, { type: "choose", index }, chosenAt);
  next = tick(next);
  if (next.phase === "headStart") next = tick(next);
  const headStartMs = round(next).headStartSeconds * 1000;
  return { state: next, drawingAt: chosenAt + COUNTDOWN_SECONDS * 1000 + headStartMs };
}

const guess = (text: string) => ({ type: "guess", text }) as const;
const READY = { type: "ready" } as const;
const FORCE = { type: "forceStart" } as const;

/** Every connected player taps Continue on the summary, in seat order. */
function readyAll(state: State, at: number): State {
  let next = state;
  for (const { id } of seats) {
    if (next.phase !== "summary") break;
    if (next.away.includes(id) || next.left.includes(id) || next.ready.includes(id)) continue;
    next = move(next, id, READY, at);
  }
  return next;
}

/** From a round's end to the next round: the result runs out, then everyone taps Continue. */
function nextRound(state: State): State {
  const summary = tick(state);
  return readyAll(summary, summary.phaseEndsAt ?? START);
}
const line = (stroke: number, points: number[]): SketchBattleMove => ({
  type: "draw",
  stroke,
  start: { tool: "pen", colour: 2, size: 1 },
  points,
});

describe("setup", () => {
  it("start needs 2–8 players per team, with no size-gap rule", () => {
    const team = (t: number, n: number) =>
      Array.from({ length: n }, (_, i): Seat => ({ id: `${t}-${i}`, name: `P${i}`, team: t }));
    expect(seatProblem(game, [...team(0, 3), ...team(1, 1)])).toBe("Team 2 needs 1 more");
    expect(seatProblem(game, [...team(0, 2), ...team(1, 2)])).toBeNull();
    expect(seatProblem(game, [...team(0, 8), ...team(1, 2)])).toBeNull();
    expect(seatProblem(game, [...team(0, 9), ...team(1, 2)])).toBe("Team 1 is over 8");
  });

  it("opens round 1 with each team's first player drawing and a 15 s choice", () => {
    const state = start();
    expect(state.phase).toBe("choose");
    expect([drawer(state, 0), drawer(state, 1)]).toEqual(["asha", "dev"]);
    expect(game.nextDeadline(state)).toBe(START + CHOOSE_SECONDS * 1000);
  });

  it("moves at most 15 a second per connection, for fast drawing", () => {
    expect(game.moveLimit).toEqual(STROKE_MOVE_LIMIT);
  });
});

describe("choosing", () => {
  it("round 1 chooser team comes from the seed", () => {
    const chooserTeams = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => teamOf(round(start({}, seed)).chooserId)),
    );
    expect(chooserTeams).toEqual(new Set([0, 1]));
    expect(round(start({}, 3)).chooserId).toBe(round(start({}, 3)).chooserId);
    const state = start();
    expect([drawer(state, 0), drawer(state, 1)]).toContain(round(state).chooserId);
  });

  it("the chooser after a no-winner round comes from the seed", () => {
    const chooserTeams = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
        let state = toDrawing(start({}, seed)).state;
        state = nextRound(tick(state));
        return teamOf(round(state).chooserId);
      }),
    );
    expect(chooserTeams).toEqual(new Set([0, 1]));
  });

  it("both drawers get the word choices and only the chooser can pick", () => {
    const state = start();
    const chooser = round(state).chooserId;
    const other = drawer(state, teamOf(chooser) === 0 ? 1 : 0);
    expect(view(state, chooser).choices).toEqual(round(state).choices);
    expect(view(state, other).choices).toEqual(round(state).choices);
    expect(refusal(state, other, { type: "choose", index: 0 }, START)).toBe(
      "Only the chooser can pick the word",
    );
  });

  it("the choose timeout picks the first word", () => {
    const state = tick(start());
    expect(round(state).word).toBe(round(state).choices[0]);
    expect(state.phase).toBe("countdown");
  });

  it("no word is offered twice in a game", () => {
    let state = start({ rounds: 15, roundSeconds: 15 });
    const offered: string[] = [];
    while (state.phase !== "showdownIntro") {
      if (state.phase === "choose") offered.push(...round(state).choices);
      state = state.phase === "result" ? nextRound(state) : tick(state);
    }
    expect(offered).toHaveLength(30);
    expect(new Set(offered).size).toBe(30);
  });
});

describe("a round", () => {
  it("with no head start, both drawers start when the countdown ends", () => {
    const { state, drawingAt } = toDrawing(start());
    expect(state.phase).toBe("drawing");
    expect(round(state).turns.map((t) => t.drawFrom)).toEqual([drawingAt, drawingAt]);
    expect(game.nextDeadline(state)).toBe(drawingAt + ROUND_MS);
  });

  it("the round ends early once both teams have guessed", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const w = word(state);
    state = move(state, guessers(state, 0)[0] ?? "", guess(w), drawingAt + 5_000);
    expect(state.phase).toBe("drawing");
    state = move(state, guessers(state, 1)[0] ?? "", guess(w), drawingAt + 9_000);
    expect(state.phase).toBe("result");
    expect(game.nextDeadline(state)).toBe(drawingAt + 9_000 + RESULT_SECONDS * 1000);
  });

  it("a drawer can't draw after their team guesses", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const d = drawer(state, 0);
    state = move(state, d, line(1, [10, 10, 5, 5]), drawingAt + 100);
    state = move(state, guessers(state, 0)[0] ?? "", guess(word(state)), drawingAt + 200);
    expect(refusal(state, d, line(2, [20, 20]), drawingAt + 300)).toBe(
      "Your team got it: the canvas is locked",
    );
  });

  it("only the drawers draw, and only while drawing", () => {
    const fresh = start();
    expect(refusal(fresh, drawer(fresh, 0), line(1, [1, 1]), START)).toBe(
      "Wait for the drawing to start",
    );
    const { state, drawingAt } = toDrawing(fresh);
    expect(refusal(state, guessers(state, 0)[0] ?? "", line(1, [1, 1]), drawingAt)).toBe(
      "Only the drawer can draw",
    );
  });

  it("a stroke drawn in batches is one stroke with absolute points", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const d = drawer(state, 0);
    state = move(state, d, line(1, [100, 100, 10, 0, 10, 0]), drawingAt + 10);
    state = move(
      state,
      d,
      { type: "draw", stroke: 1, points: [130, 100, 0, 10], end: true },
      drawingAt + 160,
    );
    expect(round(state).turns[0].ops).toEqual([
      {
        id: 1,
        tool: "pen",
        colour: 2,
        size: 1,
        points: [100, 100, 110, 100, 120, 100, 130, 100, 130, 110],
      },
    ]);
  });

  it("refuses points off the canvas and a batch for a line that isn't the last", () => {
    const { state, drawingAt } = toDrawing(start());
    const d = drawer(state, 0);
    expect(refusal(state, d, line(1, [1501, 10]), drawingAt)).toBe("That line is off the canvas");
    expect(refusal(state, d, { type: "draw", stroke: 9, points: [1, 1] }, drawingAt)).toBe(
      "Start a new line first",
    );
  });

  it("clear empties the canvas and the pixel view", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const d = drawer(state, 1);
    state = move(state, d, line(1, [10, 10, 100, 100]), drawingAt);
    state = move(state, d, { type: "clear" }, drawingAt + 50);
    expect(round(state).turns[1].ops.at(-1)).toEqual({ clear: true });
    expect(round(state).turns[1].cells).toBe(EMPTY_CELLS);
  });
});

describe("scoring", () => {
  function bothGuess(firstTeam: TeamIndex, gapMs: number) {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const w = word(state);
    const other: TeamIndex = firstTeam === 0 ? 1 : 0;
    state = move(state, guessers(state, firstTeam)[0] ?? "", guess(w), drawingAt + 1_000);
    state = move(state, guessers(state, other)[0] ?? "", guess(w), drawingAt + 1_000 + gapMs);
    return state;
  }

  it("first team to guess scores 200", () => {
    expect(bothGuess(1, 3_000).scores).toEqual([100, 200]);
  });

  it("second team scores 100 however late", () => {
    expect(bothGuess(0, ROUND_MS - 2_000).scores).toEqual([200, 100]);
  });

  it("team that never guesses scores 0", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    state = move(state, guessers(state, 1)[0] ?? "", guess(word(state)), drawingAt + 20_000);
    state = tick(state);
    expect(state.phase).toBe("result");
    expect(state.scores).toEqual([0, 200]);
    expect(state.history[0]?.winnerTeam).toBe(1);
  });

  it("nobody guessing scores 0 for both", () => {
    const state = tick(toDrawing(start()).state);
    expect(state.scores).toEqual([0, 0]);
    expect(state.history[0]?.winnerTeam).toBeNull();
  });

  it("same-millisecond guesses go to the first processed", () => {
    expect(bothGuess(1, 0).scores).toEqual([100, 200]);
    expect(bothGuess(0, 0).scores).toEqual([200, 100]);
  });
});

describe("guessing", () => {
  it("a correct guess ignores case, accents, spaces and punctuation", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const shouted = `  ${word(state).toUpperCase().replace(/ /g, "")}!! `;
    state = move(state, guessers(state, 0)[0] ?? "", guess(shouted), drawingAt + 10);
    expect(round(state).turns[0].solvedAt).toBe(drawingAt + 10);
  });

  it("drawers and spectators can't guess", () => {
    const { state, drawingAt } = toDrawing(start());
    expect(refusal(state, drawer(state, 0), guess("x"), drawingAt)).toBe("Drawers can't guess");
    expect(refusal(state, "zed", guess("x"), drawingAt)).toBe("You're watching this game");
  });

  it("guesses are refused outside the drawing stage", () => {
    const state = start();
    expect(refusal(state, "ben", guess("x"), START)).toBe("Guessing opens when the drawing starts");
    const counting = move(state, round(state).chooserId, { type: "choose", index: 0 }, START);
    expect(refusal(counting, "ben", guess("x"), START + 1)).toBe(
      "Guessing opens when the drawing starts",
    );
  });

  it("guesses are refused the moment the round's time is up, before the deadline is processed", () => {
    const { state } = toDrawing(start());
    const deadline = state.phaseEndsAt ?? 0;
    const g = guessers(state, 0)[0] ?? "";
    expect(game.validate(state, g, guess(word(state)), deadline - 1).ok).toBe(true);
    expect(refusal(state, g, guess(word(state)), deadline)).toBe("The round is over");
  });

  it("guesses are refused once the round has ended", () => {
    const drawing = toDrawing(start());
    const at = drawing.drawingAt + 1_000;
    let state = move(
      drawing.state,
      guessers(drawing.state, 0)[0] ?? "",
      guess(word(drawing.state)),
      at,
    );
    state = move(state, guessers(state, 1)[0] ?? "", guess(word(state)), at + 1);
    expect(state.phase).toBe("result");
    const late = guessers(state, 0)[1] ?? "";
    expect(refusal(state, late, guess("anything"), at + 2)).toBe("The round is over");
  });

  it("a team can't guess again after guessing", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const [first, second] = guessers(state, 0);
    state = move(state, first ?? "", guess(word(state)), drawingAt + 10);
    expect(refusal(state, second ?? "", guess("again"), drawingAt + 20)).toBe(
      "Your team already got it",
    );
  });

  it("a 4th guess within 3 s is refused", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const g = guessers(state, 0)[0] ?? "";
    for (const at of [0, 1_000, 2_000]) state = move(state, g, guess("zzz"), drawingAt + at);
    expect(refusal(state, g, guess("zzz"), drawingAt + 2_999)).toBe("Slow down");
    expect(game.validate(state, g, guess("zzz"), drawingAt + GUESS_WINDOW_MS).ok).toBe(true);
  });

  it("guesses over 36 characters are refused", () => {
    const { state, drawingAt } = toDrawing(start());
    expect(refusal(state, guessers(state, 0)[0] ?? "", guess("a".repeat(37)), drawingAt)).toBe(
      "Guesses are at most 36 characters",
    );
  });

  it("each team sees its own guesses, and the other team's once it has guessed", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const [a] = guessers(state, 0);
    const [b] = guessers(state, 1);
    state = move(state, b ?? "", guess("zzz"), drawingAt + 10);
    expect(view(state, b ?? "").teams[1].guesses?.map((g) => g.text)).toEqual(["zzz"]);
    expect(view(state, a ?? "").teams[1].guesses).toBeNull();
    state = move(state, a ?? "", guess(word(state)), drawingAt + 20);
    expect(view(state, a ?? "").teams[1].guesses?.map((g) => g.text)).toEqual(["zzz"]);
  });
});

describe("hidden information", () => {
  it("view hides the word from guessers until their team guesses", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const [g] = guessers(state, 0);
    const before = view(state, g ?? "");
    expect(before.word).toBeNull();
    expect(before.blanks).toMatch(/^[_ -]+$/);
    expect(JSON.stringify(before)).not.toContain(JSON.stringify(word(state)));
    state = move(state, g ?? "", guess(word(state)), drawingAt + 10);
    expect(view(state, g ?? "").word).toBe(word(state));
    expect(view(state, guessers(state, 1)[0] ?? "").word).toBeNull();
  });

  it("the other team's wrong-guess count shows, but not their guesses", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const [g] = guessers(state, 1);
    state = move(state, g ?? "", guess("banana"), drawing.drawingAt + 10);
    state = move(state, g ?? "", guess("rocket"), drawing.drawingAt + 20);
    const theirs = view(state, guessers(state, 0)[0] ?? "").teams[1];
    expect(theirs.guesses).toBeNull();
    expect(theirs.wrongGuesses).toBe(2);
    expect(JSON.stringify(theirs)).not.toContain("banana");
    state = move(state, g ?? "", guess(word(state)), drawing.drawingAt + 30);
    const after = view(state, guessers(state, 0)[0] ?? "").teams[1];
    expect([after.wrongGuesses, after.solvedAt]).toEqual([2, drawing.drawingAt + 30]);
  });

  it("with word lengths off, guessers get no blanks", () => {
    const { state } = toDrawing(start({ showWordLengths: false }));
    expect(view(state, guessers(state, 0)[0] ?? "").blanks).toBeNull();
  });

  it("the other team gets only pixel cells until the round result, even once they guess (SB25)", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    state = move(state, drawer(state, 1), line(1, [10, 10, 400, 10]), drawingAt + 10);
    const [g] = guessers(state, 0);
    const canvas = view(state, g ?? "").teams[1].canvas;
    expect(canvas.kind).toBe("cells");
    expect(JSON.stringify(canvas)).not.toContain("points");
    state = move(state, g ?? "", guess(word(state)), drawingAt + 20);
    state = move(state, drawer(state, 1), line(2, [10, 500, 400, 500]), drawingAt + 30);
    for (const id of [g ?? "", drawer(state, 0)]) {
      const after = view(state, id).teams[1].canvas;
      expect(after).toEqual({ kind: "cells", cells: round(state).turns[1].cells });
      expect(JSON.stringify(after)).not.toContain("points");
    }
    const result = tick(state);
    expect(result.phase).toBe("result");
    expect(view(result, g ?? "").teams[1].canvas).toEqual({
      kind: "strokes",
      ops: round(result).turns[1].ops,
    });
  });

  it("a team that guessed gets the other team's draw batches as pixel cells, never points (SB25)", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const [g] = guessers(state, 0);
    state = move(state, g ?? "", guess(word(state)), drawing.drawingAt + 10);
    const next = move(state, drawer(state, 1), line(1, [10, 10, 400, 10]), drawing.drawingAt + 20);
    const change = game.delta?.(state, next, g ?? "");
    expect(change?.teams?.[1]?.canvas).toHaveProperty("cells");
    expect(JSON.stringify(change)).not.toContain("points");
  });

  it("each team sees its own drawing as strokes", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    state = move(state, drawer(state, 0), line(1, [10, 10]), drawingAt + 10);
    expect(view(state, guessers(state, 0)[0] ?? "").teams[0].canvas.kind).toBe("strokes");
  });

  it("drawers and spectators keep the choices through the countdown, to show the pick (SB20)", () => {
    const state = start();
    const chosenAt = (state.phaseEndsAt ?? START) - 1_000;
    const counting = move(state, round(state).chooserId, { type: "choose", index: 1 }, chosenAt);
    expect(counting.phase).toBe("countdown");
    expect(view(counting, drawer(counting, 0)).choices).toEqual(round(state).choices);
    expect(view(counting, "spectator").choices).toEqual(round(state).choices);
    expect(view(counting, guessers(counting, 0)[0] ?? "").choices).toBeNull();
    expect(view(tick(counting), "spectator").choices).toBeNull();
  });

  it("word choices go to the two drawers and spectators, never to guessers (SB20)", () => {
    const state = start();
    expect(view(state, guessers(state, 0)[0] ?? "").choices).toBeNull();
    expect(view(state, guessers(state, 1)[0] ?? "").choices).toBeNull();
    expect(view(state, "spectator").choices).toEqual(round(state).choices);
  });

  it("spectators see both canvases and the word", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    state = move(state, drawer(state, 0), line(1, [10, 10]), drawingAt + 10);
    const seen = view(state, "spectator");
    expect(seen.me.role).toBe("spectator");
    expect(seen.word).toBe(word(state));
    expect(seen.teams.map((t) => t.canvas.kind)).toEqual(["strokes", "strokes"]);
  });

  it("everyone sees the word at the round result", () => {
    const state = tick(toDrawing(start()).state);
    expect(view(state, guessers(state, 0)[0] ?? "").word).toBe(word(state));
  });

  it("draw and wrong-guess moves are live and never change the next deadline", () => {
    const { state, drawingAt } = toDrawing(start());
    const deadline = game.nextDeadline(state);
    const drew = game.apply(state, drawer(state, 0), line(1, [5, 5]), drawingAt + 10);
    const cleared = game.apply(drew.state, drawer(state, 0), { type: "clear" }, drawingAt + 20);
    const wrong = game.apply(state, guessers(state, 0)[0] ?? "", guess("zzz"), drawingAt + 30);
    for (const t of [drew, cleared, wrong]) {
      expect(t.live).toBe(true);
      expect(game.nextDeadline(t.state)).toBe(deadline);
    }
    const right = game.apply(state, guessers(state, 0)[0] ?? "", guess(word(state)), drawingAt);
    expect(right.live).toBeUndefined();
  });
});

describe("rotation and disconnects", () => {
  /** Plays the current round to its end with `team` guessing first (null: nobody guesses). */
  function playRound(state: State, team: TeamIndex | null): State {
    const drawing = toDrawing(state);
    let next = drawing.state;
    if (team !== null) {
      next = move(next, guessers(next, team)[0] ?? "", guess(word(next)), drawing.drawingAt + 1);
    }
    return nextRound(tick(next));
  }

  it("both teams rotate after a no-winner round", () => {
    let state = playRound(start(), null);
    expect([drawer(state, 0), drawer(state, 1)]).toEqual(["ben", "esha"]);
    state = game.onPresence?.(state, ["chi"], START).state ?? state;
    state = playRound(state, null);
    expect(drawer(state, 0)).toBe("asha");
  });

  it("the winning drawer stays and the losing team rotates", () => {
    let state = playRound(start(), 1);
    expect([drawer(state, 0), drawer(state, 1)]).toEqual(["ben", "dev"]);
    state = playRound(state, 1);
    expect([drawer(state, 0), drawer(state, 1)]).toEqual(["chi", "dev"]);
    state = playRound(state, 0);
    expect([drawer(state, 0), drawer(state, 1)]).toEqual(["chi", "esha"]);
  });

  it("the challenger chooses after a round with a winner", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const afterTeam1Won = playRound(start({}, seed), 0);
      expect(round(afterTeam1Won).chooserId).toBe(drawer(afterTeam1Won, 1));
      const afterTeam2Won = playRound(start({}, seed), 1);
      expect(round(afterTeam2Won).chooserId).toBe(drawer(afterTeam2Won, 0));
    }
  });

  it("a winning drawer who is away gives way to the next connected player", () => {
    let state = playRound(start(), 1);
    expect(drawer(state, 1)).toBe("dev");
    const drawing = toDrawing(state);
    state = drawing.state;
    state = move(state, guessers(state, 1)[0] ?? "", guess(word(state)), drawing.drawingAt + 1);
    state = tick(state);
    state = game.onPresence?.(state, ["dev"], START + 999_001).state ?? state;
    state = nextRound(state);
    expect(drawer(state, 1)).toBe("esha");
  });

  it("rotation skips players who left", () => {
    let state = toDrawing(start()).state;
    state = game.onPlayerLeft(state, "esha").state;
    state = nextRound(tick(state));
    expect(drawer(state, 1)).toBe("faiz");
  });

  it("an away drawer's canvas stays and their team can still guess", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    state = move(state, drawer(state, 0), line(1, [10, 10, 50, 50]), drawingAt + 10);
    state = game.onPresence?.(state, [drawer(state, 0)], drawingAt + 20).state ?? state;
    expect(round(state).turns[0].ops).toHaveLength(1);
    state = move(state, guessers(state, 0)[0] ?? "", guess(word(state)), drawingAt + 30);
    expect(round(state).turns[0].solvedAt).toBe(drawingAt + 30);
  });

  it("a round plays on and times out when a team has nobody connected", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    state = game.onPresence?.(state, ["dev", "esha", "faiz"], drawingAt + 10).state ?? state;
    expect(state.phase).toBe("drawing");
    state = move(state, guessers(state, 0)[0] ?? "", guess(word(state)), drawingAt + 20);
    state = tick(state);
    expect(state.phase).toBe("result");
    expect(state.scores).toEqual([200, 0]);
  });

  it("Continue and Start next round are locked until each team has 2 connected players", () => {
    let state = tick(tick(toDrawing(start()).state));
    expect(state.phase).toBe("summary");
    state = game.onPresence?.(state, ["esha", "faiz"], START).state ?? state;
    expect(view(state, "asha").waitingFor).toEqual([1]);
    const late = (state.phaseEndsAt ?? START) + 1;
    expect(refusal(state, "asha", READY, late)).toBe("Waiting for Team 2");
    expect(refusal(state, "asha", FORCE, late)).toBe("Waiting for Team 2");

    state = game.onPresence?.(state, ["faiz"], START + 90_000).state ?? state;
    expect(view(state, "asha").waitingFor).toEqual([]);
    expect(state.phase).toBe("summary");
    state = readyAll(state, START + 91_000);
    expect(state.phase).toBe("choose");
    expect(round(state).number).toBe(2);
    expect(game.nextDeadline(state)).toBe(START + 91_000 + CHOOSE_SECONDS * 1000);
  });

  it("with too few players left, the game waits until the host ends it", () => {
    let state = tick(tick(toDrawing(start()).state));
    for (const id of ["esha", "faiz"]) state = game.onPlayerLeft(state, id).state;
    expect(refusal(state, "asha", READY, START + 999_999)).toBe("Waiting for Team 2");
    expect(state.phase).toBe("summary");
    expect(game.standings?.(state)).toMatchObject({ asha: 0, dev: 0 });
  });
});

describe("ready-up", () => {
  /** Round 1 played out with no winner, now on the summary. */
  const summary = () => tick(tick(toDrawing(start()).state));

  it("the result shows for 5 s before the summary", () => {
    const result = tick(toDrawing(start()).state);
    expect(result.phase).toBe("result");
    const resultEnds = game.nextDeadline(result) ?? 0;
    const state = tick(result);
    expect(state.phase).toBe("summary");
    expect(game.nextDeadline(state)).toBe(resultEnds + FORCE_START_AFTER_SECONDS * 1000);
  });

  it("the next round starts when every connected player is ready", () => {
    let state = summary();
    const at = state.phaseEndsAt ?? START;
    for (const id of ["asha", "ben", "chi", "dev", "esha"]) state = move(state, id, READY, at);
    expect(state.phase).toBe("summary");
    expect(view(state, "dev").ready).toEqual(["asha", "ben", "chi", "dev", "esha"]);
    expect(refusal(state, "asha", READY, at)).toBe("You're already ready");
    state = move(state, "faiz", READY, at);
    expect(state.phase).toBe("choose");
    expect(round(state).number).toBe(2);
    expect(view(state, "dev").ready).toEqual([]);
  });

  it("Continue taps during the result count once the summary is up", () => {
    let state = tick(toDrawing(start()).state);
    for (const { id } of seats) state = move(state, id, READY, START + 1);
    expect(state.phase).toBe("result");
    state = tick(state);
    expect(state.phase).toBe("choose");
  });

  it("away players aren't waited for", () => {
    let state = summary();
    state = game.onPresence?.(state, ["faiz"], START).state ?? state;
    state = readyAll(state, state.phaseEndsAt ?? START);
    expect(state.phase).toBe("choose");
  });

  it("the round starts when the last unready player drops", () => {
    let state = summary();
    for (const id of ["asha", "ben", "chi", "dev", "esha"]) state = move(state, id, READY, START);
    state = game.onPresence?.(state, ["faiz"], START + 5).state ?? state;
    expect(state.phase).toBe("choose");
  });

  it("a ready player can skip the unready ones after 10 s and not before", () => {
    let state = summary();
    const unlock = state.phaseEndsAt ?? 0;
    state = move(state, "ben", READY, unlock - 5_000);
    expect(refusal(state, "ben", FORCE, unlock - 1)).toBe(
      "Start next round opens 10 s into the summary",
    );
    state = tick(state);
    expect(state.phase).toBe("summary");
    expect(game.nextDeadline(state)).toBeNull();
    state = move(state, "ben", FORCE, unlock + 1);
    expect(state.phase).toBe("choose");
  });

  it("a player who hasn't tapped Continue can't skip the others", () => {
    const state = tick(summary());
    expect(refusal(state, "asha", FORCE, START + 999_999)).toBe("Tap Continue first");
  });

  it("spectators can't ready up or force the next round", () => {
    const state = tick(summary());
    expect(refusal(state, "zed", READY, START + 999_999)).toBe("You're watching this game");
    expect(refusal(state, "zed", FORCE, START + 999_999)).toBe("You're watching this game");
  });

  it("Continue is refused outside the round's end", () => {
    expect(refusal(start(), "asha", READY, START)).toBe("The round is not over yet");
  });
});

describe("streaks and head starts", () => {
  /** Plays the current round with `team` guessing first (null: nobody), up to the next choose stage. */
  function win(state: State, team: TeamIndex | null): State {
    const drawing = toDrawing(state);
    let next = drawing.state;
    if (team !== null) {
      next = move(next, guessers(next, team)[0] ?? "", guess(word(next)), drawing.drawingAt + 1);
    }
    return nextRound(tick(next));
  }
  /** The choose stage of a round where Team 1's Asha is on a two-win streak: Faiz gets 3 s. */
  const afterTwoWins = () => win(win(start(), 0), 0);
  /** Picks the word and runs the countdown: the head start begins. */
  function toHeadStart(state: State): { state: State; startsAt: number } {
    const chosenAt = (state.phaseEndsAt ?? START) - 1_000;
    const chosen = move(state, round(state).chooserId, { type: "choose", index: 0 }, chosenAt);
    return { state: tick(chosen), startsAt: chosenAt + COUNTDOWN_SECONDS * 1000 };
  }
  const matchup = (state: State) => ({
    drawers: [drawer(state, 0), drawer(state, 1)],
    chooser: round(state).chooserId,
    headStart: round(state).headStartSeconds,
  });

  it("follows the worked example in section 8", () => {
    let state = start();
    expect(matchup(state).drawers).toEqual(["asha", "dev"]);
    state = win(state, 0);
    expect(matchup(state)).toEqual({ drawers: ["asha", "esha"], chooser: "esha", headStart: 0 });
    state = win(state, 0);
    expect(matchup(state)).toEqual({ drawers: ["asha", "faiz"], chooser: "faiz", headStart: 3 });
    state = win(state, 1);
    expect(matchup(state)).toEqual({ drawers: ["ben", "faiz"], chooser: "ben", headStart: 0 });
  });

  it("two wins in a row give the challenger 3 s, three give 4 s", () => {
    let state = afterTwoWins();
    expect(round(state).headStartSeconds).toBe(3);
    state = win(state, 0);
    expect(matchup(state)).toEqual({ drawers: ["asha", "dev"], chooser: "dev", headStart: 4 });
    state = win(state, 0);
    expect(round(state).headStartSeconds).toBe(5);
  });

  it("round 1 and the round after a no-winner round have no head start (D44)", () => {
    expect(round(start()).headStartSeconds).toBe(0);
    const state = win(afterTwoWins(), null);
    expect(round(state).headStartSeconds).toBe(0);
  });

  it("a winning drawer who drops before the next round takes their streak with them", () => {
    let state = win(start(), 0);
    const drawing = toDrawing(state);
    state = move(
      drawing.state,
      guessers(drawing.state, 0)[0] ?? "",
      guess(word(drawing.state)),
      drawing.drawingAt + 1,
    );
    state = tick(tick(state));
    state = game.onPresence?.(state, ["asha"], state.phaseEndsAt ?? START).state ?? state;
    state = readyAll(state, state.phaseEndsAt ?? START);
    expect(matchup(state)).toEqual({ drawers: ["ben", "faiz"], chooser: "faiz", headStart: 0 });
  });

  it("the round deadline counts from the end of the head start", () => {
    const { state, startsAt } = toHeadStart(afterTwoWins());
    expect(state.phase).toBe("headStart");
    expect(game.nextDeadline(state)).toBe(startsAt + 3_000);
    const drawing = tick(state);
    expect(drawing.phase).toBe("drawing");
    expect(game.nextDeadline(drawing)).toBe(startsAt + 3_000 + ROUND_MS);
    // The chooser draws round length + 3 s in all; the other drawer the round length.
    expect(round(drawing).turns.map((t) => t.drawFrom)).toEqual([startsAt + 3_000, startsAt]);
  });

  it("during the head start only the chooser draws and nobody guesses", () => {
    const { state, startsAt } = toHeadStart(afterTwoWins());
    const at = startsAt + 1_000;
    const drawn = move(state, "faiz", line(1, [10, 10, 5, 5]), at);
    expect(refusal(drawn, "asha", line(1, [10, 10]), at)).toBe("Wait for the drawing to start");
    for (const id of ["ben", "esha"]) {
      expect(refusal(drawn, id, guess(word(drawn)), at)).toBe(
        "Guessing opens when the drawing starts",
      );
    }
    const drawing = tick(drawn);
    expect(() => move(drawing, "asha", line(1, [10, 10]), startsAt + 3_000)).not.toThrow();
  });

  it("the head-start canvas goes only to the chooser and spectators", () => {
    const { state, startsAt } = toHeadStart(afterTwoWins());
    const drawn = move(state, "faiz", line(1, [10, 10, 300, 300]), startsAt + 500);
    const canvasFor = (viewer: string) => view(drawn, viewer).teams[1].canvas;
    expect(canvasFor("faiz")).toMatchObject({ kind: "strokes", ops: [{ id: 1 }] });
    expect(canvasFor("spectator")).toMatchObject({ kind: "strokes", ops: [{ id: 1 }] });
    // His teammates and the other team see nothing of it: no strokes, no pixel cells.
    expect(canvasFor("esha")).toEqual({ kind: "strokes", ops: [] });
    expect(canvasFor("asha")).toEqual({ kind: "cells", cells: EMPTY_CELLS });
    expect(canvasFor("ben")).toEqual({ kind: "cells", cells: EMPTY_CELLS });
    // Once the drawing starts, the head start's lines show like any others.
    const drawing = tick(drawn);
    expect(view(drawing, "esha").teams[1].canvas).toMatchObject({ ops: [{ id: 1 }] });
    expect(view(drawing, "ben").teams[1].canvas).not.toEqual({ kind: "cells", cells: EMPTY_CELLS });
  });

  it("the view shows the streak and the head start from the summary to the drawing", () => {
    let state = win(start(), 0);
    const drawing = toDrawing(state);
    state = move(
      drawing.state,
      guessers(drawing.state, 0)[0] ?? "",
      guess(word(drawing.state)),
      drawing.drawingAt + 1,
    );
    state = tick(tick(state));
    expect(state.phase).toBe("summary");
    // On the summary: the coming round's streak and head start.
    for (const viewer of ["asha", "faiz", "spectator"]) {
      expect(view(state, viewer)).toMatchObject({
        streak: { team: 0, drawerId: "asha", count: 2 },
        headStartSeconds: 3,
      });
    }
    // If Asha drops, the streak and head start go with her.
    const dropped = game.onPresence?.(state, ["asha"], START).state ?? state;
    expect(view(dropped, "faiz")).toMatchObject({ streak: null, headStartSeconds: 0 });
    // Through the round itself they stay the round's.
    const next = readyAll(state, state.phaseEndsAt ?? START);
    expect(view(next, "ben")).toMatchObject({
      streak: { team: 0, drawerId: "asha", count: 2 },
      headStartSeconds: 3,
    });
    const { state: headStart } = toHeadStart(next);
    expect(view(headStart, "ben")).toMatchObject({ phase: "headStart", headStartSeconds: 3 });
  });

  it("no head starts in the showdown", () => {
    let state = start({ rounds: 5 });
    for (let n = 1; n <= 5; n++) state = win(state, 0);
    expect(state.phase).toBe("showdownIntro");
    expect(view(state, "dev")).toMatchObject({ streak: null, headStartSeconds: 0 });
    const turns = state.showdown?.turns ?? [];
    expect(turns[0]?.drawFrom).toBe(turns[1]?.drawFrom);
  });

  it("the won-by gap is clock time between the guesses, the head start included", () => {
    const { state, startsAt } = toHeadStart(afterTwoWins());
    // Faiz's team drew from `startsAt`, Asha's from 3 s later. They guess 2 s apart on the clock.
    let next = tick(state);
    next = move(next, "esha", guess(word(next)), startsAt + 10_000);
    next = move(next, "ben", guess(word(next)), startsAt + 12_000);
    const summary = game.recordSummary?.(next) as SketchBattleSummary;
    expect(summary.rounds.at(-1)).toMatchObject({ winnerTeam: 1, gapMs: 2_000 });
  });

  it("the record keeps each round's head start", () => {
    let state = afterTwoWins();
    const drawing = toDrawing(state);
    state = tick(drawing.state);
    const summary = game.recordSummary?.(state) as SketchBattleSummary;
    expect(summary.rounds.map((r) => r.headStartSeconds)).toEqual([0, 0, 3]);
  });
});

describe("the end of the game", () => {
  function playRounds(rounds: number, winner: (n: number) => TeamIndex | null) {
    let state = start({ rounds });
    for (let n = 1; n <= rounds; n++) {
      const drawing = toDrawing(state);
      state = drawing.state;
      const team = winner(n);
      if (team !== null) {
        state = move(
          state,
          guessers(state, team)[0] ?? "",
          guess(word(state)),
          drawing.drawingAt + 1,
        );
      }
      state = nextRound(tick(state));
    }
    return state;
  }

  it("the last round leads to the showdown, with the round points kept", () => {
    const state = playRounds(10, (n) => (n <= 6 ? 0 : 1));
    expect(state.phase).toBe("showdownIntro");
    expect(state.scores).toEqual([1200, 800]);
    expect(game.result(state)).toBeNull();
    expect(game.standings?.(state)).toMatchObject({ asha: 1200, dev: 800 });
  });

  it("the record summary lists each round's word, drawers, winner and gap", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const w = word(state);
    state = move(state, guessers(state, 0)[0] ?? "", guess(w), drawingAt + 12_300);
    state = move(state, guessers(state, 1)[0] ?? "", guess(w), drawingAt + 30_000);
    const summary = game.recordSummary?.(state);
    expect(summary).toEqual({
      rounds: [
        {
          number: 1,
          word: w,
          drawerIds: ["asha", "dev"],
          winnerTeam: 0,
          gapMs: 17_700,
          headStartSeconds: 0,
        },
      ],
      showdown: null,
      scores: [200, 100],
    });
  });
});

/**
 * The contract kit plays random games: choosers pick, drawers draw, guessers guess, one player
 * may leave and players drop and return. Three a side, so one leaving can't stall the game
 * below SB12's two connected players (a 2-player team that loses one waits for the host).
 */
describeGameContract(game, {
  seats,
  config: { ...DEFAULT_CONFIG, rounds: 10, roundSeconds: 15 },
  maxSteps: 8_000,
  sampleMoves: (state, playerId) => {
    const team = teamOf(playerId);
    const racing = state.showdown !== null && state.phase !== "ended";
    const turn = racing ? state.showdown?.turns[team] : state.round?.turns[team];
    const ops = turn?.ops ?? [];
    const last = [...ops].reverse().find((op) => "id" in op);
    const lastId = last && "id" in last ? last.id : 0;
    const moves: SketchBattleMove[] = [
      { type: "choose", index: 1 },
      line(lastId + 1, [10, 10, 30, 40]),
      { type: "draw", stroke: lastId, points: [600, 600, 15, -20], end: true },
      { type: "clear" },
      guess("zzz"),
      { type: "ready" },
      { type: "forceStart" },
    ];
    if (racing && state.showdown) {
      moves.push(guess(state.showdown.words[state.showdown.done[team]] ?? ""));
    } else if (state.round?.word) moves.push(guess(state.round.word));
    return moves;
  },
  hiddenFrom: (state, viewer) => {
    const sd = state.showdown;
    if (sd) {
      if (state.phase === "showdownResult" || state.phase === "ended") return [];
      // Words a viewer hasn't reached stay hidden (the last round's word is public already).
      const team = viewer === "spectator" ? null : teamOf(viewer);
      const isDrawer = team !== null && sd.turns[team].drawerId === viewer;
      const seen =
        team === null
          ? Math.max(sd.done[0], sd.done[1]) + 1
          : sd.done[team] + (isDrawer && state.phase !== "showdownIntro" ? 1 : 0);
      const lastWord = state.history.at(-1)?.word;
      return sd.words
        .slice(seen)
        .filter((w) => w !== lastWord)
        .map((w) => JSON.stringify(w));
    }
    const r = state.round;
    if (!r || state.phase === "result" || state.phase === "summary" || state.phase === "ended") {
      return [];
    }
    const team = viewer === "spectator" ? null : teamOf(viewer);
    const isDrawer = team !== null && r.turns[team].drawerId === viewer;
    const hidden: string[] = [];
    if (r.word === null && team !== null && !isDrawer) {
      hidden.push(...r.choices.map((w) => JSON.stringify(w)));
    }
    if (r.word !== null && team !== null && !isDrawer && r.turns[team].solvedAt === null) {
      hidden.push(JSON.stringify(r.word));
    }
    return hidden;
  },
});
