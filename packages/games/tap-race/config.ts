import { z } from "zod";
import type { TapRaceConfig } from "./types";

export const TEAM_COUNT = 2;

export const DEFAULT_CONFIG: TapRaceConfig = {
  targetTaps: 30,
  roundSeconds: 60,
};

export const configSchema = z.strictObject({
  targetTaps: z.number().int().min(5).max(200),
  roundSeconds: z.number().int().min(5).max(120),
});
