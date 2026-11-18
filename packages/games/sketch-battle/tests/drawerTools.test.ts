import type { Seat } from "@playden/engine";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../config";
import { sketchBattle as game } from "../engine";
import type { SketchBattleState } from "../types";
import { showsToolbar } from "../view/drawerTools";

const seats: Seat[] = [
  { id: "asha", name: "Asha", team: 0 },
  { id: "ben", name: "Ben", team: 0 },
  { id: "dev", name: "Dev", team: 1 },
  { id: "esha", name: "Esha", team: 1 },
];
const START = 1_000_000;

function tick(state: SketchBattleState): SketchBattleState {
  const at = game.nextDeadline(state);
  if (at === null) throw new Error("No deadline");
  return game.onDeadline(state, at).state;
}

describe("the drawer's toolbar (SB28)", () => {
  const choosing = game.setup(seats, { ...DEFAULT_CONFIG, rounds: 5 }, 3, START);
  const counting = tick(choosing);
  const drawing = tick(counting);

  it("shows for both drawers from the 3-2-1, so they pick a colour and size before drawing", () => {
    expect(counting.phase).toBe("countdown");
    expect(showsToolbar(game.view(counting, "asha"))).toBe(true);
    expect(showsToolbar(game.view(counting, "dev"))).toBe(true);
    expect(showsToolbar(game.view(drawing, "asha"))).toBe(true);
  });

  it("not while the word is being chosen, nor for guessers or spectators", () => {
    expect(showsToolbar(game.view(choosing, "asha"))).toBe(false);
    expect(showsToolbar(game.view(counting, "ben"))).toBe(false);
    expect(showsToolbar(game.view(counting, "spectator"))).toBe(false);
  });

  it("goes once the drawer's team has guessed, and at the result", () => {
    const word = drawing.round?.word ?? "";
    const at = (drawing.phaseEndsAt ?? START) - 10_000;
    const solved = game.apply(drawing, "ben", { type: "guess", text: word }, at).state;
    expect(showsToolbar(game.view(solved, "asha"))).toBe(false);
    expect(showsToolbar(game.view(solved, "dev"))).toBe(true);
    expect(showsToolbar(game.view(tick(drawing), "asha"))).toBe(false);
  });
});
