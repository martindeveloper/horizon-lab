/**
 * The ship's speed regimes, by what the eye sees flowing past: the true speed through the
 * near body's frame times the time warp. Normal space up to light speed as seen; cruise, the
 * way between planets, to ten thousand times it; warp beyond, for the way between the stars
 * and the galaxies. Each has its own light (scene/speed-layer.ts, scene/cockpit.ts); the
 * boundaries blend over a third of a decade so nothing snaps.
 */
import { clamp } from "@horizon/toolkit/math";

import { C_KM_S } from "./parameters";

export type Regime = "normal" | "cruise" | "warp";

/** Seen speeds, km per real second, where cruise and warp begin. */
export const CRUISE_KM_S = C_KM_S;
export const WARP_KM_S = 1e4 * C_KM_S;
/** Decades of seen speed over which one regime's light gives way to the next. */
const BLEND_DECADES = 0.35;

export const regimeOf = (seenKmPerS: number): Regime =>
  seenKmPerS >= WARP_KM_S ? "warp" : seenKmPerS >= CRUISE_KM_S ? "cruise" : "normal";

/** How far into cruise (0…1) and into warp (0…1) the light has gone at a seen speed. */
export function regimeBlend(seenKmPerS: number) {
  const log = Math.log10(Math.max(1e-9, seenKmPerS));
  const into = (edge: number) => clamp((log - Math.log10(edge)) / BLEND_DECADES + 0.5, 0, 1);
  return { cruise: into(CRUISE_KM_S), warp: into(WARP_KM_S) };
}
