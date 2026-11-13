import { cn } from "cn";
import { MinusIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@playden/ui/components/button";
import { Switch } from "@playden/ui/components/switch";
import { type SettingField, settingText, stepSetting } from "@playden/ui/lib/settingFields";

/**
 * Optional building blocks for a game's settings view. A game can use these rows and
 * controls, mix them with its own, or draw something else entirely; the platform only wraps
 * whatever the game's `Settings` view renders.
 */

/** One setting: its label and hint, with the control (or, read-only, the value) beside it. */
export function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function NumberSetting({
  field,
  value,
  canEdit,
  onChange,
}: {
  field: Extract<SettingField, { kind: "number" }>;
  value: number;
  canEdit: boolean;
  onChange: (value: number) => void;
}) {
  if (!canEdit)
    return <span className="font-medium tabular-nums">{settingText(field, value)}</span>;
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Less ${field.label.toLowerCase()}`}
        disabled={value <= field.min}
        onClick={() => onChange(stepSetting(field, value, -1))}
      >
        <MinusIcon />
      </Button>
      <span className="min-w-16 text-center font-medium tabular-nums" aria-live="polite">
        {settingText(field, value)}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label={`More ${field.label.toLowerCase()}`}
        disabled={value >= field.max}
        onClick={() => onChange(stepSetting(field, value, 1))}
      >
        <PlusIcon />
      </Button>
    </>
  );
}

export function ChoiceSetting({
  field,
  value,
  canEdit,
  onChange,
}: {
  field: Extract<SettingField, { kind: "choice" }>;
  value: number | string;
  canEdit: boolean;
  onChange: (value: number | string) => void;
}) {
  if (!canEdit) return <span className="font-medium">{settingText(field, value)}</span>;
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={field.label}>
      {field.options.map((option) => {
        const selected = option.value === value;
        return (
          <Button
            key={String(option.value)}
            size="sm"
            variant="outline"
            role="radio"
            aria-checked={selected}
            className={cn(selected && "border-primary bg-primary/15 hover:bg-primary/20")}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

export function ToggleSetting({
  field,
  value,
  canEdit,
  onChange,
}: {
  field: Extract<SettingField, { kind: "toggle" }>;
  value: boolean;
  canEdit: boolean;
  onChange: (value: boolean) => void;
}) {
  if (!canEdit) return <span className="font-medium">{settingText(field, value)}</span>;
  return <Switch checked={value} aria-label={field.label} onCheckedChange={onChange} />;
}

/**
 * A ready-made settings view for games whose settings are a flat list of common controls:
 * pass the fields, the config, and the props the room gave the game's `Settings` view.
 */
export function SettingsForm<Config extends object>({
  fields,
  config,
  canEdit,
  onChange,
}: {
  fields: readonly SettingField[];
  config: Config;
  canEdit: boolean;
  onChange: (next: Config) => void;
}) {
  const values = config as Record<string, unknown>;
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value });
  return (
    <div className="divide-y">
      {fields.map((field) => (
        <SettingRow key={field.key} label={field.label} hint={field.hint}>
          {field.kind === "number" ? (
            <NumberSetting
              field={field}
              value={values[field.key] as number}
              canEdit={canEdit}
              onChange={(v) => set(field.key, v)}
            />
          ) : field.kind === "choice" ? (
            <ChoiceSetting
              field={field}
              value={values[field.key] as number | string}
              canEdit={canEdit}
              onChange={(v) => set(field.key, v)}
            />
          ) : (
            <ToggleSetting
              field={field}
              value={values[field.key] === true}
              canEdit={canEdit}
              onChange={(v) => set(field.key, v)}
            />
          )}
        </SettingRow>
      ))}
    </div>
  );
}
