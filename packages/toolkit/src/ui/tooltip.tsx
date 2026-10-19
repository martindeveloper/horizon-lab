"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "./utils";

/**
 * Supplemental visual label. The trigger still needs text or aria-label.
 * Shown on hover and keyboard focus, hoverable, and dismissed with Escape
 * until the pointer or focus leaves (WCAG 1.4.13). `align="start"` and `"end"`
 * anchor the tip to the trigger's left or right edge, for controls at that side
 * of the viewport. `side="top"` opens it above, for controls with a dock or panel
 * just below them.
 */
export function Tooltip({
  label,
  children,
  className,
  align = "center",
  side = "bottom",
  ...props
}: ComponentProps<"span"> & {
  label: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    const reset = () => setDismissed(false);
    el.addEventListener("keydown", onKey);
    el.addEventListener("pointerleave", reset);
    el.addEventListener("focusout", reset);
    return () => {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("pointerleave", reset);
      el.removeEventListener("focusout", reset);
    };
  }, []);

  return (
    <span
      ref={root}
      className={cn("hud-tip", className)}
      data-dismissed={dismissed || undefined}
      data-align={align === "center" ? undefined : align}
      data-side={side === "bottom" ? undefined : side}
      {...props}
    >
      {children}
      <span data-tip aria-hidden="true">
        {label}
      </span>
    </span>
  );
}
