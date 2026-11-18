import type { Seat } from "@playden/engine";
import { describe, expect, it } from "vitest";
import {
  COUNTDOWN_SECONDS,
  DEFAULT_CONFIG,
  SHOWDOWN_COUNTDOWN_SECONDS,
  SHOWDOWN_FINISH_BONUS,
  SHOWDOWN_HANDOFF_SECONDS,
  SHOWDOWN_INTRO_SECONDS,
  SHOWDOWN_RESULT_SECONDS,
  SHOWDOWN_WORD_POINTS,
} from "../config";
import { sketchBattle as game } from "../engine";
import type {
  SketchBattleConfig,
  SketchBattleMove,
  SketchBattleState,
  SketchBattleView,
  TeamIndex,
} from "../types";

/**
 * The showdown (spec section 9, task 030). Test names follow section 20.
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
type State = SketchBattleState;

function start(config: Partial<SketchBattleConfig> = {}, seed = 7): State {
  return game.setup(seats, { ...DEFAULT_CONFIG, rounds: 5, ...config }, seed, START);
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

function tick(state: State): State {
  const at = game.nextDeadline(state);
  if (at === null) throw new Error(`No deadline in phase ${state.phase}`);
  return game.onDeadline(state, at).state;
}

const guess = (text: string) => ({ type: "guess", text }) as const;
const view = (state: State, viewer: string): SketchBattleView => game.view(state, viewer);
const teamOf = (id: string): TeamIndex => (seats.find((s) => s.id === id)?.team ?? 0) as TeamIndex;

/**
 * Plays `rounds` rounds (`winner` guesses first each round, null: nobody), with everyone
 * tapping Continue after each; `lastReady: false` stops on the last round's summary.
 */
function playRounds(
  rounds: number,
  winner: (n: number) => TeamIndex | null = () => null,
  config: Partial<SketchBattleConfig> = {},
  seed = 7,
  lastReady = true,
): State {
  let state = start({ rounds, ...config }, seed);
  for (let n = 1; n <= rounds; n++) {
    const round = state.round;
    if (!round) throw new Error("No round");
    const chosenAt = (state.phaseEndsAt ?? START) - 1_000;
    state = move(state, round.chooserId, { type: "choose", index: 0 }, chosenAt);
    state = tick(state);
    if (state.phase === "headStart") state = tick(state);
    const drawingAt = chosenAt + (COUNTDOWN_SECONDS + round.headStartSeconds) * 1000;
    const team = winner(n);
    if (team !== null) {
      const turns = state.round?.turns[team];
      const guesser = state.rotations[team].find((id) => id !== turns?.drawerId) ?? "";
      state = move(state, guesser, guess(state.round?.word ?? ""), drawingAt + 1);
    }
    state = tick(tick(state)); // round end, then the summary
    if (n === rounds && !lastReady) break;
    for (const { id } of seats) {
      if (state.phase === "summary" && !state.ready.includes(id)) {
        state = move(state, id, { type: "ready" }, state.phaseEndsAt ?? START);
      }
    }
  }
  return state;
}

/** From the intro to play: the title card and the 3-2-1 run out. */
const toPlay = (state: State) => tick(tick(state));

const sd = (state: State) => {
  if (!state.showdown) throw new Error("No showdown");
  return state.showdown;
};
const drawerOf = (state: State, team: TeamIndex) => sd(state).turns[team].drawerId;
const currentWord = (state: State, team: TeamIndex) => sd(state).words[sd(state).done[team]] ?? "";
/** A guesser of `team` for the current word. */
const guesserOf = (state: State, team: TeamIndex) =>
  state.rotations[team].find((id) => id !== drawerOf(state, team)) ?? "";
/** When `team`'s current drawer may start. */
const drawFrom = (state: State, team: TeamIndex) => sd(state).turns[team].drawFrom;

/** `team` guesses its current word at its drawer's start time plus `after` ms. */
function solve(state: State, team: TeamIndex, after = 1): State {
  const at = drawFrom(state, team) + after;
  return move(state, guesserOf(state, team), guess(currentWord(state, team)), at);
}

describe("the showdown", () => {
  it("follows the last round's summary: a 10 s title card, then a 3 s countdown", () => {
    const intro = playRounds(5);
    expect(intro.phase).toBe("showdownIntro");
    const introStart = (game.nextDeadline(intro) ?? 0) - SHOWDOWN_INTRO_SECONDS * 1000;
    const countdown = tick(intro);
    expect(countdown.phase).toBe("showdownCountdown");
    expect(game.nextDeadline(countdown)).toBe(
      introStart + (SHOWDOWN_INTRO_SECONDS + SHOWDOWN_COUNTDOWN_SECONDS) * 1000,
    );
    const play = tick(countdown);
    expect(play.phase).toBe("showdown");
    expect(game.nextDeadline(play)).toBeNull();
  });

  it("showdown words are all round words in one shared seeded order", () => {
    const state = playRounds(5);
    const roundWords = state.history.map((r) => r.word);
    expect([...sd(state).words].sort()).toEqual([...roundWords].sort());
    expect(sd(playRounds(5)).words).toEqual(sd(state).words);
    const orders = new Set(
      [1, 2, 3, 4, 5, 6].map((seed) => {
        const s = playRounds(5, () => null, {}, seed);
        return s.history.map((r) => sd(s).words.indexOf(r.word)).join();
      }),
    );
    expect(orders.size).toBeGreaterThan(1);
    expect(sd(state).done).toEqual([0, 0]);
  });

  it("no winner stays in the showdown: both teams' pencils move on from the last round", () => {
    const state = playRounds(5, (n) => (n === 5 ? 0 : null));
    const last = state.history.at(-1);
    for (const team of [0, 1] as const) {
      const rotation = state.rotations[team];
      const previous = last?.drawerIds[team] ?? "";
      expect(drawerOf(state, team)).toBe(
        rotation[(rotation.indexOf(previous) + 1) % rotation.length],
      );
    }
  });

  it("the showdown rotates drawers per word, after a 2 s handoff", () => {
    let state = toPlay(playRounds(5));
    const first = drawerOf(state, 0);
    const at = drawFrom(state, 0) + 5_000;
    state = solve(state, 0, 5_000);
    expect(sd(state).done).toEqual([1, 0]);
    const next = drawerOf(state, 0);
    const rotation = state.rotations[0];
    expect(next).toBe(rotation[(rotation.indexOf(first) + 1) % rotation.length]);
    expect(drawFrom(state, 0)).toBe(at + SHOWDOWN_HANDOFF_SECONDS * 1000);
    const line: SketchBattleMove = {
      type: "draw",
      stroke: 1,
      start: { tool: "pen", colour: 0, size: 1 },
      points: [10, 10, 40, 40],
    };
    expect(refusal(state, next, line, at + 1_000)).toBe("Wait for the drawing to start");
    expect(refusal(state, guesserOf(state, 0), guess("zzz"), at + 1_000)).toBe(
      "Guessing opens when the drawing starts",
    );
    state = move(state, next, line, drawFrom(state, 0));
    expect(sd(state).turns[0].ops).toHaveLength(1);
  });

  it("the last drawer's late batches after a correct guess are refused quietly (D61)", () => {
    let state = toPlay(playRounds(5));
    const first = drawerOf(state, 0);
    const at = drawFrom(state, 0) + 1_000;
    const start = { tool: "pen", colour: 0, size: 1 } as const;
    state = move(state, first, { type: "draw", stroke: 1, start, points: [10, 10, 5, 5] }, at);
    state = solve(state, 0, 1_500);
    expect(drawerOf(state, 0)).not.toBe(first);
    expect(sd(state).turns[0].ops).toEqual([]);
    const rest: SketchBattleMove = { type: "draw", stroke: 1, points: [5, 5] };
    expect(game.validate(state, first, rest, at + 600)).toEqual({
      ok: false,
      reason: "Only the drawer can draw",
      quiet: true,
    });
  });

  it("the showdown scores 100 per word plus 100 for finishing, and ends when one team finishes", () => {
    let state = toPlay(playRounds(5));
    const before = [...state.scores];
    state = solve(state, 1);
    for (let i = 0; i < 5; i++) state = solve(state, 0);
    expect(state.phase).toBe("showdownResult");
    expect(sd(state).winnerTeam).toBe(0);
    expect(state.scores).toEqual([
      (before[0] ?? 0) + 5 * SHOWDOWN_WORD_POINTS + SHOWDOWN_FINISH_BONUS,
      (before[1] ?? 0) + SHOWDOWN_WORD_POINTS,
    ]);
    expect(refusal(state, guesserOf(state, 1), guess("zzz"), START + 9e9)).toBe(
      "The showdown is over",
    );
    const resultEnds = game.nextDeadline(state) ?? 0;
    expect(resultEnds).toBe((sd(state).finishedAt ?? 0) + SHOWDOWN_RESULT_SECONDS * 1000);
    state = tick(state);
    expect(state.phase).toBe("ended");
    expect(game.result(state)?.winners.sort()).toEqual(["asha", "ben", "chi"]);
  });

  it("worked example 4: A finishes all 15 while B has 9 → 1600 and 900", () => {
    let state = toPlay(playRounds(15, () => null, { rounds: 15 }));
    expect(state.scores).toEqual([0, 0]);
    for (let i = 0; i < 9; i++) state = solve(state, 1);
    for (let i = 0; i < 15; i++) state = solve(state, 0);
    expect(state.scores).toEqual([1600, 900]);
    expect(game.recordSummary?.(state)).toMatchObject({
      showdown: { words: 15, done: [15, 9], winnerTeam: 0 },
    });
  });

  it("the game total decides the winner, and equal totals are a draw", () => {
    // Rounds: team 1 wins 4 (800), team 2 wins 6 (1200). Showdown: team 1 finishes all 10
    // (1100), team 2 finishes 7 (700). Both end on 1900.
    let state = toPlay(playRounds(10, (n) => (n <= 4 ? 0 : 1), { rounds: 10 }));
    expect(state.scores).toEqual([800, 1200]);
    for (let i = 0; i < 7; i++) state = solve(state, 1);
    for (let i = 0; i < 10; i++) state = solve(state, 0);
    state = tick(state);
    expect(state.scores).toEqual([1900, 1900]);
    expect(game.result(state)?.winners).toEqual([]);
  });

  it("players get no opponent canvas in the showdown; spectators see both", () => {
    let state = toPlay(playRounds(5));
    const line: SketchBattleMove = {
      type: "draw",
      stroke: 1,
      start: { tool: "pen", colour: 0, size: 1 },
      points: [10, 10, 400, 10],
    };
    state = move(state, drawerOf(state, 1), line, drawFrom(state, 1));
    const theirs = view(state, guesserOf(state, 0)).teams[1].canvas;
    expect(JSON.stringify(theirs)).not.toContain("points");
    expect(JSON.stringify(theirs)).not.toMatch(/[0-9]/);
    expect(view(state, "spectator").teams[1].canvas.kind).toBe("strokes");
    expect(view(state, guesserOf(state, 1)).teams[1].canvas.kind).toBe("strokes");
  });

  it("the drawer sees the word, guessers no letter count (SB26), and nobody sees words they haven't reached", () => {
    let state = toPlay(playRounds(5));
    const firstWord = currentWord(state, 0);
    state = solve(state, 0);
    const drawerView = view(state, drawerOf(state, 0));
    expect(drawerView.me.role).toBe("drawer");
    expect(drawerView.word).toBe(currentWord(state, 0));
    expect(drawerView.showdown?.finished[0]).toEqual([firstWord]);

    const guesser = view(state, guesserOf(state, 0));
    expect(guesser.word).toBeNull();
    expect(guesser.blanks).toBeNull();
    expect(guesser.showdown).not.toHaveProperty("blanks");
    expect(guesser.showdown?.current[0]).toBeNull();

    // Team 2 hasn't reached team 1's first word yet: it may not see it, or what team 1 is on.
    const behind = view(state, guesserOf(state, 1));
    expect(behind.showdown?.finished[0]).toBeNull();
    expect(behind.showdown?.current[0]).toBeNull();
    expect(behind.showdown?.done).toEqual([1, 0]);

    const spectator = view(state, "spectator");
    expect(spectator.showdown?.current).toEqual([currentWord(state, 0), currentWord(state, 1)]);
  });

  it("drawers can't guess, spectators can't play, and moves wait for the countdown", () => {
    const intro = playRounds(5);
    expect(refusal(intro, "ben", guess("zzz"), START + 9e9)).toBe(
      "Guessing opens when the drawing starts",
    );
    const state = toPlay(intro);
    const drawer = drawerOf(state, 0);
    expect(refusal(state, drawer, guess(currentWord(state, 0)), drawFrom(state, 0))).toBe(
      "Drawers can't guess",
    );
    expect(refusal(state, "zed", guess("zzz"), drawFrom(state, 0))).toBe(
      "You're watching this game",
    );
    expect(teamOf(drawer)).toBe(0);
  });

  it("the showdown waits for each team to have 2 connected players, like a round", () => {
    let state = playRounds(5, () => null, {}, 7, false);
    expect(state.phase).toBe("summary");
    state = game.onPresence?.(state, ["esha", "faiz"], START).state ?? state;
    expect(refusal(state, "asha", { type: "ready" }, START + 9e9)).toBe("Waiting for Team 2");
    state = game.onPresence?.(state, [], START).state ?? state;
    for (const { id } of seats) state = move(state, id, { type: "ready" }, START + 9e9);
    expect(state.phase).toBe("showdownIntro");
  });
});
