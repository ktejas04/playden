import type { Seat } from "@playden/engine";
import { describeGameContract } from "@playden/engine/testing";
import { describe, expect, it } from "vitest";
import { tapRace } from "../engine";
import type { TapRaceState } from "../types";

const seats: Seat[] = [
  { id: "a1", name: "Asha", team: 0 },
  { id: "a2", name: "Ben", team: 0 },
  { id: "b1", name: "Chi", team: 1 },
  { id: "b2", name: "Dev", team: 1 },
];
const START = 1_000_000;
const config = { targetTaps: 3, roundSeconds: 20 };

function start(): TapRaceState {
  return tapRace.setup(seats, config, 1, START);
}

function tap(state: TapRaceState, playerId: string, at = START + 100): TapRaceState {
  const verdict = tapRace.validate(state, playerId, { type: "tap" }, at);
  if (!verdict.ok) throw new Error(verdict.reason);
  return tapRace.apply(state, playerId, { type: "tap" }, at).state;
}

describeGameContract(tapRace, {
  seats,
  config,
  sampleMoves: () => [{ type: "tap" }],
});

describe("Tap Race", () => {
  it("a tap adds 1 to the tapper's team only", () => {
    const state = tap(start(), "a1");
    expect(state.counts).toEqual([1, 0]);
  });

  it("a spectator's tap is rejected with a reason", () => {
    expect(tapRace.validate(start(), "zed", { type: "tap" }, START)).toEqual({
      ok: false,
      reason: "You're watching this race",
    });
  });

  it("a tap after the game ended is rejected with a reason", () => {
    const over = tapRace.onDeadline(start(), START + 20_000).state;
    expect(tapRace.validate(over, "a1", { type: "tap" }, START + 20_001)).toEqual({
      ok: false,
      reason: "The race is over",
    });
  });

  it("reaching the target ends the game at once with that team winning", () => {
    let state = start();
    state = tap(tap(state, "b1"), "b2");
    expect(tapRace.result(state)).toBeNull();
    const { state: done, events } = tapRace.apply(state, "b1", { type: "tap" }, START + 200);
    expect(events).toEqual([{ type: "won", data: { team: 1 } }]);
    expect(tapRace.nextDeadline(done)).toBeNull();
    expect(tapRace.result(done)).toEqual({
      scores: { a1: 0, a2: 0, b1: 3, b2: 3 },
      winners: ["b1", "b2"],
    });
  });

  it("the deadline ends the game with the higher count winning", () => {
    const state = tap(start(), "a2");
    expect(tapRace.nextDeadline(state)).toBe(START + 20_000);
    const over = tapRace.onDeadline(state, START + 20_000).state;
    expect(tapRace.result(over)?.winners).toEqual(["a1", "a2"]);
  });

  it("equal counts at the deadline are a draw", () => {
    const state = tap(tap(start(), "a1"), "b1");
    const over = tapRace.onDeadline(state, START + 20_000).state;
    expect(tapRace.result(over)).toEqual({
      scores: { a1: 1, a2: 1, b1: 1, b2: 1 },
      winners: [],
    });
  });

  it("the view shows the exact count only for your own team", () => {
    const state = tap(tap(tap(start(), "a1"), "a2"), "b1");
    expect(tapRace.view(state, "b2")).toEqual({
      role: "player",
      team: 1,
      ownCount: 1,
      standing: "behind",
      target: 3,
      endsAt: START + 20_000,
      ended: null,
    });
    expect(JSON.stringify(tapRace.view(state, "b2"))).not.toContain('"counts"');
  });

  it("spectators see both counts", () => {
    const state = tap(start(), "a1");
    expect(tapRace.view(state, "spectator")).toEqual({
      role: "spectator",
      counts: [1, 0],
      target: 3,
      endsAt: START + 20_000,
      ended: null,
    });
  });

  it("everyone sees both counts once the race is over", () => {
    const over = tapRace.onDeadline(tap(start(), "a1"), START + 20_000).state;
    expect(tapRace.view(over, "b1")).toMatchObject({ ended: { winningTeam: 0, counts: [1, 0] } });
  });

  it("a leaving player's taps stay with their team", () => {
    const state = tap(tap(start(), "a1"), "a1");
    const after = tapRace.onPlayerLeft(state, "a1").state;
    expect(after.counts).toEqual([2, 0]);
  });

  it("standings so far give each player their team's count, for a game ended early", () => {
    const state = tap(tap(start(), "a1"), "b1");
    expect(tapRace.standings?.(tap(state, "a2"))).toEqual({ a1: 2, a2: 2, b1: 1, b2: 1 });
  });

  it("the summary for the record keeps the team counts, the target and the winning team", () => {
    const state = tap(tap(start(), "a1"), "b1");
    expect(tapRace.recordSummary?.(state)).toEqual({
      counts: [1, 1],
      target: config.targetTaps,
      winningTeam: null,
    });
  });

  it("needs every seat to be on a team", () => {
    expect(() => tapRace.setup([{ id: "x", name: "X" }], config, 1, START)).toThrow(/team/);
  });
});
