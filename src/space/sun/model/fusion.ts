/**
 * What powers the Sun: the proton–proton chain turns four hydrogen atoms into one helium atom
 * and the mass they lose into energy, including escaping neutrinos. The lost
 * share follows from isotope masses, including positron annihilation; the mass the Sun radiates away
 * each second from its luminosity, E = mc² the other way round.
 */
import { CONSTANTS, SPEED_OF_LIGHT, UNITS } from "@horizon/toolkit/science";

const HYDROGEN = CONSTANTS.hydrogen1AtomicMass.value;
const HELIUM = CONSTANTS.helium4AtomicMass.value;

/** The share of four hydrogen atoms' mass that becomes energy in one helium atom: 0.71 %. */
export const PP_MASS_FRACTION = (4 * HYDROGEN - HELIUM) / (4 * HYDROGEN);

/** Total energy, including neutrinos, released by fusing `hydrogenKg` of ¹H to ⁴He, J. */
export const fusionEnergy = (hydrogenKg: number) =>
  PP_MASS_FRACTION * hydrogenKg * SPEED_OF_LIGHT ** 2;

/** The mass a luminosity `watts` carries away each second, kg/s: Ṁ = L / c². */
export const massToEnergyRate = (watts: number) => watts / SPEED_OF_LIGHT ** 2;

/** Photon-equivalent lower estimate, kg/s; ignores energy carried away by neutrinos. */
export const hydrogenBurnRate = (watts: number) => massToEnergyRate(watts) / PP_MASS_FRACTION;

/** Photon luminosity's mass equivalent and a lower estimate of hydrogen consumption, kg/s. */
export const SOLAR_MASS_LOSS_KG_S = massToEnergyRate(UNITS.Lsun.factor);
export const SOLAR_HYDROGEN_BURN_KG_S = hydrogenBurnRate(UNITS.Lsun.factor);
