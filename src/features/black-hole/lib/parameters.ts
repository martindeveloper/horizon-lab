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
/** The frequency factor g is clamped to this range before g⁴ brightening. */
export const REDSHIFT_MIN = 0.2;
export const REDSHIFT_MAX = 2.5;
/** Electron-scattering limb darkening I(μ) ∝ 1 + 2.06 μ (Chandrasekhar 1960). */
export const LIMB_DARKENING = 2.06;
/** Scales I(μ) to an isotropic emitter's flux: ∫ 2μ N (1 + c μ) dμ = N (1 + 2c/3) = 1. */
export const LIMB_NORMALIZATION = 1 / (1 + (2 / 3) * LIMB_DARKENING);
/** Outbound rays beyond this radius have escaped to the sky. */
export const ESCAPE_RADIUS = 48;
/** Beyond this radius the march only bends rays: dust, jet and disk lie closer in. */
export const FAR_FIELD_RADIUS = 36;
/** Rays with a larger impact parameter bend analytically instead of marching… */
export const STRAIGHT_IMPACT = 34;
/** …unless the camera is closer than this. */
export const NEAR_CAMERA_RADIUS = 22;
/**
 * Dusty wind (art direction): a cone around height/radius slope 0.38 with a
 * Gaussian half-width of 0.12, fading out at 1.5 times the disk's outer radius.
 * Beyond ±0.26 of the slope the wall term is under 1 % of its peak, so samples
 * outside that cone are skipped, and outbound rays past the cone's far corner
 * (1.5 · √(1 + 0.64²) ≈ 1.78 disk radii) have no dust left to collect.
 */
export const DUST_SLOPE = 0.38;
export const DUST_WIDTH = 0.12;
export const DUST_CONE = 0.26;
export const DUST_OUTER = 1.5;
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
  DISK_PROFILE_SIZE,
  DISK_PROFILE_LAST: DISK_PROFILE_SIZE - 1,
  REDSHIFT_MIN,
  REDSHIFT_MAX,
  LIMB_DARKENING,
  LIMB_NORMALIZATION,
  MAX_STEPS: glslInt(MAX_STEPS),
  ESCAPE_R: ESCAPE_RADIUS,
  FAR_FIELD_R: FAR_FIELD_RADIUS,
  MARCH_B: STRAIGHT_IMPACT,
  MARCH_CAM_R: NEAR_CAMERA_RADIUS,
  GAS_TURN_CELLS,
  GAS_SPIRAL_CELLS,
  GAS_PITCH,
  DUST_SLOPE,
  DUST_WIDTH,
  DUST_CONE,
  DUST_OUTER,
});

/** ICU arguments for the technical notes. */
export const BLACK_HOLE_COPY = {
  innerFactor: DISK_INNER_HORIZON_FACTOR,
  outerRadius: DISK_OUTER_RADIUS,
  diskSamples: DISK_PROFILE_SIZE,
  diskIntervals: DISK_PROFILE_SIZE - 1,
  peakK: DISK_PEAK_K,
  limbDarkening: LIMB_DARKENING,
  redshiftMin: REDSHIFT_MIN,
  redshiftMax: REDSHIFT_MAX,
  farField: FAR_FIELD_RADIUS,
  rainFloor: RAIN_FLOOR,
  stepsEconomy: QUALITY_STEPS.economy,
  stepsStandard: QUALITY_STEPS.standard,
  stepsCinema: QUALITY_STEPS.cinema,
};
