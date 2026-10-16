/** User and device media preferences. Safe to import on the server; reads need a browser. */

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** A mouse or trackpad: hover-driven effects such as parallax and tilt. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
/** A finger: larger targets, and a hint that the GPU may be mobile. */
export const COARSE_POINTER_QUERY = "(pointer: coarse)";

function matches(query: string) {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query).matches
    : false;
}

/**
 * A snapshot: false on the server. Code that runs for a long time should keep
 * `window.matchMedia(REDUCED_MOTION_QUERY)` and read `.matches` live instead.
 */
export function prefersReducedMotion() {
  return matches(REDUCED_MOTION_QUERY);
}
