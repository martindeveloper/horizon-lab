/** User and device media preferences. Safe to import on the server; reads need a browser. */

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** A mouse or trackpad: hover-driven effects such as parallax and tilt. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
/** A finger: larger targets, and a hint that the GPU may be mobile. */
export const COARSE_POINTER_QUERY = "(pointer: coarse)";
/** The theme's `md` width: room for a column beside the scene, a phone held sideways included. */
export const WIDE_QUERY = "(min-width: 48rem)";
/**
 * The desktop layout: wide and tall enough for side rails and docks (the theme's `md`),
 * a touch screen tablet-tall.
 */
export const WIDE_LAYOUT_QUERY = `${WIDE_QUERY} and (min-height: 30rem) and ((min-height: 40rem) or (not (pointer: coarse)))`;
/**
 * A phone: a coarse primary pointer on the touch layout, the inverse of `WIDE_LAYOUT_QUERY`.
 * Landscape and unfolded phones count; tablets and narrow desktop windows do not.
 */
export const PHONE_QUERY =
  "(pointer: coarse) and (max-width: 47.98rem), (pointer: coarse) and (max-height: 39.98rem)";
/** A screen that shows Display P3: wide colour can be offered. */
export const WIDE_GAMUT_QUERY = "(color-gamut: p3)";

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

/** A snapshot: whether the screen shows Display P3; false on the server. */
export function showsWideGamut() {
  return matches(WIDE_GAMUT_QUERY);
}
