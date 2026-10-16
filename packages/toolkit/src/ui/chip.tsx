"use client";

import type { ComponentProps } from "react";

import { cn } from "./utils";

export type ChipProps = ComponentProps<"button"> & { selected?: boolean };

/** Pill choice or toggle; the selected chip lifts onto HUD glass. Supply `aria-pressed` or `role="switch"` with `aria-checked`. */
export function Chip({ selected = false, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-3 text-xs tracking-wide transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:h-8",
        selected ? "glass-hud font-medium text-fg" : "text-subtle hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}
