import { type Seat, seatProblem } from "@playden/engine";
import { describeGameContract } from "@playden/engine/testing";
import { describe, expect, it } from "vitest";
import {
  CHOOSE_SECONDS,
  COUNTDOWN_SECONDS,
  DEFAULT_CONFIG,
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
  return game.setup(seats, { ...DEFAULT_CONFIG, ...config }, seed, START);
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

/** From setup to the drawing stage: the chooser picks word `index`, the countdown runs out. */
function toDrawing(state: State, index: 0 | 1 = 0): { state: State; drawingAt: number } {
  const chosenAt = (state.phaseEndsAt ?? START) - 1_000;
  let next = move(state, round(state).chooserId, { type: "choose", index }, chosenAt);
  next = tick(next);
  return { state: next, drawingAt: chosenAt + COUNTDOWN_SECONDS * 1000 };
}

const guess = (text: string) => ({ type: "guess", text }) as const;
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
        state = tick(tick(state));
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
    let state = start({ rounds: 25, roundSeconds: 15 });
    const offered: string[] = [];
    while (state.phase !== "ended") {
      if (state.phase === "choose") offered.push(...round(state).choices);
      state = tick(state);
    }
    expect(offered).toHaveLength(50);
    expect(new Set(offered).size).toBe(50);
  });
});

describe("a round", () => {
  it("the round deadline counts from the end of the head start", () => {
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

  it("with word lengths off, guessers get no blanks", () => {
    const { state } = toDrawing(start({ showWordLengths: false }));
    expect(view(state, guessers(state, 0)[0] ?? "").blanks).toBeNull();
  });

  it("the other team gets only pixel cells before they guess, and the full drawing after", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    state = move(state, drawer(state, 1), line(1, [10, 10, 400, 10]), drawingAt + 10);
    const [g] = guessers(state, 0);
    const canvas = view(state, g ?? "").teams[1].canvas;
    expect(canvas.kind).toBe("cells");
    expect(JSON.stringify(canvas)).not.toContain("points");
    state = move(state, g ?? "", guess(word(state)), drawingAt + 20);
    expect(view(state, g ?? "").teams[1].canvas).toEqual({
      kind: "strokes",
      ops: round(state).turns[1].ops,
    });
  });

  it("each team sees its own drawing as strokes", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    state = move(state, drawer(state, 0), line(1, [10, 10]), drawingAt + 10);
    expect(view(state, guessers(state, 0)[0] ?? "").teams[0].canvas.kind).toBe("strokes");
  });

  it("word choices go only to the two drawers", () => {
    const state = start();
    expect(view(state, guessers(state, 0)[0] ?? "").choices).toBeNull();
    expect(view(state, "spectator").choices).toBeNull();
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
  it("both teams move to their next connected player every round", () => {
    let state = tick(tick(toDrawing(start()).state));
    expect([drawer(state, 0), drawer(state, 1)]).toEqual(["ben", "esha"]);
    state = game.onPresence?.(state, ["chi"], START).state ?? state;
    state = tick(tick(tick(tick(state))));
    expect(drawer(state, 0)).toBe("asha");
  });

  it("rotation skips players who left", () => {
    let state = toDrawing(start()).state;
    state = game.onPlayerLeft(state, "esha").state;
    state = tick(tick(state));
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

  it("the next round waits until each team has 2 connected players", () => {
    let state = tick(toDrawing(start()).state);
    state = game.onPresence?.(state, ["esha", "faiz"], START).state ?? state;
    state = tick(state);
    expect(state.phase).toBe("waiting");
    expect(game.nextDeadline(state)).toBeNull();
    expect(view(state, "asha").waitingFor).toEqual([1]);

    state = game.onPresence?.(state, ["faiz"], START + 90_000).state ?? state;
    expect(state.phase).toBe("choose");
    expect(round(state).number).toBe(2);
    expect(game.nextDeadline(state)).toBe(START + 90_000 + CHOOSE_SECONDS * 1000);
  });

  it("with too few players left, the game waits until the host ends it", () => {
    let state = tick(toDrawing(start()).state);
    for (const id of ["esha", "faiz"]) state = game.onPlayerLeft(state, id).state;
    state = tick(state);
    expect(state.phase).toBe("waiting");
    expect(game.standings?.(state)).toMatchObject({ asha: 0, dev: 0 });
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
      state = tick(tick(state));
    }
    return state;
  }

  it("ends after the last round with the higher team winning", () => {
    const state = playRounds(10, (n) => (n <= 6 ? 0 : 1));
    expect(state.phase).toBe("ended");
    expect(state.scores).toEqual([1200, 800]);
    const result = game.result(state);
    expect(result?.winners.sort()).toEqual(["asha", "ben", "chi"]);
    expect(result?.scores).toMatchObject({ asha: 1200, dev: 800 });
  });

  it("equal totals are a draw", () => {
    const state = playRounds(10, (n) => (n % 2 === 0 ? 0 : 1));
    expect(game.result(state)?.winners).toEqual([]);
  });

  it("the record summary lists each round's word, drawers, winner and gap", () => {
    const drawing = toDrawing(start());
    let state = drawing.state;
    const drawingAt = drawing.drawingAt;
    const w = word(state);
    state = move(state, guessers(state, 0)[0] ?? "", guess(w), drawingAt + 12_300);
    state = move(state, guessers(state, 1)[0] ?? "", guess(w), drawingAt + 47_000);
    const summary = game.recordSummary?.(state);
    expect(summary).toEqual({
      rounds: [{ number: 1, word: w, drawerIds: ["asha", "dev"], winnerTeam: 0, gapMs: 34_700 }],
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
  maxSteps: 4_000,
  sampleMoves: (state, playerId) => {
    const ops = state.round?.turns[teamOf(playerId)].ops ?? [];
    const last = [...ops].reverse().find((op) => "id" in op);
    const lastId = last && "id" in last ? last.id : 0;
    const moves: SketchBattleMove[] = [
      { type: "choose", index: 1 },
      line(lastId + 1, [10, 10, 30, 40]),
      { type: "draw", stroke: lastId, points: [600, 600, 15, -20], end: true },
      { type: "clear" },
      guess("zzz"),
    ];
    if (state.round?.word) moves.push(guess(state.round.word));
    return moves;
  },
  hiddenFrom: (state, viewer) => {
    const r = state.round;
    if (!r || state.phase === "result" || state.phase === "waiting" || state.phase === "ended") {
      return [];
    }
    const team = viewer === "spectator" ? null : teamOf(viewer);
    const isDrawer = team !== null && r.turns[team].drawerId === viewer;
    const hidden: string[] = [];
    if (r.word === null && !isDrawer) hidden.push(...r.choices.map((w) => JSON.stringify(w)));
    if (r.word !== null && team !== null && !isDrawer && r.turns[team].solvedAt === null) {
      hidden.push(JSON.stringify(r.word));
    }
    return hidden;
  },
});
