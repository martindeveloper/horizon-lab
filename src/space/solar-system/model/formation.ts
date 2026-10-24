/**
 * The Sun's formation, the last few hundred thousand years before the first solids: a dense
 * core of the natal cloud falls in under its own weight in one free-fall time (a uniform
 * sphere from rest, the cycloid), spinning up and flattening as it shrinks; a protostar lights
 * at the centre, embedded in dust and fed by its disk through the Class 0 phase, until the
 * first solids condense at the timeline's zero. A sketch in time: a real core falls inside out.
 */
import { clamp01 } from "@horizon/toolkit/math";

import { freeFallTime } from "./equations";
import { CORE_DENSITY_CM3, PROTOSTAR_BEFORE_SOLIDS, SUN_BIRTH } from "./parameters";

/** One free-fall time of the natal core, years. */
export const FREE_FALL = freeFallTime.compute({ n: CORE_DENSITY_CM3 });
/** The protostar lights, years ago. */
export const PROTOSTAR_LIT = SUN_BIRTH + PROTOSTAR_BEFORE_SOLIDS;
/** The core begins to fall, years ago. */
export const COLLAPSE_BEGINS = PROTOSTAR_LIT + FREE_FALL;
/** The core waits in view this long before it falls: half a free-fall time. */
export const CORE_WAIT = FREE_FALL / 2;
/** The formation plays out from here. */
export const FORMATION_BEGINS = COLLAPSE_BEGINS + CORE_WAIT;

/**
 * Radius over the starting radius of a uniform sphere falling from rest, `f` of a free-fall
 * time in: r/r₀ = cos²β, where t/t_ff = (2/π)(β + sin β cos β). Slow at first, then all at once.
 */
export function freeFallRadius(f: number) {
  if (f <= 0) return 1;
  if (f >= 1) return 0;
  /* β by bisection: the left side grows with β on [0, π/2]. */
  const target = (f * Math.PI) / 2;
  let lo = 0;
  let hi = Math.PI / 2;
  for (let k = 0; k < 40; k += 1) {
    const b = (lo + hi) / 2;
    if (b + Math.sin(b) * Math.cos(b) < target) lo = b;
    else hi = b;
  }
  const c = Math.cos((lo + hi) / 2);
  return c * c;
}

/** The core's radius over its own at rest: 1 until it falls, the cycloid to 0 as the protostar lights. */
export const coreRadius = (yearsAgo: number) =>
  freeFallRadius((COLLAPSE_BEGINS - yearsAgo) / FREE_FALL);

/** How far the protostar has come: 0 as it lights, 1 at the first solids and after. */
export const protostarPhase = (yearsAgo: number) =>
  clamp01((PROTOSTAR_LIT - yearsAgo) / PROTOSTAR_BEFORE_SOLIDS);

/** A star, forming or formed, sits at the centre. */
export const sunExists = (yearsAgo: number) => yearsAgo <= PROTOSTAR_LIT;
