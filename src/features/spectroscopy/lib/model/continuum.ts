import { airToVacuum, CLASSICAL_ELECTRON_RADIUS_M, HC_EV_NM } from "@horizon/toolkit/science";

import { ionizationEnergy, partitionFunction } from "./atoms";
import {
  atomsPerKilogram,
  BOLTZMANN_EV,
  ionizationFractions,
  NUCLEI_PER_KILOGRAM,
} from "./populations";

/**
 * The continuum's opacity at one wavelength in one layer of a star, m² per kg of gas: what a
 * photon meets between the lines. In the Sun it is mostly the negative hydrogen ion H⁻
 * (an electron caught by a neutral atom, freed by any photon bluer than 1.64 μm); in hotter
 * stars, where H⁻ breaks up, neutral hydrogen's own ionization from n = 3 (the Paschen
 * continuum) and scattering off free electrons take over. Fits are in cgs, as published, and
 * converted at the end; populations come from the same Saha equation as the lines.
 *
 * Left out: metals' bound-free edges (which matter below about 400 nm in cool stars), He⁻ and
 * H₂⁺, molecules, and the difference between scattering and absorption (both are treated as
 * absorption, with the Planck function as source).
 */

export type ContinuumGas = {
  /** K. */
  temperature: number;
  /** Pa. */
  electronPressure: number;
  /** Pa. */
  gasPressure: number;
};

export const CONTINUUM_SOURCES = [
  "hMinusBoundFree",
  "hMinusFreeFree",
  "hydrogenBoundFree",
  "hydrogenFreeFree",
  "electrons",
  "rayleigh",
] as const;
export type ContinuumSource = (typeof CONTINUUM_SOURCES)[number];

/** hc/k, μm K. */
const SECOND_RADIATION_UM = 1.4388e4;
/** H⁻'s photodetachment threshold, μm (0.754 eV). */
const H_MINUS_THRESHOLD = 1.6419;
/** John (1988), eq. 4–5: H⁻ bound-free cross-section, the f(λ) series. */
const H_MINUS_BF = [152.519, 49.534, -118.858, 92.536, -34.194, 4.982];
/**
 * John (1988), table 3a (λ > 0.3645 μm): H⁻ free-free, rows n = 1–6 of A, B, C, D, E, F.
 * The fit covers 1400–10,080 K, where H⁻ matters.
 */
const H_MINUS_FF = [
  [0, 0, 0, 0, 0, 0],
  [2483.346, 285.827, -2054.291, 2827.776, -1341.537, 208.952],
  [-3449.889, -1158.382, 8746.523, -11485.632, 5303.609, -812.939],
  [2200.04, 2427.719, -13651.105, 16755.524, -7510.494, 1132.738],
  [-696.271, -1841.4, 8624.97, -10051.53, 4400.067, -655.02],
  [88.283, 444.517, -1863.864, 2095.288, -901.788, 132.985],
] as const;
const H_MINUS_FF_SHORTEST = 0.3645;
/** Hydrogen's Rydberg constant, Å⁻¹. */
const RYDBERG_PER_ANGSTROM = 1.09678e-3;
/** Kramers' bound-free cross-section at n = 1 per Å³ of wavelength, cm² (Gray eq. 8.4). */
const KRAMERS = 1.0449e-26;
/** Hydrogen's ionization energy, eV (NIST). */
const HYDROGEN_LIMIT = ionizationEnergy("H I");
/** Thomson's cross-section (8π/3) rₑ², m². */
const THOMSON = ((8 * Math.PI) / 3) * CLASSICAL_ELECTRON_RADIUS_M ** 2;

/** John (1988), eq. 4–5: H⁻'s bound-free cross-section, cm². */
function hMinusCrossSection(um: number) {
  if (um >= H_MINUS_THRESHOLD) return 0;
  const x = 1 / um - 1 / H_MINUS_THRESHOLD;
  const r = Math.sqrt(x);
  let f = 0;
  for (let n = H_MINUS_BF.length - 1; n >= 0; n--) f = f * r + H_MINUS_BF[n]!;
  return 1e-18 * um ** 3 * x * r * f;
}

/** Rayleigh scattering by ground-state hydrogen, cm² per atom (Dalgarno, in Gray eq. 8.14). */
function rayleigh(angstrom: number) {
  const x = 1 / (angstrom * angstrom);
  return x * x * (5.799e-13 + x * (1.422e-6 + x * 2.784));
}

/** What the continuum needs of a wavelength, worked out once for every layer. */
export type ContinuumWavelength = {
  /** eV. */
  photon: number;
  /** H⁻ bound-free cross-section, cm². */
  hMinus: number;
  /** H⁻ free-free: A λ² + B + C/λ + D/λ² + E/λ³ + F/λ⁴ for each n (John 1988). */
  freeFree: Float64Array;
  /** Kramers' cross-section from n = 1, cm²: 1.0449 × 10⁻²⁶ λ³ (Å). */
  kramers: number;
  /** The lowest level of hydrogen a photon can ionize. */
  first: number;
  /** g_bf / n³ for it and the next two. */
  levels: readonly [number, number, number];
  /** Menzel & Pekeris's 0.3456 / (λR)^⅓, which sets the Gaunt factors. */
  gaunt: number;
  /** Rayleigh cross-section, cm². */
  rayleigh: number;
};

/** The continuum's wavelength-dependent factors at an air wavelength (the fits use vacuum). */
export function continuumWavelength(air: number): ContinuumWavelength {
  const nm = airToVacuum(air);
  const um = nm / 1e3;
  const angstrom = nm * 10;
  const photon = HC_EV_NM / nm;
  const l = Math.max(H_MINUS_FF_SHORTEST, um);
  const inv = 1 / l;
  const freeFree = new Float64Array(H_MINUS_FF.length);
  H_MINUS_FF.forEach(([a, b, c, d, e, f], n) => {
    freeFree[n] = a * l * l + b + inv * (c + inv * (d + inv * (e + inv * f)));
  });
  const lambdaR = angstrom * RYDBERG_PER_ANGSTROM;
  const gaunt = 0.3456 / Math.cbrt(lambdaR);
  let first = 1;
  while (HYDROGEN_LIMIT / first ** 2 > photon) first++;
  const level = (n: number) => (1 - gaunt * (lambdaR / n ** 2 - 0.5)) / n ** 3;
  return {
    photon,
    hMinus: hMinusCrossSection(um),
    freeFree,
    kramers: KRAMERS * angstrom ** 3,
    first,
    levels: [level(first), level(first + 1), level(first + 2)],
    gaunt,
    rayleigh: rayleigh(angstrom),
  };
}

/**
 * A layer's continuum: a function of the wavelength (from `continuumWavelength`) giving each
 * source's opacity, m² kg⁻¹. Everything that depends on the layer alone is worked out once.
 */
export function continuumOf(gas: ContinuumGas) {
  const { temperature, electronPressure, gasPressure } = gas;
  const kT = BOLTZMANN_EV * temperature;
  /* Neutral hydrogen per kg, with cm² turned into m²; free electrons per kg from Pₑ / (P_g − Pₑ),
     electrons per heavy particle. */
  const neutral =
    atomsPerKilogram("H") * ionizationFractions("H", temperature, electronPressure)[0]! * 1e-4;
  const electrons =
    THOMSON *
    NUCLEI_PER_KILOGRAM *
    (electronPressure / Math.max(gasPressure - electronPressure, 1e-30));
  const pressureCgs = electronPressure * 10;
  /* H⁻ ions per neutral atom per photodetachment cross-section: Saha for H⁻ ⇌ H + e⁻. */
  const hMinus =
    neutral *
    pressureCgs *
    0.75 *
    temperature ** -2.5 *
    Math.exp(SECOND_RADIATION_UM / (H_MINUS_THRESHOLD * temperature));
  const theta = Math.min(3.6, Math.max(0.5, 5040 / temperature));
  const thetaPowers = H_MINUS_FF.map((_, n) => theta ** ((n + 2) / 2));
  /* Neutral hydrogen: Boltzmann factors of its levels (Gray assumes U = 2), and the
     free-free's Saha factor e^(−I/kT). */
  const share = (2 / partitionFunction("H I", temperature)) * neutral;
  const boltzmann = (n: number) => Math.exp(-(HYDROGEN_LIMIT * (1 - 1 / n ** 2)) / kT);
  const excitation = Array.from({ length: 16 }, (_, n) => (n ? boltzmann(n) : 0));
  const ionized = Math.exp(-HYDROGEN_LIMIT / kT);
  const integral = kT / (2 * HYDROGEN_LIMIT);

  return (w: ContinuumWavelength): Record<ContinuumSource, number> => {
    const stimulated = -Math.expm1(-w.photon / kT);
    let freeFree = 0;
    for (let n = 0; n < thetaPowers.length; n++) freeFree += thetaPowers[n]! * w.freeFree[n]!;
    /* Hydrogen (Gray 2005, eq. 8.8–8.10): Kramers' cross-sections with Gaunt factors, summed
       over the three lowest levels the photon can ionize and integrated over the rest. */
    const n = w.first;
    const level = (k: number) => excitation[k] ?? boltzmann(k);
    const boundFree =
      w.levels[0] * level(n) +
      w.levels[1] * level(n + 1) +
      w.levels[2] * level(n + 2) +
      integral * (level(n + 3) - ionized);
    const kramers = w.kramers * share * stimulated;
    return {
      hMinusBoundFree: hMinus * stimulated * w.hMinus,
      hMinusFreeFree: neutral * pressureCgs * Math.max(0, 1e-29 * freeFree),
      hydrogenBoundFree: kramers * boundFree,
      hydrogenFreeFree: kramers * (1 + w.gaunt * (kT / w.photon + 0.5)) * integral * ionized,
      electrons,
      rayleigh: neutral * w.rayleigh,
    };
  };
}

/** The total of a layer's continuum opacities, m² kg⁻¹. */
export const totalOpacity = (parts: Record<ContinuumSource, number>) =>
  parts.hMinusBoundFree +
  parts.hMinusFreeFree +
  parts.hydrogenBoundFree +
  parts.hydrogenFreeFree +
  parts.electrons +
  parts.rayleigh;
