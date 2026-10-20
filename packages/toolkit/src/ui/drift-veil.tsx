"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "./utils";

/** Milliseconds the veil takes to lift once the drift is ready, before it unmounts. */
const LIFT_MS = 900;

/**
 * The veil over a scene while its drift gathers what it needs (its music, its timing): the
 * scene dims, a hairline horizon draws out and breathes, and the veil lifts as the drift begins.
 * It takes no pointer events, so the immersive controls stay in reach. `label` is read to
 * assistive technology; nothing is printed.
 */
export function DriftVeil({ active, label }: { active: boolean; label: ReactNode }) {
  const [shown, setShown] = useState(active);
  if (active && !shown) setShown(true);
  useEffect(() => {
    if (active) return;
    const timeout = window.setTimeout(() => setShown(false), LIFT_MS);
    return () => window.clearTimeout(timeout);
  }, [active]);
  if (!shown) return null;
  return (
    <div
      className={cn(
        "drift-veil pointer-events-none absolute inset-0 z-10 flex items-center justify-center",
        active ? "drift-veil-in" : "drift-veil-out",
      )}
      role="status"
      aria-live="polite"
      aria-hidden={!active}
    >
      <span className="drift-veil-line" aria-hidden="true" />
      <span className="sr-only">{active ? label : null}</span>
    </div>
  );
}
