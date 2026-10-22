/**
 * The observatory's own literature figures, once: what its tours, stories and atlas quote about
 * the catalogued holes' surroundings and the atlas's other sites. Each is a value or published
 * span with its source and how it was checked (docs/science-sources.md). The holes' masses,
 * distances and spins are the shared catalogue's (`BLACK_HOLES` in `@/space/stellar`).
 */
import { factsOf, literatureFact } from "@/lib/facts";

export const OBSERVATORY = {
  sgrA: {
    ring: literatureFact(51.8, "uas", "eht2022a", "verified", { range: [49.5, 54.1], digits: 3 }),
  },
  s2: {
    pericentreSpeed: literatureFact(7_650, "km/s", "gravity2018", "verified", { digits: 3 }),
  },
  s301: {
    pericentre: literatureFact(null, "au", "abdElDayem2026", "verified", {
      range: [11.5, 12],
      digits: 2,
    }),
    pericentreSpeed: literatureFact(null, "km/s", "abdElDayem2026", "verified", {
      range: [25_000, 25_600],
      digits: 3,
    }),
  },
  m87: {
    jetAngle: literatureFact(17, "deg", "walker2018", "verified", {
      digits: 2,
      note: "the jet's angle to the line of sight; the disk is drawn perpendicular to it",
    }),
    ring2019: literatureFact(42, "uas", "eht2019", "verified", { range: [39, 45], digits: 2 }),
    ring: literatureFact(43.9, "uas", "eht2025", "verified", { range: [43.3, 44.5], digits: 3 }),
  },
  cygnusX1: {
    inclination: literatureFact(27.51, "deg", "millerJones2021", "verified", {
      range: [26.94, 28.28],
      digits: 3,
      note: "the orbit's inclination, adopted for the disk",
    }),
  },
  gaiaBh3: {
    eccentricity: literatureFact(0.729, "ratio", "panuzzo2024", "verified", {
      range: [0.724, 0.734],
      digits: 3,
    }),
    separation: literatureFact(null, "au", "panuzzo2024", "derived", {
      range: [4.4, 28],
      digits: 2,
      note: "a(1 ∓ e)",
    }),
  },
  omegaCen: {
    clusterMass: literatureFact(3.94e6, "Msun", "baumgardt2021", "verified", { digits: 3 }),
    trackedStars: literatureFact(1.4e6, "count", "haberle2024", "verified", { digits: 2 }),
    images: literatureFact(500, "count", "haberle2024", "verified", {
      digits: 1,
      note: "more than this many Hubble images",
    }),
    fastStars: literatureFact(7, "count", "haberle2024", "verified", { digits: 1 }),
    fastestStar: literatureFact(113, "km/s", "haberle2024", "verified", {
      range: [111.9, 114.1],
      digits: 3,
      note: "on the sky",
    }),
    escapeSpeed: literatureFact(62, "km/s", "haberle2024", "verified", { digits: 2 }),
    modelMass: literatureFact(null, "Msun", "haberle2024", "verified", {
      range: [39_000, 47_000],
      digits: 2,
      note: "N-body comparisons",
    }),
    massLimitAgainst: literatureFact(6_000, "Msun", "banares2025", "verified", {
      digits: 1,
      note: "an upper limit at 3σ from pulsar accelerations and stellar motions",
    }),
  },
  ton618: {
    lineWidth: literatureFact(10_527, "km/s", "shemmer2004", "verified", {
      digits: 1,
      note: "Hβ, best-fit FWHM",
    }),
    thinDiskLimit: literatureFact(5e10, "Msun", "king2016", "verified", {
      digits: 1,
      note: "for typical parameters",
    }),
  },
  gw231123: {
    frequencies: literatureFact(null, "Hz", "lvk2025", "verified", { range: [30, 80], digits: 1 }),
    duration: literatureFact(0.1, "s", "lvk2025", "verified", { digits: 1 }),
    skyArea: literatureFact(1_700, "count", "lvk2025", "verified", {
      digits: 2,
      note: "square degrees, 90 % credible",
    }),
    redshift: literatureFact(0.4, "ratio", "lvk2025", "derived", { digits: 2 }),
    travelTime: literatureFact(null, "Gyr", "lvk2025", "derived", {
      range: [2, 6],
      digits: 1,
      note: "lookback times across the redshift's range",
    }),
    primarySpin: literatureFact(0.9, "ratio", "lvk2025", "verified", { digits: 1 }),
    secondarySpin: literatureFact(0.8, "ratio", "lvk2025", "verified", { digits: 1 }),
    pairInstabilityGap: literatureFact(null, "Msun", "lvkSummary2025", "verified", {
      range: [60, 130],
      digits: 2,
    }),
  },
  gw150914: {
    primaryMass: literatureFact(34.6, "Msun", "abbott2016", "verified", { digits: 2 }),
    secondaryMass: literatureFact(30, "Msun", "abbott2016", "verified", { digits: 2 }),
    distance: literatureFact(1.3e9, "ly", "abbott2016", "verified", { digits: 2 }),
    radiated: literatureFact(3, "Msun", "abbott2016", "verified", {
      digits: 1,
      note: "the mass-energy carried off as waves, in M☉c²",
    }),
  },
  grs1915: {
    distance: literatureFact(9.4, "kpc", "reid2023", "verified", { digits: 2 }),
    mass: literatureFact(11.2, "Msun", "reid2023", "verified", { digits: 2 }),
  },
  ss433: {
    distance: literatureFact(5.5, "kpc", "blundell2004", "verified", { digits: 2 }),
    jetSpeed: literatureFact(0.2647, "c", "eikenberry2001", "verified", { digits: 2 }),
  },
  orion: {
    distance: literatureFact(388, "pc", "kounkel2017", "verified", {
      range: [383, 393],
      digits: 2,
    }),
  },
  carina: {
    distance: literatureFact(2.35, "kpc", "smith2006", "verified", { digits: 3 }),
    etaCarinaeMass: literatureFact(90, "Msun", "hillier2001", "verified", {
      digits: 2,
      note: "a lower bound on the primary",
    }),
  },
  cygnusX: {
    distance: literatureFact(1.4, "kpc", "rygl2012", "verified", {
      range: [1.32, 1.48],
      digits: 2,
    }),
  },
  westerlund1: {
    distance: literatureFact(null, "kpc", "navarete2022", "verified", {
      range: [4, 4.3],
      digits: 2,
    }),
    mass: literatureFact(null, "Msun", "clark2005", "verified", {
      sources: ["andersen2017"],
      range: [5e4, 1e5],
      digits: 1,
    }),
  },
  m31: {
    holeMass: literatureFact(1.4e8, "Msun", "bender2005", "verified", { digits: 2 }),
  },
  lmc: {
    x1Mass: literatureFact(10.91, "Msun", "orosz2009", "verified", {
      range: [9.5, 12.32],
      digits: 2,
    }),
  },
} as const;

/** Every fact with its path ("observatory.m87.ring"), for tests and the ledger. */
export const catalogueFacts = () => factsOf({ observatory: OBSERVATORY });
