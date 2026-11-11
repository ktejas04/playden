import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { GameDefinition, Seat } from "../src/GameDefinition";
import {
  type ContractFixture,
  checkMetadata,
  checkPlaythrough,
  checkSetup,
  describeGameContract,
  firstNonJson,
} from "../src/testing";

/**
 * A tiny correct game: each player taps until someone reaches the target, or the deadline
 * ends it. Each broken variant below breaks one rule, and the kit must catch it.
 */
interface State {
  taps: Record<string, number>;
  secret: string;
  deadline: number;
  over: boolean;
}
type Move = { type: "tap" } | { type: "shout" };
interface Config {
  target: number;
}

const counter: GameDefinition<State, Move, { mine: number }, Config> = {
  id: "counter",
  name: "Counter",
  summary: "Tap to win.",
  minPlayers: 1,
  maxPlayers: 4,
  defaultConfig: { target: 5 },
  configSchema: z.strictObject({ target: z.number().int().min(1) }),
  moveSchema: z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("tap") }),
    z.strictObject({ type: z.literal("shout") }),
  ]),
  setup: (seats, _config, seed, now) => ({
    taps: Object.fromEntries(seats.map((s) => [s.id, 0])),
    secret: `secret-${seed}`,
    deadline: now + 20_000,
    over: false,
  }),
  validate: (state, playerId, move) => {
    if (state.over) return { ok: false, reason: "The game is over" };
    if (!(playerId in state.taps)) return { ok: false, reason: "You're not playing" };
    if (move.type === "shout") return { ok: false, reason: "No shouting" };
    return { ok: true };
  },
  apply: (state, playerId) => {
    const taps = { ...state.taps, [playerId]: (state.taps[playerId] ?? 0) + 1 };
    return { state: { ...state, taps, over: (taps[playerId] ?? 0) >= 5 }, events: [] };
  },
  view: (state, playerId) => ({ mine: state.taps[playerId] ?? 0 }),
  nextDeadline: (state) => (state.over ? null : state.deadline),
  onDeadline: (state) => ({ state: { ...state, over: true }, events: [] }),
  onPlayerLeft: (state, playerId) => {
    const taps = Object.fromEntries(Object.entries(state.taps).filter(([id]) => id !== playerId));
    return { state: { ...state, taps }, events: [{ type: "left", data: { playerId } }] };
  },
  result: (state) =>
    state.over ? { scores: { ...state.taps }, winners: Object.keys(state.taps) } : null,
};

const seats: Seat[] = [
  { id: "a", name: "Asha" },
  { id: "b", name: "Ben" },
];
const fixture: ContractFixture<State, Move, Config> = {
  seats,
  sampleMoves: () => [{ type: "tap" }, { type: "shout" }],
  hiddenFrom: (state) => [state.secret],
};

const play = (game: typeof counter, f = fixture) => checkPlaythrough(game, f, 1);

describeGameContract(counter, fixture);

describe("the contract kit catches broken games", () => {
  it("a bad id, empty name, bad player range or invalid default settings", () => {
    const problems = checkMetadata({
      ...counter,
      id: "Counter Game",
      name: " ",
      minPlayers: 5,
      defaultConfig: { target: 0 },
    });
    expect(problems).toEqual([
      'id "Counter Game" isn\'t lowercase-hyphenated',
      "name is empty",
      "players 5–4 isn't a valid range",
      "defaultConfig doesn't pass configSchema",
    ]);
  });

  it("impossible team rules", () => {
    const problems = checkMetadata({
      ...counter,
      teams: { count: 1, minSize: 3, maxSize: 2, maxSizeGap: -1 },
    });
    expect(problems).toHaveLength(3);
  });

  it("setup that ignores the seed", () => {
    let calls = 0;
    const problems = checkSetup(
      { ...counter, setup: (s, c, seed, now) => ({ ...counter.setup(s, c, seed + calls++, now) }) },
      fixture,
    );
    expect(problems.join()).toMatch(/differs for the same seed/);
  });

  it("state that isn't plain JSON", () => {
    const problems = checkSetup(
      {
        ...counter,
        setup: (s, c, seed, now) => ({ ...counter.setup(s, c, seed, now), when: new Date(now) }),
      },
      fixture,
    );
    expect(problems.join()).toMatch(/state isn't plain JSON: state\.when is a Date/);
  });

  it("a result before the game has started", () => {
    const problems = checkSetup(
      { ...counter, result: () => ({ scores: {}, winners: [] }) },
      fixture,
    );
    expect(problems).toContain("result isn't null at the start");
  });

  it("apply that changes the state it was given", () => {
    const problems = play({
      ...counter,
      apply: (state, playerId) => {
        state.taps[playerId] = (state.taps[playerId] ?? 0) + 1;
        return { state, events: [] };
      },
    });
    expect(problems.join()).toMatch(/validate\/apply threw/);
  });

  it("a rejection without a reason", () => {
    const problems = play({
      ...counter,
      validate: (state, playerId, move) =>
        move.type === "shout"
          ? { ok: false, reason: "" }
          : counter.validate(state, playerId, move, 0),
    });
    expect(problems.join()).toMatch(/rejection has no reason/);
  });

  it("a view that leaks hidden information", () => {
    const problems = play({
      ...counter,
      view: (state, playerId) => ({ mine: state.taps[playerId] ?? 0, peek: state.secret }),
    } as typeof counter);
    expect(problems.join()).toMatch(/leaks hidden "secret-1"/);
  });

  it("a game that never ends", () => {
    const problems = play(
      { ...counter, nextDeadline: () => null, apply: (state) => ({ state, events: [] }) },
      { ...fixture, maxSteps: 50 },
    );
    expect(problems).toEqual(["seed 1: no result after 50 steps"]);
  });

  it("a game that gets stuck with no moves and no deadline", () => {
    const problems = play(
      { ...counter, nextDeadline: () => null },
      { ...fixture, sampleMoves: () => [] },
    );
    expect(problems.join()).toMatch(/stuck/);
  });

  it("a result that names someone who isn't seated", () => {
    const problems = play({
      ...counter,
      result: (state) => (state.over ? { scores: { zed: 1 }, winners: [] } : null),
    });
    expect(problems).toEqual(['result names "zed", who isn\'t seated']);
  });
});

describe("firstNonJson", () => {
  it("accepts plain JSON, including undefined object properties", () => {
    expect(firstNonJson({ a: [1, "x", true, null], b: { c: undefined } })).toBeNull();
  });

  it.each([
    [{ n: Number.NaN }, "$.n is NaN"],
    [{ list: [1, undefined] }, "$.list[1] is undefined"],
    [{ m: new Map() }, "$.m is a Map"],
    [{ f: () => 1 }, "$.f is a function"],
  ])("rejects %o", (value, message) => {
    expect(firstNonJson(value)).toBe(message);
  });
});
