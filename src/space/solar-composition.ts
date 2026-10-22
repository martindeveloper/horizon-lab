/**
 * The Sun's photospheric composition (Asplund et al. 2009, ARA&A 47, 481), for every simulation
 * that mixes a star's gas: abundances as log ε = log(N / N_H) + 12 for the elements the labs
 * draw, and hydrogen's share of the mass.
 */
import type { ElementSymbol } from "@horizon/toolkit/science";

export const SOLAR_ABUNDANCES = {
  H: 12,
  He: 10.93,
  Li: 1.05,
  Na: 6.24,
  K: 5.03,
  Mg: 7.6,
  Ca: 6.34,
  Fe: 7.5,
} as const satisfies Partial<Record<ElementSymbol, number>>;

/** Hydrogen's mass fraction X. */
export const SOLAR_HYDROGEN_MASS_FRACTION = 0.7381;
