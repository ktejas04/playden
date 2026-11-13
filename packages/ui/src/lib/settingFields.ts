/**
 * Optional building blocks for a game's settings view (docs/design/rooms-and-games.md,
 * Settings). The platform doesn't use these: each game draws its own settings, of any shape,
 * through its `Settings` view. Games whose settings are a flat list of common controls can
 * describe them as fields and get a form from `SettingsForm` (components/settings.tsx).
 */

/** Anything with zod's safeParse; keeps this module free of zod itself. */
export interface ConfigSchema {
  safeParse(value: unknown): { success: boolean };
}

/** One common setting: a number with steps, a choice of a few values, or an on/off switch. */
export type SettingField = {
  key: string;
  label: string;
  /** One short line under the label, e.g. "First team to reach it wins". */
  hint?: string;
} & (
  | { kind: "number"; min: number; max: number; step: number; unit?: string }
  | { kind: "choice"; options: readonly { value: number | string; label: string }[] }
  | { kind: "toggle" }
);

/** A setting's current value in words, e.g. "60 s", "15 rounds", "On". */
export function settingText(field: SettingField, value: unknown): string {
  switch (field.kind) {
    case "number":
      return `${String(value)}${field.unit ? ` ${field.unit}` : ""}`;
    case "choice":
      return field.options.find((o) => o.value === value)?.label ?? String(value);
    case "toggle":
      return value === true ? "On" : "Off";
  }
}

/** The next value up or down for a number setting, kept within its range and steps. */
export function stepSetting(
  field: Extract<SettingField, { kind: "number" }>,
  value: number,
  direction: 1 | -1,
): number {
  return Math.min(field.max, Math.max(field.min, value + direction * field.step));
}

/**
 * What's wrong with a game's setting fields, checked against its config schema and defaults:
 * every key exists in the defaults, defaults are valid choices, and each field's limits are
 * exactly what the schema accepts. A game using fields calls this from its tests.
 */
export function settingProblems(
  fields: readonly SettingField[],
  defaults: unknown,
  schema: ConfigSchema,
): string[] {
  const problems: string[] = [];
  const base = (defaults ?? {}) as Record<string, unknown>;
  const accepts = (key: string, value: unknown) =>
    schema.safeParse({ ...base, [key]: value }).success;
  const seen = new Set<string>();

  for (const field of fields) {
    const { key } = field;
    if (seen.has(key)) problems.push(`setting "${key}" is listed twice`);
    seen.add(key);
    if (!(key in base)) {
      problems.push(`setting "${key}" isn't in defaultConfig`);
      continue;
    }
    const value = base[key];
    switch (field.kind) {
      case "number": {
        const { min, max, step } = field;
        if (typeof value !== "number" || value < min || value > max) {
          problems.push(`setting "${key}" default isn't within ${min}–${max}`);
        } else if ((value - min) % step !== 0) {
          problems.push(`setting "${key}" default isn't on a ${step} step from ${min}`);
        }
        if (!accepts(key, min) || !accepts(key, max)) {
          problems.push(`setting "${key}" range ${min}–${max} isn't all accepted by configSchema`);
        }
        if (accepts(key, min - step) || accepts(key, max + step)) {
          problems.push(`setting "${key}" range is narrower than configSchema allows`);
        }
        break;
      }
      case "choice":
        if (!field.options.some((o) => o.value === value)) {
          problems.push(`setting "${key}" default isn't one of its options`);
        }
        for (const option of field.options) {
          if (!accepts(key, option.value)) {
            problems.push(`setting "${key}" option ${String(option.value)} fails configSchema`);
          }
        }
        break;
      case "toggle":
        if (typeof value !== "boolean") problems.push(`setting "${key}" default isn't on/off`);
        if (!accepts(key, true) || !accepts(key, false)) {
          problems.push(`setting "${key}" isn't accepted as both on and off`);
        }
        break;
    }
  }
  return problems;
}
