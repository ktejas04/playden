import type { GameSettingsProps } from "@playden/engine";
import { SettingsForm } from "@playden/ui/components/settings";
import type { SettingField } from "@playden/ui/lib/settingFields";
import type { TapRaceConfig } from "../types";

/** Tap Race's settings: a flat list, so it uses the ready-made form. */
export const TAP_RACE_SETTINGS = [
  {
    key: "targetTaps",
    label: "Taps to win",
    hint: "The first team to reach it wins",
    kind: "number",
    min: 5,
    max: 200,
    step: 5,
    unit: "taps",
  },
  {
    key: "roundSeconds",
    label: "Round length",
    hint: "If nobody reaches the target, the higher count wins",
    kind: "number",
    min: 5,
    max: 120,
    step: 5,
    unit: "s",
  },
] as const satisfies readonly SettingField[];

export function TapRaceSettings(props: GameSettingsProps<TapRaceConfig>) {
  return <SettingsForm fields={TAP_RACE_SETTINGS} {...props} />;
}
