import { describe, expect, it } from "vitest";
import {
  CHOOSE_SECONDS,
  COUNTDOWN_SECONDS,
  FORCE_START_AFTER_SECONDS,
  RESULT_SECONDS,
} from "../config";
import type { SketchBattleView } from "../types";
import { phaseLength, secondsLeft } from "../view/timer";

const END = 100_000;

function viewIn(
  phase: SketchBattleView["phase"],
  drawFrom: number | null = null,
): SketchBattleView {
  const team = { drawFrom } as SketchBattleView["teams"][0];
  return { phase, phaseEndsAt: END, teams: [team, team] } as SketchBattleView;
}

describe("timers", () => {
  it("counts whole seconds up, so the last second shows 1 and time's up shows 0", () => {
    expect(secondsLeft(END, END - 2_500, null)).toBe(3);
    expect(secondsLeft(END, END - 1, null)).toBe(1);
    expect(secondsLeft(END, END, null)).toBe(0);
    expect(secondsLeft(END, END + 500, null)).toBe(0);
    expect(secondsLeft(null, END, null)).toBeNull();
  });

  it("never shows more than the phase lasts, even with a clock a little behind the server", () => {
    // A clock 200 ms behind sees 3.2 s left at the start of the 3 s countdown: show 3, not 4.
    expect(secondsLeft(END, END - 3_200, COUNTDOWN_SECONDS)).toBe(3);
    expect(secondsLeft(END, END - 15_100, CHOOSE_SECONDS)).toBe(15);
  });

  it("knows each phase's length from the view", () => {
    expect(phaseLength(viewIn("choose"))).toBe(CHOOSE_SECONDS);
    expect(phaseLength(viewIn("countdown"))).toBe(COUNTDOWN_SECONDS);
    expect(phaseLength(viewIn("result"))).toBe(RESULT_SECONDS);
    expect(phaseLength(viewIn("drawing", END - 60_000))).toBe(60);
    expect(phaseLength(viewIn("drawing"))).toBeNull();
    expect(phaseLength(viewIn("summary"))).toBe(FORCE_START_AFTER_SECONDS);
    expect(phaseLength(viewIn("ended"))).toBeNull();
  });
});
