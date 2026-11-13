import type { GameSession, GameStatus } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import { NO_GAME, clockOffset, reduceGame } from "../src/room/gameState";

const session: GameSession = {
  id: 1,
  phase: "playing",
  gameId: "tap-race",
  config: { targetTaps: 30 },
  players: [
    { id: "a", name: "Asha", team: 0, left: false },
    { id: "b", name: "Ben", team: 1, left: false },
  ],
  spectators: [],
  banned: [],
  startsAt: null,
  result: null,
  endedEarly: false,
};
const status = (fields: Partial<GameSession> | null): GameStatus => ({
  type: "game.status",
  session: fields === null ? null : { ...session, ...fields },
});
const playing = status({});
const view = { type: "game.view", view: { n: 2 } } as const;

describe("reduceGame", () => {
  it("keeps the latest status", () => {
    expect(reduceGame(NO_GAME, playing).status).toEqual(playing);
  });

  it("keeps this player's latest view through the game and its results", () => {
    let state = reduceGame(reduceGame(NO_GAME, playing), view);
    expect(state.view).toEqual({ n: 2 });
    state = reduceGame(state, status({ phase: "results" }));
    expect(state.view).toEqual({ n: 2 });
  });

  it("drops the view when the room is idle again or a new session sets up", () => {
    const withView = reduceGame(reduceGame(NO_GAME, playing), view);
    expect(reduceGame(withView, status(null)).view).toBeNull();
    expect(reduceGame(withView, status({ id: 2, phase: "setup" })).view).toBeNull();
  });

  it("numbers each batch of events, so the screen can react to every one", () => {
    let state = reduceGame(NO_GAME, { type: "game.events", events: [{ type: "won" }] });
    expect(state.events).toEqual({ id: 1, events: [{ type: "won" }] });
    state = reduceGame(state, { type: "game.events", events: [{ type: "won" }] });
    expect(state.events?.id).toBe(2);
  });
});

describe("deltas (D55)", () => {
  /** A game whose view is a counter and whose delta is the new count. */
  const applyDelta = () => (view: unknown, delta: unknown) => ({
    ...(view as object),
    ...(delta as object),
  });
  const numbered = { type: "game.view", view: { n: 0 }, epoch: "e1", seq: 4 } as const;
  const delta = (seq: number, n: number, epoch = "e1") =>
    ({ type: "game.delta", epoch, seq, delta: { n } }) as const;
  const started = reduceGame(reduceGame(NO_GAME, playing), numbered);

  it("applies deltas in order on top of the full view", () => {
    let state = reduceGame(started, delta(5, 1), applyDelta);
    state = reduceGame(state, delta(6, 2), applyDelta);
    expect(state.view).toEqual({ n: 2 });
    expect(state.needsResync).toBe(false);
  });

  it("a gap in the numbering asks for a resync and ignores deltas until the full view", () => {
    let state = reduceGame(started, delta(6, 2), applyDelta);
    expect(state.needsResync).toBe(true);
    expect(state.view).toEqual({ n: 0 });
    state = reduceGame(state, delta(7, 3), applyDelta);
    expect(state.view).toEqual({ n: 0 });

    state = reduceGame(state, { type: "game.view", view: { n: 3 }, epoch: "e1", seq: 7 });
    expect(state.needsResync).toBe(false);
    expect(reduceGame(state, delta(8, 4), applyDelta).view).toEqual({ n: 4 });
  });

  it("a delta from a room that reloaded (a new epoch) asks for a resync", () => {
    expect(reduceGame(started, delta(5, 1, "e2"), applyDelta).needsResync).toBe(true);
  });

  it("a delta with no view to apply to asks for a resync", () => {
    expect(reduceGame(reduceGame(NO_GAME, playing), delta(1, 1), applyDelta).needsResync).toBe(
      true,
    );
  });

  it("a game that can't apply deltas asks for a resync", () => {
    expect(reduceGame(started, delta(5, 1)).needsResync).toBe(true);
  });
});

describe("clockOffset", () => {
  it("is how far the server's clock is ahead, allowing for half the round trip", () => {
    // Sent at 1000, answered at server time 5100, received at 1200: 100 ms each way.
    expect(clockOffset(1000, 5100, 1200)).toBe(4000);
  });

  it("is negative when this device's clock runs ahead", () => {
    expect(clockOffset(9000, 5050, 9100)).toBe(-4000);
  });
});
