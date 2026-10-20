import type { ComponentProps } from "react";

import { cn } from "./utils";

export type ActionVariant = "glass" | "solar" | "ghost";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 md:min-h-10";

const variants: Record<ActionVariant, string> = {
  glass: "glass-hud text-fg hover:text-accent hover:solar-ring",
  solar: "action-fill shadow-(--action-glow) hover:brightness-110",
  ghost: "text-muted hover:text-fg",
};

/** Class list for a text action, usable on `button`, `a`, or a router `Link`. */
export function actionClass(variant: ActionVariant = "glass", className?: string) {
  return cn(base, variants[variant], className);
}

export type ActionProps = ComponentProps<"button"> & { variant?: ActionVariant };

/** Native button carrying the shared text-action style. */
export function Action({ variant = "glass", className, type = "button", ...props }: ActionProps) {
  return <button type={type} className={actionClass(variant, className)} {...props} />;
}
