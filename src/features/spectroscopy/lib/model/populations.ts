import { SOLAR_HYDROGEN_MASS_FRACTION } from "@/space/solar-composition";
import {
  ATOMIC_MASS_KG,
  BOLTZMANN_CONSTANT,
  ELECTRON_MASS_KG,
  ELECTRON_VOLT_J,
  PLANCK_CONSTANT,
  PROTON_MASS_KG,
  RYDBERG_INFINITY,
} from "@horizon/toolkit/science";

import {
  ELEMENT_IDS,
  ELEMENTS,
  ionizationEnergy,
  partitionFunction,
  type ElementId,
  type Line,
} from "./atoms";

/**
 * How a gas in local thermodynamic equilibrium shares its atoms out: among ionization stages
 * by Saha's equation, among the levels of each stage by Boltzmann's. Temperatures in K,
 * electron pressure in Pa.
 */

/** k in eV per kelvin. */
export const BOLTZMANN_EV = BOLTZMANN_CONSTANT / ELECTRON_VOLT_J;

/** Hydrogen's Rydberg constant, m⁻¹: R∞ for the proton's finite mass, R_H = R∞ / (1 + mₑ / m_p). */
export const RYDBERG_HYDROGEN = RYDBERG_INFINITY / (1 + ELECTRON_MASS_KG / PROTON_MASS_KG);

/** (2π mₑ k / h²)^(3/2), m⁻³ K^(−3/2): the electron's quantum concentration per T^(3/2). */
const QUANTUM_CONCENTRATION =
  ((2 * Math.PI * ELECTRON_MASS_KG * BOLTZMANN_CONSTANT) / PLANCK_CONSTANT ** 2) ** 1.5;

/**
 * Saha: atoms in the next stage up per atom in this one, given the two stages' partition
 * functions and the ionization energy χ in eV,
 * N_{i+1}/N_i = (2 U_{i+1} / U_i) (2π mₑ k T / h²)^(3/2) (k T / Pₑ) e^(−χ/kT).
 * The printed equation (`equations.ts`) computes from this too.
 */
export function sahaFactor(
  upperPartition: number,
  lowerPartition: number,
  chi: number,
  kelvin: number,
  electronPressure: number,
) {
  const kT = BOLTZMANN_CONSTANT * kelvin;
  const exponent = -chi / (BOLTZMANN_EV * kelvin);
  return (
    ((2 * upperPartition) / lowerPartition) *
    QUANTUM_CONCENTRATION *
    kelvin ** 1.5 *
    (kT / electronPressure) *
    Math.exp(exponent)
  );
}

/** Saha's ratio for a species and the stage above it, from NIST's partition functions. */
function sahaRatio(species: string, next: string, kelvin: number, electronPressure: number) {
  return sahaFactor(
    partitionFunction(next, kelvin),
    partitionFunction(species, kelvin),
    ionizationEnergy(species),
    kelvin,
    electronPressure,
  );
}

/** The fraction of an element's atoms in each ionization stage, neutral first. */
export function ionizationFractions(element: ElementId, kelvin: number, electronPressure: number) {
  const { stages } = ELEMENTS[element];
  /* Cumulative products in logs, so a fully ionized gas does not overflow. */
  const logs = [0];
  for (let i = 1; i < stages.length; i++) {
    const ratio = sahaRatio(stages[i - 1]!, stages[i]!, kelvin, electronPressure);
    logs.push(logs[i - 1]! + Math.log(ratio));
  }
  const top = Math.max(...logs);
  const weights = logs.map((l) => Math.exp(l - top));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}

/** What Saha's equation needs of a gas: K and Pa. */
export type SahaGas = { temperature: number; electronPressure: number };

const fractionsByGas = new WeakMap<SahaGas, Partial<Record<ElementId, readonly number[]>>>();

/**
 * `ionizationFractions` in one gas, worked out once per gas and element: a star's cells are
 * asked for every line of an element. A gas is never changed once made, so it is its own key.
 */
export function ionizationIn(gas: SahaGas, element: ElementId): readonly number[] {
  let known = fractionsByGas.get(gas);
  if (!known) fractionsByGas.set(gas, (known = {}));
  return (known[element] ??= ionizationFractions(element, gas.temperature, gas.electronPressure));
}

/**
 * Boltzmann's factor g e^(−E/kT) for a level of statistical weight g at E eV: atoms in it per
 * atom in a level of weight 1 at the ground state. The printed equation computes from this too.
 */
export function boltzmannFactor(g: number, energy: number, kelvin: number) {
  return g * Math.exp(-energy / (BOLTZMANN_EV * kelvin));
}

/** Boltzmann: the fraction of a stage's atoms in a level, n / N = g e^(−E/kT) / U(T). */
function levelFraction(species: string, g: number, energy: number, kelvin: number) {
  return boltzmannFactor(g, energy, kelvin) / partitionFunction(species, kelvin);
}

/**
 * The share of an element's atoms ready to absorb a line, weighted by its oscillator
 * strength: (N_stage / N_element) · gf · e^(−E_lower/kT) / U. Multiplied by the element's
 * column it gives Σ n_lower f, which sets the line's strength.
 */
export function absorberShare(line: Line, gas: SahaGas) {
  const fraction = ionizationIn(gas, line.element)[line.stage] ?? 0;
  return fraction * levelFraction(line.species, 10 ** line.logGf, line.lower, gas.temperature);
}

/** The fraction of an element's atoms in one level of one stage: a point on Payne's curves. */
export function levelShare(
  element: ElementId,
  stage: number,
  g: number,
  energy: number,
  kelvin: number,
  electronPressure: number,
) {
  const species = ELEMENTS[element].stages[stage]!;
  const fraction = ionizationFractions(element, kelvin, electronPressure)[stage] ?? 0;
  return fraction * levelFraction(species, g, energy, kelvin);
}

/** Atoms of an element in a kilogram of the star's gas, its abundance changed by `shift` dex. */
export function atomsPerKilogram(element: ElementId, shift = 0) {
  const hydrogen = SOLAR_HYDROGEN_MASS_FRACTION / (ELEMENTS.H.atomicWeight * ATOMIC_MASS_KG);
  return hydrogen * 10 ** (ELEMENTS[element].abundance + shift - 12);
}

/** Nuclei of every element in a kilogram of gas with the Sun's composition. */
export const NUCLEI_PER_KILOGRAM = ELEMENT_IDS.reduce((sum, id) => sum + atomsPerKilogram(id), 0);
