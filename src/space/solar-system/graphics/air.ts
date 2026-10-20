/**
 * The atmospheres a close-up draws as a scattering shell over the body (air.frag.glsl), one
 * entry per body with air; the rest keep the surface shader's cheap haze rim. Thicknesses
 * are in body radii and the optical depths are those of a vertical column, so a body's rim
 * brightness follows from its own air: Earth's thin blue Rayleigh layer, Venus's and Titan's
 * deep pale haze, Mars's thin dust. Scale heights are a few times the real ones, so the march
 * samples the dense layer rather than stepping over it, with the coefficients scaled to keep
 * each column's depth.
 */
import type { BodyId } from "@horizon/toolkit/bodies";
import { keysOf } from "@horizon/toolkit/records";

export type Air = {
  /** The shell's top above the surface, body radii. */
  shell: number;
  /** Scale heights of the air (Rayleigh) and the haze (Mie), body radii. */
  scale: readonly [air: number, haze: number];
  /** Vertical optical depth of the air, RGB (Rayleigh, blue the deepest). */
  rayleigh: readonly [number, number, number];
  /** Vertical optical depth of the haze, RGB (its own tint). */
  mie: readonly [number, number, number];
  /** Henyey–Greenstein asymmetry of the haze: how strongly it scatters forward. */
  g: number;
  /**
   * The share of each path's extinction that dims light: 1 for thin air, where light scatters
   * once; less for a deep haze, which sends most of what it takes from a ray on towards the
   * camera, so the limb stays as bright as the cloud deck beneath it.
   */
  deep: number;
  /** Sunlight on the shell, over the π that lights the map as 1: the look's own gain. */
  light: number;
};

export const AIR: Partial<Record<BodyId, Air>> = {
  earth: {
    shell: 0.04,
    scale: [0.012, 0.004],
    rayleigh: [0.05, 0.11, 0.27],
    mie: [0.03, 0.03, 0.03],
    g: 0.7,
    deep: 1,
    light: 2.4,
  },
  venus: {
    shell: 0.05,
    scale: [0.012, 0.01],
    rayleigh: [0.05, 0.06, 0.08],
    mie: [0.5, 0.46, 0.36],
    g: 0.3,
    deep: 0.4,
    light: 2.2,
  },
  mars: {
    shell: 0.03,
    scale: [0.006, 0.005],
    rayleigh: [0.0015, 0.0025, 0.005],
    mie: [0.22, 0.14, 0.08],
    g: 0.4,
    deep: 0.8,
    light: 2,
  },
  titan: {
    shell: 0.2,
    scale: [0.035, 0.03],
    rayleigh: [0.08, 0.1, 0.14],
    mie: [1, 0.72, 0.4],
    g: 0.3,
    deep: 0.4,
    light: 2,
  },
};

/** The bodies with a scattering shell. */
export const AIR_BODIES: readonly BodyId[] = keysOf(AIR);

/**
 * A body's shell as its shader reads it, in the shell's own units: the shell is the unit
 * sphere, the body the sphere of radius `planet` inside it, and lengths are body radii over
 * (1 + shell). Scattering coefficients per unit length at the surface are each column's
 * depth over its scale height.
 */
export function airUniforms(air: Air) {
  const unit = 1 + air.shell;
  const [hr, hm] = air.scale;
  const perUnit = (
    [r, g, b]: readonly [number, number, number],
    h: number,
  ): [number, number, number] => [(r / h) * unit, (g / h) * unit, (b / h) * unit];
  return {
    planet: 1 / unit,
    scale: [hr / unit, hm / unit] as const,
    rayleigh: perUnit(air.rayleigh, hr),
    mie: perUnit(air.mie, hm),
    g: air.g,
    deep: air.deep,
    light: Math.PI * air.light,
  };
}
