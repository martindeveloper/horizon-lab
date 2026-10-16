"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "./utils";

/**
 * Supplemental visual label. The trigger still needs text or aria-label.
 * Shown on hover and keyboard focus, hoverable, and dismissed with Escape
 * until the pointer or focus leaves (WCAG 1.4.13). `align="end"` anchors the
 * tip to the trigger's right edge, for controls at the right of the viewport.
 */
export function Tooltip({
  label,
  children,
  className,
  align = "center",
  ...props
}: ComponentProps<"span"> & { label: ReactNode; align?: "center" | "end" }) {
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
      data-align={align === "end" ? align : undefined}
      {...props}
    >
      {children}
      <span data-tip aria-hidden="true">
        {label}
      </span>
    </span>
  );
}
