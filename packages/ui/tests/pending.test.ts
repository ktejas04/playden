import { describe, expect, it } from "vitest";
import { addPending, settlePending } from "../src/lib/pending";

/** Guesses the server has confirmed, as the game's view lists them. */
type Confirmed = { by: string; text: string };
const mine = (item: string, c: Confirmed) => c.by === "me" && c.text === item;

describe("pending items (own moves shown faded until the server confirms them)", () => {
  it("shows a sent item until the server lists it, then drops it", () => {
    let pending = addPending([], "apple", { confirmedCount: 0, now: 0 });
    expect(pending.map((p) => p.item)).toEqual(["apple"]);
    pending = settlePending(pending, [], mine, { now: 100, timeoutMs: 5_000 });
    expect(pending).toHaveLength(1);
    pending = settlePending(pending, [{ by: "me", text: "apple" }], mine, {
      now: 200,
      timeoutMs: 5_000,
    });
    expect(pending).toEqual([]);
  });

  it("matches only items confirmed after it was sent, one each", () => {
    const confirmed = [{ by: "me", text: "apple" }];
    let pending = addPending([], "apple", { confirmedCount: 1, now: 0 });
    pending = addPending(pending, "apple", { confirmedCount: 1, now: 1 });
    pending = settlePending(pending, confirmed, mine, { now: 2, timeoutMs: 5_000 });
    expect(pending).toHaveLength(2);
    pending = settlePending(pending, [...confirmed, { by: "me", text: "apple" }], mine, {
      now: 3,
      timeoutMs: 5_000,
    });
    expect(pending).toHaveLength(1);
  });

  it("gives up on an item the server never confirmed (refused or lost)", () => {
    const pending = addPending([], "apple", { confirmedCount: 0, now: 0 });
    expect(settlePending(pending, [], mine, { now: 5_000, timeoutMs: 5_000 })).toEqual([]);
  });
});
