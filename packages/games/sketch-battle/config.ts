import { z } from "zod";
import type { SketchBattleConfig } from "./types";

/** Every tunable number for Sketch Battle (spec section 17). Tune after game nights. */

export const TEAM_COUNT = 2;

export const ROUND_OPTIONS = [10, 15, 20, 25] as const;
export const DEFAULT_ROUNDS = 15;
export const ROUND_SECONDS_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120] as const;
export const DEFAULT_ROUND_SECONDS = 60;
export const DEFAULT_SHOW_WORD_LENGTHS = true;

export const WORD_CHOICES = 2;
export const CHOOSE_SECONDS = 15;
export const COUNTDOWN_SECONDS = 3;

export const HEAD_START_MIN_STREAK = 2;
export const HEAD_START_BASE_SECONDS = 3;
export const HEAD_START_PER_EXTRA_WIN_SECONDS = 1;
/** No cap until players ask for one. */
export const HEAD_START_MAX_SECONDS: number | null = null;

export const RESULT_SECONDS = 5;
export const FORCE_START_AFTER_SECONDS = 10;

export const FIRST_TEAM_POINTS = 200;
export const SECOND_TEAM_POINTS = 100;
export const SHOWDOWN_WORD_POINTS = 100;
export const SHOWDOWN_FINISH_BONUS = 100;
export const SHOWDOWN_INTRO_SECONDS = 10;
export const SHOWDOWN_COUNTDOWN_SECONDS = 3;
export const SHOWDOWN_HANDOFF_SECONDS = 2;

export const TEAM_MIN_PLAYERS = 2;
export const TEAM_MAX_PLAYERS = 8;
/** A round starts only when each team has this many connected players (SB12). */
export const MIN_CONNECTED_TO_START_ROUND = 2;

export const MAX_GUESS_LENGTH = 36;
/** At most GUESS_BURST guesses in any GUESS_WINDOW_MS, per player. */
export const GUESS_BURST = 3;
export const GUESS_WINDOW_MS = 3_000;

/** The drawer's phone sends a draw move at most this often while the pen moves (SB11). */
export const STROKE_BATCH_MS = 150;
/** Moves per connection: a fast dotting drawer can briefly send about 10 a second. */
export const STROKE_MOVE_LIMIT = { perSecond: 15, burst: 15 } as const;
/** Canvas units; the drawer's phone drops points closer than this to the last one. */
export const MIN_POINT_DISTANCE = 4;
/** Most coordinates (x and y each count) one draw move may carry. */
export const MAX_POINTS_PER_MOVE = 400;

export const CANVAS_WIDTH = 1500;
export const CANVAS_HEIGHT = 1000;
/** Brush sizes 1–4, as fractions of the canvas width. */
export const BRUSH_SIZES = [0.01, 0.02, 0.05, 0.1] as const;
export const PALETTE_SIZE = 10;

/** The other team's pixel view (SB6, D47). */
export const PREVIEW_COLS = 24;
export const PREVIEW_ROWS = 16;

/** Replays redraw one step every this many milliseconds. */
export const REPLAY_STEP_MS = 10;

export const DEFAULT_CONFIG: SketchBattleConfig = {
  rounds: DEFAULT_ROUNDS,
  roundSeconds: DEFAULT_ROUND_SECONDS,
  showWordLengths: DEFAULT_SHOW_WORD_LENGTHS,
};

const oneOf = (options: readonly number[], label: string) =>
  z
    .number()
    .int()
    .refine((n) => options.includes(n), `${label} must be one of ${options.join(", ")}`);

export const configSchema = z.strictObject({
  rounds: oneOf(ROUND_OPTIONS, "Rounds"),
  roundSeconds: oneOf(ROUND_SECONDS_OPTIONS, "Seconds per round"),
  showWordLengths: z.boolean(),
});
