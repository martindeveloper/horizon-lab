import type { BodyRef } from "./body-reference";
import { PLANETS } from "./solar-system/model/catalogue";
import {
  BLACK_HOLES,
  ENGINES,
  NAMED_STARS,
  SPECTRAL_TYPES,
  type Engine,
  type StellarFigures,
} from "./stellar";

/** Planetary heat sources; the stellar catalogue owns the stars' and holes' engines. */
const PLANET_ENGINES: Partial<Record<keyof typeof PLANETS, Engine>> = {
  earth: {
    process: "radioactivity",
    sources: ["kamland2011"],
    status: "verified",
    note: "no fusion: radioactive decay supplies about half its heat, the rest is left from its formation",
  },
  jupiter: {
    process: "contraction",
    sources: ["li2018"],
    status: "derived",
    note: "no fusion: it radiates more heat than it absorbs, left from its formation and released as it slowly contracts and cools",
  },
};

type BodyRecord = {
  figures: StellarFigures;
  engine: Engine | undefined;
  spectralType: string | undefined;
};

/** Resolve once at the model boundary. Route and manifest consumers need only BodyRef. */
export function bodyRecord(ref: BodyRef): BodyRecord {
  switch (ref.catalogue) {
    case "stars":
      if (!Object.hasOwn(NAMED_STARS, ref.id)) break;
      return {
        figures: NAMED_STARS[ref.id],
        engine: ENGINES[ref.id],
        spectralType: SPECTRAL_TYPES[ref.id],
      };
    case "holes":
      if (!Object.hasOwn(BLACK_HOLES, ref.id)) break;
      return { figures: BLACK_HOLES[ref.id], engine: ENGINES[ref.id], spectralType: undefined };
    case "planets": {
      if (!Object.hasOwn(PLANETS, ref.id)) break;
      const { equatorialRadius: radius, polarRadius: polar, mass, rotation } = PLANETS[ref.id];
      return {
        figures: { radius, polar, mass, rotation },
        engine: PLANET_ENGINES[ref.id],
        spectralType: undefined,
      };
    }
  }
  throw new Error(`Unknown body ${ref.catalogue}:${ref.id}`);
}
