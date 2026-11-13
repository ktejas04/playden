import { GAME_ID_PATTERN, type GameDefinition, type Seat } from "../GameDefinition";
import { type Rng, createRng, nextInt, pick } from "../random";
import { deepFreeze, firstNonJson, sameJson } from "./json";

/** What a game's tests tell the contract kit about it. */
export interface ContractFixture<State, Move, Config> {
  /** A valid table to set up, e.g. two teams of two. */
  seats: Seat[];
  /** Defaults to the game's `defaultConfig`. */
  config?: Config;
  /** Moves worth trying for this player right now; invalid ones are fine and get tried too. */
  sampleMoves(state: State, playerId: string): Move[];
  /** Text that must never appear in this viewer's view, e.g. the other team's secret word. */
  hiddenFrom?(state: State, viewer: string | "spectator"): string[];
  /** Seeds for the random playthroughs. Defaults to [1, 2, 3]. */
  seeds?: number[];
  /** A playthrough must end within this many moves and deadlines. Defaults to 500. */
  maxSteps?: number;
}

const START_TIME = 1_750_000_000_000;
/** Most moves land within this many milliseconds of the previous one. */
const MAX_THINK_MS = 1_500;

type Game<S, M, V, C, D = unknown> = GameDefinition<S, M, V, C, D>;

export function checkMetadata<S, M, V, C, D>(game: Game<S, M, V, C, D>): string[] {
  const problems: string[] = [];
  if (!GAME_ID_PATTERN.test(game.id)) problems.push(`id "${game.id}" isn't lowercase-hyphenated`);
  if (!game.name.trim()) problems.push("name is empty");
  if (!game.summary.trim()) problems.push("summary is empty");
  if (!(game.minPlayers >= 1 && game.minPlayers <= game.maxPlayers)) {
    problems.push(`players ${game.minPlayers}–${game.maxPlayers} isn't a valid range`);
  }
  if (game.teams) {
    const { count, minSize, maxSize } = game.teams;
    if (count < 2) problems.push("teams.count must be at least 2");
    if (!(minSize >= 1 && minSize <= maxSize)) problems.push("team sizes aren't a valid range");
    if (count * minSize > game.maxPlayers) problems.push("minimum teams need more than maxPlayers");
  }
  if (!game.configSchema.safeParse(game.defaultConfig).success) {
    problems.push("defaultConfig doesn't pass configSchema");
  }
  if (game.delta && !game.applyDelta) problems.push("delta needs applyDelta");
  if (game.moveLimit && !(game.moveLimit.perSecond > 0 && game.moveLimit.burst >= 1)) {
    problems.push("moveLimit needs a positive rate and burst");
  }
  return problems;
}

function jsonProblem(label: string, value: unknown): string | null {
  const problem = firstNonJson(value);
  return problem ? `${label} isn't plain JSON: ${problem.replace(/^\$/, label)}` : null;
}

export function checkSetup<S, M, V, C, D>(
  game: Game<S, M, V, C, D>,
  fixture: ContractFixture<S, M, C>,
): string[] {
  const problems: string[] = [];
  const config = fixture.config ?? game.defaultConfig;
  try {
    const a = game.setup(fixture.seats, config, 42, START_TIME);
    const b = game.setup(fixture.seats, config, 42, START_TIME);
    const notJson = jsonProblem("state", a);
    if (notJson) problems.push(notJson);
    else if (JSON.stringify(a) !== JSON.stringify(b)) {
      problems.push("setup differs for the same seed (randomness must come from the seed)");
    }
    if (game.result(a) !== null) problems.push("result isn't null at the start");
  } catch (error) {
    problems.push(`setup threw: ${String(error)}`);
  }
  return problems;
}

function checkViews<S, M, V, C, D>(
  game: Game<S, M, V, C, D>,
  fixture: ContractFixture<S, M, C>,
  state: S,
  at: string,
): string[] {
  const problems: string[] = [];
  const viewers: (string | "spectator")[] = [...fixture.seats.map((s) => s.id), "spectator"];
  for (const viewer of viewers) {
    const view = game.view(state, viewer);
    const notJson = jsonProblem(`view for ${viewer}`, view);
    if (notJson) {
      problems.push(`${at}: ${notJson}`);
      continue;
    }
    const text = JSON.stringify(view);
    for (const secret of fixture.hiddenFrom?.(state, viewer) ?? []) {
      if (secret && text.includes(secret)) {
        problems.push(`${at}: view for ${viewer} leaks hidden "${secret}"`);
      }
    }
  }
  return problems;
}

function checkResult<S, M, V, C, D>(
  game: Game<S, M, V, C, D>,
  fixture: ContractFixture<S, M, C>,
  state: S,
): string[] {
  const result = game.result(state);
  if (!result) return [];
  const ids = new Set(fixture.seats.map((s) => s.id));
  const problems: string[] = [];
  for (const id of [...Object.keys(result.scores), ...result.winners]) {
    if (!ids.has(id)) problems.push(`result names "${id}", who isn't seated`);
  }
  if (game.recordSummary) {
    const problem = jsonProblem("recordSummary", game.recordSummary(state));
    if (problem) problems.push(problem);
  }
  return problems;
}

/**
 * Checks one change of state: plain JSON, a live change keeps the deadline (D55), and each
 * viewer's delta is clean and rebuilds exactly the view they'd otherwise get.
 */
function checkTransition<S, M, V, C, D>(
  game: Game<S, M, V, C, D>,
  fixture: ContractFixture<S, M, C>,
  before: S,
  transition: { state: S; events: unknown; live?: true },
  label: string,
): string[] {
  const { state: after, events, live } = transition;
  const notJson = jsonProblem("events", events) ?? jsonProblem("state", after);
  if (notJson) return [`${label}: ${notJson}`];
  if (live && game.nextDeadline(before) !== game.nextDeadline(after)) {
    return [`${label}: a live move changed nextDeadline`];
  }
  const { delta, applyDelta } = game;
  if (!delta || !applyDelta) return [];
  const viewers: (string | "spectator")[] = [...fixture.seats.map((s) => s.id), "spectator"];
  for (const viewer of viewers) {
    const change = delta(before, after, viewer);
    const deltaNotJson = jsonProblem(`delta for ${viewer}`, change);
    if (deltaNotJson) return [`${label}: ${deltaNotJson}`];
    const text = JSON.stringify(change);
    for (const secret of fixture.hiddenFrom?.(after, viewer) ?? []) {
      if (secret && text.includes(secret)) {
        return [`${label}: delta for ${viewer} leaks hidden "${secret}"`];
      }
    }
    const was = game.view(before, viewer);
    const rebuilt = change === null ? was : applyDelta(was, change);
    if (!sameJson(rebuilt, game.view(after, viewer))) {
      return [`${label}: delta for ${viewer} doesn't rebuild its view`];
    }
  }
  return [];
}

/**
 * Plays one seeded random game: players try suggested moves (valid or not) at random
 * moments, deadlines fire when nobody moves first, one player may leave midway, and (for games
 * with `onPresence`) players drop and come back.
 * Every state the engine is handed is frozen, so changing it in place throws.
 */
export function checkPlaythrough<S, M, V, C, D>(
  game: Game<S, M, V, C, D>,
  fixture: ContractFixture<S, M, C>,
  seed: number,
): string[] {
  const maxSteps = fixture.maxSteps ?? 500;
  const config = fixture.config ?? game.defaultConfig;
  let rng: Rng = createRng(seed);
  let now = START_TIME;
  let step = 0;
  let left: string | null = null;
  let away: string[] = [];
  const at = () => `seed ${seed}, step ${step}`;
  const draw = (min: number, max: number) => {
    const drawn = nextInt(rng, min, max);
    rng = drawn.rng;
    return drawn.value;
  };

  let state: S;
  /** Tells the game who is away now (D56), checking the change like any other. */
  const tellPresence = (): string[] => {
    if (!game.onPresence) return [];
    try {
      const transition = game.onPresence(state, away, now);
      const problems = checkTransition(game, fixture, state, transition, `${at()} (presence)`);
      if (problems.length === 0) state = deepFreeze(transition.state);
      return problems;
    } catch (error) {
      return [`${at()}: onPresence threw (did it change its input?): ${String(error)}`];
    }
  };
  try {
    state = deepFreeze(game.setup(fixture.seats, config, seed, now));
  } catch (error) {
    return [`setup threw: ${String(error)}`];
  }

  for (; step < maxSteps; step++) {
    if (game.result(state) !== null) return checkResult(game, fixture, state);
    const viewProblems = checkViews(game, fixture, state, at());
    if (viewProblems.length > 0) return viewProblems;

    const deadline = game.nextDeadline(state);
    if (deadline !== null && !Number.isFinite(deadline))
      return [`${at()}: deadline is ${deadline}`];

    if (left === null && fixture.seats.length > 1 && draw(1, 50) === 1) {
      const leaving = pick(rng, fixture.seats);
      left = leaving.value.id;
      rng = leaving.rng;
      try {
        const transition = game.onPlayerLeft(state, left);
        const problems = checkTransition(game, fixture, state, transition, `${at()} (player left)`);
        if (problems.length > 0) return problems;
        state = deepFreeze(transition.state);
      } catch (error) {
        return [`${at()}: onPlayerLeft threw (did it change its input?): ${String(error)}`];
      }
      continue;
    }

    // Presence (D56): now and then someone drops or comes back.
    if (game.onPresence && draw(1, 20) === 1) {
      const toggled = pick(rng, fixture.seats);
      rng = toggled.rng;
      const id = toggled.value.id;
      away = away.includes(id) ? away.filter((other) => other !== id) : [...away, id];
      const problems = tellPresence();
      if (problems.length > 0) return problems;
      continue;
    }

    const candidates = fixture.seats
      .filter((seat) => seat.id !== left && !away.includes(seat.id))
      .flatMap((seat) => fixture.sampleMoves(state, seat.id).map((move) => ({ seat, move })));
    const moveAt = now + draw(0, MAX_THINK_MS);
    const deadlineFirst = deadline !== null && (candidates.length === 0 || deadline <= moveAt);

    if (deadlineFirst) {
      now = Math.max(now, deadline);
      try {
        const transition = game.onDeadline(state, now);
        const problems = checkTransition(game, fixture, state, transition, `${at()} (deadline)`);
        if (problems.length > 0) return problems;
        state = deepFreeze(transition.state);
      } catch (error) {
        return [`${at()}: onDeadline threw (did it change its input?): ${String(error)}`];
      }
      continue;
    }

    if (candidates.length === 0 && game.onPresence && away.length > 0) {
      // A game may wait for away players (e.g. enough to start a round): everyone comes back.
      away = [];
      const problems = tellPresence();
      if (problems.length > 0) return problems;
      continue;
    }
    if (candidates.length === 0) {
      return [`${at()}: stuck: no moves to try and no deadline, but no result either`];
    }
    now = moveAt;
    const chosen = pick(rng, candidates);
    rng = chosen.rng;
    const { seat, move } = chosen.value;
    try {
      const verdict = game.validate(state, seat.id, move, now);
      if (!verdict.ok) {
        if (typeof verdict.reason !== "string" || !verdict.reason.trim()) {
          return [`${at()}: a rejection has no reason to show the player`];
        }
        continue;
      }
      const transition = game.apply(state, seat.id, move, now);
      const problems = checkTransition(game, fixture, state, transition, `${at()} (move)`);
      if (problems.length > 0) return problems;
      state = deepFreeze(transition.state);
    } catch (error) {
      return [`${at()}: validate/apply threw (did it change its input?): ${String(error)}`];
    }
  }
  return [`seed ${seed}: no result after ${maxSteps} steps`];
}
