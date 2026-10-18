import { convert } from "./units";

/** A flat ΛCDM universe: the Hubble constant (km/s/Mpc) and the matter density Ωm; Ω_Λ = 1 − Ωm. */
export type FlatLcdm = { H0: number; omegaM: number };

/** Planck 2018 VI, TT,TE,EE+lowE+lensing+BAO (Planck Collaboration 2020, A&A 641, A6, Table 2). */
export const PLANCK_2018 = { H0: 67.66, omegaM: 0.3111 } as const satisfies FlatLcdm;
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
