/**
 * Flight assist for a ship flown by hand. Space is too big for real time and too varied for
 * one time warp, so the clocks run at a warp of their own that grows with the square root of
 * the ship's height above the nearest surface: a full burn from rest then always carries the
 * ship the same share of that height in the same few seconds, beside a moon or between the
 * stars, and the warp eases off on its own as a surface comes up. Every drive manoeuvres at
 * one g; the coasting drives cap the speed at their cruise.
 */
import { clamp } from "@horizon/toolkit/math";

import { STANDARD_GRAVITY_KM_S2 } from "./parameters";

/** A full burn from rest covers this share of the ship's height in `REACH_S` real seconds. */
const REACH_SHARE = 0.08;
const REACH_S = 2;
/** Below this height, km, the warp falls no further; and the most it ever runs. */
const LOWEST_KM = 50;
const MOST_ASSIST = 3.2e10;

/** The thrusters every drive manoeuvres with, km/s² as the crew feels it: one g. */
export const MANOEUVRE_ACCEL = STANDARD_GRAVITY_KM_S2;

/** Ship seconds per real second at `heightKm` above the nearest surface: ½ a (w t)² = share · h. */
export function assistWarp(heightKm: number, accel = MANOEUVRE_ACCEL) {
  const h = Math.max(LOWEST_KM, heightKm);
  return clamp(Math.sqrt((2 * REACH_SHARE * h) / accel) / REACH_S, 1, MOST_ASSIST);
}
