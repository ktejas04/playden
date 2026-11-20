import type { Phase, SketchBattleView } from "../types";

/** From the 3-2-1 until the drawer's team guesses: pen, size and colour can be picked (SB28). */
const TOOL_PHASES: readonly Phase[] = [
  "countdown",
  "headStart",
  "drawing",
  "showdownCountdown",
  "showdown",
];

/** Whether this viewer gets the drawing toolbar. Drawing itself waits for the drawing to start. */
export function showsToolbar(view: SketchBattleView): boolean {
  if (view.me.role !== "drawer" || view.me.team === null) return false;
  return TOOL_PHASES.includes(view.phase) && view.teams[view.me.team].solvedAt === null;
}
