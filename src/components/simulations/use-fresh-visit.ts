"use client";

import { useEffect } from "react";
import type { StoreApi } from "zustand";

/**
 * A sub-app's lifecycle. Its store is a module, so it outlives the page; leaving the
 * simulation puts it back as it was first made, and every visit starts fresh: no guide still
 * running, no selection, panel or switch carried over. The view comes from the URL again on
 * the way in.
 */
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
