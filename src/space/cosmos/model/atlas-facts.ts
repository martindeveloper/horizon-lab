/** Figures shown by the atlas, separated from its large survey data. */
import { literatureFact as fact, type Facts } from "@/lib/facts";
import type { SourceId } from "@/lib/sources";

import {
  ATLAS_H,
  ATLAS_LANDMARKS,
  ATLAS_SOURCES,
  ATLAS_SUN,
  BASINS,
  KNOTS,
  QUIPU_CLUSTERS,
  VELA,
  VOIDS,
  basinByName,
  equivalentRadius,
  hMpcToMly,
  voidById,
  type AtlasLandmarkId,
} from "./atlas";

const distance = (id: AtlasLandmarkId, source: SourceId) => {
  const p = ATLAS_LANDMARKS[id].at;
  return fact(
    Math.hypot(p[0] - ATLAS_SUN[0], p[1] - ATLAS_SUN[1], p[2] - ATLAS_SUN[2]),
    "Mly",
    source,
    "derived",
    {
      digits: 3,
      sources: ["planck2018"],
      note: "Model distance to the catalogue marker in Planck 2018 flat ΛCDM; see atlas data notes, not an independent distance measurement",
    },
  );
};
const basin = (id: AtlasLandmarkId, name: string) => {
  const b = basinByName(name);
  return {
    distance: distance(id, "cosmicBasins2024"),
    probability: fact(b.probability, "percent", "cosmicBasins2024", "derived", {
      note: "Posterior basin-existence probability, NOT Milky Way membership",
    }),
    radius: fact(hMpcToMly(equivalentRadius(b.volume)), "Mly", "cosmicBasins2024", "derived", {
      digits: 3,
      note: "Equivalent-volume radius using h = H₀/100; not an actual basin boundary",
    }),
  };
};
const voidFacts = (id: AtlasLandmarkId, number: number) => {
  const v = voidById(number);
  return {
    distance: distance(id, "cosmicVoids2026"),
    radius: fact(v.radiusMly, "Mly", "cosmicVoids2026", "derived", {
      digits: 3,
      note: "PREPRINT: effective radius of the full region; circle is a size guide, not its shape",
    }),
    robustRadius: fact(v.robustRadiusMly, "Mly", "cosmicVoids2026", "derived", {
      digits: 3,
      note: "PREPRINT: effective radius of voxels classified as void in at least 68% of realizations; not a radial error bar",
    }),
  };
};

export const ATLAS_FACTS = {
  quipu: {
    distance: distance("quipu", "classix2025"),
    members: fact(QUIPU_CLUSTERS.length, "count", "classix2025", "verified"),
    // Keep the authors' length/cosmology; do not silently rescale a literature result.
    length: fact(428, "Mpc", "classix2025", "verified", {
      digits: 3,
      note: "Published extent at H₀ = 70, Ωm = 0.3; displayed points reproject measured redshifts into Planck 2018",
    }),
    mass: fact(2.4e17, "Msun", "classix2025", "derived", {
      digits: 2,
      note: "Inferred total mass, Table 1; not the sum of directly measured masses",
    }),
    sourceHubble: fact(70, "km/s/Mpc", "classix2025", "verified"),
  },
  vela: {
    distance: distance("vela", "vela2026"),
    mass: fact(VELA.mass, "Msun", "vela2026", "derived", {
      digits: 3,
      note: "Accepted manuscript v2, Table 2; full δ = 0 region, H₀ = 74.6. Do not substitute the preprint knot's much smaller collapsing-region mass",
    }),
    radius: fact(hMpcToMly(equivalentRadius(VELA.volume)), "Mly", "vela2026", "derived", {
      digits: 3,
      note: "Equivalent-volume radius; displayed as a size guide, not an isodensity surface",
    }),
    sourceHubble: fact(74.6, "km/s/Mpc", "vela2026", "verified"),
  },
  southPoleWall: {
    distance: distance("southPoleWall", "southPole2020"),
    velocity: fact(11_800, "km/s", "southPole2020", "verified", {
      digits: 3,
      note: "Approximate Chamaeleon+11.8 peak at the celestial south pole; no wall surface is imported",
    }),
  },
  shapleyBasin: {
    ...basin("shapleyBasin", "Shapley"),
    membership: fact(58, "percent", "cosmicBasins2024", "derived", {
      note: "Milky Way flow membership across posterior realizations; NOT existence probability",
    }),
  },
  sloanBasin: basin("sloanBasin", "Sloan Great Wall"),
  ophiuchusBasin: {
    ...basin("ophiuchusBasin", "Ophiuchus"),
    membership: fact(39, "percent", "cosmicBasins2024", "derived", {
      note: "Milky Way flow membership across posterior realizations; NOT existence probability",
    }),
  },
  localVoid: voidFacts("localVoid", 10),
  northernLocalVoid: voidFacts("northernLocalVoid", 13),
  sculptorVoid: voidFacts("sculptorVoid", 28),
  cosmicSurveys: {
    groups: fact(ATLAS_SOURCES.cf4.rows, "count", "cosmicflows4", "verified"),
    clusters: fact(ATLAS_SOURCES.classix.rows, "count", "classix2025", "verified"),
    galaxies: fact(ATLAS_SOURCES.desi.sampleRows, "count", "desiDr1", "derived", {
      note: "Sparse visual sample after quality cuts; NOT the total size of DESI DR1",
    }),
  },
  cosmicBasins: {
    count: fact(BASINS.length, "count", "cosmicBasins2024", "verified"),
    h: fact(ATLAS_H, "ratio", "planck2018", "derived", {
      digits: 4,
      note: "H₀ / 100 for h⁻¹ Mpc coordinates; original paper mass cosmologies are retained separately",
    }),
  },
  cosmicVoids: {
    count: fact(VOIDS.length, "count", "cosmicVoids2026", "verified", {
      note: "PREPRINT catalogue size at λth = 0",
    }),
    support: fact(68, "percent", "cosmicVoids2026", "verified", {
      note: "Minimum fraction of realizations for the robust subvolume",
    }),
    resolution: fact(hMpcToMly(7.9), "Mly", "cosmicVoids2026", "derived", {
      digits: 2,
      note: "PREPRINT: nominal 7.9 h⁻¹ Mpc spatial resolution",
    }),
  },
  cosmicKnots: {
    count: fact(KNOTS.length, "count", "cosmicVoids2026", "verified", {
      note: "PREPRINT catalogue size at λth = 0",
    }),
  },
} satisfies Record<string, Facts>;
