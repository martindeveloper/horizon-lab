"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { afterMotion } from "./motion";
import { cn } from "./utils";

/**
 * The curtain over a scene while its drift gathers what it needs (its music, its timing): the
 * scene fades to black, a hairline horizon draws out and breathes, and the curtain lifts slowly
 * as the drift begins. It is opaque once drawn in, so the drift cuts its camera to the opening
 * shot behind it and the visitor sees that shot first, already in motion, as the black lifts.
 * It takes no pointer events, so the immersive controls stay in reach. `label` is read to
 * assistive technology; nothing is printed.
 */
export function DriftVeil({ active, label }: { active: boolean; label: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(active);
  if (active && !shown) setShown(true);
  useEffect(() => {
    if (active || !root.current) return;
    return afterMotion(root.current, () => setShown(false));
  }, [active]);
  if (!shown) return null;
  return (
    <div
      ref={root}
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
