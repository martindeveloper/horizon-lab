import { clamp01 } from "@horizon/toolkit/math";
import {
  defineEquation,
  formatNumber,
  GRAVITATIONAL_CONSTANT,
  JULIAN_YEAR_SECONDS,
  PROTON_MASS_KG,
  UNITS,
  type Formula,
} from "@horizon/toolkit/science";

import {
  CLEAR_DONE,
  GALACTIC_YEAR,
  GAS_MASS_PER_H2,
  GAS_DISK_LIFETIME,
  MODEL_START,
  ROCHE_FLUID,
  SUN_BIRTH,
  TIDAL_RECESSION_POWER,
} from "./parameters";

/**
 * The solar system model's formulas, each written once: the model computes with them, the
 * simulations' `technical.ts` print them by ID, and tests check them.
 */

/** Numbers inside printed formulas: "27,000", "4.567". */
const n = (value: number) => formatNumber(value, "en", 3);
const gyr = (years: number) => n(years / 1e9);
const myr = (years: number) => n(years / 1e6);

/**
 * A uniform cloud at rest falls in on itself in one free-fall time, set by its density alone:
 * `n` H₂ molecules per cm³, with ρ = 2.8 m_H n (helium included); `t_ff` in years.
 */
export const freeFallTime = defineEquation({
  id: "free-fall-time",
  text: `t_ff = √(3π / (32 G ρ)),  ρ = ${n(GAS_MASS_PER_H2)} m_H n`,
  latex: `t_{ff} = \\sqrt{\\frac{3\\pi}{32\\,G\\rho}}, \\quad \\rho = ${n(GAS_MASS_PER_H2)}\\,m_H\\,n`,
  output: "t",
  variables: {
    n: { symbol: "n", latex: "n", unit: "cm-3" },
    t: { symbol: "t_ff", latex: "t_{ff}", unit: "yr" },
  },
  compute: ({ n }) => {
    const rho = GAS_MASS_PER_H2 * PROTON_MASS_KG * n * UNITS["cm-3"].factor;
    return Math.sqrt((3 * Math.PI) / (32 * GRAVITATIONAL_CONSTANT * rho)) / JULIAN_YEAR_SECONDS;
  },
});

/**
 * Roche's limit for a fluid satellite: inside it the primary's tides pull a body apart. `R` is
 * the primary's radius and `ratio` its density over the satellite's.
 */
export const rocheLimit = defineEquation({
  id: "roche-limit",
  text: `a_R = ${n(ROCHE_FLUID)} R (ρ_primary / ρ_satellite)^(1/3)`,
  latex: `a_R = ${n(ROCHE_FLUID)}\\,R\\left(\\frac{\\rho_\\mathrm{primary}}{\\rho_\\mathrm{satellite}}\\right)^{1/3}`,
  output: "a",
  variables: {
    R: { symbol: "R", latex: "R", unit: "km" },
    ratio: {
      symbol: "ρ_primary/ρ_satellite",
      latex: "\\rho_\\mathrm{primary}/\\rho_\\mathrm{satellite}",
    },
    a: { symbol: "a_R", latex: "a_R", unit: "km" },
  },
  compute: ({ R, ratio }) => ROCHE_FLUID * R * Math.cbrt(ratio),
});

/**
 * Tidal recession at constant torque between two dated distances: da/dt ∝ a^(−11/2), so
 * a^(13/2) runs linearly from `a0` at `t0` to `a1` at `t1` (Darwin's law; times in years ago).
 */
export const tidalRecession = defineEquation({
  id: "tidal-recession",
  text: "a(t)^(13/2) = a₀^(13/2) + (a₁^(13/2) − a₀^(13/2)) (t − t₀) / (t₁ − t₀)",
  latex:
    "a(t)^{13/2} = a_0^{13/2} + \\left(a_1^{13/2} - a_0^{13/2}\\right)\\frac{t - t_0}{t_1 - t_0}",
  output: "a",
  variables: {
    a0: { symbol: "a₀", latex: "a_0", unit: "km" },
    a1: { symbol: "a₁", latex: "a_1", unit: "km" },
    t0: { symbol: "t₀", latex: "t_0", unit: "yr" },
    t1: { symbol: "t₁", latex: "t_1", unit: "yr" },
    t: { symbol: "t", latex: "t", unit: "yr" },
    a: { symbol: "a", latex: "a", unit: "km" },
  },
  compute: ({ a0, a1, t0, t1, t }) => {
    const p = TIDAL_RECESSION_POWER;
    const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    return (a0 ** p + (a1 ** p - a0 ** p) * f) ** (1 / p);
  },
});

/** First solids 4.567 Gyr ago (CAI age); a 5 Myr gas disk. `t` is years ago. */
export const gasDisk = defineEquation({
  id: "gas-disk",
  text: `gas(t) = 1 − clamp((${gyr(SUN_BIRTH)} Gyr − t) / ${myr(GAS_DISK_LIFETIME)} Myr, 0, 1)`,
  latex: `\\mathrm{gas}(t) = 1 - \\operatorname{clamp}\\!\\left(\\frac{${gyr(SUN_BIRTH)}\\,\\mathrm{Gyr} - t}{${myr(GAS_DISK_LIFETIME)}\\,\\mathrm{Myr}}, 0, 1\\right)`,
  output: "gas",
  variables: {
    t: { symbol: "t", latex: "t", unit: "yr" },
    gas: { symbol: "gas", latex: "\\mathrm{gas}" },
  },
  compute: ({ t }) => 1 - clamp01((SUN_BIRTH - t) / GAS_DISK_LIFETIME),
});

/** Smoothstep between MODEL_START and CLEAR_DONE (4.5 and 4.45 Gyr ago). */
export const migrationProgress = defineEquation({
  id: "migration-progress",
  text: `mig(t) = u² (3 − 2u),  u = clamp((${gyr(MODEL_START)} Gyr − t) / ${gyr(MODEL_START - CLEAR_DONE)} Gyr, 0, 1)`,
  latex: `\\mathrm{mig}(t) = u^2(3 - 2u), \\quad u = \\frac{${gyr(MODEL_START)}\\,\\mathrm{Gyr} - t}{${gyr(MODEL_START - CLEAR_DONE)}\\,\\mathrm{Gyr}}`,
  output: "mig",
  variables: {
    t: { symbol: "t", latex: "t", unit: "yr" },
    mig: { symbol: "mig", latex: "\\mathrm{mig}" },
  },
  compute: ({ t }) => {
    const u = clamp01((MODEL_START - t) / (MODEL_START - CLEAR_DONE));
    return u * u * (3 - 2 * u);
  },
});

/** Giant-planet elements slide from the sketch's start to today's. */
export const migratedElement = defineEquation({
  id: "migrated-element",
  text: "a(mig) = a_start + (a_today − a_start) mig",
  latex: "a(\\mathrm{mig}) = a_{start} + (a_{today} - a_{start})\\,\\mathrm{mig}",
  output: "a",
  variables: {
    start: { symbol: "a_start", latex: "a_{start}" },
    today: { symbol: "a_today", latex: "a_{today}" },
    mig: { symbol: "mig", latex: "\\mathrm{mig}" },
    a: { symbol: "a", latex: "a" },
  },
  compute: ({ start, today, mig }) => start + (today - start) * mig,
});

/** Tracers move geometrically between orbits, so a jump from 20 to 20,000 au reads evenly. */
export const tracerSemiMajorAxis = defineEquation({
  id: "tracer-semi-major-axis",
  text: "log a_tracer(s) = (1 − s) log a₀ + s log a₁",
  latex: "\\log a_{tracer}(s) = (1 - s)\\log a_0 + s \\log a_1",
  output: "a",
  variables: {
    a0: { symbol: "a₀", latex: "a_0", unit: "au" },
    a1: { symbol: "a₁", latex: "a_1", unit: "au" },
    s: { symbol: "s", latex: "s" },
    a: { symbol: "a_tracer", latex: "a_{tracer}", unit: "au" },
  },
  compute: ({ a0, a1, s }) => Math.exp((1 - s) * Math.log(a0) + s * Math.log(a1)),
});

/** The Sun's galactic orbital phase, one lap per GALACTIC_YEAR. `t` is years ago. */
export const galacticAngle = defineEquation({
  id: "galactic-angle",
  text: `θ = 2π t / ${myr(GALACTIC_YEAR)} Myr`,
  latex: `\\theta = \\frac{2\\pi t}{${myr(GALACTIC_YEAR)}\\,\\mathrm{Myr}}`,
  output: "theta",
  variables: {
    t: { symbol: "t", latex: "t", unit: "yr" },
    theta: { symbol: "θ", latex: "\\theta", unit: "rad" },
  },
  compute: ({ t }) => (2 * Math.PI * t) / GALACTIC_YEAR,
});

/** The solar system model's formulas, for a simulation's equation registry. */
export const SOLAR_EQUATIONS: readonly Formula[] = [
  freeFallTime,
  gasDisk,
  migrationProgress,
  migratedElement,
  rocheLimit,
  tidalRecession,
  tracerSemiMajorAxis,
  galacticAngle,
];
