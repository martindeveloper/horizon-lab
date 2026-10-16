"use client";

import { useEffect } from "react";

import type { HorizonDebug } from "./console";
import { DebugCrash } from "./debug-crash";

declare global {
  interface Window {
    Horizon?: { Debug?: HorizonDebug };
  }
}

/** Installs `window.Horizon.Debug` after hydration; the console helpers load lazily. */
export function DebugTools() {
  useEffect(() => {
    let active = true;
    void import("./console").then(({ createDebug }) => {
      if (!active) return;
      window.Horizon = { ...window.Horizon, Debug: createDebug() };
    });
    return () => {
      active = false;
    };
  }, []);
  return <DebugCrash scope="root" />;
}
