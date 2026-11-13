import { settingProblems } from "@playden/ui/lib/settingFields";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, configSchema } from "../config";
import { TAP_RACE_SETTINGS } from "../view/settings";

describe("Tap Race settings", () => {
  it("match the config schema and defaults exactly", () => {
    expect(settingProblems(TAP_RACE_SETTINGS, DEFAULT_CONFIG, configSchema)).toEqual([]);
  });
});
