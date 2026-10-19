import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

import { RAIN_FLOOR } from "./clocks";
import { QUALITY_STEPS } from "./presets";

/**
 * The observatory's model numbers, once. The renderer receives them as shader
 * `#define`s, the engine computes with them, and the technical notes quote them
 * as ICU arguments, so the shader, the code and the copy cannot disagree.
 * Radii are in units of M.
 */

/** Radial samples of the Page–Thorne flux texture. */
export const DISK_PROFILE_SIZE = 512;
/** The disk's outer radius. */
export const DISK_OUTER_RADIUS = 15.6;
/** The disk's inner edge sits at max(1.08 r₊, r_ISCO). */
export const DISK_INNER_HORIZON_FACTOR = 1.08;
/** Display scales for temperature and flux, not accretion-rate predictions. */
export const DISK_PEAK_K = 15_800;
export const DISK_PEAK_FLUX = 1.68;
/**
 * Illustrative glow of gas plunging inside the ISCO, before g⁴. Its peak stays
 * under a tenth of the disk's, which a zero-torque disk's vanishing inner flux requires.
 */
export const PLUNGE_GLOW = 0.06;
/** Electron-scattering limb darkening I(μ) ∝ 1 + 2.06 μ (Chandrasekhar 1960). */
export const LIMB_DARKENING = 2.06;
/** Scales I(μ) to an isotropic emitter's flux: ∫ 2μ N (1 + c μ) dμ = N (1 + 2c/3) = 1. */
export const LIMB_NORMALIZATION = 1 / (1 + (2 / 3) * LIMB_DARKENING);
/** Ray steps move about this fraction of the radius inside 8 M, and the second one outside. */
export const STEP_NEAR = 0.07;
export const STEP_FAR = 0.1;
/** Far out the step grows as √(r/8 M), up to this factor: rays there are nearly straight. */
export const STEP_FAR_GROWTH = 3;
/** Outbound rays beyond this radius have escaped to the sky. */
export const ESCAPE_RADIUS = 48;
/** Beyond this radius the march only bends rays: glow, jet and disk lie closer in. */
export const FAR_FIELD_RADIUS = 36;
/** Rays with a larger impact parameter bend analytically instead of marching… */
export const STRAIGHT_IMPACT = 34;
/** …unless the camera is closer than this. */
export const NEAR_CAMERA_RADIUS = 22;
/**
 * Illustrative glow above the disk (art direction, not a dust or plasma
 * model): a cone around height/radius slope 0.38 with a Gaussian half-width of
 * 0.12, fading out at 1.5 times the disk's outer radius. Beyond ±0.26 of the
 * slope the wall term is under 1 % of its peak, so samples outside that cone
 * are skipped, and outbound rays past the cone's far corner
 * (1.5 · √(1 + 0.64²) ≈ 1.78 disk radii) have no glow left to collect.
 */
export const GLOW_SLOPE = 0.38;
export const GLOW_WIDTH = 0.12;
export const GLOW_CONE = 0.26;
export const GLOW_OUTER = 1.5;
/** Turbulent gas: cells around and along the shear spiral, and its pitch (art direction). */
export const GAS_TURN_CELLS = 12;
export const GAS_SPIRAL_CELLS = 16;
export const GAS_PITCH = 4;
/** The highest quality's step budget bounds the shader loop. */
export const MAX_STEPS = Math.max(...Object.values(QUALITY_STEPS));

/** Compile-time constants for `black-hole.frag.glsl`. */
export const SHADER_DEFINES = glslDefines({
  DISK_PEAK_K,
  DISK_PEAK_FLUX,
  PLUNGE_GLOW,
  DISK_PROFILE_SIZE,
  DISK_PROFILE_LAST: DISK_PROFILE_SIZE - 1,
  LIMB_DARKENING,
  LIMB_NORMALIZATION,
  MAX_STEPS: glslInt(MAX_STEPS),
  STEP_NEAR,
  STEP_FAR,
  STEP_FAR_GROWTH,
  ESCAPE_R: ESCAPE_RADIUS,
  FAR_FIELD_R: FAR_FIELD_RADIUS,
  MARCH_B: STRAIGHT_IMPACT,
  MARCH_CAM_R: NEAR_CAMERA_RADIUS,
  GAS_TURN_CELLS,
  GAS_SPIRAL_CELLS,
  GAS_PITCH,
  GLOW_SLOPE,
  GLOW_WIDTH,
  GLOW_CONE,
  GLOW_OUTER,
});

/** ICU arguments for the technical notes. */
export const BLACK_HOLE_COPY = {
  innerFactor: DISK_INNER_HORIZON_FACTOR,
  outerRadius: DISK_OUTER_RADIUS,
  diskSamples: DISK_PROFILE_SIZE,
  diskIntervals: DISK_PROFILE_SIZE - 1,
  peakK: DISK_PEAK_K,
  limbDarkening: LIMB_DARKENING,
  farField: FAR_FIELD_RADIUS,
  stepNear: Math.round(STEP_NEAR * 100),
  stepFar: Math.round(STEP_FAR * 100),
  stepFarMax: Math.round(STEP_FAR * STEP_FAR_GROWTH * 100),
  rainFloor: RAIN_FLOOR,
  stepsEconomy: QUALITY_STEPS.economy,
  stepsStandard: QUALITY_STEPS.standard,
  stepsCinema: QUALITY_STEPS.cinema,
};
