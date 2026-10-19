import {
  mainSequencePhotosphere,
  SEQUENCE_RANGE,
  starPhotosphere,
  type Photosphere,
} from "./atmospheres";

/**
 * Bright stars down the spectral sequence. Each is drawn with the ATLAS9 model nearest its
 * measured effective temperature and gravity, the Sun's composition, and its measured radial
 * velocity. M stars are left out: molecules (TiO above all), which the lab does not model,
 * dominate their spectra.
 */
export const STAR_IDS = [
  "alnitak",
  "rigel",
  "vega",
  "procyon",
  "sun",
  "arcturus",
  "aldebaran",
] as const;
export type StarId = (typeof STAR_IDS)[number];

export type Star = {
  id: StarId;
  /** MK spectral type. */
  type: string;
  /** Measured effective temperature, K. */
  teff: number;
  /** Measured radial velocity, km/s (heliocentric, as SIMBAD lists it; positive receding). */
  velocity: number;
  /** km/s: the Sun's measured one; elsewhere the models' own 2 km/s. */
  microturbulence: number;
  /** Where the effective temperature comes from. */
  source: string;
};

export const STARS: Record<StarId, Star> = {
  alnitak: {
    id: "alnitak",
    type: "O9.5 Iab",
    teff: 29_500,
    velocity: 18.1,
    microturbulence: 2,
    source: "Hummel et al. 2013, A&A 554, A52",
  },
  rigel: {
    id: "rigel",
    type: "B8 Ia",
    teff: 12_000,
    velocity: 17.8,
    microturbulence: 2,
    source: "Przybilla et al. 2006, A&A 445, 1099",
  },
  vega: {
    id: "vega",
    type: "A0 V",
    teff: 9_550,
    velocity: -13.5,
    microturbulence: 2,
    source: "Castelli & Kurucz 1994, A&A 281, 817",
  },
  procyon: {
    id: "procyon",
    type: "F5 IV–V",
    teff: 6_530,
    velocity: -4.5,
    microturbulence: 2,
    source: "Kervella et al. 2004, A&A 413, 251",
  },
  sun: {
    id: "sun",
    type: "G2 V",
    teff: 5_772,
    velocity: 0,
    microturbulence: 1,
    source: "IAU 2015 Resolution B3",
  },
  arcturus: {
    id: "arcturus",
    type: "K1.5 III",
    teff: 4_286,
    velocity: -5.2,
    microturbulence: 2,
    source: "Ramírez & Allende Prieto 2011, ApJ 743, 135",
  },
  aldebaran: {
    id: "aldebaran",
    type: "K5 III",
    teff: 3_900,
    velocity: 54.4,
    microturbulence: 2,
    source: "Heiter et al. 2015, A&A 582, A49",
  },
};

export const photosphereOf = (id: StarId): Photosphere => starPhotosphere(id);

/** Main-sequence effective temperatures the line-strength curves are drawn at, K. */
export const SEQUENCE_TEMPERATURES = Array.from({ length: 30 }, (_, i) =>
  Math.round(SEQUENCE_RANGE[0] * (29_000 / SEQUENCE_RANGE[0]) ** (i / 29)),
);

/**
 * Main-sequence classes by effective temperature, hot to cool: where each begins, K, halfway
 * between the last subtype of the class above and its own first (Pecaut & Mamajek 2013, as
 * updated: O9.5 V 31,900 / B0 V 31,400 … K9 V 3,930 / M0 V 3,850).
 */
export const SPECTRAL_CLASSES = [
  ["O", 31_650],
  ["B", 10_050],
  ["A", 7310],
  ["F", 5960],
  ["G", 5325],
  ["K", 3890],
  ["M", 0],
] as const;

/** A main-sequence star's spectral class. */
export const spectralClass = (teff: number) =>
  SPECTRAL_CLASSES.find(([, from]) => teff >= from)?.[0] ?? "M";

export { mainSequencePhotosphere };
