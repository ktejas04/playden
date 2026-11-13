import {
  type GameDefinition,
  type GameEvent,
  type Rng,
  type Transition,
  createRng,
  nextInt,
  shuffle,
} from "@playden/engine";
import { z } from "zod";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CHOOSE_SECONDS,
  COUNTDOWN_SECONDS,
  DEFAULT_CONFIG,
  MAX_GUESS_LENGTH,
  MAX_POINTS_PER_MOVE,
  MIN_CONNECTED_TO_START_ROUND,
  PALETTE_SIZE,
  RESULT_SECONDS,
  STROKE_MOVE_LIMIT,
  TEAM_COUNT,
  TEAM_MAX_PLAYERS,
  TEAM_MIN_PLAYERS,
  WORD_CHOICES,
  configSchema,
} from "./config";
import { applyViewDelta, viewDelta } from "./delta";
import { blanksFor, guessProblem, isCorrectGuess, rememberGuess, tooManyGuesses } from "./guess";
import { EMPTY_CELLS, markStroke } from "./preview";
import { connectedIn, nextConnected } from "./rotation";
import { gapMs, pointsFor } from "./scoring";
import type {
  CanvasOp,
  Pair,
  Round,
  RoundRecord,
  SketchBattleConfig,
  SketchBattleDelta,
  SketchBattleMove,
  SketchBattleState,
  SketchBattleSummary,
  SketchBattleView,
  Stroke,
  TeamIndex,
  TeamTurn,
  TeamView,
} from "./types";
import { ENGLISH_WORDS } from "./words/english";

type State = SketchBattleState;
const TEAMS: Pair<TeamIndex> = [0, 1];
const seconds = (n: number) => n * 1000;

const drawStartSchema = z.strictObject({
  tool: z.enum(["pen", "eraser"]),
  colour: z
    .number()
    .int()
    .min(0)
    .max(PALETTE_SIZE - 1),
  size: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

const moveSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("choose"), index: z.union([z.literal(0), z.literal(1)]) }),
  z.strictObject({
    type: z.literal("draw"),
    stroke: z.number().int().min(0).max(1_000_000_000),
    start: drawStartSchema.optional(),
    points: z.array(z.number().int().min(-10_000).max(10_000)).min(2).max(MAX_POINTS_PER_MOVE),
    end: z.literal(true).optional(),
  }),
  z.strictObject({ type: z.literal("clear") }),
  z.strictObject({ type: z.literal("guess"), text: z.string().max(MAX_GUESS_LENGTH * 4) }),
]);

function teamOf(state: State, playerId: string): TeamIndex | null {
  if (state.rotations[0].includes(playerId)) return 0;
  if (state.rotations[1].includes(playerId)) return 1;
  return null;
}

function unavailable(state: State): Set<string> {
  return new Set([...state.away, ...state.left]);
}

/** Teams without enough connected players to start a round (SB12). */
function teamsShort(state: State): TeamIndex[] {
  const gone = unavailable(state);
  return TEAMS.filter(
    (team) => connectedIn(state.rotations[team], gone).length < MIN_CONNECTED_TO_START_ROUND,
  );
}

/** A batch's points: the first absolute, the rest differences from the point before. */
function decodePoints(points: readonly number[]): number[] {
  const out: number[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < points.length; i += 2) {
    x = i === 0 ? (points[0] ?? 0) : x + (points[i] ?? 0);
    y = i === 0 ? (points[1] ?? 0) : y + (points[i + 1] ?? 0);
    out.push(x, y);
  }
  return out;
}

const onCanvas = (points: readonly number[]) =>
  points.every((v, i) => v >= 0 && v <= (i % 2 === 0 ? CANVAS_WIDTH : CANVAS_HEIGHT));

function lastStroke(ops: readonly CanvasOp[]): Stroke | undefined {
  const last = ops.at(-1);
  return last && "id" in last ? last : undefined;
}

function newTurn(drawerId: string): TeamTurn {
  return { drawerId, drawFrom: 0, ops: [], cells: EMPTY_CELLS, guesses: [], solvedAt: null };
}

function withTurn(state: State, team: TeamIndex, turn: TeamTurn): State {
  const round = state.round;
  if (!round) return state;
  const turns: Pair<TeamTurn> = team === 0 ? [turn, round.turns[1]] : [round.turns[0], turn];
  return { ...state, round: { ...round, turns } };
}

/**
 * Opens the next round's choose stage (4.1: both teams move to their next connected player;
 * a random team chooses, with no head start). Winner-stays and streaks come in task 026.
 */
function startRound(state: State, now: number): Transition<State> {
  const previous = state.round;
  const gone = unavailable(state);
  const drawers = TEAMS.map((team) => {
    const rotation = state.rotations[team];
    if (!previous) return rotation[0] ?? "";
    return nextConnected(rotation, previous.turns[team].drawerId, gone);
  }) as Pair<string>;
  const drawn = nextInt(state.rng, 0, TEAM_COUNT - 1);
  const chooserTeam = drawn.value as TeamIndex;
  const words = state.wordOrder
    .slice(state.wordCursor, state.wordCursor + WORD_CHOICES)
    .map((index) => ENGLISH_WORDS[index]?.word ?? "");
  const round: Round = {
    number: (previous?.number ?? 0) + 1,
    chooserId: drawers[chooserTeam],
    choices: [words[0] ?? "", words[1] ?? ""],
    word: null,
    headStartSeconds: 0,
    wordChosenAt: null,
    solvedOrder: [],
    turns: [newTurn(drawers[0]), newTurn(drawers[1])],
  };
  return {
    state: {
      ...state,
      rng: drawn.rng,
      phase: "choose",
      phaseEndsAt: now + seconds(CHOOSE_SECONDS),
      wordCursor: state.wordCursor + WORD_CHOICES,
      round,
    },
    events: [{ type: "round.choosing", data: { round: round.number, chooserId: round.chooserId } }],
  };
}

function chooseWord(state: State, index: 0 | 1, now: number): Transition<State> {
  const round = state.round;
  if (!round) return { state, events: [] };
  const drawFrom = now + seconds(COUNTDOWN_SECONDS);
  const turns = round.turns.map((turn) => ({ ...turn, drawFrom })) as Pair<TeamTurn>;
  return {
    state: {
      ...state,
      phase: "countdown",
      phaseEndsAt: drawFrom,
      round: { ...round, word: round.choices[index], wordChosenAt: now, turns },
    },
    events: [{ type: "word.chosen", data: { chooserId: round.chooserId } }],
  };
}

function endRound(state: State, now: number, events: GameEvent[]): Transition<State> {
  const round = state.round;
  if (!round) return { state, events };
  const points = pointsFor(round.solvedOrder);
  const record: RoundRecord = {
    number: round.number,
    word: round.word ?? "",
    drawerIds: [round.turns[0].drawerId, round.turns[1].drawerId],
    winnerTeam: round.solvedOrder[0] ?? null,
    solvedAt: [round.turns[0].solvedAt, round.turns[1].solvedAt],
    drawingStartedAt: [round.turns[0].drawFrom, round.turns[1].drawFrom],
    points,
  };
  return {
    state: {
      ...state,
      phase: "result",
      phaseEndsAt: now + seconds(RESULT_SECONDS),
      history: [...state.history, record],
      scores: [state.scores[0] + points[0], state.scores[1] + points[1]],
    },
    events: [...events, { type: "round.ended", data: record }],
  };
}

/** After the result: the next round, a wait for players (SB12), or the end of the game. */
function afterResult(state: State, now: number): Transition<State> {
  if ((state.round?.number ?? 0) >= state.config.rounds) {
    return {
      state: { ...state, phase: "ended", phaseEndsAt: null },
      events: [{ type: "game.ended", data: { scores: state.scores } }],
    };
  }
  if (teamsShort(state).length > 0) {
    return { state: { ...state, phase: "waiting", phaseEndsAt: null }, events: [] };
  }
  return startRound(state, now);
}

function draw(
  state: State,
  team: TeamIndex,
  move: Extract<SketchBattleMove, { type: "draw" }>,
): State {
  const turn = state.round?.turns[team];
  if (!turn) return state;
  const points = decodePoints(move.points);
  if (move.start) {
    const stroke: Stroke = { id: move.stroke, ...move.start, points };
    return withTurn(state, team, {
      ...turn,
      ops: [...turn.ops, stroke],
      cells: markStroke(turn.cells, stroke),
    });
  }
  const last = lastStroke(turn.ops);
  if (!last) return state;
  const extended: Stroke = { ...last, points: [...last.points, ...points] };
  return withTurn(state, team, {
    ...turn,
    ops: [...turn.ops.slice(0, -1), extended],
    cells: markStroke(turn.cells, extended, last.points.length / 2),
  });
}

function guess(state: State, playerId: string, team: TeamIndex, text: string, now: number) {
  const round = state.round;
  const turn = round?.turns[team];
  if (!round || !turn) return { state, events: [] };
  const correct = isCorrectGuess(text, round.word ?? "");
  const recentGuesses = {
    ...state.recentGuesses,
    [playerId]: rememberGuess(state.recentGuesses[playerId] ?? [], now),
  };
  const guesses = [...turn.guesses, { by: playerId, text: text.trim(), at: now, correct }];
  if (!correct) {
    const next = withTurn({ ...state, recentGuesses }, team, { ...turn, guesses });
    return { state: next, events: [], live: true as const };
  }
  const solved = withTurn({ ...state, recentGuesses }, team, { ...turn, guesses, solvedAt: now });
  const solvedOrder = [...round.solvedOrder, team];
  const next: State = { ...solved, round: { ...(solved.round as Round), solvedOrder } };
  const events: GameEvent[] = [{ type: "guess.correct", data: { team, by: playerId } }];
  if (solvedOrder.length === TEAM_COUNT) return endRound(next, now, events);
  return { state: next, events };
}

/** May this viewer see the word? Drawers from the countdown on, spectators, teams that guessed, everyone at the result. */
function seesWord(state: State, team: TeamIndex | null, isDrawer: boolean): boolean {
  const round = state.round;
  if (!round?.word) return false;
  if (state.phase === "result" || state.phase === "waiting" || state.phase === "ended") return true;
  if (team === null || isDrawer) return true;
  return round.turns[team].solvedAt !== null;
}

/** May this viewer see a team's real strokes and guesses (D47)? */
function seesTeam(state: State, viewerTeam: TeamIndex | null, team: TeamIndex): boolean {
  if (viewerTeam === null || viewerTeam === team) return true;
  if (state.phase === "result" || state.phase === "waiting" || state.phase === "ended") return true;
  return state.round?.turns[viewerTeam].solvedAt != null;
}

const NO_OPS: CanvasOp[] = [];
const NO_GUESSES: SketchBattleView["teams"][0]["guesses"] = [];

function teamView(state: State, team: TeamIndex, viewerTeam: TeamIndex | null): TeamView {
  const turn = state.round?.turns[team];
  const shown = seesTeam(state, viewerTeam, team);
  const away = new Set(state.away);
  const left = new Set(state.left);
  return {
    players: state.rotations[team].map((id) => ({
      id,
      name: state.names[id] ?? id,
      away: away.has(id),
      left: left.has(id),
    })),
    score: state.scores[team],
    drawerId: turn?.drawerId ?? null,
    drawFrom: turn && state.round?.word ? turn.drawFrom : null,
    solvedAt: turn?.solvedAt ?? null,
    canvas: shown
      ? { kind: "strokes", ops: turn?.ops ?? NO_OPS }
      : { kind: "cells", cells: turn?.cells ?? EMPTY_CELLS },
    guesses: shown ? (turn?.guesses ?? NO_GUESSES) : null,
  };
}

function scoresByPlayer(state: State): Record<string, number> {
  return Object.fromEntries(
    TEAMS.flatMap((team) => state.rotations[team].map((id) => [id, state.scores[team]])),
  );
}

export const sketchBattle: GameDefinition<
  SketchBattleState,
  SketchBattleMove,
  SketchBattleView,
  SketchBattleConfig,
  SketchBattleDelta
> = {
  id: "sketch-battle",
  name: "Sketch Battle",
  summary: "Two teams draw the same word at once. First team to guess it wins the round.",
  minPlayers: TEAM_COUNT * TEAM_MIN_PLAYERS,
  maxPlayers: TEAM_COUNT * TEAM_MAX_PLAYERS,
  teams: { count: TEAM_COUNT, minSize: TEAM_MIN_PLAYERS, maxSize: TEAM_MAX_PLAYERS },
  devOnly: true,
  moveLimit: STROKE_MOVE_LIMIT,

  defaultConfig: DEFAULT_CONFIG,
  configSchema,
  moveSchema,

  setup: (seats, config, seed, now) => {
    const rotations: Pair<string[]> = [[], []];
    for (const seat of seats) {
      if (seat.team !== 0 && seat.team !== 1)
        throw new Error(`Sketch Battle needs a team for ${seat.id}`);
      rotations[seat.team].push(seat.id);
    }
    const shuffled = shuffle(
      createRng(seed),
      ENGLISH_WORDS.map((_, index) => index),
    );
    const rng: Rng = shuffled.rng;
    const state: State = {
      config,
      rng,
      phase: "choose",
      phaseEndsAt: null,
      rotations,
      names: Object.fromEntries(seats.map((seat) => [seat.id, seat.name])),
      away: [],
      left: [],
      wordOrder: shuffled.value.slice(0, config.rounds * WORD_CHOICES),
      wordCursor: 0,
      round: null,
      history: [],
      scores: [0, 0],
      recentGuesses: {},
    };
    return startRound(state, now).state;
  },

  validate: (state, playerId, move, now) => {
    const team = teamOf(state, playerId);
    const round = state.round;
    if (state.phase === "ended") return { ok: false, reason: "The game is over" };
    if (team === null || !round) return { ok: false, reason: "You're watching this game" };
    const turn = round.turns[team];
    const isDrawer = turn.drawerId === playerId;

    switch (move.type) {
      case "choose":
        if (state.phase !== "choose") return { ok: false, reason: "The word is already chosen" };
        if (round.chooserId !== playerId) {
          return { ok: false, reason: "Only the chooser can pick the word" };
        }
        return { ok: true };
      case "draw":
      case "clear": {
        if (!isDrawer) return { ok: false, reason: "Only the drawer can draw" };
        if (state.phase !== "drawing" || now < turn.drawFrom) {
          return { ok: false, reason: "Wait for the drawing to start" };
        }
        if (turn.solvedAt !== null) {
          return { ok: false, reason: "Your team got it: the canvas is locked" };
        }
        if (move.type === "clear") return { ok: true };
        if (move.points.length % 2 !== 0) return { ok: false, reason: "That line is broken" };
        if (!onCanvas(decodePoints(move.points))) {
          return { ok: false, reason: "That line is off the canvas" };
        }
        const last = lastStroke(turn.ops);
        if (move.start) {
          return last && move.stroke <= last.id
            ? { ok: false, reason: "That line was already started" }
            : { ok: true };
        }
        if (!last || last.id !== move.stroke || turn.ops.at(-1) !== last) {
          return { ok: false, reason: "Start a new line first" };
        }
        return { ok: true };
      }
      case "guess": {
        if (state.phase !== "drawing" || now < turn.drawFrom) {
          return { ok: false, reason: "Guessing opens when the drawing starts" };
        }
        if (isDrawer) return { ok: false, reason: "Drawers can't guess" };
        if (turn.solvedAt !== null) return { ok: false, reason: "Your team already got it" };
        const problem = guessProblem(move.text);
        if (problem) return { ok: false, reason: problem };
        if (tooManyGuesses(state.recentGuesses[playerId] ?? [], now)) {
          return { ok: false, reason: "Slow down" };
        }
        return { ok: true };
      }
    }
  },

  apply: (state, playerId, move, now) => {
    const team = teamOf(state, playerId);
    if (team === null) return { state, events: [] };
    switch (move.type) {
      case "choose":
        return chooseWord(state, move.index, now);
      case "draw":
        return { state: draw(state, team, move), events: [], live: true };
      case "clear": {
        const turn = state.round?.turns[team];
        if (!turn) return { state, events: [] };
        const cleared = {
          ...turn,
          ops: [...turn.ops, { clear: true as const }],
          cells: EMPTY_CELLS,
        };
        return { state: withTurn(state, team, cleared), events: [], live: true };
      }
      case "guess":
        return guess(state, playerId, team, move.text, now);
    }
  },

  view: (state, viewer) => {
    const team = viewer === "spectator" ? null : teamOf(state, viewer);
    const round = state.round;
    const isDrawer = team !== null && round?.turns[team].drawerId === viewer;
    const showWord = seesWord(state, team, isDrawer);
    const word = showWord ? (round?.word ?? null) : null;
    return {
      me: { team, role: team === null ? "spectator" : isDrawer ? "drawer" : "guesser" },
      phase: state.phase,
      phaseEndsAt: state.phaseEndsAt,
      roundNumber: round?.number ?? 0,
      rounds: state.config.rounds,
      chooserId: round?.chooserId ?? null,
      choices: state.phase === "choose" && isDrawer && round ? round.choices : null,
      word,
      blanks:
        round?.word && !showWord && state.config.showWordLengths ? blanksFor(round.word) : null,
      teams: [teamView(state, 0, team), teamView(state, 1, team)],
      lastRound: state.history.at(-1) ?? null,
      waitingFor: state.phase === "waiting" ? teamsShort(state) : [],
    };
  },

  delta: (before, after, viewer) =>
    viewDelta(sketchBattle.view(before, viewer), sketchBattle.view(after, viewer)),
  applyDelta: applyViewDelta,

  nextDeadline: (state) => state.phaseEndsAt,

  onDeadline: (state, now) => {
    switch (state.phase) {
      case "choose":
        return chooseWord(state, 0, now);
      case "countdown": {
        const round = state.round;
        if (!round) return { state, events: [] };
        const turns = round.turns.map((turn) => ({ ...turn, drawFrom: now })) as Pair<TeamTurn>;
        return {
          state: {
            ...state,
            phase: "drawing",
            phaseEndsAt: now + seconds(state.config.roundSeconds),
            round: { ...round, turns },
          },
          events: [{ type: "drawing.started" }],
        };
      }
      case "drawing":
        return endRound(state, now, []);
      case "result":
        return afterResult(state, now);
      default:
        return { state, events: [] };
    }
  },

  onPlayerLeft: (state, playerId) => ({
    state: state.left.includes(playerId) ? state : { ...state, left: [...state.left, playerId] },
    events: [],
  }),

  onPresence: (state, awayIds, now) => {
    const next = { ...state, away: [...awayIds] };
    if (state.phase === "waiting" && teamsShort(next).length === 0) return startRound(next, now);
    return { state: next, events: [] };
  },

  standings: scoresByPlayer,

  result: (state) => {
    if (state.phase !== "ended") return null;
    const [a, b] = state.scores;
    const winner: TeamIndex | null = a === b ? null : a > b ? 0 : 1;
    return {
      scores: scoresByPlayer(state),
      winners: winner === null ? [] : [...state.rotations[winner]],
    };
  },

  recordSummary: (state): SketchBattleSummary => ({
    rounds: state.history.map((record) => ({
      number: record.number,
      word: record.word,
      drawerIds: record.drawerIds,
      winnerTeam: record.winnerTeam,
      gapMs: gapMs(record.solvedAt, record.drawingStartedAt),
    })),
    scores: state.scores,
  }),
};
