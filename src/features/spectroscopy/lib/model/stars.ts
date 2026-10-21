import type { Fact } from "@/lib/facts";
import { NAMED_STARS } from "@/space/stellar";

import { mainSequencePhotosphere, SEQUENCE_RANGE } from "./atmospheres";

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

/**
 * A star's effective temperature, K: the shared catalogue's figure (`NAMED_STARS`, sourced and
 * checked there), or the lab's own where the catalogue has no single value for it.
 */
type Temperature =
  | { kelvin: number; catalogue: Fact }
  | {
      kelvin: number;
      /** The catalogue's figure beside it, where there is one (a span, say), else null. */
      catalogue: Fact | null;
      /** Where the lab's value comes from, and why it is not the catalogue's. */
      source: string;
    };

type Star = {
  id: StarId;
  /** MK spectral type. */
  type: string;
  teff: Temperature;
  /** Measured radial velocity, km/s (heliocentric, as SIMBAD lists it; positive receding). */
  velocity: number;
  /** km/s: the Sun's measured one; elsewhere the models' own 2 km/s. */
  microturbulence: number;
};

/** The catalogue's effective temperature of a star it gives one value for. */
function catalogued(fact: Fact): Temperature {
  if (fact.value === undefined) throw new Error("The catalogue gives only a span");
  return { kelvin: fact.value, catalogue: fact };
}

export const STARS: Record<StarId, Star> = {
  alnitak: {
    id: "alnitak",
    type: "O9.5 Iab",
    teff: catalogued(NAMED_STARS.alnitak.teff),
    velocity: 18.1,
    microturbulence: 2,
  },
  rigel: {
    id: "rigel",
    type: "B8 Ia",
    teff: catalogued(NAMED_STARS.rigel.teff),
    velocity: 17.8,
    microturbulence: 2,
  },
  vega: {
    id: "vega",
    type: "A0 V",
    /* Vega is a rapid rotator seen pole-on: the catalogue's span runs from its equator to its
       pole. A spectrum integrates the whole disc, which one plane-parallel model fits best at
       this temperature. */
    teff: {
      kelvin: 9_550,
      catalogue: NAMED_STARS.vega.teff,
      source: "Castelli & Kurucz 1994, A&A 281, 817 (a model-atmosphere fit to the disc's light)",
    },
    velocity: -13.5,
    microturbulence: 2,
  },
  procyon: {
    id: "procyon",
    type: "F5 IV–V",
    teff: catalogued(NAMED_STARS.procyon.teff),
    velocity: -4.5,
    microturbulence: 2,
  },
  sun: {
    id: "sun",
    type: "G2 V",
    teff: catalogued(NAMED_STARS.sun.teff),
    velocity: 0,
    microturbulence: 1,
  },
  arcturus: {
    id: "arcturus",
    type: "K1.5 III",
    teff: catalogued(NAMED_STARS.arcturus.teff),
    velocity: -5.2,
    microturbulence: 2,
  },
  aldebaran: {
    id: "aldebaran",
    type: "K5 III",
    teff: catalogued(NAMED_STARS.aldebaran.teff),
    velocity: 54.4,
    microturbulence: 2,
  },
};

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
