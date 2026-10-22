import type { Fact } from "@/lib/facts";
import { SPECTRAL_CLASSES, spectralClass } from "@/space/hr-diagram";
import { NAMED_STARS, SPECTRAL_TYPES } from "@/space/stellar";

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
  /** MK spectral type, the shared catalogue's. */
  type: string;
  teff: Temperature;
  /** Measured radial velocity, km/s (the shared catalogue's, heliocentric; positive receding); the Sun's own frame for the Sun. */
  velocity: number;
  /** km/s: the Sun's measured one; elsewhere the models' own 2 km/s. */
  microturbulence: number;
};

/** A star's spectral type from the shared catalogue, which lists every star the lab draws. */
function typeOf(id: StarId) {
  const type = SPECTRAL_TYPES[id];
  if (!type) throw new Error(`The catalogue has no spectral type for ${id}`);
  return type;
}

/** The catalogue's effective temperature of a star it gives one value for. */
function catalogued(fact: Fact): Temperature {
  if (fact.value === undefined) throw new Error("The catalogue gives only a span");
  return { kelvin: fact.value, catalogue: fact };
}

export const STARS: Record<StarId, Star> = {
  alnitak: {
    id: "alnitak",
    type: typeOf("alnitak"),
    teff: catalogued(NAMED_STARS.alnitak.teff),
    velocity: NAMED_STARS.alnitak.radialVelocity.value,
    microturbulence: 2,
  },
  rigel: {
    id: "rigel",
    type: typeOf("rigel"),
    teff: catalogued(NAMED_STARS.rigel.teff),
    velocity: NAMED_STARS.rigel.radialVelocity.value,
    microturbulence: 2,
  },
  vega: {
    id: "vega",
    type: typeOf("vega"),
    /* Vega is a rapid rotator seen pole-on: the catalogue's span runs from its equator to its
       pole. A spectrum integrates the whole disc, which one plane-parallel model fits best at
       this temperature. */
    teff: {
      kelvin: NAMED_STARS.vega.discTeff.value,
      catalogue: NAMED_STARS.vega.teff,
      source: "the shared catalogue's disc temperature (Castelli & Kurucz 1994)",
    },
    velocity: NAMED_STARS.vega.radialVelocity.value,
    microturbulence: 2,
  },
  procyon: {
    id: "procyon",
    type: typeOf("procyon"),
    teff: catalogued(NAMED_STARS.procyon.teff),
    velocity: NAMED_STARS.procyon.radialVelocity.value,
    microturbulence: 2,
  },
  sun: {
    id: "sun",
    type: typeOf("sun"),
    teff: catalogued(NAMED_STARS.sun.teff),
    velocity: 0,
    microturbulence: 1,
  },
  arcturus: {
    id: "arcturus",
    type: typeOf("arcturus"),
    teff: catalogued(NAMED_STARS.arcturus.teff),
    velocity: NAMED_STARS.arcturus.radialVelocity.value,
    microturbulence: 2,
  },
  aldebaran: {
    id: "aldebaran",
    type: typeOf("aldebaran"),
    teff: catalogued(NAMED_STARS.aldebaran.teff),
    velocity: NAMED_STARS.aldebaran.radialVelocity.value,
    microturbulence: 2,
  },
};

/** Main-sequence effective temperatures the line-strength curves are drawn at, K. */
export const SEQUENCE_TEMPERATURES = Array.from({ length: 30 }, (_, i) =>
  Math.round(SEQUENCE_RANGE[0] * (29_000 / SEQUENCE_RANGE[0]) ** (i / 29)),
);

export { mainSequencePhotosphere, SPECTRAL_CLASSES, spectralClass };
