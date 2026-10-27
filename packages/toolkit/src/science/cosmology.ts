import {
  BOLTZMANN_CONSTANT,
  CMB_TEMPERATURE_K,
  GRAVITATIONAL_CONSTANT,
  PLANCK_CONSTANT,
  SPEED_OF_LIGHT,
} from "./constants";
import { convert } from "./units";

/**
 * A flat ΛCDM universe: the Hubble constant (km/s/Mpc), the matter density Ωm and, optionally,
 * radiation Ωr; Ω_Λ = 1 − Ωm − Ωr. Distances, ages and lookback times integrate with
 * radiation; only the closed forms `cosmicAgeGyr` and `scaleFactorAtAge` leave it out, which
 * makes every age about 5.6 million years older with Planck's values.
 */
export type FlatLcdm = { H0: number; omegaM: number; omegaR?: number };

/** Three massless neutrino species add 3 × 7/8 × (4/11)^(4/3) of the photons' density. */
const NEUTRINO_SHARE = 3 * (7 / 8) * (4 / 11) ** (4 / 3);

/**
 * The radiation density parameter Ωr h² of a background at temperature `T` (K): the photons'
 * energy density a T⁴ / c² against the critical density at H₀ = 100 km/s/Mpc, with three
 * massless neutrino species beside them (4.18 × 10⁻⁵ at the CMB's temperature).
 */
export function radiationDensity(T: number) {
  const radiationConstant =
    (8 * Math.PI ** 5 * BOLTZMANN_CONSTANT ** 4) /
    (15 * PLANCK_CONSTANT ** 3 * SPEED_OF_LIGHT ** 3);
  const photons = (radiationConstant * T ** 4) / SPEED_OF_LIGHT ** 2;
  const H100 = convert(100, "km/s/Mpc", "Hz");
  const critical = (3 * H100 ** 2) / (8 * Math.PI * GRAVITATIONAL_CONSTANT);
  return (photons / critical) * (1 + NEUTRINO_SHARE);
}

/**
 * Planck 2018 VI, TT,TE,EE+lowE+lensing+BAO (Planck Collaboration 2020, A&A 641, A6, Table 2).
 * Ωr: photons at the CMB's temperature and three massless neutrino species (`radiationDensity`).
 */
export const PLANCK_2018 = {
  H0: 67.66,
  omegaM: 0.3111,
  omegaR: radiationDensity(CMB_TEMPERATURE_K) / 0.6766 ** 2,
} as const satisfies FlatLcdm;

/** The Hubble time 1/H₀ in Gyr (977.79 / H₀ for H₀ in km/s/Mpc). */
export const hubbleTimeGyr = (H0: number) => convert(1 / convert(H0, "km/s/Mpc", "Hz"), "s", "Gyr");

function shape({ H0, omegaM }: FlatLcdm) {
  const omegaL = 1 - omegaM;
  return {
    /** t(a) = (2 / 3√Ω_Λ) / H₀ · asinh(√(Ω_Λ/Ωm) a^1.5) */
    factor: (2 / (3 * Math.sqrt(omegaL))) * hubbleTimeGyr(H0),
    ratio: Math.sqrt(omegaL / omegaM),
  };
}

/**
 * Age (Gyr) of a flat matter + Λ universe when its scale factor was `a` (1 today): a closed
 * form without radiation (see `cosmicAgeAtRedshiftGyr` for the age with it).
 */
export function cosmicAgeGyr(a: number, model: FlatLcdm = PLANCK_2018) {
  if (model.omegaM === 1) return (2 / 3) * hubbleTimeGyr(model.H0) * a ** 1.5;
  const { factor, ratio } = shape(model);
  return factor * Math.asinh(ratio * a ** 1.5);
}

/** Scale factor a of a flat ΛCDM universe at an age in Gyr: the inverse of `cosmicAgeGyr`. */
export function scaleFactorAtAge(ageGyr: number, model: FlatLcdm = PLANCK_2018) {
  if (model.omegaM === 1) return ((1.5 * ageGyr) / hubbleTimeGyr(model.H0)) ** (2 / 3);
  const { factor, ratio } = shape(model);
  return (Math.sinh(ageGyr / factor) / ratio) ** (2 / 3);
}

/** Steps of the Simpson rule the distances integrate with: below a part in 10⁶ at any z. */
const COMOVING_STEPS = 256;

/**
 * Comoving distance (Mpc) to redshift z in a flat ΛCDM universe: (c / H₀) ∫ da / (a² E(a)),
 * integrated over u = √a, where 2u / √(Ωr + Ωm u² + Ω_Λ u⁸) stays smooth back to the Big Bang
 * (z = Infinity gives the particle horizon).
 */
export function comovingDistanceMpc(z: number, model: FlatLcdm = PLANCK_2018) {
  const { H0, omegaM, omegaR = 0 } = model;
  const omegaL = 1 - omegaM - omegaR;
  const integrand = (u: number) =>
    u === 0
      ? omegaR > 0
        ? 0
        : 2 / Math.sqrt(omegaM)
      : (2 * u) / Math.sqrt(omegaR + omegaM * u * u + omegaL * u ** 8);
  return (convert(1, "c", "km/s") / H0) * simpson(integrand, Math.sqrt(1 / (1 + z)), 1);
}

/** Simpson's rule over `from`–`to` in `COMOVING_STEPS` steps. */
function simpson(f: (x: number) => number, from: number, to: number) {
  const h = (to - from) / COMOVING_STEPS;
  let sum = f(from) + f(to);
  for (let i = 1; i < COMOVING_STEPS; i += 1) sum += (i % 2 ? 4 : 2) * f(from + i * h);
  return (sum * h) / 3;
}

/* Each model's horizon, once: `redshiftAtComovingDistance` asks for it on every call. */
const particleHorizons = new WeakMap<FlatLcdm, number>();

/** Today's distance (Mpc) to the edge of the observable universe: light since the Big Bang. */
export function particleHorizonMpc(model: FlatLcdm = PLANCK_2018) {
  let mpc = particleHorizons.get(model);
  if (mpc === undefined) {
    mpc = comovingDistanceMpc(Number.POSITIVE_INFINITY, model);
    particleHorizons.set(model, mpc);
  }
  return mpc;
}

/**
 * Today's distance (Mpc) to the cosmic event horizon: the farthest place light sent today can
 * ever reach, as dark energy carries everything beyond away, (c / H₀) ∫₁^∞ da / (a² E(a)),
 * integrated in x = 1/a. About 5.1 Gpc (16.6 billion light-years) in Planck 2018's model.
 */
export function eventHorizonMpc(model: FlatLcdm = PLANCK_2018) {
  const { H0, omegaM, omegaR = 0 } = model;
  const omegaL = 1 - omegaM - omegaR;
  const integrand = (x: number) => 1 / Math.sqrt(omegaR * x ** 4 + omegaM * x ** 3 + omegaL);
  return (convert(1, "c", "km/s") / H0) * simpson(integrand, 0, 1);
}

/**
 * Redshift of a source at today's (comoving) distance `mpc`: the inverse of
 * `comovingDistanceMpc`, by bisection in ln(1 + z). Infinity at or past the particle horizon.
 */
export function redshiftAtComovingDistance(mpc: number, model: FlatLcdm = PLANCK_2018) {
  if (!(mpc > 0)) return 0;
  if (mpc >= particleHorizonMpc(model)) return Number.POSITIVE_INFINITY;
  return invertRedshift(mpc, (z) => comovingDistanceMpc(z, model));
}

function invertRedshift(target: number, valueAt: (z: number) => number) {
  let lo = 0;
  let hi = Math.log(1e6);
  const limit = Math.log(Number.MAX_VALUE);
  // Expand the bracket for early sources instead of silently returning the initial ceiling.
  while (hi < limit && valueAt(Math.expm1(hi)) < target) {
    lo = hi;
    hi = Math.min(2 * hi, limit);
  }
  for (let i = 0; i < 64; i += 1) {
    const mid = (lo + hi) / 2;
    if (valueAt(Math.expm1(mid)) < target) lo = mid;
    else hi = mid;
  }
  return Math.expm1((lo + hi) / 2);
}

/**
 * Redshift of light that set out `gyr` billion years ago: the inverse of `lookbackTimeGyr`, by
 * bisection in ln(1 + z). Infinity at or past the age of the universe.
 */
export function redshiftAtLookback(gyr: number, model: FlatLcdm = PLANCK_2018) {
  if (!(gyr > 0)) return 0;
  if (gyr >= cosmicAgeAtRedshiftGyr(0, model)) return Number.POSITIVE_INFINITY;
  return invertRedshift(gyr, (z) => lookbackTimeGyr(z, model));
}

/** How long ago (Gyr) light now arriving from redshift z set out, with radiation. */
export function lookbackTimeGyr(z: number, model: FlatLcdm = PLANCK_2018) {
  return z > 0 ? cosmicAgeAtRedshiftGyr(0, model) - cosmicAgeAtRedshiftGyr(z, model) : 0;
}

/**
 * Age (Gyr) of the universe at redshift z, with radiation: (1 / H₀) ∫₀ᵃ a′ da′ / √(Ωr + Ωm a′
 * + Ω_Λ a′⁴); 13.787 Gyr today with Planck's values. At the cosmic microwave background
 * (z ≈ 1090) it gives the familiar ~0.37 million years.
 */
export function cosmicAgeAtRedshiftGyr(z: number, model: FlatLcdm = PLANCK_2018) {
  const { H0, omegaM, omegaR = 0 } = model;
  const omegaL = 1 - omegaM - omegaR;
  const a = 1 / (1 + z);
  const integrand = (x: number) => x / Math.sqrt(omegaR + omegaM * x + omegaL * x ** 4);
  /* Over u = √x the integrand stays smooth where radiation hands over to matter. */
  const inU = (u: number) => (u === 0 ? 0 : 2 * u * integrand(u * u));
  const top = Math.sqrt(a);
  const h = top / COMOVING_STEPS;
  let sum = inU(0) + inU(top);
  for (let i = 1; i < COMOVING_STEPS; i += 1) sum += (i % 2 ? 4 : 2) * inU(i * h);
  return hubbleTimeGyr(H0) * ((sum * h) / 3);
}
