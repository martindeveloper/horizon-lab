/**
 * The universe's expansion as the ship's clocks run through it: the scale factor a at Earth's
 * time t since today (flat ΛCDM, Planck 2018), held where the scene can still draw it; the one
 * rule for what it moves (`expansionAt`: whatever lies beyond the Local Group recedes, what is
 * bound stays); the microwave background's temperature then; and how old the light from far
 * away is. The microwave background's shell, 45 billion light-years out today, is centred on
 * whoever looks and is never reached.
 */
import { CMB_LY, EVENT_HORIZON_LY, expansionFactor } from "@/space/cosmos/model/cosmos";
import {
  CMB_TEMPERATURE_K,
  LIGHT_YEAR_KM,
  UNITS,
  convert,
  cosmicAgeGyr,
  lookbackTimeGyr,
  redshiftAtComovingDistance,
  scaleFactorAtAge,
} from "@horizon/toolkit/science";

import { COSMIC_FAR_KM } from "./parameters";

/** Today's age in the same closed form the scale factor is read from, so a(0) is 1 exactly. */
const AGE_TODAY_GYR = cosmicAgeGyr(1);

/**
 * The largest scale factor drawn: from the farthest place the ship can stand (the edge, on the
 * event horizon) the far side of the expanded map, where the microwave background set out,
 * still lies inside the frustum's far plane (about 1.7, some fifteen billion years on). Past it
 * the map holds where it is and the background stays at its coolest; the clocks run on.
 */
export const MAX_SCALE_FACTOR = COSMIC_FAR_KM / ((CMB_LY + EVENT_HORIZON_LY) * LIGHT_YEAR_KM);

/** The scale factor at `t` seconds after today (1 today), held at `MAX_SCALE_FACTOR`. */
export const scaleFactorAt = (t: number) =>
  Math.min(
    MAX_SCALE_FACTOR,
    scaleFactorAtAge(Math.max(1e-6, AGE_TODAY_GYR + t / UNITS.Gyr.factor)),
  );

/**
 * The shared rule for what the expansion moves (`expansionFactor`), for a place `km` from the
 * Sun today: beyond the Local Group it recedes by a, within it it stays.
 */
export const expansionAt = (km: number, a: number) => expansionFactor(convert(km, "km", "Mly"), a);

/** Nearer than this the expansion does not matter: light's age is its distance, light-years. */
const NEARBY_LY = 1e8;

/**
 * How long the light reaching the ship from something `km` away (comoving) has been under
 * way, years. Nearby that is the distance in light-years; across the cosmic map it is the
 * lookback time of the redshift that comoving distance has in Planck 2018's ΛCDM, which is
 * less, the universe having been smaller while the light crossed it.
 */
export function lookbackYears(km: number) {
  const ly = km / LIGHT_YEAR_KM;
  if (ly < NEARBY_LY) return ly;
  const z = redshiftAtComovingDistance(convert(ly, "ly", "Mpc"));
  return lookbackTimeGyr(z) * 1e9;
}

/** The microwave background's temperature with the universe at scale `a`, kelvin: T₀ / a. */
export const cmbKelvin = (a: number) => CMB_TEMPERATURE_K / a;
