import { glslDefines } from "@horizon/toolkit/shaders/defines";

/** The night side's floor, as on the planets: linear light. */
export const SPACECRAFT_AMBIENT = 0.035;
/** Reflectance at normal incidence of paint, plastics and the dish's coating. */
export const SPACECRAFT_DIELECTRIC_F0 = 0.04;
/** The smoothest a surface reads (GGX α), so a mirror-flat panel keeps a finite glint. */
export const SPACECRAFT_MIN_ALPHA = 0.02;
/**
 * The share of a metal's colour that scatters like a matte surface: crinkled foil throws the
 * Sun every way a little, so it reads dim and mottled away from its glint rather than black.
 * A teaching choice; a mirror would be 0.
 */
export const SPACECRAFT_FOIL_SCATTER = 0.25;

/**
 * The spacecraft shaders' compile-time constants, written to
 * `shaders/parameters.generated.glsl` (`npm run shaders:generate`).
 */
export const SPACECRAFT_SHADER_DEFINES = glslDefines({
  SPACECRAFT_AMBIENT,
  SPACECRAFT_DIELECTRIC_F0,
  SPACECRAFT_MIN_ALPHA,
  SPACECRAFT_FOIL_SCATTER,
});
