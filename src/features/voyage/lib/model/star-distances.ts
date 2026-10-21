/**
 * The catalogue stars' distances (SIMBAD parallaxes, `star-distances.json`, fetched by
 * `scripts/fetch-star-distances.mjs`), for a sky flown through. The sky carried with a camera
 * never reads them, so only that sky's bundle carries the table.
 */
import DISTANCES from "./star-distances.json";

const DISTANCE_PC: Readonly<Record<string, number>> = DISTANCES.stars;

/** A catalogue star's distance in parsecs; 0 when unknown. */
export function starDistance(name: string) {
  return DISTANCE_PC[name] ?? 0;
}
