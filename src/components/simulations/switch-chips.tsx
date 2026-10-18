"use client";

import { SwitchChip, SwitchRow } from "@horizon/toolkit/ui";

/**
 * A scene's display switches: a wrapping row of switch chips where space is short (a dock),
 * or a list of switch rows in a panel.
 */
export function SwitchChips<Key extends string>({
  keys,
  values,
  label,
  onToggle,
  list = false,
}: {
  keys: readonly Key[];
  values: Readonly<Record<Key, boolean>>;
  label: (key: Key) => string;
  onToggle: (key: Key) => void;
  list?: boolean;
}) {
  if (list)
    return (
      <div className="-mx-3 grid gap-0.5">
        {keys.map((key) => (
          <SwitchRow key={key} on={values[key]} onToggle={() => onToggle(key)}>
            {label(key)}
          </SwitchRow>
        ))}
      </div>
    );
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((key) => (
        <SwitchChip key={key} on={values[key]} onToggle={() => onToggle(key)}>
          {label(key)}
        </SwitchChip>
      ))}
    </div>
  );
}
