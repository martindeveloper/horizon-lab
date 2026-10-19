import { galacticAngle } from "@/space/solar-system/model/equations";
import {
  defineEquation,
  keplerThirdLaw,
  lightTravelTime,
  tangentialVelocity,
  type Formula,
  RAD_PER_DEG as RAD,
  formatNumber,
} from "@horizon/toolkit/science";

import { localGroupOrbit } from "./cosmos";
import {
  ARM_PITCH_DEG,
  ARM_CROSSINGS_KPC,
  BAR_ANGLE_DEG,
  RADIAL_AMPLITUDE_LY,
  REID_R0_KPC,
  RADIAL_PERIOD,
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
 * Deep Field's formulas, each written once: the model computes with them,
 * `technical.json` prints them by ID, and tests check them. Sampling recipes stay as text
 * in `technical.json`.
 */

const TAU = Math.PI * 2;
/** Numbers inside printed formulas: "27,000", "4.567". */
const n = (value: number) => formatNumber(value, "en", 3);
const myr = (years: number) => n(years / 1e6);

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

/**
 * The outer disk bends north beyond WARP_START_KPC. A linear warp prints no exponent, and its
 * amplitude is a pure slope; otherwise the amplitude carries kpc^(1 − power).
 */
const warpPower = WARP_POWER === 1 ? "" : `^${n(WARP_POWER)}`;
const warpPowerLatex = WARP_POWER === 1 ? "" : `^{${n(WARP_POWER)}}`;
const warpUnit = WARP_POWER === 1 ? "" : ` kpc^${n(1 - WARP_POWER)}`;
const warpUnitLatex = WARP_POWER === 1 ? "" : `\\,\\mathrm{kpc}^{${n(1 - WARP_POWER)}}`;
export const galacticWarp = defineEquation({
  id: "galactic-warp",
  text: `z_warp = ${n(WARP_AMPLITUDE_KPC)}${warpUnit} (R − ${n(WARP_START_KPC)} kpc)${warpPower} sin(β − ${n(WARP_NODES_DEG)}°)`,
  latex: `z_{warp} = ${n(WARP_AMPLITUDE_KPC)}${warpUnitLatex}\\,(R - ${n(WARP_START_KPC)}\\,\\mathrm{kpc})${warpPowerLatex}\\sin(\\beta - ${n(WARP_NODES_DEG)}^\\circ)`,
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

/** Every formula Deep Field's `technical.json` may reference by ID. */
export const DEEP_FIELD_EQUATIONS = Object.fromEntries<Formula>(
  [
    keplerThirdLaw,
    lightTravelTime,
    tangentialVelocity,
    galacticAngle,
    galacticRadius,
    galacticHeight,
    spiralArm,
    localGroupOrbit,
    galacticWarp,
  ].map((equation) => [equation.id, equation]),
);
