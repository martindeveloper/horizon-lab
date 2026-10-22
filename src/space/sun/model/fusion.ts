/**
 * What powers the Sun: the proton–proton chain turns four hydrogen atoms into one helium atom
 * and the mass they lose into light (Borexino 2018 measured it by its neutrinos). The lost
 * share follows from the atomic weights (the electrons cancel); the mass the Sun radiates away
 * each second from its luminosity, E = mc² the other way round.
 */
import { PERIODIC_TABLE, SPEED_OF_LIGHT, UNITS } from "@horizon/toolkit/science";

/** The share of four hydrogen atoms' mass that becomes energy in one helium atom: 0.71 %. */
export const PP_MASS_FRACTION =
  (4 * PERIODIC_TABLE.H.atomicWeight - PERIODIC_TABLE.He.atomicWeight) /
  (4 * PERIODIC_TABLE.H.atomicWeight);

/** The energy released by fusing `hydrogenKg` of hydrogen to helium, J. */
export const fusionEnergy = (hydrogenKg: number) =>
  PP_MASS_FRACTION * hydrogenKg * SPEED_OF_LIGHT ** 2;

/** The mass a luminosity `watts` carries away each second, kg/s: Ṁ = L / c². */
export const massToEnergyRate = (watts: number) => watts / SPEED_OF_LIGHT ** 2;

/** Hydrogen the Sun burns each second to shine at one L☉, kg/s. */
export const hydrogenBurnRate = (watts: number) => massToEnergyRate(watts) / PP_MASS_FRACTION;

/** The Sun's own figures: mass lost and hydrogen burnt each second at the nominal luminosity. */
export const SOLAR_MASS_LOSS_KG_S = massToEnergyRate(UNITS.Lsun.factor);
export const SOLAR_HYDROGEN_BURN_KG_S = hydrogenBurnRate(UNITS.Lsun.factor);
