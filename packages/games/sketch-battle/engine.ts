import {
  type GameDefinition,
  type GameEvent,
  type Rng,
  type Transition,
  type Validation,
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
  FORCE_START_AFTER_SECONDS,
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
import { connectedIn, nextDrawer } from "./rotation";
import { gapMs, pointsFor } from "./scoring";
import { headStartFor, streakFor } from "./streak";
import {
  inShowdown,
  newTurn,
  showdownDeadline,
  showdownGuess,
  showdownOver,
  showdownView,
  startShowdown,
} from "./showdown";
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
const otherTeam = (team: TeamIndex): TeamIndex => (team === 0 ? 1 : 0);
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
  z.strictObject({ type: z.literal("ready") }),
  z.strictObject({ type: z.literal("forceStart") }),
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

/** The round's guessing is over: its result is up, or its time ran out (deadline due or not). */
function roundOver(state: State, now: number): boolean {
  if (state.phase === "result" || state.phase === "summary") return true;
  return state.phase === "drawing" && state.phaseEndsAt !== null && now >= state.phaseEndsAt;
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

/** The team's turn being played: the round's, or the current showdown word's. */
function currentTurn(state: State, team: TeamIndex): TeamTurn | undefined {
  if (state.showdown && inShowdown(state.phase)) return state.showdown.turns[team];
  return state.round?.turns[team];
}

function withTurn(state: State, team: TeamIndex, turn: TeamTurn): State {
  const pair = (turns: Pair<TeamTurn>): Pair<TeamTurn> =>
    team === 0 ? [turn, turns[1]] : [turns[0], turn];
  if (state.showdown && inShowdown(state.phase)) {
    return { ...state, showdown: { ...state.showdown, turns: pair(state.showdown.turns) } };
  }
  const round = state.round;
  if (!round) return state;
  return { ...state, round: { ...round, turns: pair(round.turns) } };
}

/** The next round's drawers (section 8): the winning drawer stays, everyone else rotates. */
function nextDrawers(state: State): Pair<string> {
  const previous = state.round;
  const gone = unavailable(state);
  const winner = previous?.solvedOrder[0] ?? null;
  return TEAMS.map((team) => {
    const rotation = state.rotations[team];
    if (!previous) return rotation[0] ?? "";
    return nextDrawer(rotation, previous.turns[team].drawerId, winner === team, gone);
  }) as Pair<string>;
}

/** The challenger's head start for the round these drawers play (section 7). */
const headStartWith = (state: State, drawers: Pair<string>) =>
  headStartFor(streakFor(state.history, drawers)?.count ?? 0);

/**
 * Opens the next round's choose stage (section 8): the winning drawer stays and the losing
 * team's challenger chooses, with a head start if the winner is on a streak (section 7);
 * after a no-winner round both teams rotate and a random team chooses, with none (D44).
 */
function startRound(state: State, now: number): Transition<State> {
  const previous = state.round;
  const winner = previous?.solvedOrder[0] ?? null;
  const drawers = nextDrawers(state);
  const drawn =
    winner === null
      ? nextInt(state.rng, 0, TEAM_COUNT - 1)
      : { value: otherTeam(winner), rng: state.rng };
  const chooserTeam = drawn.value as TeamIndex;
  const words = state.wordOrder
    .slice(state.wordCursor, state.wordCursor + WORD_CHOICES)
    .map((index) => ENGLISH_WORDS[index]?.word ?? "");
  const round: Round = {
    number: (previous?.number ?? 0) + 1,
    chooserId: drawers[chooserTeam],
    choices: [words[0] ?? "", words[1] ?? ""],
    word: null,
    headStartSeconds: winner === null ? 0 : headStartWith(state, drawers),
    wordChosenAt: null,
    solvedOrder: [],
    turns: [newTurn(drawers[0], 0), newTurn(drawers[1], 0)],
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

/** The chooser draws from `from`; the other drawer once the head start is over. */
function drawFromAfter(round: Round, from: number): Pair<TeamTurn> {
  const headStartEnds = from + seconds(round.headStartSeconds);
  return round.turns.map((turn) => ({
    ...turn,
    drawFrom: turn.drawerId === round.chooserId ? from : headStartEnds,
  })) as Pair<TeamTurn>;
}

/** Both drawers draw and guessers guess, until the round's time is up. */
function startDrawing(state: State, now: number): Transition<State> {
  const round = state.round;
  if (!round) return { state, events: [] };
  const turns = round.turns.map((turn) =>
    turn.drawerId === round.chooserId && state.phase === "headStart"
      ? turn
      : { ...turn, drawFrom: now },
  ) as Pair<TeamTurn>;
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

function chooseWord(state: State, index: 0 | 1, now: number): Transition<State> {
  const round = state.round;
  if (!round) return { state, events: [] };
  const countdownEnds = now + seconds(COUNTDOWN_SECONDS);
  const turns = drawFromAfter(round, countdownEnds);
  return {
    state: {
      ...state,
      phase: "countdown",
      phaseEndsAt: countdownEnds,
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
    headStartSeconds: round.headStartSeconds,
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

const isLastRound = (state: State) => (state.round?.number ?? 0) >= state.config.rounds;

/** Teams the next round, or the showdown, waits for (SB12, SB18). */
function waitingFor(state: State): TeamIndex[] {
  if (state.phase !== "result" && state.phase !== "summary") return [];
  return teamsShort(state);
}

/** Every connected player has tapped Continue (away and departed players aren't waited for). */
function everyoneReady(state: State): boolean {
  const gone = unavailable(state);
  return TEAMS.every((team) =>
    connectedIn(state.rotations[team], gone).every((id) => state.ready.includes(id)),
  );
}

/** After the summary: the next round, or the showdown after the last one. */
function afterSummary(state: State, now: number): Transition<State> {
  const next = { ...state, ready: [] };
  if (isLastRound(state)) return startShowdown(next, now, unavailable(state));
  return startRound(next, now);
}

/** On the summary, starts the next round once everyone is ready and both teams can play. */
function startWhenReady(state: State, now: number): Transition<State> {
  if (state.phase === "summary" && waitingFor(state).length === 0 && everyoneReady(state)) {
    return afterSummary(state, now);
  }
  return { state, events: [] };
}

function draw(
  state: State,
  team: TeamIndex,
  move: Extract<SketchBattleMove, { type: "draw" }>,
): State {
  const turn = currentTurn(state, team);
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
  if (state.phase === "result" || state.phase === "summary" || state.phase === "ended") return true;
  if (team === null || isDrawer) return true;
  return round.turns[team].solvedAt !== null;
}

/** Round result, summary, or the showdown's end: every team's drawing and guesses are open. */
const allOpen = (state: State) =>
  state.phase === "result" || state.phase === "summary" || showdownOver(state.phase);

/**
 * May this viewer see a team's real strokes (D47)? Their own team's, and everyone's at the
 * result; the other team's only as pixel cells until then, even once their team guessed (SB25).
 */
function seesCanvas(state: State, viewerTeam: TeamIndex | null, team: TeamIndex): boolean {
  return viewerTeam === null || viewerTeam === team || allOpen(state);
}

/** May this viewer see a team's guesses? The other team's once their own team guessed; never in the showdown (SB4). */
function seesGuesses(state: State, viewerTeam: TeamIndex | null, team: TeamIndex): boolean {
  if (viewerTeam === null || viewerTeam === team || allOpen(state)) return true;
  if (inShowdown(state.phase)) return false;
  return state.round?.turns[viewerTeam].solvedAt != null;
}

const NO_OPS: CanvasOp[] = [];
const NO_GUESSES: SketchBattleView["teams"][0]["guesses"] = [];

/**
 * The head start is private (SB4): only the chooser and spectators see that canvas. Everyone
 * else, the chooser's teammates included, gets an empty one until the drawing starts.
 */
function headStartHidden(state: State, team: TeamIndex, viewer: string): boolean {
  const round = state.round;
  if (state.phase !== "headStart" || !round || viewer === "spectator") return false;
  return round.turns[team].drawerId === round.chooserId && viewer !== round.chooserId;
}

function teamView(
  state: State,
  team: TeamIndex,
  viewerTeam: TeamIndex | null,
  viewer: string,
): TeamView {
  const turn = currentTurn(state, team);
  const racing = inShowdown(state.phase);
  const playing = racing ? state.phase === "showdown" : Boolean(state.round?.word);
  const shown = seesCanvas(state, viewerTeam, team);
  const hidden = headStartHidden(state, team, viewer);
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
    drawFrom: turn && playing ? turn.drawFrom : null,
    solvedAt: turn?.solvedAt ?? null,
    canvas: shown
      ? { kind: "strokes", ops: hidden ? NO_OPS : (turn?.ops ?? NO_OPS) }
      : { kind: "cells", cells: racing || hidden ? EMPTY_CELLS : (turn?.cells ?? EMPTY_CELLS) },
    guesses: seesGuesses(state, viewerTeam, team) ? (turn?.guesses ?? NO_GUESSES) : null,
    wrongGuesses: turn?.guesses.filter((g) => !g.correct).length ?? 0,
  };
}

/**
 * The streak and head start a viewer is shown (section 7): the round's own while it plays;
 * from its result on, the coming round's, as the drawers stand now. None in the showdown.
 */
function streakView(state: State): Pick<SketchBattleView, "streak" | "headStartSeconds"> {
  const none = { streak: null, headStartSeconds: 0 };
  const round = state.round;
  if (!round || inShowdown(state.phase) || state.phase === "ended") return none;
  if (state.phase === "result" || state.phase === "summary") {
    if (isLastRound(state)) return none;
    const drawers = nextDrawers(state);
    return {
      streak: streakFor(state.history, drawers),
      headStartSeconds: headStartWith(state, drawers),
    };
  }
  const drawers: Pair<string> = [round.turns[0].drawerId, round.turns[1].drawerId];
  return { streak: streakFor(state.history, drawers), headStartSeconds: round.headStartSeconds };
}

const quietly = (verdict: Validation): Validation =>
  verdict.ok ? verdict : { ...verdict, quiet: true };

/** Why this stroke or clear can't be taken now, if it can't. */
function drawProblem(
  state: State,
  playerId: string,
  turn: TeamTurn,
  isDrawer: boolean,
  move: Extract<SketchBattleMove, { type: "draw" | "clear" }>,
  now: number,
): Validation {
  if (!isDrawer) return { ok: false, reason: "Only the drawer can draw" };
  const playing =
    state.phase === "drawing" ||
    state.phase === "showdown" ||
    (state.phase === "headStart" && state.round?.chooserId === playerId);
  if (!playing || now < turn.drawFrom) {
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
      ready: [],
      recentGuesses: {},
      showdown: null,
    };
    return startRound(state, now).state;
  },

  validate: (state, playerId, move, now) => {
    const team = teamOf(state, playerId);
    const round = state.round;
    if (state.phase === "ended") return { ok: false, reason: "The game is over" };
    const turn = team === null ? undefined : currentTurn(state, team);
    if (team === null || !round || !turn) return { ok: false, reason: "You're watching this game" };
    const isDrawer = turn.drawerId === playerId;
    const racing = inShowdown(state.phase);

    switch (move.type) {
      case "choose":
        if (state.phase !== "choose") return { ok: false, reason: "The word is already chosen" };
        if (round.chooserId !== playerId) {
          return { ok: false, reason: "Only the chooser can pick the word" };
        }
        return { ok: true };
      case "draw":
      case "clear":
        // Our client only draws in its own turn, so a refused stroke is one that arrived after the
        // turn ended (a correct guess, time up, the showdown handoff): dropped quietly (D61).
        return quietly(drawProblem(state, playerId, turn, isDrawer, move, now));
      case "guess": {
        if (state.phase === "showdownResult") return { ok: false, reason: "The showdown is over" };
        // Closed the moment time is up, even if the room hasn't processed the deadline yet.
        if (!racing && roundOver(state, now)) return { ok: false, reason: "The round is over" };
        const open = racing ? state.phase === "showdown" : state.phase === "drawing";
        if (!open || now < turn.drawFrom) {
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
      case "ready":
      case "forceStart": {
        if (state.phase !== "result" && state.phase !== "summary") {
          return { ok: false, reason: "The round is not over yet" };
        }
        const short = waitingFor(state)[0];
        if (short !== undefined) return { ok: false, reason: `Waiting for Team ${short + 1}` };
        if (move.type === "ready") {
          if (state.ready.includes(playerId)) return { ok: false, reason: "You're already ready" };
          return { ok: true };
        }
        // Only someone who's ready can skip the ones who aren't.
        if (!state.ready.includes(playerId)) return { ok: false, reason: "Tap Continue first" };
        if (state.phase !== "summary" || (state.phaseEndsAt !== null && now < state.phaseEndsAt)) {
          return {
            ok: false,
            reason: `Start next round opens ${FORCE_START_AFTER_SECONDS} s into the summary`,
          };
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
        const turn = currentTurn(state, team);
        if (!turn) return { state, events: [] };
        const cleared = {
          ...turn,
          ops: [...turn.ops, { clear: true as const }],
          cells: EMPTY_CELLS,
        };
        return { state: withTurn(state, team, cleared), events: [], live: true };
      }
      case "guess":
        if (inShowdown(state.phase)) {
          return showdownGuess(state, playerId, team, move.text, now, unavailable(state));
        }
        return guess(state, playerId, team, move.text, now);
      case "ready":
        return startWhenReady({ ...state, ready: [...state.ready, playerId] }, now);
      case "forceStart":
        return afterSummary(state, now);
    }
  },

  view: (state, viewer) => {
    const team = viewer === "spectator" ? null : teamOf(state, viewer);
    const round = state.round;
    const isDrawer = team !== null && currentTurn(state, team)?.drawerId === viewer;
    const showdown = showdownView(state, team, isDrawer);
    const showWord = seesWord(state, team, isDrawer);
    // In the showdown a player's word and blanks are their own team's current word.
    const racing = showdown !== null && inShowdown(state.phase);
    const roundBlanks =
      round?.word && !showWord && state.config.showWordLengths ? blanksFor(round.word) : null;
    const word = racing
      ? team === null
        ? null
        : showdown.current[team]
      : showWord
        ? (round?.word ?? null)
        : null;
    const blanks = racing ? (team === null ? null : showdown.blanks[team]) : roundBlanks;
    return {
      me: { team, role: team === null ? "spectator" : isDrawer ? "drawer" : "guesser" },
      phase: state.phase,
      phaseEndsAt: state.phaseEndsAt,
      roundNumber: round?.number ?? 0,
      rounds: state.config.rounds,
      chooserId: round?.chooserId ?? null,
      // Both drawers, and spectators (SB20); never guessers. Kept through the countdown to show the pick.
      choices:
        (state.phase === "choose" || state.phase === "countdown") &&
        (isDrawer || team === null) &&
        round
          ? round.choices
          : null,
      word,
      blanks,
      teams: [teamView(state, 0, team, viewer), teamView(state, 1, team, viewer)],
      lastRound: state.history.at(-1) ?? null,
      waitingFor: waitingFor(state),
      ready: state.phase === "result" || state.phase === "summary" ? state.ready : [],
      showdown,
      ...streakView(state),
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
        if (round.headStartSeconds === 0) return startDrawing(state, now);
        return {
          state: {
            ...state,
            phase: "headStart",
            phaseEndsAt: now + seconds(round.headStartSeconds),
            round: { ...round, turns: drawFromAfter(round, now) },
          },
          events: [
            {
              type: "headStart.started",
              data: { chooserId: round.chooserId, seconds: round.headStartSeconds },
            },
          ],
        };
      }
      case "headStart":
        return startDrawing(state, now);
      case "drawing":
        return endRound(state, now, []);
      case "result": {
        const summary: State = {
          ...state,
          phase: "summary",
          phaseEndsAt: now + seconds(FORCE_START_AFTER_SECONDS),
        };
        const started = startWhenReady(summary, now);
        return started.state === summary ? { state: summary, events: [] } : started;
      }
      case "summary":
        // Start next round opens; a round whose last unready players left starts now.
        return startWhenReady({ ...state, phaseEndsAt: null }, now);
      case "showdownIntro":
      case "showdownCountdown":
      case "showdownResult":
        return showdownDeadline(state, now);
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
    return startWhenReady(next, now);
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
      gapMs: gapMs(record.solvedAt),
      headStartSeconds: record.headStartSeconds,
    })),
    showdown: state.showdown && {
      words: state.showdown.words.length,
      done: state.showdown.done,
      winnerTeam: state.showdown.winnerTeam,
    },
    scores: state.scores,
  }),
};
