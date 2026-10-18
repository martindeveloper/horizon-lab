/** Beyond the Milky Way: figures from the cosmos model and the literature. */
import { convert } from "@horizon/toolkit/science";

import {
  ANDROMEDA_APPROACH_KMS,
  ANDROMEDA_MLY,
  CLUSTER_GROWTH_POWER,
  HUBBLE,
  LOCAL_TURNAROUND,
  OMEGA_M,
  UNIVERSE_AGE_GYR,
  STRUCTURES,
  anchorAt,
  anchorById,
  andromedaApart,
  scaleAt,
  type AnchorId,
} from "../cosmos";
import type { SourceId } from "./sources";
import type { Facts, Live, Status } from "./types";

type Extra = { status?: Status; note?: string; digits?: number };

const length = (v: readonly number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);

/** An anchor's heliocentric distance today and its place on the slider (comoving or bound). */
const anchorDistance = (id: AnchorId, source: SourceId, extra: Extra = {}): Live => ({
  value: anchorById(id).mly,
  unit: "Mly",
  digits: 3,
  source,
  status: "verified",
  at: (yearsAgo) =>
    anchorById(id).tie === "flow"
      ? anchorById(id).mly * scaleAt(yearsAgo)
      : length(anchorAt(anchorById(id), yearsAgo)),
  ...extra,
});

/** A structure's diameter today, stretched with the scale of space on the slider. */
const comoving = (width: number, source: SourceId, extra: Extra): Live => ({
  value: width,
  unit: "Mly",
  source,
  status: "derived",
  at: (yearsAgo) => width * scaleAt(yearsAgo),
  ...extra,
});

const andromedaDistance: Live = {
  value: ANDROMEDA_MLY,
  unit: "Mly",
  show: "Mly",
  source: "li2021",
  status: "verified",
  note: "765 kpc; 752–785 kpc in McConnachie 2012 and Li et al. 2021",
  at: andromedaApart,
};
/** M31's bright disk: RC3's isophotal diameter (log D25 = 3.28, in 0.1′) at the model's distance. */
const M31_DISK_LY = convert(ANDROMEDA_MLY, "Mly", "ly") * convert(10 ** 3.28 / 10, "arcmin", "rad");
const greatAttractorDistance = anchorDistance("greatAttractor", "tully2014", {
  digits: 2,
  status: "derived",
  note: "~77 Mpc at h = 0.68; Dupuy & Courtois 2023 put the basin centre farther, ~105 Mpc",
});

export const COSMOS = {
  /** The scale of space then, for every card beyond the Local Group. */
  universe: {
    scale: {
      value: 1,
      unit: "ratio",
      source: "planck2018",
      status: "derived",
      note: "flat ΛCDM, H₀ 67.66 km/s/Mpc, Ωm 0.3111; a = 0.37 ten billion years ago",
      at: scaleAt,
    },
    hubble: {
      value: HUBBLE,
      unit: "km/s/Mpc",
      digits: 3,
      source: "planck2018",
      status: "verified",
      note: "67.66 km/s/Mpc",
    },
    matter: { value: OMEGA_M, unit: "ratio", digits: 2, source: "planck2018", status: "verified" },
    age: {
      value: UNIVERSE_AGE_GYR,
      unit: "Gyr",
      digits: 3,
      source: "planck2018",
      status: "derived",
      note: "flat ΛCDM with these H₀ and Ωm",
    },
    clusterGrowth: {
      value: CLUSTER_GROWTH_POWER,
      unit: "ratio",
      source: "horizon",
      status: "teaching-choice",
      note: "a cluster's gathered share goes as a^1.5, close to ΛCDM infall since z ≈ 2",
    },
  },
  localGroup: {
    width: {
      value: STRUCTURES.localGroup.width,
      unit: "Mly",
      digits: 1,
      source: "mcconnachie2012",
      status: "verified",
      note: "~3 Mpc",
    },
    members: {
      value: 100,
      unit: "count",
      source: "mcconnachie2019",
      status: "verified",
      note: "113 listed with the Milky Way, M31 or the rest of the Local Group; ~15 may be star clusters",
    },
    apart: andromedaDistance,
    turnaround: {
      value: LOCAL_TURNAROUND.mly,
      unit: "Mly",
      digits: 2,
      source: "vanDerMarel2012",
      status: "derived",
      note: "timing argument (Kahn & Woltjer 1959): radial Kepler orbit from t = 0",
    },
    turnaroundAgo: {
      value: LOCAL_TURNAROUND.yearsAgo,
      unit: "yr",
      show: "Gyr",
      digits: 2,
      source: "vanDerMarel2012",
      status: "derived",
    },
  },
  localSheet: {
    width: comoving(STRUCTURES.localSheet.width, "tully2008", {
      digits: 2,
      note: "twice the 7 Mpc radius",
    }),
    radius: { value: 7, unit: "Mpc", source: "tully2008", status: "verified" },
    thickness: {
      value: STRUCTURES.localSheet.thickness,
      unit: "Mly",
      digits: 1,
      source: "tully2008",
      status: "derived",
      note: "±1.5 Mpc about the supergalactic equator",
    },
    fromVoid: {
      value: 260,
      unit: "km/s",
      source: "tully2008",
      status: "verified",
      note: "259 ± 25 km/s",
    },
    stray: { value: 40, unit: "km/s", source: "tully2008", status: "verified" },
  },
  andromeda: {
    distance: andromedaDistance,
    approach: {
      value: ANDROMEDA_APPROACH_KMS,
      unit: "km/s",
      source: "vanDerMarel2012",
      status: "verified",
      note: "−109.3 ± 4.4 km/s toward the Galactic centre",
    },
    approachSun: {
      value: 300,
      unit: "km/s",
      source: "vanDerMarel2012",
      status: "verified",
      note: "heliocentric",
    },
    width: {
      range: [M31_DISK_LY, convert(2 * 40, "kpc", "ly")],
      unit: "ly",
      digits: 2,
      source: "m31Width",
      status: "derived",
      note: "D25 = 190.5′ at the model's 2.5 Mly, to twice the ~40 kpc outer-disk radius",
    },
    firstPass: { range: [4, 5], unit: "Gyr", source: "m31Merger", status: "verified" },
    mergerWithin: {
      value: 10,
      unit: "Gyr",
      source: "m31Merger",
      status: "verified",
      note: "merger odds 50–90 % within this time",
    },
  },
  triangulum: {
    distance: anchorDistance("triangulum", "mcconnachie2012"),
    width: { value: 60_000, unit: "ly", source: "nasaM33", status: "verified" },
  },
  virgo: {
    distance: anchorDistance("virgoCluster", "mei2007", { note: "16.5 Mpc" }),
    members: {
      value: 1_500,
      unit: "count",
      range: [1_300, 2_000],
      source: "binggeli1985",
      status: "verified",
    },
    width: {
      value: STRUCTURES.virgo.width,
      unit: "Mly",
      digits: 1,
      source: "mclaughlin1999",
      status: "derived",
      note: "2 r₂₀₀",
    },
    blackHole: { value: 6.5e9, unit: "Msun", source: "eht2019", status: "verified" },
  },
  fornax: {
    distance: anchorDistance("fornaxCluster", "blakeslee2009", { note: "20.0 ± 0.3 Mpc" }),
    members: { value: 340, unit: "count", source: "ferguson1989", status: "verified" },
    width: {
      value: 5,
      unit: "Mly",
      source: "drinkwater2001",
      status: "derived",
      note: "~0.7 Mpc radius",
    },
    rank: {
      value: 2,
      unit: "count",
      source: "iodice2019",
      status: "verified",
      note: "by mass, after Virgo; the card words it, no figure",
    },
  },
  supercluster: {
    width: comoving(STRUCTURES.supercluster.width, "devaucouleurs1958", {
      digits: 2,
      note: "~33 Mpc across",
    }),
    members: {
      value: 10,
      unit: "count",
      source: "tully1982",
      status: "verified",
      note: "clouds besides the Virgo Cluster, each with many small groups",
    },
  },
  centaurus: {
    distance: anchorDistance("centaurusCluster", "hubbleFlow", { status: "derived" }),
  },
  hydra: {
    distance: anchorDistance("hydraCluster", "hubbleFlow", { status: "derived" }),
    members: {
      value: 580,
      unit: "count",
      source: "richter1989",
      status: "verified",
      note: "a field catalogue, not a member census",
    },
  },
  greatAttractor: {
    distance: greatAttractorDistance,
    mass: {
      value: 5.4e16,
      unit: "Msun",
      digits: 1,
      source: "lyndenBell1988",
      status: "verified",
      note: "estimates vary",
    },
  },
  laniakea: {
    width: comoving(STRUCTURES.laniakea.width, "tully2014", {
      digits: 2,
      note: "160 Mpc across",
    }),
    members: { value: 100_000, unit: "count", source: "tully2014", status: "verified" },
    mass: { value: 1e17, unit: "Msun", source: "tully2014", status: "verified" },
    heart: greatAttractorDistance,
  },
} satisfies Record<string, Facts>;
