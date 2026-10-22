import { clamp01 } from "@horizon/toolkit/math";
import { defineEquation, formatNumber, type Formula } from "@horizon/toolkit/science";

import { CLEAR_DONE, GALACTIC_YEAR, GAS_DISK_LIFETIME, MODEL_START, SUN_BIRTH } from "./parameters";

/**
 * The solar system model's formulas, each written once: the model computes with them, the
 * simulations' `technical.ts` print them by ID, and tests check them.
 */

/** Numbers inside printed formulas: "27,000", "4.567". */
const n = (value: number) => formatNumber(value, "en", 3);
const gyr = (years: number) => n(years / 1e9);
const myr = (years: number) => n(years / 1e6);

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
  gasDisk,
  migrationProgress,
  migratedElement,
  tracerSemiMajorAxis,
  galacticAngle,
];
