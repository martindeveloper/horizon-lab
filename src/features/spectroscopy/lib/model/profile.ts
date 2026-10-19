import {
  ATOMIC_MASS_KG,
  BOLTZMANN_CONSTANT,
  CLASSICAL_ELECTRON_RADIUS_M,
  HC_EV_NM,
  SECOND_RADIATION_CONSTANT,
  SPEED_OF_LIGHT,
} from "@horizon/toolkit/science";

import { ELEMENTS, ionizationEnergy, type ElementId, type Line } from "./atoms";
import {
  absorberShare,
  atomsPerKilogram,
  ionizationFractions,
  NUCLEI_PER_KILOGRAM,
} from "./populations";
import { voigt } from "./voigt";

/** The state of a gas in local thermodynamic equilibrium. */
export type Conditions = {
  /** Sets excitation, ionization and thermal motion, K. */
  temperature: number;
  /** Pa. */
  electronPressure: number;
  /** Pa; sets collisional broadening. */
  gasPressure: number;
  /** Small-scale turbulent speeds added to thermal motion, km/s. */
  microturbulence: number;
};

/** A uniform slab of gas: its conditions and the atoms of each element in a column through it, m⁻². */
export type Gas = Conditions & { columns: Partial<Record<ElementId, number>> };

/** A line's shape: τ(λ) ∝ H(a, v), v = (λ − centre) / doppler. */
export type Shape = {
  /** Observed line centre, nm (air). */
  centre: number;
  /** Doppler width Δλ_D, nm. */
  doppler: number;
  /** Voigt damping a: the Lorentzian half-width in Doppler widths. */
  damping: number;
  /**
   * Hydrogen: the Stark width in Doppler widths, beyond which the wings fall as v^(−5/2)
   * (Holtsmark's quasi-static limit) instead of a Lorentzian's v⁻².
   */
  holtsmark?: number;
};

/** The shape's value v Doppler widths from centre: H(a, v), with hydrogen's Stark wings. */
export function shapeAt(shape: Shape, v: number) {
  const h = voigt(shape.damping, v);
  const edge = shape.holtsmark;
  const x = Math.abs(v);
  return edge !== undefined && x > edge ? h * Math.sqrt(edge / x) : h;
}

/** A line's optical depth: τ(λ) = peak · H(a, v), so τ at centre is peak · H(a, 0). */
export type Profile = Shape & { peak: number };

/** Radiation damping's Lorentz width, the classical (4π/3) rₑ, nm: 1.18 × 10⁻⁵ nm. */
export const RADIATIVE_FWHM = ((4 * Math.PI) / 3) * CLASSICAL_ELECTRON_RADIUS_M * 1e9;

/**
 * Collisions with neutral hydrogen (van der Waals), as a full width in rad s⁻¹. Where Barklem,
 * Piskunov & O'Mara (2000) list the line, their quantum-mechanical (ABO) cross-section:
 * γ = γ₁₀₀₀₀ (T / 10⁴ K)^((1 − α)/2) n_H, with n_H the neutral hydrogen atoms per cm³.
 */
function hydrogenCollisionRate(line: Line, c: Conditions) {
  const abo = line.hydrogenCollisions;
  if (abo) return 10 ** abo.logGamma * (c.temperature / 1e4) ** abo.exponent * neutralHydrogen(c);
  return UNSOLD_ENHANCEMENT * unsoldRate(line, c);
}

/** Neutral hydrogen atoms per cm³: the Sun's share of the heavy particles, by Saha. */
function neutralHydrogen(c: Conditions) {
  const heavy = (c.gasPressure - c.electronPressure) / (BOLTZMANN_CONSTANT * c.temperature);
  const neutral = ionizationFractions("H", c.temperature, c.electronPressure)[0]!;
  return Math.max(0, heavy) * HYDROGEN_SHARE * neutral * 1e-6;
}
const HYDROGEN_SHARE = atomsPerKilogram("H") / NUCLEI_PER_KILOGRAM;

/**
 * Otherwise Unsöld's (1955) approximation in Gray's form (The Observation and Analysis of
 * Stellar Photospheres, eq. 11.29–11.30, cgs):
 * log γ₆ = 19.6 + ⅖ log C₆ + log P_g − 0.7 log T, C₆ = 0.3 × 10⁻³⁰ [(I − χ − χ_λ)⁻² − (I − χ)⁻²].
 */
export function unsoldRate(line: Line, c: Conditions) {
  const limit = ionizationEnergy(line.species);
  const photon = HC_EV_NM / line.wavelength;
  const upper = limit - line.lower - photon;
  if (upper <= 0.1) return 0;
  const c6 = 0.3e-30 * (1 / upper ** 2 - 1 / (limit - line.lower) ** 2);
  if (!(c6 > 0)) return 0;
  const gasPressureCgs = c.gasPressure * 10;
  return (
    10 **
    (19.6 + 0.4 * Math.log10(c6) + Math.log10(gasPressureCgs) - 0.7 * Math.log10(c.temperature))
  );
}

/**
 * Unsöld's widths fall short of ABO's: for the lab's lines that Barklem et al. list, by a
 * median factor of this much in the Sun's photosphere, which the rest are given.
 */
export const UNSOLD_ENHANCEMENT = 1.15;

function vanDerWaalsFwhm(line: Line, c: Conditions) {
  const metres = line.wavelength * 1e-9;
  return ((hydrogenCollisionRate(line, c) * metres ** 2) / (2 * Math.PI * SPEED_OF_LIGHT)) * 1e9;
}

/**
 * Hydrogen's levels split in the electric fields of nearby ions (the linear Stark effect), so
 * its lines widen with electron density: Hβ's half-maximum width is 4.8 nm at nₑ = 10²³ m⁻³
 * and grows as nₑ^0.68 (Gigosos, González & Cardeñoso 2003). The other Balmer lines scale with
 * n_upper² − n_lower², as the linear Stark splitting does. The core is drawn as a Lorentzian;
 * past the Stark width the wings steepen to Holtsmark's Δλ^(−5/2).
 */
function starkFwhm(line: Line, c: Conditions) {
  if (line.species !== "H I") return 0;
  const upper = Number.parseInt(line.upperLevel.configuration, 10);
  const lower = Number.parseInt(line.lowerLevel.configuration, 10);
  const density = c.electronPressure / (BOLTZMANN_CONSTANT * c.temperature);
  return 4.8 * (density / 1e23) ** 0.681 * ((upper ** 2 - lower ** 2) / 12);
}

/** Doppler width Δλ_D = (λ / c) √(2kT / m + ξ²), nm. */
export function dopplerWidth(
  nm: number,
  element: ElementId,
  kelvin: number,
  microturbulence: number,
) {
  const thermal = (2 * BOLTZMANN_CONSTANT * kelvin) / (ELEMENTS[element].mass * ATOMIC_MASS_KG);
  return (nm * Math.sqrt(thermal + (microturbulence * 1e3) ** 2)) / SPEED_OF_LIGHT;
}

/** The line's total Lorentz width (full width at half maximum): radiation, collisions, Stark, nm. */
export const lorentzFwhm = (line: Line, c: Conditions) =>
  RADIATIVE_FWHM + vanDerWaalsFwhm(line, c) + starkFwhm(line, c);

/** The line's shape under some conditions, its centre moved by `shift` (λ_observed / λ_rest). */
export function lineShape(line: Line, c: Conditions, shift = 1): Shape {
  const doppler = dopplerWidth(line.wavelength, line.element, c.temperature, c.microturbulence);
  const stark = starkFwhm(line, c);
  return {
    centre: line.wavelength * shift,
    doppler: doppler * shift,
    damping: lorentzFwhm(line, c) / (2 * doppler),
    ...(stark > 0 ? { holtsmark: Math.max(3, stark / doppler) } : {}),
  };
}

/**
 * What one atom of the element contributes to the line, integrated over wavelength, m³:
 * (Σ n_lower f / N) · π rₑ λ² · (1 − e^(−hc/λkT)), the last factor for stimulated emission.
 * Divided by √π Δλ_D it is the cross-section where H(a, v) = 1.
 */
export function lineCrossSection(line: Line, c: Conditions) {
  const metres = line.wavelength * 1e-9;
  const stimulated = -Math.expm1(-SECOND_RADIATION_CONSTANT / (metres * c.temperature));
  const share = absorberShare(line, c.temperature, c.electronPressure);
  return share * Math.PI * CLASSICAL_ELECTRON_RADIUS_M * metres ** 2 * stimulated;
}

/** A line's profile in a slab of gas; null when the gas holds none of its element. */
export function lineProfile(line: Line, gas: Gas, shift = 1): Profile | null {
  const column = gas.columns[line.element];
  if (!column) return null;
  const shape = lineShape(line, gas, shift);
  const crossSection = lineCrossSection(line, gas);
  if (!(crossSection > 0)) return null;
  const peak = (column * crossSection) / (Math.sqrt(Math.PI) * (shape.doppler / shift) * 1e-9);
  return { ...shape, peak };
}

/**
 * How far from centre the line still matters (τ above `floor`), in nm: the Doppler core, or
 * the Lorentz wings where τ ≈ peak · a / (√π v²) falls to the floor; never beyond `cap`.
 */
export function reach(p: Profile, floor = 1e-4, cap = 40) {
  const core = Math.sqrt(Math.max(1, Math.log(p.peak / floor)));
  const wings = Math.sqrt((p.peak * p.damping) / (Math.sqrt(Math.PI) * floor));
  return Math.min(cap, p.doppler * Math.max(3, core, wings));
}
