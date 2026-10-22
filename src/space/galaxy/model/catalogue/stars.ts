import type { Facts, Value } from "@/lib/facts";
import type { SourceId } from "@/lib/sources";
/** The nearest stars, from their astrometry (neighbours.ts) through the science kit's laws. */
import { angularSeparation, convert, parallaxDistance } from "@horizon/toolkit/science";

import { closestApproach, neighbour, neighbourSeparationAu, type NeighbourId } from "../neighbours";

/**
 * A neighbour's figures: distance by the parallax law, radial and proper motion, and the
 * closest approach of its straight-line track.
 */
function starFacts(id: NeighbourId, astrometry: SourceId, velocity: SourceId) {
  const star = neighbour(id);
  const approach = closestApproach(star);
  const p = convert(star.parallax, "mas", "arcsec");
  return {
    distance: {
      value: convert(parallaxDistance.compute({ p }), "pc", "ly"),
      unit: "ly",
      digits: 3,
      source: astrometry,
      status: "derived",
      note: `parallax ${star.parallax} mas`,
    },
    radialVelocity: {
      value: Math.abs(star.rv),
      unit: "km/s",
      digits: 2,
      source: velocity,
      status: "verified",
      note: `${star.rv} km/s, ${star.rv < 0 ? "approaching" : "receding"}`,
    },
    properMotion: {
      value: Math.hypot(star.pmRa, star.pmDec),
      unit: "mas/yr",
      show: "arcsec/yr",
      digits: 3,
      source: astrometry,
      status: "derived",
      note: "total proper motion",
    },
    approach: {
      value: approach.ly,
      unit: "ly",
      digits: 3,
      source: astrometry,
      status: "derived",
      note: "closest point of the straight-line track",
    },
    approachWhen: {
      value: Math.abs(approach.yearsAgo),
      unit: "yr",
      digits: 2,
      source: astrometry,
      status: "derived",
      note: approach.yearsAgo > 0 ? "years ago" : "years from now",
    },
  } satisfies Record<string, Value>;
}

export const STARS = {
  proxima: starFacts("proxima", "gaiaDr3", "kervella2017"),
  alphaCen: {
    ...starFacts("alphaCen", "akeson2021", "akeson2021"),
    fromProxima: {
      value: angularSeparation.compute({
        ra1: neighbour("alphaCen").ra,
        dec1: neighbour("alphaCen").dec,
        ra2: neighbour("proxima").ra,
        dec2: neighbour("proxima").dec,
      }),
      unit: "deg",
      digits: 1,
      source: "gaiaDr3",
      status: "derived",
      note: "2.19° on the sky",
    },
    proximaOut: {
      value: neighbourSeparationAu(neighbour("proxima"), neighbour("alphaCen"), 0),
      unit: "au",
      digits: 2,
      source: "akeson2021",
      status: "derived",
      note: "Gaia DR3 Proxima to the Akeson barycentre; Kervella 2017: 12,947 ± 260 au with the older distance",
    },
  },
  barnard: starFacts("barnard", "gaiaDr3", "gaiaDr3"),
  scholz: {
    ...starFacts("scholz", "dupuy2019", "dupuy2019"),
    flyby: {
      range: [70e3, 80e3],
      unit: "yr",
      show: "kyr",
      source: "mamajek2015",
      status: "verified",
      note: "52 kau at 70 kyr (Mamajek 2015); 68.7 kau at 80.5 kyr (Dupuy 2019)",
    },
  },
} satisfies Record<NeighbourId, Facts>;
