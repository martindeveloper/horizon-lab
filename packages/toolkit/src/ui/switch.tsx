"use client";

import type { ComponentProps, ReactNode } from "react";

import { Chip } from "./chip";
import { ListItem } from "./list-item";
import { cn } from "./utils";

/**
 * The on/off mark every switch shows: a small track whose knob slides right and turns the
 * track to the action colour when on (gold in the dark, ink in light). Visual only (aria-hidden); the control around it carries `role="switch"`
 * and `aria-checked`. `sm` fits a chip.
 */
export function SwitchMark({ on, size = "md" }: { on: boolean; size?: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <span
      aria-hidden
      className={cn(
        "relative shrink-0 rounded-full transition-colors duration-control ease-standard",
        small ? "h-3 w-5" : "h-4 w-7",
        on ? "bg-action" : "bg-fg/15",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 rounded-full transition-[translate,background-color] duration-control ease-standard",
          small ? "size-2" : "size-3",
          on ? cn("bg-action-fg", small ? "translate-x-2" : "translate-x-3") : "bg-fg/60",
        )}
      />
    </span>
  );
}

type SwitchProps = { on: boolean; onToggle: () => void; children: ReactNode };

/** A switch as a panel row: its name, and the mark at the end of the row. */
export function SwitchRow({
  on,
  onToggle,
  children,
  className,
  ...props
}: SwitchProps & Omit<ComponentProps<"button">, "role" | "onClick" | "aria-checked" | "children">) {
  return (
    <ListItem
      {...props}
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(!on && "text-muted", className)}
    >
      <span className="min-w-0 truncate">{children}</span>
      <SwitchMark on={on} />
    </ListItem>
  );
}

/** A switch as a pill, where a row has no room (a dock): the mark, then its name. */
export function SwitchChip({
  on,
  onToggle,
  children,
  className,
  ...props
}: SwitchProps & Omit<ComponentProps<"button">, "role" | "onClick" | "aria-checked" | "children">) {
  return (
    <Chip
      {...props}
      role="switch"
      aria-checked={on}
      selected={on}
      onClick={onToggle}
      className={cn("gap-2", className)}
    >
      <SwitchMark on={on} size="sm" />
      {children}
    </Chip>
  );
}
