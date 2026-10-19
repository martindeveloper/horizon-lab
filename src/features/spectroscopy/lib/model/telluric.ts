import {
  ATOMIC_MASS_KG,
  BOLTZMANN_CONSTANT,
  SPEED_OF_LIGHT,
  vacuumToAir,
} from "@horizon/toolkit/science";

import type { Profile } from "./profile";

/**
 * Earth's own lines: oxygen in the air absorbs the A band (759 nm) and the B band (687 nm),
 * which Fraunhofer lettered with the Sun's lines. They come from the air above the telescope,
 * so they never shift with the star.
 *
 * A rigid-rotor sketch of the two bands of O₂'s b¹Σg⁺ ← X³Σg⁻ transition: P and R branches from
 * the odd rotational levels ¹⁶O₂ populates (its nuclei have no spin), with the spin-triplet
 * structure folded into each line, at a mean column temperature of 255 K. The band origins,
 * rotational constants and integrated strengths are the measured ones.
 */

/** cm⁻¹ per K (hc/k inverse): kT / (hc) at 1 K. */
const WAVENUMBER_PER_KELVIN = 0.6950348;
const COLUMN_TEMPERATURE = 255;
/** O₂ molecules above sea level, cm⁻²: 20.95 % of the air's 2.15 × 10²⁵ molecules cm⁻². */
const O2_COLUMN = 0.2095 * 2.147e25;
/** Pressure-broadened Lorentz half-width, cm⁻¹, at the column's mean pressure. */
const LORENTZ_HWHM = 0.035;
const O2_MASS = 31.999 * ATOMIC_MASS_KG;
/** Ground-state rotational constant B″ (v = 0), cm⁻¹. */
const B_LOWER = 1.43777;

const BANDS = [
  /* b¹Σg⁺(v′=0) ← X(v″=0): Fraunhofer's A */
  { id: "A", origin: 13120.909, upperB: 1.39124, strength: 2.25e-22 },
  /* b¹Σg⁺(v′=1) ← X(v″=0): Fraunhofer's B */
  { id: "B", origin: 14525.661, upperB: 1.37315, strength: 1.5e-23 },
] as const;

function bandProfiles(band: (typeof BANDS)[number]): Profile[] {
  const lines: { wavenumber: number; weight: number }[] = [];
  const kT = WAVENUMBER_PER_KELVIN * COLUMN_TEMPERATURE;
  for (let N = 1; N <= 41; N += 2) {
    const lower = B_LOWER * N * (N + 1);
    const boltzmann = Math.exp(-lower / kT);
    /* R branch N′ = N + 1, P branch N′ = N − 1, with Hönl–London weights N + 1 and N. */
    lines.push({
      wavenumber: band.origin + band.upperB * (N + 1) * (N + 2) - lower,
      weight: (N + 1) * boltzmann,
    });
    if (N > 1)
      lines.push({
        wavenumber: band.origin + band.upperB * (N - 1) * N - lower,
        weight: N * boltzmann,
      });
  }
  const total = lines.reduce((sum, l) => sum + l.weight, 0);
  return lines.map(({ wavenumber, weight }) => {
    const centre = vacuumToAir(1e7 / wavenumber);
    const dopplerWavenumber =
      (wavenumber * Math.sqrt((2 * BOLTZMANN_CONSTANT * COLUMN_TEMPERATURE) / O2_MASS)) /
      SPEED_OF_LIGHT;
    /* τ(ν) = S N φ(ν), φ = H(a, v) / (√π Δν_D): the same Voigt shape in wavelength. */
    const peak =
      (((band.strength * weight) / total) * O2_COLUMN) / (Math.sqrt(Math.PI) * dopplerWavenumber);
    return {
      centre,
      doppler: (centre * dopplerWavenumber) / wavenumber,
      damping: LORENTZ_HWHM / dopplerWavenumber,
      peak,
    };
  });
}

/** Every O₂ line of both bands for one airmass, air wavelengths. */
export const TELLURIC: readonly Profile[] = BANDS.flatMap(bandProfiles);

const headOf = (band: (typeof BANDS)[number]) =>
  Math.min(...bandProfiles(band).map((p) => p.centre));

/** Where each band's lines pile up into a head: the edge Fraunhofer saw. */
export const BAND_HEADS = { A: headOf(BANDS[0]), B: headOf(BANDS[1]) };
