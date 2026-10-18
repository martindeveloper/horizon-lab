/**
 * Every measured figure an orrery card prints, once: its value, unit, optional range and
 * source. Messages keep only the words around it ("About {value} galaxies"); the card
 * formats the figure in the visitor's distance unit and language.
 *
 * Values the model computes with stay in the model (`parameters.ts`, `cosmos.ts`, the
 * toolkit's bodies) and are referenced here, not copied; figures that follow the slider
 * carry `at`, the model function that gives them `yearsAgo` years ago.
 * docs/science-sources.md lists this file (`npm run docs:catalogue`).
 */
import {
  FIGURES,
  NAMED,
  PLANET_RADIUS_KM,
  jplElements,
  type NamedId,
  type PlanetId,
} from "@horizon/toolkit/bodies";
import {
  AU_KM,
  AU_LIGHT_SECONDS,
  AU_SI,
  SOLAR_RADIUS_KM,
  convert,
  keplerThirdLaw,
  parallaxDistance,
  type UnitId,
} from "@horizon/toolkit/science";

import {
  ANDROMEDA_APPROACH_KMS,
  ANDROMEDA_MLY,
  LOCAL_TURNAROUND,
  STRUCTURES,
  anchorAt,
  anchorById,
  andromedaApart,
  scaleAt,
  type AnchorId,
} from "./cosmos";
import { startElements } from "./elements";
import {
  NEIGHBOURS,
  closestApproach,
  neighbourPosition,
  type Neighbour,
  type NeighbourId,
} from "./neighbours";
import {
  ARM_PITCH_DEG,
  ARM_START_KPC,
  BAR_ANGLE_DEG,
  COLD_CLASSICAL_AU,
  DISK_AU,
  GALACTIC_YEAR,
  OORT_SHELLS_AU,
  RADIAL_AMPLITUDE_LY,
  RADIAL_PERIOD,
  SUN_BIRTH,
  SUN_GALACTIC_RADIUS_LY,
  SUN_HEIGHT_LY,
  VERTICAL_AMPLITUDE_LY,
  VERTICAL_PERIOD,
} from "./parameters";
import { TRACERS } from "./tracers";

export type Source = { cite: string; link?: string };

/** Works the figures are checked against; links only where the ledger opened one. */
export const SOURCES = {
  akeson2021: {
    cite: "Akeson et al. 2021, AJ 162, 14 (α Cen AB barycentre, Tables 8–9)",
    link: "https://doi.org/10.3847/1538-3881/abfaff",
  },
  allen2001: { cite: "Allen, Bernstein & Malhotra 2001, ApJ 549, L241 (the Kuiper cliff)" },
  bennettBovy2019: {
    cite: "Bennett & Bovy 2019, MNRAS 482, 1417",
    link: "https://arxiv.org/abs/1809.03507",
  },
  binggeli1985: { cite: "Binggeli, Sandage & Tammann 1985, AJ 90, 1681" },
  blakeslee2009: {
    cite: "Blakeslee et al. 2009, ApJ 694, 556",
    link: "https://arxiv.org/abs/0901.1138",
  },
  blandHawthorn2016: {
    cite: "Bland-Hawthorn & Gerhard 2016, ARA&A 54, 529",
    link: "https://arxiv.org/abs/1602.07702",
  },
  bovy2017: { cite: "Bovy 2017, MNRAS 468, L63 (Oort constants)" },
  connelly2012: {
    cite: "Connelly et al. 2012, Science 338, 651",
    link: "https://doi.org/10.1126/science.1226919",
  },
  devaucouleurs1958: { cite: "de Vaucouleurs 1958 (the Local Supercluster)" },
  drinkwater2001: { cite: "Drinkwater et al. 2001, ApJ 548, L139" },
  duncan1987: { cite: "Duncan, Quinn & Tremaine 1987, AJ 94, 1330; NASA Oort cloud facts" },
  dupuy2019: {
    cite: "Dupuy et al. 2019, AJ 158, 174",
    link: "https://doi.org/10.3847/1538-3881/ab3cd1",
  },
  dupuyCourtois2023: { cite: "Dupuy & Courtois 2023, A&A 678, A176" },
  eht2019: {
    cite: "Event Horizon Telescope Collaboration 2019, Paper VI, ApJL 875, L6",
    link: "https://arxiv.org/abs/1906.11243",
  },
  eilers2019: { cite: "Eilers et al. 2019, ApJ 871, 120" },
  ferguson1989: { cite: "Ferguson 1989, AJ 98, 367 (Fornax Cluster Catalog)" },
  gaiaDr3: {
    cite: "Gaia Collaboration 2023, A&A 674, A1 (Gaia DR3)",
    link: "https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I/355/gaiadr3",
  },
  gaiaEnceladus: {
    cite: "Helmi et al. 2018, Nature 563, 85; Belokurov et al. 2018, MNRAS 478, 611",
  },
  gravity2021: { cite: "GRAVITY Collaboration 2021, A&A 647, A59; GRAVITY Collaboration 2022" },
  gravity2022: { cite: "GRAVITY Collaboration 2022 (Sgr A* mass)" },
  horizon: { cite: "Horizon model: a labelled teaching choice" },
  hubbleFlow: {
    cite: "NED (cz 3,418 km/s) and Christlein & Zabludoff 2003 (cz 3,683 km/s), at the model's H₀",
  },
  iau2012b2: { cite: "IAU 2012 Resolution B2 (the astronomical unit)" },
  iau2015b3: { cite: "IAU 2015 Resolution B3 (nominal solar and planetary values)" },
  iodice2019: {
    cite: "Iodice et al. 2019, A&A 623, A1 (§1: after Virgo, the most massive concentration within 20 Mpc)",
    link: "https://arxiv.org/abs/1812.01050",
  },
  iorio2012: { cite: "Iorio 2012, Sol. Phys. 281, 815; NSSDC fact sheets" },
  jplElements: {
    cite: "JPL approximate planetary elements (Standish & Williams)",
    link: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
  },
  jplHorizons: { cite: "JPL Horizons (Sedna barycentric; Halley 1994 osculating elements)" },
  jplRadii: {
    cite: "JPL planetary physical parameters (IAU 2015 mean radii)",
    link: "https://ssd.jpl.nasa.gov/planets/phys_par.html",
  },
  kaibVolk2022: {
    cite: "Kaib & Volk 2022 (after Heisler & Tremaine 1986)",
    link: "https://arxiv.org/abs/2206.00010",
  },
  kervella2017: { cite: "Kervella, Thévenin & Lovis 2017, A&A 598, L7" },
  li2021: {
    cite: "Li et al. 2021, ApJ 920, 84",
    link: "https://doi.org/10.3847/1538-4357/ac1597",
  },
  liu2011: { cite: "Liu, Zhu & Zhang 2011, A&A 526, A16" },
  lucey2023: {
    cite: "Wegg, Gerhard & Portail 2015 (5.0 ± 0.2 kpc half-length); Lucey et al. 2023, MNRAS (~3.5 kpc)",
    link: "https://arxiv.org/abs/2206.01798",
  },
  lyndenBell1988: { cite: "Lynden-Bell et al. 1988, ApJ 326, 19" },
  m31Width: {
    cite: "RC3, de Vaucouleurs et al. 1991 (NGC 224: log D25 = 3.28); Ibata et al. 2005, ApJ 634, 287 (outer disk to ~40 kpc, arXiv:astro-ph/0504164)",
    link: "https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=VII/155",
  },
  m31Merger: {
    cite: "van der Marel et al. 2019, ApJ 872, 24; Sawala et al. 2025, Nat. Astron.; Wu et al. 2026, ApJL",
  },
  mamajek2015: { cite: "Mamajek et al. 2015, ApJL 800, L17" },
  mcconnachie2012: {
    cite: "McConnachie 2012, AJ 144, 4",
    link: "https://arxiv.org/abs/1204.1562",
  },
  mcconnachie2019: {
    cite: "McConnachie, nearby galaxies catalogue after McConnachie 2012 (Table 1, October 2019)",
    link: "https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/community/nearby/",
  },
  mclaughlin1999: { cite: "McLaughlin 1999, ApJ 512, L9 (Virgo r₂₀₀ = 1.55 Mpc)" },
  mei2007: { cite: "Mei et al. 2007, ApJ 655, 144" },
  morbidelli2005: {
    cite: "Morbidelli 2005 review, after Gomes et al. 2005; Tsiganis et al. 2005, Nature 435, 459",
    link: "https://arxiv.org/abs/astro-ph/0512256",
  },
  mpcTno: {
    cite: "Minor Planet Center, list of trans-Neptunian objects",
    link: "https://minorplanetcenter.net/iau/lists/TNOs.html",
  },
  nasaKuiper: {
    cite: "NASA Kuiper Belt facts; Pitjeva & Pitjev 2018",
    link: "https://science.nasa.gov/solar-system/kuiper-belt/facts/",
  },
  nasaM33: { cite: "NASA/HST, Triangulum Galaxy (M33): 18.7 kpc optical diameter" },
  nasaMilkyWay: { cite: "NASA Science, Beyond Our Solar System: the Milky Way" },
  nssdc: { cite: "NSSDC planetary fact sheets" },
  pasquini2004: {
    cite: "Pasquini et al. 2004, A&A 426, 651",
    link: "https://arxiv.org/abs/astro-ph/0407524",
  },
  pitjeva2018: {
    cite: "Pitjeva & Pitjev 2018, Astron. Lett. 44, 554",
    link: "https://arxiv.org/abs/1811.05191",
  },
  planck2018: { cite: "Planck Collaboration 2020, A&A 641, A6 (TT,TE,EE+lowE+lensing+BAO)" },
  reid2019: { cite: "Reid et al. 2019, ApJ 885, 131" },
  richter1989: { cite: "Richter 1989, catalogue of 581 galaxies in the Hydra I cluster area" },
  tully2008: {
    cite: "Tully et al. 2008, ApJ 676, 184",
    link: "https://arxiv.org/abs/0705.4139",
  },
  tully1982: {
    cite: "Tully 1982, ApJ 257, 389 (Table 1: the Virgo Cluster and ten clouds)",
    link: "https://adsabs.harvard.edu/pdf/1982ApJ...257..389T",
  },
  tully2014: { cite: "Tully et al. 2014, Nature 513, 71" },
  vallee2017: {
    cite: "Vallée 2017, Astron. Rev. 13, 113",
    link: "https://arxiv.org/abs/1711.05228",
  },
  vanDerMarel2012: { cite: "van der Marel et al. 2012, ApJ 753, 8" },
  wegg2015: {
    cite: "Wegg, Gerhard & Portail 2015, MNRAS 450, 4050",
    link: "https://arxiv.org/abs/1504.01401",
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

/**
 * Units are the science kit's (`UNITS`), so a figure converts with `convert` like every
 * other number in Horizon; `count`, `percent` and `ratio` are plain numbers.
 */
export type Unit = UnitId | "count" | "percent" | "ratio";
/** Lengths a card shows in the visitor's distance unit (au, ly or pc) with its symbol. */
export type LengthUnit = "au" | "ly" | "Mly" | "pc" | "kpc" | "Mpc";

const LENGTHS: ReadonlySet<Unit> = new Set<LengthUnit>(["au", "ly", "Mly", "pc", "kpc", "Mpc"]);
export const isLength = (unit: Unit): unit is LengthUnit => LENGTHS.has(unit);

/**
 * How a figure was checked (docs/science-sources.md): opened in the source, computed from
 * checked inputs, a deliberate model choice, or not yet confirmed.
 */
export type Status = "verified" | "derived" | "teaching-choice" | "flag";

export type Fact = {
  /** Today's value, in `unit`. */
  value: number;
  unit: Unit;
  /** Published spread or estimates, in `unit`. */
  range?: readonly [number, number];
  /** A rounded figure the card words as "about" or "on the order of". */
  approx?: boolean;
  /** Significant figures to print; by default as many as `value` (or `range`) is written with. */
  digits?: number;
  source: SourceId;
  /** Defaults to "verified". */
  status?: Status;
  /** Arithmetic or caveat for the ledger. */
  note?: string;
  /** The model's value `yearsAgo` years ago, for figures that follow the slider. */
  at?: (yearsAgo: number) => number;
};

export type Kind = "sun" | "planet" | "named" | "population" | "star" | "galaxy" | "cosmos";

export type Entry = { kind: Kind; id: string; facts: Readonly<Record<string, Fact>> };

/** One object's figures; the facts keep their literal types, so `at` is known where set. */
const entry = <const F extends Record<string, Fact>>(kind: Kind, id: string, facts: F) => ({
  kind,
  id,
  facts,
});

const length = (v: readonly number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
/** An anchor's heliocentric distance today and its place on the slider (comoving or bound). */
const anchorDistance = (id: AnchorId, source: SourceId, extra: Partial<Fact> = {}): Fact => ({
  value: anchorById(id).mly,
  unit: "Mly",
  digits: 3,
  source,
  at: (yearsAgo) =>
    anchorById(id).tie === "flow"
      ? anchorById(id).mly * scaleAt(yearsAgo)
      : length(anchorAt(anchorById(id), yearsAgo)),
  ...extra,
});
/** A structure's diameter today, stretched with the scale of space on the slider. */
const comoving = (width: number, source: SourceId, extra: Partial<Fact> = {}): Fact => ({
  value: width,
  unit: "Mly",
  approx: true,
  source,
  at: (yearsAgo) => width * scaleAt(yearsAgo),
  ...extra,
});

const andromedaDistance: Fact = {
  value: ANDROMEDA_MLY,
  unit: "Mly",
  source: "li2021",
  note: "765 kpc; 752–785 kpc in McConnachie 2012 and Li et al. 2021",
  at: andromedaApart,
};
/** M31's bright disk: RC3's isophotal diameter (log D25 = 3.28, in 0.1′) at the model's distance. */
const M31_DISK_LY = convert(ANDROMEDA_MLY, "Mly", "ly") * convert(10 ** 3.28 / 10, "arcmin", "rad");
const greatAttractorDistance = anchorDistance("greatAttractor", "tully2014", {
  approx: true,
  digits: 2,
  status: "derived",
  note: "~77 Mpc at h = 0.68; Dupuy & Courtois 2023 put the basin centre farther, ~105 Mpc",
});

/** Significant figures that keep every whole kilometre: 2,439.4 → 4, 69,911 → 5. */
const wholeDigits = (value: number) => Math.max(1, Math.floor(Math.log10(Math.abs(value))) + 1);

/**
 * Semi-major axis of a p:q mean-motion resonance with a planet: Kepler's third law
 * P² = a³ inverted, for an orbit of q/p times the planet's period (inside for p > q).
 */
function resonance(planet: PlanetId, p: number, q: number) {
  const period = (keplerThirdLaw.compute({ a: jplElements(planet, 0).a }) * p) / q;
  return period ** (2 / 3);
}

/** A named body's elements (a and e do not depend on the date). */
const named = (id: NamedId) => NAMED.find((body) => body.id === id)!.elementsAt(new Date(0), 0);

const RAD = Math.PI / 180;
const neighbour = (id: NeighbourId) => NEIGHBOURS.find((star) => star.id === id)!;

/** Angle between two stars on the sky, degrees (haversine). */
function separationDeg(a: Neighbour, b: Neighbour) {
  const h =
    Math.sin(((b.dec - a.dec) * RAD) / 2) ** 2 +
    Math.cos(a.dec * RAD) * Math.cos(b.dec * RAD) * Math.sin(((b.ra - a.ra) * RAD) / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(h))) / RAD;
}

/**
 * A neighbour's figures from its astrometry (neighbours.ts): distance by the parallax law,
 * radial and proper motion, and the closest approach of its straight-line track.
 */
function starFacts(id: NeighbourId, astrometry: SourceId, velocity: SourceId) {
  const star = neighbour(id);
  const approach = closestApproach(star);
  return {
    distance: {
      value: convert(
        parallaxDistance.compute({ p: convert(star.parallax, "mas", "arcsec") }),
        "pc",
        "ly",
      ),
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
      note: `${star.rv} km/s, ${star.rv < 0 ? "approaching" : "receding"}`,
    },
    properMotion: {
      value: Math.hypot(star.pmRa, star.pmDec),
      unit: "mas/yr",
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
  } satisfies Record<string, Fact>;
}

/** The Sun's distance from the Galactic centre: the model's R₀. */
const sunToCentre: Fact = {
  value: SUN_GALACTIC_RADIUS_LY,
  unit: "ly",
  approx: true,
  digits: 3,
  source: "gravity2021",
  note: "8.28 kpc; GRAVITY 8.275–8.277 kpc",
};
const barAngle: Fact = {
  value: BAR_ANGLE_DEG,
  unit: "deg",
  approx: true,
  source: "wegg2015",
  note: "28–33°",
};

const diskMass: Fact = {
  value: 35,
  unit: "Mearth",
  approx: true,
  source: "morbidelli2005",
  note: "the whole Nice-model planetesimal disk",
};
const coldClassicals: Fact = {
  value: (COLD_CLASSICAL_AU[0] + COLD_CLASSICAL_AU[1]) / 2,
  unit: "au",
  range: COLD_CLASSICAL_AU,
  approx: true,
  source: "kaibVolk2022",
  status: "teaching-choice",
  note: "Kaib & Volk 2022: 42–47.5 au; drawn to 48",
};
const auKm: Fact = { value: AU_KM, unit: "km", digits: 10, source: "iau2012b2", note: "exact" };
const auLightTime: Fact = {
  value: AU_LIGHT_SECONDS,
  unit: "s",
  digits: 3,
  source: "iau2012b2",
  status: "derived",
  note: "1 au over c, both exact",
};

/** A planet's radius (toolkit bodies), and its Nice-model start where the sketch moves it. */
function planetFacts(id: PlanetId) {
  const start = startElements(id);
  const facts: { radius: Fact; start?: Fact } = {
    radius: {
      value: PLANET_RADIUS_KM[id],
      unit: "km",
      digits: wholeDigits(PLANET_RADIUS_KM[id]),
      source: "jplRadii",
    },
  };
  if (start)
    facts.start = {
      value: start.a,
      unit: "au",
      digits: start.a < 10 ? 2 : 3,
      source: "morbidelli2005",
      status: "teaching-choice",
      note: "Nice-model start, not a measurement",
    };
  return facts;
}

export const CATALOGUE = {
  sun: {
    sun: entry("sun", "sun", {
      radius: {
        value: SOLAR_RADIUS_KM,
        unit: "km",
        source: "iau2015b3",
        note: "nominal solar radius",
      },
      age: {
        value: SUN_BIRTH,
        unit: "yr",
        approx: true,
        digits: 3,
        source: "connelly2012",
        note: "CAIs 4,567.3 ± 0.16 Myr",
      },
      au: auKm,
      auLightTime,
      massShare: {
        value: 99.8,
        unit: "percent",
        source: "nssdc",
        status: "derived",
        note: "lower bound; 99.87 %",
      },
      spinShare: {
        value: 1,
        unit: "percent",
        source: "iorio2012",
        status: "derived",
        note: "upper bound; 0.61 % of the angular momentum",
      },
      earthDiameters: {
        value: SOLAR_RADIUS_KM / FIGURES.earth.equatorialKm,
        unit: "count",
        digits: 3,
        source: "iau2015b3",
        status: "derived",
        note: "nominal solar over Earth's equatorial radius",
      },
    }),
  },
  planets: {
    mercury: entry("planet", "mercury", planetFacts("mercury")),
    venus: entry("planet", "venus", planetFacts("venus")),
    earth: entry("planet", "earth", {
      ...planetFacts("earth"),
      au: auKm,
      auLightTime,
      auMetres: { value: AU_SI, unit: "m", digits: 12, source: "iau2012b2", note: "exact" },
    }),
    mars: entry("planet", "mars", planetFacts("mars")),
    jupiter: entry("planet", "jupiter", planetFacts("jupiter")),
    saturn: entry("planet", "saturn", planetFacts("saturn")),
    uranus: entry("planet", "uranus", planetFacts("uranus")),
    neptune: entry("planet", "neptune", {
      ...planetFacts("neptune"),
      end: {
        value: jplElements("neptune", 0).a,
        unit: "au",
        approx: true,
        digits: 1,
        source: "jplElements",
      },
    }),
  },
  named: {
    sedna: entry("named", "sedna", {
      perihelion: {
        value: named("sedna").a * (1 - named("sedna").e),
        unit: "au",
        approx: true,
        digits: 2,
        source: "jplHorizons",
        status: "derived",
        note: "a(1 − e), barycentric",
      },
      aphelion: {
        value: named("sedna").a * (1 + named("sedna").e),
        unit: "au",
        approx: true,
        digits: 2,
        source: "jplHorizons",
        status: "derived",
        note: "a(1 + e)",
      },
    }),
    halley: entry("named", "halley", {
      semiMajorAxis: {
        value: named("halley").a,
        unit: "au",
        digits: 3,
        source: "jplHorizons",
      },
    }),
  },
  populations: {
    asteroids: entry("population", "asteroids", {
      where: {
        value: (resonance("jupiter", 1, 4) + resonance("jupiter", 1, 2)) / 2,
        unit: "au",
        range: [resonance("jupiter", 1, 4), resonance("jupiter", 1, 2)],
        approx: true,
        digits: 2,
        source: "jplElements",
        status: "derived",
        note: "between Jupiter's 4:1 and 2:1 resonances, by Kepler's third law",
      },
      mass: {
        value: 3.3,
        unit: "percent",
        approx: true,
        digits: 1,
        source: "pitjeva2018",
        note: "4.008 × 10⁻⁴ M⊕ = 3.3 % of the Moon's mass",
      },
    }),
    disk: entry("population", "disk", {
      drawnAt: {
        value: (DISK_AU[0] + DISK_AU[1]) / 2,
        unit: "au",
        range: DISK_AU,
        approx: true,
        source: "morbidelli2005",
        note: "inner edge ~15.5 au",
      },
      mass: diskMass,
    }),
    kuiper: entry("population", "kuiper", {
      region: { value: 40, unit: "au", range: [30, 50], approx: true, source: "nasaKuiper" },
      todayMass: {
        value: 0.1,
        unit: "Mearth",
        source: "nasaKuiper",
        note: "upper bound; 0.020 M⊕ in Pitjeva & Pitjev 2018",
      },
      originalMass: diskMass,
      catalogued: {
        value: 4_000,
        unit: "count",
        source: "mpcTno",
        note: "lower bound; 4,108 on 16 October 2026",
      },
      cliff: { value: 50, unit: "au", approx: true, source: "allen2001" },
      coldClassicals,
      plutinos: {
        value: resonance("neptune", 3, 2),
        unit: "au",
        digits: 3,
        source: "jplElements",
        status: "derived",
        note: "Neptune's 3:2 resonance by Kepler's third law",
      },
    }),
    oort: entry("population", "oort", {
      innerEdge: {
        value: 3_500,
        unit: "au",
        range: [2_000, 5_000],
        approx: true,
        source: "duncan1987",
      },
      outerEdge: {
        value: 150_000,
        unit: "au",
        range: [100_000, 200_000],
        approx: true,
        source: "kaibVolk2022",
      },
      innerShell: {
        value: OORT_SHELLS_AU[0],
        unit: "au",
        source: "horizon",
        status: "teaching-choice",
      },
      outerShell: {
        value: OORT_SHELLS_AU[1],
        unit: "au",
        source: "horizon",
        status: "teaching-choice",
      },
    }),
  },
  tracers: {
    sample: entry("population", "tracers", {
      coldClassicals,
      count: { value: TRACERS.length, unit: "count", source: "horizon", status: "teaching-choice" },
    }),
  },
  stars: {
    proxima: entry("star", "proxima", {
      ...starFacts("proxima", "gaiaDr3", "kervella2017"),
    }),
    alphaCen: entry("star", "alphaCen", {
      ...starFacts("alphaCen", "akeson2021", "akeson2021"),
      fromProxima: {
        value: separationDeg(neighbour("alphaCen"), neighbour("proxima")),
        unit: "deg",
        digits: 1,
        source: "gaiaDr3",
        status: "derived",
        note: "2.19° on the sky",
      },
      proximaOut: {
        value: neighbourPosition(neighbour("proxima"), 0).distanceTo(
          neighbourPosition(neighbour("alphaCen"), 0),
        ),
        unit: "au",
        approx: true,
        digits: 2,
        source: "akeson2021",
        status: "derived",
        note: "Gaia DR3 Proxima to the Akeson barycentre; Kervella 2017: 12,947 ± 260 au with the older distance",
      },
    }),
    barnard: entry("star", "barnard", {
      ...starFacts("barnard", "gaiaDr3", "gaiaDr3"),
    }),
    scholz: entry("star", "scholz", {
      ...starFacts("scholz", "dupuy2019", "dupuy2019"),
      flyby: {
        value: 75e3,
        unit: "yr",
        range: [70e3, 80e3],
        approx: true,
        source: "mamajek2015",
        note: "52 kau at 70 kyr (Mamajek 2015); 68.7 kau at 80.5 kyr (Dupuy 2019)",
      },
    }),
  },
  galaxy: {
    sun: entry("galaxy", "sun", {
      centre: sunToCentre,
      lap: {
        value: GALACTIC_YEAR,
        unit: "yr",
        range: [205e6, 230e6],
        approx: true,
        source: "eilers2019",
        status: "derived",
        note: "2πR₀/Θ₀: 222 Myr at 229 km/s (Eilers 2019), 206 Myr at 247 km/s (Reid 2019)",
      },
      laps: {
        value: SUN_BIRTH / GALACTIC_YEAR,
        unit: "count",
        digits: 2,
        source: "eilers2019",
        status: "derived",
        note: "the Sun's age over the galactic year",
      },
      circularSpeed: {
        value: 230,
        unit: "km/s",
        approx: true,
        source: "eilers2019",
        note: "229.0 km/s",
      },
      sunSpeed: {
        value: 250,
        unit: "km/s",
        approx: true,
        source: "reid2019",
        note: "247 ± 4 km/s",
      },
      radialSwing: {
        value: 2 * RADIAL_AMPLITUDE_LY,
        unit: "ly",
        approx: true,
        digits: 2,
        source: "bovy2017",
        status: "derived",
        note: "twice the ~0.5 kpc epicycle amplitude",
      },
      radialPeriod: {
        value: RADIAL_PERIOD,
        unit: "yr",
        approx: true,
        source: "bovy2017",
        status: "derived",
        note: "κ = 36.0 km/s/kpc → 171 Myr",
      },
      verticalAmplitude: {
        value: VERTICAL_AMPLITUDE_LY,
        unit: "ly",
        digits: 2,
        source: "blandHawthorn2016",
        status: "derived",
        note: "ρ₀ = 0.097 M☉/pc³; √(20.8² + (W/ν)²) = 102 pc",
      },
      verticalPeriod: {
        value: VERTICAL_PERIOD,
        unit: "yr",
        approx: true,
        source: "blandHawthorn2016",
        status: "derived",
        note: "84.8 Myr",
      },
      height: {
        value: SUN_HEIGHT_LY,
        unit: "ly",
        approx: true,
        source: "bennettBovy2019",
        note: "20.8 ± 0.3 pc",
      },
    }),
    bulge: entry("galaxy", "bulge", {
      centre: sunToCentre,
      bar: {
        value: convert(2 * ARM_START_KPC, "kpc", "ly"),
        unit: "ly",
        range: [convert(7, "kpc", "ly"), convert(10, "kpc", "ly")],
        approx: true,
        digits: 2,
        source: "lucey2023",
        note: "twice the 4.3 kpc half-length; estimates 7–10 kpc end to end",
      },
      barAngle,
      blackHole: { value: 4e6, unit: "Msun", approx: true, source: "gravity2022" },
    }),
    halo: entry("galaxy", "halo", {
      width: {
        value: 1,
        unit: "Mly",
        approx: true,
        digits: 1,
        source: "blandHawthorn2016",
        status: "derived",
        note: "R₂₀₀ ≈ 200 kpc: 1.3–1.8 Mly across",
      },
    }),
    milkyway: entry("galaxy", "milkyway", {
      diskWidth: { value: 100_000, unit: "ly", approx: true, digits: 1, source: "nasaMilkyWay" },
      thickness: {
        value: 1_000,
        unit: "ly",
        approx: true,
        digits: 1,
        source: "blandHawthorn2016",
        note: "thin-disk scale height 300 pc",
      },
      stars: { value: 100e9, unit: "count", source: "nasaMilkyWay", note: "lower bound" },
      age: {
        value: 13.6,
        unit: "Gyr",
        approx: true,
        source: "pasquini2004",
        status: "derived",
        note: "13.4 Gyr halo age plus 0.2–0.3 Gyr",
      },
      barAngle,
      armPitch: {
        value: ARM_PITCH_DEG,
        unit: "deg",
        approx: true,
        source: "vallee2017",
        note: "13.1°",
      },
      gaiaEnceladus: {
        value: 10,
        unit: "Gyr",
        range: [8, 11],
        approx: true,
        source: "gaiaEnceladus",
      },
      planeTilt: {
        value: 60,
        unit: "deg",
        approx: true,
        source: "liu2011",
        status: "derived",
        note: "60.19° between the ecliptic and Galactic planes",
      },
    }),
  },
  cosmos: {
    /** The scale of space then, for every card beyond the Local Group. */
    universe: entry("cosmos", "universe", {
      scale: {
        value: 1,
        unit: "ratio",
        source: "planck2018",
        status: "derived",
        note: "flat ΛCDM, H₀ 67.66 km/s/Mpc, Ωm 0.3111; a = 0.37 ten billion years ago",
        at: scaleAt,
      },
    }),
    localGroup: entry("cosmos", "localGroup", {
      width: {
        value: STRUCTURES.localGroup.width,
        unit: "Mly",
        approx: true,
        digits: 1,
        source: "mcconnachie2012",
        note: "~3 Mpc",
      },
      members: {
        value: 100,
        unit: "count",
        source: "mcconnachie2019",
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
        digits: 2,
        source: "vanDerMarel2012",
        status: "derived",
      },
    }),
    localSheet: entry("cosmos", "localSheet", {
      width: comoving(STRUCTURES.localSheet.width, "tully2008", {
        digits: 2,
        status: "derived",
        note: "twice the 7 Mpc radius",
      }),
      radius: { value: 7, unit: "Mpc", approx: true, source: "tully2008" },
      thickness: {
        value: STRUCTURES.localSheet.thickness,
        unit: "Mly",
        approx: true,
        digits: 1,
        source: "tully2008",
        status: "derived",
        note: "±1.5 Mpc about the supergalactic equator",
      },
      fromVoid: {
        value: 260,
        unit: "km/s",
        approx: true,
        source: "tully2008",
        note: "259 ± 25 km/s",
      },
      stray: { value: 40, unit: "km/s", approx: true, source: "tully2008" },
    }),
    andromeda: entry("cosmos", "andromeda", {
      distance: andromedaDistance,
      approach: {
        value: ANDROMEDA_APPROACH_KMS,
        unit: "km/s",
        source: "vanDerMarel2012",
        note: "−109.3 ± 4.4 km/s toward the Galactic centre",
      },
      approachSun: {
        value: 300,
        unit: "km/s",
        approx: true,
        source: "vanDerMarel2012",
        note: "heliocentric",
      },
      width: {
        value: M31_DISK_LY,
        unit: "ly",
        range: [M31_DISK_LY, convert(2 * 40, "kpc", "ly")],
        approx: true,
        digits: 2,
        source: "m31Width",
        status: "derived",
        note: "D25 = 190.5′ at the model's 2.5 Mly, to twice the ~40 kpc outer-disk radius",
      },
      firstPass: {
        value: 4.5,
        unit: "Gyr",
        range: [4, 5],
        approx: true,
        source: "m31Merger",
      },
      mergerWithin: {
        value: 10,
        unit: "Gyr",
        source: "m31Merger",
        note: "merger odds 50–90 % within this time",
      },
    }),
    triangulum: entry("cosmos", "triangulum", {
      distance: anchorDistance("triangulum", "mcconnachie2012"),
      width: { value: 60_000, unit: "ly", approx: true, source: "nasaM33" },
    }),
    virgo: entry("cosmos", "virgo", {
      distance: anchorDistance("virgoCluster", "mei2007", { note: "16.5 Mpc" }),
      members: {
        value: 1_500,
        unit: "count",
        range: [1_300, 2_000],
        approx: true,
        source: "binggeli1985",
      },
      width: {
        value: STRUCTURES.virgo.width,
        unit: "Mly",
        approx: true,
        digits: 1,
        source: "mclaughlin1999",
        status: "derived",
        note: "2 r₂₀₀",
      },
      blackHole: { value: 6.5e9, unit: "Msun", approx: true, source: "eht2019" },
    }),
    fornax: entry("cosmos", "fornax", {
      distance: anchorDistance("fornaxCluster", "blakeslee2009", { note: "20.0 ± 0.3 Mpc" }),
      members: { value: 340, unit: "count", approx: true, source: "ferguson1989" },
      width: {
        value: 5,
        unit: "Mly",
        approx: true,
        source: "drinkwater2001",
        status: "derived",
        note: "~0.7 Mpc radius",
      },
      rank: {
        value: 2,
        unit: "count",
        source: "iodice2019",
        note: "by mass, after Virgo; the card words it, no figure",
      },
    }),
    supercluster: entry("cosmos", "supercluster", {
      width: comoving(STRUCTURES.supercluster.width, "devaucouleurs1958", {
        digits: 2,
        status: "derived",
        note: "~33 Mpc across",
      }),
      members: {
        value: 10,
        unit: "count",
        source: "tully1982",
        note: "clouds besides the Virgo Cluster, each with many small groups",
      },
    }),
    centaurus: entry("cosmos", "centaurus", {
      distance: anchorDistance("centaurusCluster", "hubbleFlow", { status: "derived" }),
    }),
    hydra: entry("cosmos", "hydra", {
      distance: anchorDistance("hydraCluster", "hubbleFlow", { status: "derived" }),
      members: {
        value: 580,
        unit: "count",
        approx: true,
        source: "richter1989",
        note: "a field catalogue, not a member census",
      },
    }),
    greatAttractor: entry("cosmos", "greatAttractor", {
      distance: greatAttractorDistance,
      mass: {
        value: 5.4e16,
        unit: "Msun",
        approx: true,
        digits: 1,
        source: "lyndenBell1988",
        note: "estimates vary",
      },
    }),
    laniakea: entry("cosmos", "laniakea", {
      width: comoving(STRUCTURES.laniakea.width, "tully2014", {
        digits: 2,
        status: "derived",
        note: "160 Mpc across",
      }),
      members: { value: 100_000, unit: "count", approx: true, source: "tully2014" },
      mass: { value: 1e17, unit: "Msun", approx: true, source: "tully2014" },
      heart: greatAttractorDistance,
    }),
  },
} as const;

/** Every fact with its path ("cosmos.virgo.members"), for tests and the ledger. */
export function catalogueFacts() {
  return Object.entries(CATALOGUE).flatMap(([kind, entries]) =>
    Object.entries(entries as Record<string, Entry>).flatMap(([id, e]) =>
      Object.entries(e.facts).map(([fact, value]) => ({
        path: `${kind}.${id}.${fact}`,
        fact: value,
      })),
    ),
  );
}
