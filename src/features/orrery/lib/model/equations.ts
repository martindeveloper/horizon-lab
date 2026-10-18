import { ORBIT_EQUATIONS } from "@horizon/toolkit/bodies";
import { clamp01 } from "@horizon/toolkit/math";
import {
  defineEquation,
  keplerThirdLaw,
  lightTravelTime,
  tangentialVelocity,
  type Formula,
} from "@horizon/toolkit/science";

import { localGroupOrbit, scaleFactor } from "./cosmos";
import {
  ARM_PITCH_DEG,
  ARM_CROSSINGS_KPC,
  BAR_ANGLE_DEG,
  CLEAR_DONE,
  GALACTIC_YEAR,
  GAS_DISK_LIFETIME,
  MODEL_START,
  RADIAL_AMPLITUDE_LY,
  REID_R0_KPC,
  RADIAL_PERIOD,
  SUN_BIRTH,
  SUN_GALACTIC_RADIUS_LY,
  SUN_HEIGHT_LY,
  VERTICAL_AMPLITUDE_LY,
  VERTICAL_PERIOD,
  WARP_AMPLITUDE_KPC,
  WARP_NODES_DEG,
  WARP_POWER,
  WARP_START_KPC,
} from "./parameters";

/**
 * The orrery's formulas, each written once: the model computes with them,
 * `technical.json` prints them by ID, and tests check them. Shader-only steps,
 * vector rotations and sampling recipes stay as text in `technical.json`.
 */

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
/** Numbers inside printed formulas: "27,000", "4.567". */
const n = (value: number) => value.toLocaleString("en", { maximumFractionDigits: 3 });
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
  compute: ({ t }) => (TAU * t) / GALACTIC_YEAR,
});

export const galacticRadius = defineEquation({
  id: "galactic-radius",
  text: `R = ${n(SUN_GALACTIC_RADIUS_LY)} ly + ${n(RADIAL_AMPLITUDE_LY)} ly (1 − cos(2π t / ${myr(RADIAL_PERIOD)} Myr))`,
  latex: `R = ${n(SUN_GALACTIC_RADIUS_LY)}\\,\\mathrm{ly} + ${n(RADIAL_AMPLITUDE_LY)}\\,\\mathrm{ly}\\left(1 - \\cos\\frac{2\\pi t}{${myr(RADIAL_PERIOD)}\\,\\mathrm{Myr}}\\right)`,
  output: "R",
  variables: {
    t: { symbol: "t", latex: "t", unit: "yr" },
    R: { symbol: "R", latex: "R", unit: "ly" },
  },
  compute: ({ t }) =>
    SUN_GALACTIC_RADIUS_LY + RADIAL_AMPLITUDE_LY * (1 - Math.cos((TAU * t) / RADIAL_PERIOD)),
});

export const galacticHeight = defineEquation({
  id: "galactic-height",
  text: `z = ${n(VERTICAL_AMPLITUDE_LY)} ly sin(φ₀ − 2π t / ${myr(VERTICAL_PERIOD)} Myr),  sin φ₀ = ${n(SUN_HEIGHT_LY)} / ${n(VERTICAL_AMPLITUDE_LY)}`,
  latex: `z = ${n(VERTICAL_AMPLITUDE_LY)}\\,\\mathrm{ly}\\,\\sin\\!\\left(\\varphi_0 - \\frac{2\\pi t}{${myr(VERTICAL_PERIOD)}\\,\\mathrm{Myr}}\\right), \\quad \\sin\\varphi_0 = \\frac{${n(SUN_HEIGHT_LY)}}{${n(VERTICAL_AMPLITUDE_LY)}}`,
  output: "z",
  variables: {
    t: { symbol: "t", latex: "t", unit: "yr" },
    z: { symbol: "z", latex: "z", unit: "ly" },
  },
  compute: ({ t }) =>
    VERTICAL_AMPLITUDE_LY *
    Math.sin(Math.asin(SUN_HEIGHT_LY / VERTICAL_AMPLITUDE_LY) - (TAU * t) / VERTICAL_PERIOD),
});

/** Each arm's distance from the Sun where it crosses the Sun–centre line (Reid et al. 2019). */
const armOffsets = ARM_CROSSINGS_KPC.map((R) => n(REID_R0_KPC - R).replace("-", "−")).join(", ");

/**
 * Logarithmic arm through its measured crossing R_k of the Sun–centre line (β = 0): its
 * azimuth at radius R. Each arm's inner end sits at β₀ = bar angle + k · 90°.
 */
export const spiralArm = defineEquation({
  id: "spiral-arm",
  text: `ln(R / R_k) = −β tan ${n(ARM_PITCH_DEG)}°,  R_k = R₀ − (${armOffsets}) kpc,  β ≤ ${n(BAR_ANGLE_DEG)}° + k · 90°`,
  latex: `\\ln\\frac{R}{R_k} = -\\beta\\tan ${n(ARM_PITCH_DEG)}^\\circ, \\quad R_k = R_0 - (${armOffsets})\\,\\mathrm{kpc}, \\quad \\beta \\le ${n(BAR_ANGLE_DEG)}^\\circ + k \\cdot 90^\\circ`,
  output: "beta",
  variables: {
    R: { symbol: "R", latex: "R", unit: "kpc" },
    Rk: { symbol: "R_k", latex: "R_k", unit: "kpc" },
    beta: { symbol: "β", latex: "\\beta", unit: "rad" },
  },
  compute: ({ R, Rk }) => -Math.log(R / Rk) / Math.tan(ARM_PITCH_DEG * RAD),
});

/** The outer disk bends north beyond WARP_START_KPC; a linear warp prints no exponent. */
const warpPower = WARP_POWER === 1 ? "" : `^${n(WARP_POWER)}`;
const warpPowerLatex = WARP_POWER === 1 ? "" : `^{${n(WARP_POWER)}}`;
export const galacticWarp = defineEquation({
  id: "galactic-warp",
  text: `z_warp = ${n(WARP_AMPLITUDE_KPC)} kpc (R − ${n(WARP_START_KPC)} kpc)${warpPower} sin(β − ${n(WARP_NODES_DEG)}°)`,
  latex: `z_{warp} = ${n(WARP_AMPLITUDE_KPC)}\\,\\mathrm{kpc}\\,(R - ${n(WARP_START_KPC)}\\,\\mathrm{kpc})${warpPowerLatex}\\sin(\\beta - ${n(WARP_NODES_DEG)}^\\circ)`,
  output: "z",
  variables: {
    R: { symbol: "R", latex: "R", unit: "kpc" },
    beta: { symbol: "β", latex: "\\beta", unit: "rad" },
    z: { symbol: "z_warp", latex: "z_{warp}", unit: "kpc" },
  },
  compute: ({ R, beta }) =>
    R > WARP_START_KPC
      ? WARP_AMPLITUDE_KPC *
        (R - WARP_START_KPC) ** WARP_POWER *
        Math.sin(beta - WARP_NODES_DEG * RAD)
      : 0,
});

/** Every formula the orrery's `technical.json` may reference by ID. */
export const ORRERY_EQUATIONS = Object.fromEntries<Formula>(
  [
    keplerThirdLaw,
    lightTravelTime,
    tangentialVelocity,
    ...ORBIT_EQUATIONS,
    gasDisk,
    migrationProgress,
    migratedElement,
    tracerSemiMajorAxis,
    galacticAngle,
    galacticRadius,
    galacticHeight,
    spiralArm,
    scaleFactor,
    localGroupOrbit,
    galacticWarp,
  ].map((equation) => [equation.id, equation]),
);
