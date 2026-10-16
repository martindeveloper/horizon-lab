"use client";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "./utils";

/** Fade a supplied loading screen away after the consumer reports its first frame. */
export function LoadingOverlay({
  ready,
  children,
  exitDelayMs = 560,
}: {
  ready: boolean;
  children: ReactNode;
  exitDelayMs?: number;
}) {
  const [mounted, setMounted] = useState(true);
  const [previousReady, setPreviousReady] = useState(ready);
  if (previousReady !== ready) {
    setPreviousReady(ready);
    if (!ready) setMounted(true);
  }
  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => setMounted(false), exitDelayMs);
    return () => window.clearTimeout(timeout);
  }, [ready, exitDelayMs]);
  if (!mounted) return null;
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 bg-space transition-opacity duration-500 ease-out",
        ready ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      aria-hidden={ready}
    >
      {children}
    </div>
  );
}
