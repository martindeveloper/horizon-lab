"use client";

import { useEffect } from "react";
import type { StoreApi } from "zustand";

/** Module-level stores outlive the page; reset on exit so the next visit starts fresh. */
export function freshVisit<T>(store: Pick<StoreApi<T>, "getInitialState" | "setState">) {
  return () => store.setState(store.getInitialState(), true);
}

/**
 * Resets the store (`freshVisit`) when the simulation closes. Call it from the component its
 * layout keeps mounted across the simulation's own views, so moving between them keeps state.
 */
export function useFreshVisit(reset: () => void) {
  useEffect(() => reset, [reset]);
}
