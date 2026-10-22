/**
 * The bright-star catalogue's distances, for a sky flown through: the shared catalogue's
 * literature distance (`stellar.ts`) for a star it describes, otherwise the SIMBAD parallax
 * (`star-distances.json`, fetched by `scripts/fetch-star-distances.mjs`). The sky carried with
 * a camera never reads them, so only that sky's bundle carries the table.
 */
import type { Fact } from "@/lib/facts";
import { convertFigure } from "@horizon/toolkit/science";

import DISTANCES from "./star-distances.json";
import { NAMED_STARS, type NamedStarId, type StellarFigures } from "./stellar";

const DISTANCE_PC: Readonly<Record<string, number>> = DISTANCES.stars;

/** The catalogue stars the shared catalogue describes, by their catalogue names. */
const NAMED: Readonly<Record<string, NamedStarId>> = {
  "Rigil Kentaurus": "alpha-cen-a",
  Sirius: "sirius",
  Vega: "vega",
  Achernar: "achernar",
  Arcturus: "arcturus",
  Alnitak: "alnitak",
  Aldebaran: "aldebaran",
  Rigel: "rigel",
  Deneb: "deneb",
  Antares: "antares",
  Betelgeuse: "betelgeuse",
};

function namedDistance(name: string) {
  const id = NAMED[name];
  const figures: StellarFigures | undefined = id ? NAMED_STARS[id] : undefined;
  const fact: Fact | undefined = figures?.distance;
  return fact?.value === undefined ? undefined : convertFigure(fact.value, fact.unit, "pc");
}

/** A catalogue star's distance in parsecs; 0 when unknown. */
export function starDistance(name: string) {
  return namedDistance(name) ?? DISTANCE_PC[name] ?? 0;
}
