import type { ComponentProps } from "react";

import { cn } from "./utils";

export const kickerClass = "font-mono text-xs tracking-widest text-subtle uppercase";

/** Mono uppercase label above a title, section, or readout group. Use `kickerClass` on other elements. */
export function Kicker({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn(kickerClass, className)} {...props} />;
}
