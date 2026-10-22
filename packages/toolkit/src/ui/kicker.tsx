import type { ComponentProps } from "react";

import { cn } from "./utils";

export const kickerClass = "font-mono text-ui tracking-label text-fg-tertiary uppercase";

export type KickerProps = ComponentProps<"p"> & { size?: "default" | "compact" };

/** Mono uppercase label above a title, section, or readout group. Use `kickerClass` on other elements. */
export function Kicker({ size = "default", className, ...props }: KickerProps) {
  return (
    <p
      className={cn(kickerClass, size === "compact" && "text-micro tracking-instrument", className)}
      {...props}
    />
  );
}
