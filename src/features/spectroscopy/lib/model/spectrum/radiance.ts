import { airToVacuum, planckRadiance } from "@horizon/toolkit/science";

/** Planck's law at a spectrum's air wavelength, evaluated (as it is defined) in vacuum. */
export const planck = (air: number, kelvin: number) => planckRadiance(airToVacuum(air), kelvin);

/**
 * Light through a uniform slab: what shines `behind` it dimmed by e^(−τ), plus the slab's own
 * `source` function for the rest, I = I₀ e^(−τ) + B (1 − e^(−τ)). Kirchhoff's laws in one line;
 * the printed equation (`equations.ts`) computes from this too.
 */
export function slabIntensity(behind: number, source: number, tau: number) {
  const transmitted = Math.exp(-tau);
  return behind * transmitted + source * (1 - transmitted);
}
