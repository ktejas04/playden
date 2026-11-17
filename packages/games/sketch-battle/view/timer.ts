import {
  CHOOSE_SECONDS,
  COUNTDOWN_SECONDS,
  FORCE_START_AFTER_SECONDS,
  RESULT_SECONDS,
} from "../config";
import type { SketchBattleView } from "../types";

/**
 * Whole seconds left, counted up (the last second shows 1, time's up shows 0). Capped at the
 * phase's length: a clock a little behind the server's must not show 4 at the start of a 3-2-1.
 */
export function secondsLeft(endsAt: number | null, now: number, cap: number | null): number | null {
  if (endsAt === null) return null;
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return cap === null ? left : Math.min(cap, left);
}

/** How long the current phase lasts, in seconds, when the view can tell. */
export function phaseLength(view: SketchBattleView): number | null {
  switch (view.phase) {
    case "choose":
      return CHOOSE_SECONDS;
    case "countdown":
      return COUNTDOWN_SECONDS;
    case "result":
      return RESULT_SECONDS;
    case "summary":
      return FORCE_START_AFTER_SECONDS;
    case "drawing": {
      const starts = view.teams.flatMap((team) => (team.drawFrom === null ? [] : [team.drawFrom]));
      if (view.phaseEndsAt === null || starts.length === 0) return null;
      return Math.round((view.phaseEndsAt - Math.max(...starts)) / 1000);
    }
    default:
      return null;
  }
}
