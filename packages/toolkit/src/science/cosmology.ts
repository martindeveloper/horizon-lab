import { convert } from "./units";

/**
 * A flat ΛCDM universe: the Hubble constant (km/s/Mpc), the matter density Ωm and, optionally,
 * radiation Ωr; Ω_Λ = 1 − Ωm − Ωr. Radiation enters distances only: it changes the age by
 * well under a million years, so the age formulas leave it out.
 */
export type FlatLcdm = { H0: number; omegaM: number; omegaR?: number };

/**
 * Planck 2018 VI, TT,TE,EE+lowE+lensing+BAO (Planck Collaboration 2020, A&A 641, A6, Table 2).
 * Ωr: photons at T = 2.7255 K and three neutrino species (Ωr h² = 4.18 × 10⁻⁵).
 */
export const PLANCK_2018 = {
  H0: 67.66,
  omegaM: 0.3111,
  omegaR: 4.18e-5 / 0.6766 ** 2,
} as const satisfies FlatLcdm;
export const PLANCK_2018_SOURCE = "Planck Collaboration 2020, A&A 641, A6";

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

/** Age (Gyr) of a flat ΛCDM universe when its scale factor was `a` (1 today). */
export function cosmicAgeGyr(a: number, model: FlatLcdm = PLANCK_2018) {
  const { factor, ratio } = shape(model);
  return factor * Math.asinh(ratio * a ** 1.5);
}

/** Scale factor a of a flat ΛCDM universe at an age in Gyr: the inverse of `cosmicAgeGyr`. */
export function scaleFactorAtAge(ageGyr: number, model: FlatLcdm = PLANCK_2018) {
  const { factor, ratio } = shape(model);
  return (Math.sinh(ageGyr / factor) / ratio) ** (2 / 3);
}

/** Steps of the Simpson rule in `comovingDistanceMpc`: below a part in 10⁶ at any z. */
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
  const from = Math.sqrt(1 / (1 + z));
  const h = (1 - from) / COMOVING_STEPS;
  let sum = integrand(from) + integrand(1);
  for (let i = 1; i < COMOVING_STEPS; i += 1) sum += (i % 2 ? 4 : 2) * integrand(from + i * h);
  return (convert(1, "c", "km/s") / H0) * ((sum * h) / 3);
}

/** Today's distance (Mpc) to the edge of the observable universe: light since the Big Bang. */
export const particleHorizonMpc = (model: FlatLcdm = PLANCK_2018) =>
  comovingDistanceMpc(Number.POSITIVE_INFINITY, model);

/** Redshift of light that set out `gyr` billion years ago (the inverse of `lookbackTimeGyr`). */
export function redshiftAtLookback(gyr: number, model: FlatLcdm = PLANCK_2018) {
  return 1 / scaleFactorAtAge(cosmicAgeGyr(1, model) - gyr, model) - 1;
}

/** How long ago (Gyr) light now arriving from redshift z set out. */
export function lookbackTimeGyr(z: number, model: FlatLcdm = PLANCK_2018) {
  return cosmicAgeGyr(1, model) - cosmicAgeGyr(1 / (1 + z), model);
}

/**
 * Age (Gyr) of the universe at redshift z, with radiation: (1 / H₀) ∫₀ᵃ a′ da′ / √(Ωr + Ωm a′
 * + Ω_Λ a′⁴). Agrees with `cosmicAgeGyr` once radiation no longer matters; at the cosmic
 * microwave background (z ≈ 1090) it gives the familiar ~0.37 million years.
 */
export function cosmicAgeAtRedshiftGyr(z: number, model: FlatLcdm = PLANCK_2018) {
  const { H0, omegaM, omegaR = 0 } = model;
  const omegaL = 1 - omegaM - omegaR;
  const a = 1 / (1 + z);
  const integrand = (x: number) => x / Math.sqrt(omegaR + omegaM * x + omegaL * x ** 4);
  /* Over u = √x the integrand stays smooth where radiation hands over to matter. */
  const inU = (u: number) => 2 * u * integrand(u * u);
  const top = Math.sqrt(a);
  const h = top / COMOVING_STEPS;
  let sum = inU(0) + inU(top);
  for (let i = 1; i < COMOVING_STEPS; i += 1) sum += (i % 2 ? 4 : 2) * inU(i * h);
  return hubbleTimeGyr(H0) * ((sum * h) / 3);
}
