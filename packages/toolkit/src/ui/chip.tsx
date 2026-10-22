"use client";

import type { ComponentProps } from "react";

import { cn } from "./utils";

/**
 * The hairline outline an unmarked control keeps so it reads as a button beside plain labels:
 * it brightens, with a faint fill, under the pointer. Shared by chips and tile buttons.
 */
export const outlineClass =
  "text-fg-secondary ring-outline ring-border-strong ring-inset hover:bg-fg-primary/5 hover:text-fg-primary hover:ring-border-hover";

export type ChipProps = ComponentProps<"button"> & { selected?: boolean };

/**
 * Pill choice or toggle; the selected chip lifts onto HUD glass, the others keep a hairline
 * outline so they read as buttons beside a plain label. Supply `aria-pressed` or
 * `role="switch"` with `aria-checked`.
 */
export function Chip({ selected = false, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-3 text-ui tracking-wide transition-colors duration-feedback ease-standard focus-visible:ring-focus focus-visible:ring-ring focus-visible:outline-hidden md:h-8",
        selected ? "glass-hud font-medium text-fg-primary" : outlineClass,
        className,
      )}
      {...props}
    />
  );
}
