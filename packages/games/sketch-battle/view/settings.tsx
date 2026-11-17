import type { GameSettingsProps } from "@playden/engine";
import { SettingsForm } from "@playden/ui/components/settings";
import type { SettingField } from "@playden/ui/lib/settingFields";
import {
  MAX_ROUNDS,
  MIN_ROUNDS,
  ROUND_SECONDS_MAX,
  ROUND_SECONDS_MIN,
  ROUND_SECONDS_STEP,
} from "../config";
import type { SketchBattleConfig } from "../types";

/** Sketch Battle's host settings (spec section 4): a flat list, so it uses the ready-made form. */
export const SKETCH_BATTLE_SETTINGS = [
  {
    key: "rounds",
    label: "Rounds",
    hint: "The showdown comes after the last one",
    kind: "number",
    min: MIN_ROUNDS,
    max: MAX_ROUNDS,
    step: 1,
    unit: "rounds",
  },
  {
    key: "roundSeconds",
    label: "Time per round",
    hint: "How long the drawers have to get their team there",
    kind: "number",
    min: ROUND_SECONDS_MIN,
    max: ROUND_SECONDS_MAX,
    step: ROUND_SECONDS_STEP,
    unit: "s",
  },
  {
    key: "showWordLengths",
    label: "Show word lengths",
    hint: "Guessers see a blank for each letter",
    kind: "toggle",
  },
] as const satisfies readonly SettingField[];

export function SketchBattleSettings(props: GameSettingsProps<SketchBattleConfig>) {
  return <SettingsForm fields={SKETCH_BATTLE_SETTINGS} {...props} />;
}
