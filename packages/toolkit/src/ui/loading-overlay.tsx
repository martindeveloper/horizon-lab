"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { afterMotion } from "./motion";
import { cn } from "./utils";

/** Fade a supplied loading screen away after the consumer reports its first frame. */
export function LoadingOverlay({
  ready,
  children,
  exitDelayMs,
}: {
  ready: boolean;
  children: ReactNode;
  /** Optional minimum hold after readiness. The fade always finishes before removal. */
  exitDelayMs?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(true);
  const [previousReady, setPreviousReady] = useState(ready);
  if (previousReady !== ready) {
    setPreviousReady(ready);
    if (!ready) setMounted(true);
  }
  useEffect(() => {
    if (!ready || !root.current) return;
    return afterMotion(root.current, () => setMounted(false), exitDelayMs);
  }, [ready, exitDelayMs]);
  if (!mounted) return null;
  return (
    <div
      ref={root}
      className={cn(
        "absolute inset-0 z-20 bg-space transition-opacity duration-reveal ease-enter",
        ready ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      aria-hidden={ready}
    >
      {children}
    </div>
  );
}
