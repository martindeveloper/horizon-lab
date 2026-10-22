import type { Fact } from "@/lib/facts";
import { SPECTRAL_CLASSES, spectralClass } from "@/space/hr-diagram";
import {
  NAMED_STARS,
  SPECTRAL_TYPES,
  type NamedStarId,
  type StellarFigures,
} from "@/space/stellar";
import { recordBy } from "@horizon/toolkit/records";

import { mainSequencePhotosphere, SEQUENCE_RANGE } from "./atmospheres";

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

/** The selected bodies in spectral order; only departures from catalogue defaults are written. */
type Definition = {
  id: NamedStarId;
  teff?: Temperature;
  velocity?: number;
  microturbulence?: number;
};
/**
 * Bright stars down the spectral sequence, using the nearest ATLAS9 atmosphere and measured
 * radial velocity. M stars are left out: molecules, which this lab does not model, dominate.
 */
const ENTRIES = [
  { id: "alnitak" },
  { id: "rigel" },
  {
    id: "vega",
    /* Vega is a rapid rotator seen pole-on. Its integrated spectrum uses the catalogue's
       disc temperature, while the reported measurement keeps the equator-to-pole span. */
    teff: {
      kelvin: NAMED_STARS.vega.discTeff.value,
      catalogue: NAMED_STARS.vega.teff,
      source: "the shared catalogue's disc temperature (Castelli & Kurucz 1994)",
    },
  },
  { id: "procyon" },
  /* The Sun's own frame and measured microturbulence. */
  { id: "sun", velocity: 0, microturbulence: 1 },
  { id: "arcturus" },
  { id: "aldebaran" },
] as const satisfies readonly Definition[];
export type StarId = (typeof ENTRIES)[number]["id"];
export const STAR_IDS = ENTRIES.map(({ id }) => id);

function starOf({ id, teff, velocity, microturbulence }: Definition & { id: StarId }): Star {
  const measured: StellarFigures = NAMED_STARS[id];
  const temperature = teff ?? (measured.teff ? catalogued(measured.teff) : undefined);
  const radialVelocity = velocity ?? measured.radialVelocity?.value;
  if (!temperature || radialVelocity === undefined)
    throw new Error(`Missing spectral measurements for ${id}`);
  return {
    id,
    type: typeOf(id),
    teff: temperature,
    velocity: radialVelocity,
    microturbulence: microturbulence ?? 2,
  };
}

export const STARS = recordBy(ENTRIES, ({ id }) => id, starOf);

/** Main-sequence effective temperatures the line-strength curves are drawn at, K. */
export const SEQUENCE_TEMPERATURES = Array.from({ length: 30 }, (_, i) =>
  Math.round(SEQUENCE_RANGE[0] * (29_000 / SEQUENCE_RANGE[0]) ** (i / 29)),
);

export { mainSequencePhotosphere, SPECTRAL_CLASSES, spectralClass };
