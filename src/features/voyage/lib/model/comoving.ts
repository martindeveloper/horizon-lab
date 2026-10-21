/**
 * The universe's expansion as the ship's clocks run through it: the scale factor a at Earth's
 * time t since today (flat ΛCDM, Planck 2018), the microwave background's temperature then,
 * and the edge of what can ever be reached. The cosmic map is drawn in comoving coordinates
 * scaled by a, so galaxies recede as the clocks run; the microwave background's shell, 45
 * billion light-years out today, is centred on whoever looks and is never reached.
 */
import { CMB_KELVIN, CMB_MLY } from "@/space/cosmos/model/cosmos";
import {
  LIGHT_YEAR_KM,
  PLANCK_2018,
  SPEED_OF_LIGHT,
  convert,
  cosmicAgeGyr,
  lookbackTimeGyr,
  redshiftAtComovingDistance,
  scaleFactorAtAge,
} from "@horizon/toolkit/science";

const GYR_S = 1e9 * 365.25 * 86_400;
/** Today's age in the same closed form the scale factor is read from, so a(0) is 1 exactly. */
const AGE_TODAY_GYR = cosmicAgeGyr(1);

/** The scale factor at `t` seconds after today (1 today). */
export const scaleFactorAt = (t: number) =>
  scaleFactorAtAge(Math.max(1e-6, AGE_TODAY_GYR + t / GYR_S));

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

/** The microwave background's temperature at `t` seconds after today, kelvin: T₀ / a. */
export const cmbKelvinAt = (t: number) => CMB_KELVIN / scaleFactorAt(t);

/** Today's comoving distance to where the microwave background set out, light-years. */
export const CMB_LY = CMB_MLY * 1e6;

/**
 * The cosmic event horizon, light-years comoving: nothing farther today can ever be reached,
 * even at light speed, as dark energy carries it away. It is c/H₀ ∫₁^∞ da / (a² E(a)) in
 * Planck 2018's flat ΛCDM (about 16.6 billion light-years), integrated here in x = 1/a. The
 * "edge" place parks the ship there, with the microwave background as far away as at home.
 */
export const EDGE_LY = (() => {
  const { H0, omegaM, omegaR } = PLANCK_2018;
  const omegaL = 1 - omegaM - omegaR;
  /* E(1/x) in x: the integrand dx / E over 0..1, Simpson's rule. */
  const f = (x: number) => 1 / Math.sqrt(omegaR * x ** 4 + omegaM * x ** 3 + omegaL);
  const n = 400;
  const h = 1 / n;
  let sum = f(0) + f(1);
  for (let i = 1; i < n; i += 1) sum += (i % 2 ? 4 : 2) * f(i * h);
  const integral = (sum * h) / 3;
  return convert((SPEED_OF_LIGHT / 1e3 / H0) * integral, "Mpc", "ly");
})();
