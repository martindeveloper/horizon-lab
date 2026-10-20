"use client";

import { useEffect, useState } from "react";

import { onCrash, type CrashScope } from "@/lib/debug";

class DebugCrashError extends Error {
  constructor(scope: CrashScope) {
    super(`Horizon.Debug crash (${scope})`);
    this.name = "DebugCrashError";
  }
}

/**
 * Renders nothing until `Horizon.Debug.crash()` asks it to throw. A route crash
 * sits inside the route error boundary (the 500 page); a root crash sits in the
 * shell and reaches the global error page. "Try again" remounts it clean.
 */
export function DebugCrash({ scope }: { scope: CrashScope }) {
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => onCrash(scope, () => setError(new DebugCrashError(scope))), [scope]);
  if (error) throw error;
  return null;
}
