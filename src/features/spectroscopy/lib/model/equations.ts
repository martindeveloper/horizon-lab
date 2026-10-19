import {
  ATOMIC_MASS_KG,
  BOLTZMANN_CONSTANT,
  ELECTRON_MASS_KG,
  PLANCK_CONSTANT,
  SPEED_OF_LIGHT,
  defineEquation,
  dopplerShift,
  photonEnergy,
  planckLaw,
  planckRadiance,
  wienDisplacement,
  type Formula,
} from "@horizon/toolkit/science";

import { BOLTZMANN_EV } from "./populations";

/**
 * Stellar Spectra's formulas, written once: the guide and the technical details print them,
 * and tests check them against textbook values.
 */

/** Boltzmann's law: how a gas at T shares its atoms between two levels. */
export const boltzmannLaw = defineEquation({
  id: "boltzmann-law",
  text: "n_b / n_a = (g_b / g_a) e^(−(E_b − E_a) / kT)",
  latex: "\\frac{n_b}{n_a} = \\frac{g_b}{g_a} e^{-(E_b - E_a)/kT}",
  output: "ratio",
  variables: {
    g: { symbol: "g_b / g_a", latex: "g_b/g_a" },
    dE: { symbol: "ΔE", latex: "\\Delta E", unit: "eV" },
    T: { symbol: "T", latex: "T", unit: "K" },
    ratio: { symbol: "n_b / n_a", latex: "n_b/n_a" },
  },
  compute: ({ g, dE, T }) => g * Math.exp(-dE / (BOLTZMANN_EV * T)),
  source: "Boltzmann (1877)",
});

/** The proton–electron mass ratio's effect on hydrogen: R_H = R_∞ / (1 + mₑ / m_p). */
const RYDBERG_HYDROGEN =
  10_973_731.568_157 / (1 + ELECTRON_MASS_KG / (1.007_276_466_578_9 * ATOMIC_MASS_KG));

/** Saha's equation: how a gas at T and electron pressure Pₑ shares its atoms between two stages. */
export const sahaEquation = defineEquation({
  id: "saha-equation",
  text: "N_{i+1} / N_i = (2 U_{i+1} / U_i) (2π mₑ kT / h²)^(3/2) (kT / Pₑ) e^(−χ_i / kT)",
  latex:
    "\\frac{N_{i+1}}{N_i} = \\frac{2 U_{i+1}}{U_i} \\left(\\frac{2\\pi m_e k T}{h^2}\\right)^{3/2} \\frac{kT}{P_e} e^{-\\chi_i/kT}",
  output: "ratio",
  variables: {
    U: { symbol: "U_{i+1} / U_i", latex: "U_{i+1}/U_i" },
    chi: { symbol: "χ", latex: "\\chi", unit: "eV" },
    T: { symbol: "T", latex: "T", unit: "K" },
    Pe: { symbol: "Pₑ", latex: "P_e" },
    ratio: { symbol: "N_{i+1} / N_i", latex: "N_{i+1}/N_i" },
  },
  compute: ({ U, chi, T, Pe }) => {
    const kT = BOLTZMANN_CONSTANT * T;
    const quantum = ((2 * Math.PI * ELECTRON_MASS_KG * kT) / PLANCK_CONSTANT ** 2) ** 1.5;
    return 2 * U * quantum * (kT / Pe) * Math.exp(-chi / (BOLTZMANN_EV * T));
  },
  source: "Saha (1920), Philosophical Magazine 40, 472",
});

/** Hydrogen's lines from level n₁ to n₂ (vacuum wavelengths). */
export const rydbergFormula = defineEquation({
  id: "rydberg-formula",
  text: "1/λ = R_H (1/n₁² − 1/n₂²)",
  latex: "\\frac{1}{\\lambda} = R_H \\left(\\frac{1}{n_1^2} - \\frac{1}{n_2^2}\\right)",
  output: "lambda",
  variables: {
    n1: { symbol: "n₁", latex: "n_1" },
    n2: { symbol: "n₂", latex: "n_2" },
    lambda: { symbol: "λ", latex: "\\lambda", unit: "nm" },
  },
  compute: ({ n1, n2 }) => 1e9 / (RYDBERG_HYDROGEN * (1 / n1 ** 2 - 1 / n2 ** 2)),
  source: "Rydberg (1890); Bohr (1913)",
});

/** Light through a uniform slab of gas: Kirchhoff's laws in one line. */
export const slabTransfer = defineEquation({
  id: "slab-transfer",
  text: "I = I₀ e^(−τ) + B_λ(T) (1 − e^(−τ))",
  latex: "I = I_0 e^{-\\tau} + B_\\lambda(T)\\left(1 - e^{-\\tau}\\right)",
  output: "I",
  variables: {
    I0: { symbol: "I₀", latex: "I_0" },
    tau: { symbol: "τ", latex: "\\tau" },
    lambda: { symbol: "λ", latex: "\\lambda", unit: "nm" },
    T: { symbol: "T", latex: "T", unit: "K" },
    I: { symbol: "I", latex: "I" },
  },
  compute: ({ I0, tau, lambda, T }) =>
    I0 * Math.exp(-tau) + planckRadiance(lambda, T) * -Math.expm1(-tau),
  source: "Kirchhoff (1860); the formal solution of radiative transfer",
});

/** The line's width from thermal and turbulent motion. */
export const dopplerWidth = defineEquation({
  id: "doppler-width",
  text: "Δλ_D = (λ / c) √(2kT / m + ξ²)",
  latex: "\\Delta\\lambda_D = \\frac{\\lambda}{c}\\sqrt{\\frac{2kT}{m} + \\xi^2}",
  output: "width",
  variables: {
    lambda: { symbol: "λ", latex: "\\lambda", unit: "nm" },
    T: { symbol: "T", latex: "T", unit: "K" },
    A: { symbol: "m / mᵤ", latex: "m/m_u" },
    xi: { symbol: "ξ", latex: "\\xi", unit: "km/s" },
    width: { symbol: "Δλ_D", latex: "\\Delta\\lambda_D", unit: "nm" },
  },
  compute: ({ lambda, T, A, xi }) =>
    (lambda * Math.sqrt((2 * BOLTZMANN_CONSTANT * T) / (A * ATOMIC_MASS_KG) + (xi * 1e3) ** 2)) /
    SPEED_OF_LIGHT,
});

/** A formula the documents print but nothing computes from directly. */
const formula = (id: string, text: string, latex: string, source?: string): Formula => ({
  id,
  ...(source !== undefined ? { source } : {}),
  toString: () => text,
  toLatex: () => latex,
});

/** A line's optical depth: atoms, oscillator strength and the Voigt profile. */
export const lineOpacity = formula(
  "line-opacity",
  "τ(λ) = π rₑ λ² f N_lower (1 − e^(−hc/λkT)) H(a, v) / (√π Δλ_D)",
  "\\tau(\\lambda) = \\pi r_e \\lambda^2 f N_\\ell \\left(1 - e^{-hc/\\lambda k T}\\right) \\frac{H(a, v)}{\\sqrt{\\pi}\\,\\Delta\\lambda_D}",
);

/**
 * The flux leaving a star: the intensity integrated up through its layers along μ = 2/3, which
 * the Eddington–Barbier relation makes stand for the whole disc.
 */
export const eddingtonFlux = formula(
  "eddington-flux",
  "F_λ ≈ π Σ B_λ(T_k) [e^(−3τ_k/2) − e^(−3τ_{k+1}/2)]",
  "F_\\lambda \\approx \\pi \\sum_k B_\\lambda(T_k)\\left[e^{-3\\tau_k/2} - e^{-3\\tau_{k+1}/2}\\right]",
  "Eddington (1926); Barbier (1943)",
);

/** The width a line absorbs: what a curve of growth plots. */
export const equivalentWidth = formula(
  "equivalent-width",
  "W = ∫ (1 − F_λ / F_c) dλ",
  "W = \\int \\left(1 - \\frac{F_\\lambda}{F_c}\\right) d\\lambda",
);

/** Every formula the technical details may name, by ID. */
export const SPECTROSCOPY_EQUATIONS: Record<string, Formula> = Object.fromEntries(
  [
    planckLaw,
    wienDisplacement,
    photonEnergy,
    dopplerShift,
    boltzmannLaw,
    sahaEquation,
    rydbergFormula,
    slabTransfer,
    dopplerWidth,
    lineOpacity,
    eddingtonFlux,
    equivalentWidth,
  ].map((equation) => [equation.id, equation]),
);
