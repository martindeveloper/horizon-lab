/**
 * Earth's oceans under the brightening Sun, a model: the water begins to go once Earth's
 * sunlight reaches what the moist-greenhouse limit has today, where the stratosphere turns wet
 * and hydrogen escapes, and the seas are gone by the runaway-greenhouse limit, where they boil
 * into the air (Kasting, Whitmire & Reynolds 1993); between, the water goes evenly in the
 * logarithm of the sunlight. The globe blends from the measured map to the dry one by it, and
 * the ocean glint fades with it.
 */
import { clamp } from "@horizon/toolkit/math";

import { sunlightShare } from "./equations";
import { RGB_TIP, TODAY } from "./track";
import { standingAt } from "./worlds";

/** Today's Sun loses a world's water by a moist greenhouse within this distance (Kasting et al. 1993), au. */
export const WATER_LOSS_AU = 0.95;
/** Within this distance of today's Sun a world's oceans boil in a runaway greenhouse (Kasting et al. 1993), au. */
export const RUNAWAY_AU = 0.84;

const sunlightOnEarth = (age: number) => standingAt("earth", age).sunlight;
/** The first age from today at which Earth's sunlight reaches what a distance gets from today's Sun. */
function earthReaches(distanceAu: number) {
  const wanted = sunlightShare.compute({ L: 1, d: distanceAu });
  let lo = TODAY;
  let hi = RGB_TIP;
  for (let step = 0; step < 60; step += 1) {
    const mid = (lo + hi) / 2;
    if (sunlightOnEarth(mid) >= wanted) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Earth's oceans begin to go, and are gone. */
export const OCEANS_GOING = earthReaches(WATER_LOSS_AU);
export const EARTH_DRY = earthReaches(RUNAWAY_AU);
const WET = sunlightOnEarth(OCEANS_GOING);
const DRY = sunlightOnEarth(EARTH_DRY);

/** How far Earth's oceans have gone at an age, 0 (today's seas) to 1 (dry). */
export function earthDryness(age: number) {
  if (age <= OCEANS_GOING) return 0;
  if (age >= EARTH_DRY) return 1;
  return clamp(Math.log(sunlightOnEarth(age) / WET) / Math.log(DRY / WET), 0, 1);
}
