import {
  BOLTZMANN_CONSTANT,
  ELECTRON_MASS_KG,
  ELECTRON_VOLT_J,
  PLANCK_CONSTANT,
} from "@horizon/toolkit/science";

import { ELEMENTS, ionizationEnergy, partitionFunction, type ElementId, type Line } from "./atoms";

/**
 * How a gas in local thermodynamic equilibrium shares its atoms out: among ionization stages
 * by Saha's equation, among the levels of each stage by Boltzmann's. Temperatures in K,
 * electron pressure in Pa.
 */

/** k in eV per kelvin. */
export const BOLTZMANN_EV = BOLTZMANN_CONSTANT / ELECTRON_VOLT_J;

/** (2π mₑ k / h²)^(3/2), m⁻³ K^(−3/2): the electron's quantum concentration per T^(3/2). */
const QUANTUM_CONCENTRATION =
  ((2 * Math.PI * ELECTRON_MASS_KG * BOLTZMANN_CONSTANT) / PLANCK_CONSTANT ** 2) ** 1.5;

/**
 * Saha: atoms in the next stage up per atom in this one,
 * N_{i+1}/N_i = (2 U_{i+1} / U_i) (2π mₑ k T / h²)^(3/2) (k T / Pₑ) e^(−χ/kT).
 */
export function sahaRatio(species: string, next: string, kelvin: number, electronPressure: number) {
  const kT = BOLTZMANN_CONSTANT * kelvin;
  const exponent = -ionizationEnergy(species) / (BOLTZMANN_EV * kelvin);
  return (
    ((2 * partitionFunction(next, kelvin)) / partitionFunction(species, kelvin)) *
    QUANTUM_CONCENTRATION *
    kelvin ** 1.5 *
    (kT / electronPressure) *
    Math.exp(exponent)
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

/**
 * Boltzmann: the fraction of a stage's atoms in a level of statistical weight g at E eV,
 * n / N = g e^(−E/kT) / U(T).
 */
export function levelFraction(species: string, g: number, energy: number, kelvin: number) {
  return (g * Math.exp(-energy / (BOLTZMANN_EV * kelvin))) / partitionFunction(species, kelvin);
}

/**
 * The share of an element's atoms ready to absorb a line, weighted by its oscillator
 * strength: (N_stage / N_element) · gf · e^(−E_lower/kT) / U. Multiplied by the element's
 * column it gives Σ n_lower f, which sets the line's strength.
 */
export function absorberShare(line: Line, kelvin: number, electronPressure: number) {
  const fraction = ionizationFractions(line.element, kelvin, electronPressure)[line.stage] ?? 0;
  return fraction * levelFraction(line.species, 10 ** line.logGf, line.lower, kelvin);
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
