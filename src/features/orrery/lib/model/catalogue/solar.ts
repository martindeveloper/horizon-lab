/** The Sun, planets, named bodies and small-body populations. */
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
  resonanceSemiMajorAxis,
} from "@horizon/toolkit/science";

import { startElements } from "../elements";
import { COLD_CLASSICAL_AU, DISK_AU, OORT_SHELLS_AU, SUN_BIRTH } from "../parameters";
import { TRACERS } from "../tracers";
import type { Facts, Span, Value } from "./types";

/** Significant figures that keep every whole kilometre: 2,439.4 → 4, 69,911 → 5. */
const wholeDigits = (value: number) => Math.max(1, Math.floor(Math.log10(Math.abs(value))) + 1);

/** Where an orbit of `k` times the planet's period sits (Kepler's third law). */
const resonance = (planet: PlanetId, k: number) =>
  resonanceSemiMajorAxis.compute({ ap: jplElements(planet, 0).a, k });

/** A named body's present elements; their a and e do not depend on the date. */
const named = (id: NamedId) => NAMED.find((body) => body.id === id)!.elementsAt(new Date(0), 0);

const diskMass: Value = {
  value: 35,
  unit: "Mearth",
  source: "morbidelli2005",
  status: "verified",
  note: "the whole Nice-model planetesimal disk",
};
const coldClassicals: Span = {
  range: COLD_CLASSICAL_AU,
  unit: "au",
  source: "kaibVolk2022",
  status: "teaching-choice",
  note: "Kaib & Volk 2022: 42–47.5 au; drawn to 48",
};
const auKm: Value = {
  value: AU_KM,
  unit: "km",
  digits: 4,
  source: "iau2012b2",
  status: "verified",
  note: "exactly 149,597,870.7 km",
};
const auLightTime: Value = {
  value: AU_LIGHT_SECONDS,
  unit: "s",
  show: "min",
  digits: 2,
  source: "iau2012b2",
  status: "derived",
  note: "1 au over c, both exact",
};

/** A planet's radius (toolkit bodies), and its Nice-model start where the sketch moves it. */
function planetFacts(id: PlanetId) {
  const start = startElements(id);
  const facts: { radius: Value; start?: Value } = {
    radius: {
      value: PLANET_RADIUS_KM[id],
      unit: "km",
      digits: wholeDigits(PLANET_RADIUS_KM[id]),
      source: "jplRadii",
      status: "verified",
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

export const SUN = {
  sun: {
    radius: {
      value: SOLAR_RADIUS_KM,
      unit: "km",
      source: "iau2015b3",
      status: "verified",
      note: "nominal solar radius",
    },
    radiusAu: {
      value: convert(SOLAR_RADIUS_KM, "km", "au"),
      unit: "au",
      digits: 2,
      source: "iau2015b3",
      status: "derived",
    },
    age: {
      value: SUN_BIRTH,
      unit: "yr",
      show: "Gyr",
      digits: 3,
      source: "connelly2012",
      status: "verified",
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
  },
} satisfies Record<string, Facts>;

export const PLANETS = {
  mercury: planetFacts("mercury"),
  venus: planetFacts("venus"),
  earth: {
    ...planetFacts("earth"),
    au: auKm,
    auLightTime,
    auMetres: {
      value: AU_SI,
      unit: "m",
      digits: 12,
      source: "iau2012b2",
      status: "verified",
      note: "exact",
    },
  },
  mars: planetFacts("mars"),
  jupiter: planetFacts("jupiter"),
  saturn: planetFacts("saturn"),
  uranus: planetFacts("uranus"),
  neptune: {
    ...planetFacts("neptune"),
    end: {
      value: jplElements("neptune", 0).a,
      unit: "au",
      digits: 1,
      source: "jplElements",
      status: "verified",
    },
  },
} satisfies Record<PlanetId, Facts>;

export const NAMED_BODIES = {
  sedna: {
    perihelion: {
      value: named("sedna").a * (1 - named("sedna").e),
      unit: "au",
      digits: 2,
      source: "jplHorizons",
      status: "derived",
      note: "a(1 − e), barycentric",
    },
    aphelion: {
      value: named("sedna").a * (1 + named("sedna").e),
      unit: "au",
      digits: 2,
      source: "jplHorizons",
      status: "derived",
      note: "a(1 + e)",
    },
  },
  halley: {
    semiMajorAxis: {
      value: named("halley").a,
      unit: "au",
      digits: 3,
      source: "jplHorizons",
      status: "verified",
    },
  },
} satisfies Record<string, Facts>;

export const POPULATIONS = {
  asteroids: {
    where: {
      range: [resonance("jupiter", 1 / 4), resonance("jupiter", 1 / 2)],
      unit: "au",
      digits: 2,
      source: "jplElements",
      status: "derived",
      note: "between Jupiter's 4:1 and 2:1 resonances, by Kepler's third law",
    },
    mass: {
      value: 3.3,
      unit: "percent",
      digits: 1,
      source: "pitjeva2018",
      status: "verified",
      note: "4.008 × 10⁻⁴ M⊕ = 3.3 % of the Moon's mass",
    },
  },
  disk: {
    drawnAt: {
      range: DISK_AU,
      unit: "au",
      source: "morbidelli2005",
      status: "verified",
      note: "inner edge ~15.5 au",
    },
    mass: diskMass,
  },
  kuiper: {
    region: { range: [30, 50], unit: "au", source: "nasaKuiper", status: "verified" },
    todayMass: {
      value: 0.1,
      unit: "Mearth",
      source: "nasaKuiper",
      status: "verified",
      note: "upper bound; 0.020 M⊕ in Pitjeva & Pitjev 2018",
    },
    originalMass: diskMass,
    catalogued: {
      value: 4_000,
      unit: "count",
      source: "mpcTno",
      status: "verified",
      note: "lower bound; 4,108 on 16 October 2026",
    },
    cliff: { value: 50, unit: "au", source: "allen2001", status: "verified" },
    coldClassicals,
    plutinos: {
      value: resonance("neptune", 3 / 2),
      unit: "au",
      digits: 3,
      source: "jplElements",
      status: "derived",
      note: "Neptune's 3:2 resonance by Kepler's third law",
    },
  },
  oort: {
    innerEdge: { range: [2_000, 5_000], unit: "au", source: "duncan1987", status: "verified" },
    outerEdge: {
      range: [100_000, 200_000],
      unit: "au",
      source: "kaibVolk2022",
      status: "verified",
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
  },
  /** The planetesimal sample the clearing sketch draws. */
  tracers: {
    coldClassicals,
    count: { value: TRACERS.length, unit: "count", source: "horizon", status: "teaching-choice" },
  },
} satisfies Record<string, Facts>;
