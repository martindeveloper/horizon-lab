import { factsOf, type Facts, type Status, type Value } from "@/lib/facts";
import type { SourceId } from "@/lib/sources";
import { BLACK_HOLES } from "@/space/stellar";
/** Beyond the Milky Way: figures from the cosmos model and the literature. */
import { convert, lookbackTimeGyr } from "@horizon/toolkit/science";

import { ATLAS_FACTS } from "./atlas-facts";
import { CMB_FACTS } from "./cmb";
import {
  ANDROMEDA_APPROACH_KMS,
  ANDROMEDA_MLY,
  CMB_AGE_YEARS,
  CMB_KELVIN,
  CMB_MLY,
  HORIZON_MLY,
  LAST_SCATTERING_Z,
  LOOKBACK_RINGS_GYR,
  HUBBLE,
  LOCAL_TURNAROUND,
  OMEGA_M,
  UNIVERSE_AGE_GYR,
  STRUCTURES,
  WEB_SKY,
  anchorById,
  type AnchorId,
} from "./cosmos";

type Extra = { status?: Status; note?: string; digits?: number };

/** The Sloan Great Wall's redshift (Gott et al. 2005). */
const SLOAN_Z = WEB_SKY.sloanGreatWall.cz / convert(1, "c", "km/s");

/** An anchor's heliocentric distance today. */
const anchorDistance = (id: AnchorId, source: SourceId, extra: Extra = {}): Value => ({
  value: anchorById(id).mly,
  unit: "Mly",
  digits: 3,
  source,
  status: "verified",
  ...extra,
});

/** A structure's comoving size today. */
const comoving = (width: number, source: SourceId, extra: Extra): Value => ({
  value: width,
  unit: "Mly",
  source,
  status: "derived",
  ...extra,
});

const andromedaDistance: Value = {
  value: ANDROMEDA_MLY,
  unit: "Mly",
  show: "Mly",
  source: "li2021",
  status: "verified",
  note: "765 kpc; 761 ± 11 kpc (Li et al. 2021) and 783 ± 25 kpc (McConnachie 2012)",
};
/** M31's bright disk: RC3's isophotal diameter (log D25 = 3.28, in 0.1′) at the model's distance. */
const M31_DISK_LY = convert(ANDROMEDA_MLY, "Mly", "ly") * convert(10 ** 3.28 / 10, "arcmin", "rad");
/** A lookback ring's age: a teaching choice of round numbers. */
const ring = (gyr: number): Value => ({
  value: gyr * 1e9,
  unit: "yr",
  show: "Gyr",
  source: "horizon",
  status: "teaching-choice",
  note: "drawn where that light set out, at today's distance",
});
const greatAttractorDistance = anchorDistance("greatAttractor", "woudt2008", {
  digits: 2,
  status: "derived",
  note: "the Norma Cluster's Hubble-flow distance, cz 4,871 km/s in the CMB frame; Dupuy & Courtois 2023 put the basin centre farther, ~105 Mpc",
});

export const COSMOS = {
  cmbDisplay: CMB_FACTS,
  ...ATLAS_FACTS,
  /** The model's cosmology. */
  universe: {
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
  },
  localGroup: {
    width: {
      value: STRUCTURES.localGroup.width,
      unit: "Mly",
      digits: 1,
      source: "karachentsev2009",
      status: "derived",
      note: "twice the zero-velocity radius, 0.96 ± 0.03 Mpc",
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
      note: "D25 = 190.5′ at the model's 765 kpc, to twice the ~40 kpc outer-disk radius",
    },
    firstPass: {
      range: [4, 6],
      unit: "Gyr",
      source: "m31Merger",
      status: "verified",
      note: "~4.5 Gyr (van der Marel et al. 2019); 5.3, 4.7–6.2 Gyr (Wu et al. 2026)",
    },
    mergerWithin: {
      value: 10,
      unit: "Gyr",
      source: "m31Merger",
      status: "verified",
      note: "merger odds 50–90 % within this time",
    },
  },
  triangulum: {
    distance: anchorDistance("triangulum", "breuval2023", { note: "840 ± 11 kpc" }),
    width: { value: 60_000, unit: "ly", source: "nasaM33", status: "verified" },
  },
  virgo: {
    distance: anchorDistance("virgoCluster", "eht2019", { note: "M87's 16.8 Mpc" }),
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
      note: "2 r₂₀₀; McLaughlin's 1.55 Mpc at 15 Mpc, scaled to M87's 16.8 Mpc",
    },
    blackHole: BLACK_HOLES.m87.mass,
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
    distance: anchorDistance("centaurusCluster", "hubbleFlow", {
      status: "derived",
      note: "cz 3,418 km/s in the CMB frame at the model's H₀",
    }),
  },
  hydra: {
    distance: anchorDistance("hydraCluster", "hubbleFlow", {
      status: "derived",
      note: "cz 3,683 km/s in the CMB frame at the model's H₀",
    }),
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
      note: "160 Mpc across at Cosmicflows-2's H₀ = 75.2, rescaled to the model's; Cosmicflows-4 slightly favours a larger Shapley basin (Valade et al. 2024, Nat. Astron. 8, 1610)",
    }),
    members: { value: 100_000, unit: "count", source: "tully2014", status: "verified" },
    mass: { value: 1e17, unit: "Msun", source: "tully2014", status: "verified" },
    heart: greatAttractorDistance,
  },
  /* Beyond Laniakea: comoving distances from redshifts, in the model's cosmology. */
  perseusPisces: {
    distance: anchorDistance("perseusCluster", "struble1999", {
      digits: 2,
      status: "flag",
      note: "comoving from the cluster's heliocentric cz 5,366 km/s in the CMB frame, seen only as quoted (NGC 1275 itself: 5,297); papers adopt 72–74 Mpc",
    }),
    length: {
      value: STRUCTURES.perseusPisces.length,
      unit: "Mly",
      digits: 2,
      source: "wegner1993",
      status: "derived",
      note: "lower bound: the main ridge runs at least 50 h⁻¹ Mpc, here at h = 0.6766",
    },
  },
  coma: {
    distance: anchorDistance("comaCluster", "geller1999", {
      digits: 2,
      status: "derived",
      note: "comoving from the median heliocentric cz 7,090 km/s in the CMB frame; SNe Ia give 98.5 ± 2.2 Mpc (Scolnic et al. 2024)",
    }),
    members: {
      value: 1_651,
      unit: "count",
      digits: 3,
      source: "pedratti2026",
      status: "verified",
      note: "spectroscopic members after interlopers are removed",
    },
    mass: {
      value: 1e15,
      unit: "Msun",
      source: "pedratti2026",
      status: "verified",
      note: "M₂₀₀ = 1.04 × 10¹⁵ M☉ at H₀ = 70",
    },
  },
  shapley: {
    distance: anchorDistance("shapleyCore", "proust2006", {
      digits: 2,
      status: "derived",
      note: "comoving from Abell 3558's heliocentric cz 14,307 km/s in the CMB frame; the paper uses 145 h⁻¹ Mpc",
    }),
    clusters: {
      value: 44,
      unit: "count",
      source: "proust2006",
      status: "verified",
      note: "clusters in its velocity range",
    },
    galaxies: {
      value: 8_632,
      unit: "count",
      digits: 2,
      source: "proust2006",
      status: "verified",
      note: "galaxies with measured velocities in the surveyed field, fore- and background included",
    },
    mass: {
      value: 5e16 / (HUBBLE / 100),
      unit: "Msun",
      digits: 1,
      source: "proust2006",
      status: "derived",
      note: "5 × 10¹⁶ h⁻¹ M☉ in the surveyed volume, at h = 0.6766; Ragone et al. 2006: at least 1.1 × 10¹⁶ h⁻¹",
    },
  },
  sloanGreatWall: {
    distance: anchorDistance("sloanGreatWall", "gott2005", {
      digits: 2,
      status: "derived",
      note: "comoving at z = 0.073; the paper's median 310 Mpc at H₀ = 71, Ωm = 0.27",
    }),
    length: comoving(STRUCTURES.sloanGreatWall.length, "gott2005", {
      digits: 2,
      note: "450 Mpc comoving at H₀ = 71, rescaled to the model's H₀",
    }),
    lengthThen: {
      value: STRUCTURES.sloanGreatWall.length / (1 + SLOAN_Z),
      unit: "Mly",
      digits: 2,
      source: "gott2005",
      status: "derived",
      note: "comoving length / (1 + z); the paper's 419 Mpc (1.37 billion ly) is at H₀ = 71",
    },
    lookback: {
      value: lookbackTimeGyr(SLOAN_Z) * 1e9,
      unit: "yr",
      show: "Gyr",
      digits: 2,
      source: "gott2005",
      status: "derived",
      note: "lookback time to z = 0.073 in the model's cosmology",
    },
  },
  observableUniverse: {
    edge: {
      value: HORIZON_MLY,
      unit: "Mly",
      digits: 3,
      source: "planck2018",
      status: "derived",
      note: "particle horizon: the comoving distance light has covered since the Big Bang, with radiation",
    },
    cmbDistance: {
      value: CMB_MLY,
      unit: "Mly",
      digits: 3,
      source: "planck2018",
      status: "derived",
      note: `comoving distance to z∗ = ${LAST_SCATTERING_Z}; Planck's r∗ / θ∗ give 13,885 Mpc`,
    },
    cmbAge: {
      value: CMB_AGE_YEARS,
      unit: "yr",
      show: "kyr",
      digits: 2,
      source: "planck2018",
      status: "derived",
      note: "the universe's age at z∗, with radiation: ~372,000 years",
    },
    cmbTemperature: {
      value: CMB_KELVIN,
      unit: "K",
      digits: 5,
      source: "fixsen2009",
      status: "verified",
      note: "2.7255 ± 0.0006 K today",
    },
    lightTravel: {
      value: UNIVERSE_AGE_GYR,
      unit: "Gyr",
      digits: 3,
      source: "planck2018",
      status: "derived",
      note: "the age of the universe: how long the oldest light has travelled",
    },
    ringNear: ring(LOOKBACK_RINGS_GYR[0]),
    ringMid: ring(LOOKBACK_RINGS_GYR[1]),
    ringFar: ring(LOOKBACK_RINGS_GYR[2]),
  },
} satisfies Record<string, Facts>;

/** Every fact with its path ("cosmos.virgo.members"), for tests and the ledger. */
export const cosmosCatalogueFacts = () => factsOf({ cosmos: COSMOS });
