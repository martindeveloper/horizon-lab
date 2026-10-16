import type { ComponentProps } from "react";

import { cn } from "./utils";

export type SurfaceProps = ComponentProps<"div"> & {
  variant?: "glass" | "panel" | "pill" | "hud" | "popover" | "lesson";
};

const variants = {
  glass: "glass",
  panel: "glass-panel",
  pill: "glass-pill",
  hud: "glass-hud",
  popover: "glass-popover",
  lesson: "lesson-card",
};

/** Material only. Consumers choose geometry, padding, positioning and semantics. */
export function Surface({ variant = "panel", className, ...props }: SurfaceProps) {
  return <div className={cn(variants[variant], className)} {...props} />;
}
