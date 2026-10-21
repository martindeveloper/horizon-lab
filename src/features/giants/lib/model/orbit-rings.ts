/**
 * The planets' orbits as they come and go: the hand-over's level (`hand-over.ts`) spread over
 * the rings, so they ripple out from the body one after another, each fading in as it grows
 * into place, and go again from the outside in.
 */
import { ORBIT_GROW, ORBIT_STAGGER } from "../parameters";
import { eased } from "./hand-over";

/** How much of ring `k` of `count` shows at a level, 0–1. */
export function ringShown(level: number, k: number, count: number) {
  const span = 1 - (count - 1) * ORBIT_STAGGER;
  return eased((level - k * ORBIT_STAGGER) / span);
}

/** A ring's drawn radius as it shows: it grows into its true size. */
export const ringRadius = (radius: number, shown: number) =>
  radius * (1 - ORBIT_GROW * (1 - shown));
