import type { ComponentProps } from "react";

import { cn } from "./utils";

export type ActionVariant = "glass" | "solar" | "ghost";

const base =
  "ui-focus ui-disabled inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-body/5 font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform,filter] duration-control ease-standard md:min-h-10";

const variants: Record<ActionVariant, string> = {
  glass: "ui-glass glass-hud text-fg-primary",
  solar: "ui-filled action-fill shadow-(--action-glow)",
  ghost: "ui-quiet ui-press text-fg-secondary",
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
