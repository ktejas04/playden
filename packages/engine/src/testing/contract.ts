import { GAME_ID_PATTERN, type GameDefinition, type Seat } from "../GameDefinition";
import { type Rng, createRng, nextInt, pick } from "../random";
import { deepFreeze, firstNonJson } from "./json";

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

type Game<S, M, V, C> = GameDefinition<S, M, V, C>;

export function checkMetadata<S, M, V, C>(game: Game<S, M, V, C>): string[] {
  const problems: string[] = [];
  if (!GAME_ID_PATTERN.test(game.id)) problems.push(`id "${game.id}" isn't lowercase-hyphenated`);
  if (!game.name.trim()) problems.push("name is empty");
  if (!game.summary.trim()) problems.push("summary is empty");
  if (!(game.minPlayers >= 1 && game.minPlayers <= game.maxPlayers)) {
    problems.push(`players ${game.minPlayers}–${game.maxPlayers} isn't a valid range`);
  }
  if (game.teams) {
    const { count, minSize, maxSize, maxSizeGap } = game.teams;
    if (count < 2) problems.push("teams.count must be at least 2");
    if (!(minSize >= 1 && minSize <= maxSize)) problems.push("team sizes aren't a valid range");
    if (maxSizeGap < 0) problems.push("teams.maxSizeGap can't be negative");
    if (count * minSize > game.maxPlayers) problems.push("minimum teams need more than maxPlayers");
  }
  if (!game.configSchema.safeParse(game.defaultConfig).success) {
    problems.push("defaultConfig doesn't pass configSchema");
  }
  return problems;
}

function jsonProblem(label: string, value: unknown): string | null {
  const problem = firstNonJson(value);
  return problem ? `${label} isn't plain JSON: ${problem.replace(/^\$/, label)}` : null;
}

export function checkSetup<S, M, V, C>(
  game: Game<S, M, V, C>,
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

function checkViews<S, M, V, C>(
  game: Game<S, M, V, C>,
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

function checkResult<S, M, V, C>(
  game: Game<S, M, V, C>,
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
  return problems;
}

/**
 * Plays one seeded random game: players try suggested moves (valid or not) at random
 * moments, deadlines fire when nobody moves first, and one player may leave midway.
 * Every state the engine is handed is frozen, so changing it in place throws.
 */
export function checkPlaythrough<S, M, V, C>(
  game: Game<S, M, V, C>,
  fixture: ContractFixture<S, M, C>,
  seed: number,
): string[] {
  const maxSteps = fixture.maxSteps ?? 500;
  const config = fixture.config ?? game.defaultConfig;
  let rng: Rng = createRng(seed);
  let now = START_TIME;
  let step = 0;
  let left: string | null = null;
  const at = () => `seed ${seed}, step ${step}`;
  const draw = (min: number, max: number) => {
    const drawn = nextInt(rng, min, max);
    rng = drawn.rng;
    return drawn.value;
  };

  let state: S;
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
        const { state: next, events } = game.onPlayerLeft(state, left);
        const notJson = jsonProblem("events", events) ?? jsonProblem("state", next);
        if (notJson) return [`${at()} (player left): ${notJson}`];
        state = deepFreeze(next);
      } catch (error) {
        return [`${at()}: onPlayerLeft threw (did it change its input?): ${String(error)}`];
      }
      continue;
    }

    const candidates = fixture.seats
      .filter((seat) => seat.id !== left)
      .flatMap((seat) => fixture.sampleMoves(state, seat.id).map((move) => ({ seat, move })));
    const moveAt = now + draw(0, MAX_THINK_MS);
    const deadlineFirst = deadline !== null && (candidates.length === 0 || deadline <= moveAt);

    if (deadlineFirst) {
      now = Math.max(now, deadline);
      try {
        const { state: next, events } = game.onDeadline(state, now);
        const notJson = jsonProblem("events", events) ?? jsonProblem("state", next);
        if (notJson) return [`${at()} (deadline): ${notJson}`];
        state = deepFreeze(next);
      } catch (error) {
        return [`${at()}: onDeadline threw (did it change its input?): ${String(error)}`];
      }
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
      const { state: next, events } = game.apply(state, seat.id, move, now);
      const notJson = jsonProblem("events", events) ?? jsonProblem("state", next);
      if (notJson) return [`${at()} (move): ${notJson}`];
      state = deepFreeze(next);
    } catch (error) {
      return [`${at()}: validate/apply threw (did it change its input?): ${String(error)}`];
    }
  }
  return [`seed ${seed}: no result after ${maxSteps} steps`];
}
