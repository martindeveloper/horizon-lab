"use client";

import type { ComponentProps } from "react";

import { Chip, cn } from "@horizon/toolkit/ui";

/** One on/off chip for a scene switch: a gold pip for on, an empty ring for off. */
export function SwitchChip({
  on,
  onToggle,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Chip>, "role" | "selected" | "onClick" | "aria-checked"> & {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <Chip
      {...props}
      role="switch"
      aria-checked={on}
      selected={on}
      onClick={onToggle}
      className={cn("gap-1.5", className)}
    >
      {/* The state reads without the glass. */}
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full transition-colors duration-300",
          on ? "bg-accent" : "border border-current opacity-60",
        )}
      />
      {children}
    </Chip>
  );
}

/** A row of switch chips for a scene's display switches. */
export function SwitchChips<Key extends string>({
  keys,
  values,
  label,
  onToggle,
}: {
  keys: readonly Key[];
  values: Readonly<Record<Key, boolean>>;
  label: (key: Key) => string;
  onToggle: (key: Key) => void;
}) {
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
