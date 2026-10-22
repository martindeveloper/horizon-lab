/**
 * The Sun's photospheric composition (Asplund et al. 2009, ARA&A 47, 481), for every simulation
 * that mixes a star's gas: abundances as log ε = log(N / N_H) + 12 for the elements the labs
 * draw, and hydrogen's share of the mass.
 */
import { keysOf } from "@horizon/toolkit/records";
import { PERIODIC_TABLE, type ElementSymbol } from "@horizon/toolkit/science";

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

/**
 * The mean mass per particle of the Sun's photospheric gas, neutral and atomic, in atomic mass
 * units: each element's atomic weight averaged by its share of the atoms (hydrogen and helium
 * carry it; the listed metals add a few thousandths).
 */
export const SOLAR_MEAN_MOLECULAR_WEIGHT = (() => {
  let atoms = 0;
  let mass = 0;
  for (const symbol of keysOf(SOLAR_ABUNDANCES)) {
    const share = 10 ** (SOLAR_ABUNDANCES[symbol] - SOLAR_ABUNDANCES.H);
    atoms += share;
    mass += share * PERIODIC_TABLE[symbol].atomicWeight;
  }
  return mass / atoms;
})();
