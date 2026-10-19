import {
  BOLTZMANN_CONSTANT_SI,
  ELEMENTARY_CHARGE_SI,
  PLANCK_CONSTANT_SI,
  SPEED_OF_LIGHT_SI,
} from "./definitions";
import { defineEquation } from "./equation";

/**
 * Light split into wavelengths: thermal radiation, photon energies, Doppler shifts and the
 * air–vacuum convention spectroscopists quote wavelengths in. Wavelengths are in nanometres.
 */

/** hc / k, m K: the second radiation constant c₂. */
export const SECOND_RADIATION_CONSTANT =
  (PLANCK_CONSTANT_SI * SPEED_OF_LIGHT_SI) / BOLTZMANN_CONSTANT_SI;

/** hc in eV nm (1239.84…): a photon of λ nm carries HC_EV_NM / λ electronvolts. */
export const HC_EV_NM = ((PLANCK_CONSTANT_SI * SPEED_OF_LIGHT_SI) / ELEMENTARY_CHARGE_SI) * 1e9;

/** The root of x = 5 (1 − e⁻ˣ), which puts Planck's peak per wavelength at hc / (x k T). */
const WIEN_X = (() => {
  let x = 5;
  for (let i = 0; i < 40; i++) x = 5 * -Math.expm1(-x);
  return x;
})();

/** Wien's displacement constant b, m K (2.897 771 955 × 10⁻³, derived from h, c and k). */
export const WIEN_CONSTANT = SECOND_RADIATION_CONSTANT / WIEN_X;

/**
 * Planck's law per unit wavelength: the radiance of a black body at `kelvin`, at `nm`
 * nanometres, in W m⁻² sr⁻¹ m⁻¹. Zero for a body at absolute zero and where the exponential
 * would overflow.
 */
export function planckRadiance(nm: number, kelvin: number) {
  if (!(kelvin > 0) || !(nm > 0)) return 0;
  const lambda = nm * 1e-9;
  const x = SECOND_RADIATION_CONSTANT / (lambda * kelvin);
  if (x > 700) return 0;
  return (2 * PLANCK_CONSTANT_SI * SPEED_OF_LIGHT_SI ** 2) / lambda ** 5 / Math.expm1(x);
}

export const planckLaw = defineEquation({
  id: "planck-law",
  text: "B_λ(T) = (2hc² / λ⁵) / (e^(hc / λkT) − 1)",
  latex: "B_\\lambda(T) = \\frac{2 h c^2}{\\lambda^5} \\frac{1}{e^{hc/\\lambda k T} - 1}",
  output: "B",
  variables: {
    lambda: { symbol: "λ", latex: "\\lambda", unit: "nm" },
    T: { symbol: "T", latex: "T", unit: "K" },
    B: { symbol: "B_λ", latex: "B_\\lambda" },
  },
  compute: ({ lambda, T }) => planckRadiance(lambda, T),
  source: "Planck (1901), Annalen der Physik 309, 553",
});

/** Where a black body is brightest per unit wavelength. */
export const wienDisplacement = defineEquation({
  id: "wien-displacement",
  text: "λ_max = b / T",
  latex: "\\lambda_{\\max} = \\frac{b}{T}",
  output: "lambdaMax",
  variables: {
    T: { symbol: "T", latex: "T", unit: "K" },
    lambdaMax: { symbol: "λ_max", latex: "\\lambda_{\\max}", unit: "nm" },
  },
  compute: ({ T }) => (WIEN_CONSTANT / T) * 1e9,
  source: "Wien (1893); b from Planck's law",
});

/** A photon's energy from its wavelength: the step between two levels it can bridge. */
export const photonEnergy = defineEquation({
  id: "photon-energy",
  text: "E = hc / λ",
  latex: "E = \\frac{h c}{\\lambda}",
  output: "E",
  variables: {
    lambda: { symbol: "λ", latex: "\\lambda", unit: "nm" },
    E: { symbol: "E", latex: "E", unit: "eV" },
  },
  compute: ({ lambda }) => HC_EV_NM / lambda,
  source: "Planck (1900); Einstein (1905)",
});

/**
 * The wavelength seen from a source moving along the line of sight at v (positive when it
 * recedes): the relativistic longitudinal Doppler shift.
 */
export const dopplerShift = defineEquation({
  id: "doppler-shift",
  text: "λ = λ₀ √((1 + v/c) / (1 − v/c))",
  latex: "\\lambda = \\lambda_0 \\sqrt{\\frac{1 + v/c}{1 - v/c}}",
  output: "lambda",
  variables: {
    lambda0: { symbol: "λ₀", latex: "\\lambda_0", unit: "nm" },
    v: { symbol: "v", latex: "v", unit: "km/s" },
    lambda: { symbol: "λ", latex: "\\lambda", unit: "nm" },
  },
  compute: ({ lambda0, v }) => lambda0 * dopplerFactor(v),
  source: "Doppler (1842); Einstein (1905)",
});

/** λ / λ₀ for a source receding at `kmPerS` (negative when it approaches). */
export function dopplerFactor(kmPerS: number) {
  const beta = (kmPerS * 1e3) / SPEED_OF_LIGHT_SI;
  return Math.sqrt((1 + beta) / (1 - beta));
}

/**
 * The refractive index of standard air (dry, 15 °C, 101 325 Pa) at a vacuum wavelength, after
 * Morton (2000, eq. 8: Edlén's formula as revised by Birch & Downs 1994), the IAU convention
 * for wavelengths above 200 nm.
 */
export function airIndex(vacuumNm: number) {
  const s2 = (1e3 / vacuumNm) ** 2;
  return 1 + 8.34254e-5 + 2.406147e-2 / (130 - s2) + 1.5998e-4 / (38.9 - s2);
}

/** The air wavelength astronomers quote for light of a vacuum wavelength (both nm). */
export const vacuumToAir = (vacuumNm: number) => vacuumNm / airIndex(vacuumNm);
