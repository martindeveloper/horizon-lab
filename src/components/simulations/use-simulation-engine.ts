"use client";

import { useEffect, useState } from "react";

import { startEngine, type StartEngine } from "@horizon/toolkit/rendering";

/** Feature adapters supply stable callbacks and retain ownership of their stores. */
export function useSimulationEngine(create: StartEngine, resetReady: () => void) {
  const [failure, setFailure] = useState<Error | null>(null);
  useEffect(() => {
    resetReady();
    const lifetime = startEngine(create, (error) => {
      setFailure(error instanceof Error ? error : new Error("Simulation rendering failed"));
    });
    return () => {
      try {
        lifetime.dispose();
      } finally {
        resetReady();
      }
    };
  }, [create, resetReady]);
  if (failure) throw failure;
}
