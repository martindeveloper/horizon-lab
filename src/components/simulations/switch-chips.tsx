"use client";

import { SwitchChip, SwitchRow } from "@horizon/toolkit/ui";

import { SwitchGroup } from "./rail";

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
      <SwitchGroup>
        {keys.map((key) => (
          <SwitchRow key={key} on={values[key]} onToggle={() => onToggle(key)}>
            {label(key)}
          </SwitchRow>
        ))}
      </SwitchGroup>
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
