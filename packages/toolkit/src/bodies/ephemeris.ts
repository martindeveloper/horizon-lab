/**
 * Heliocentric positions of the planets and a few named bodies.
 *
 * Planets use the JPL approximate Keplerian elements for 1800–2050 AD
 * (Standish & Williams, "Keplerian Elements for Approximate Positions of the
 * Major Planets"), J2000 ecliptic frame, with their secular rates per Julian
 * century. Pluto uses its row from the table's earlier edition, since withdrawn
 * by JPL. Positions are good to a fraction of a
 * degree inside that window (Standish's error table reaches ~10′ for Saturn).
 * Positions come out in the scene frame (frames.ts).
 */
import { wrap } from "../math/index";
import { J2000_JD, SOLAR_RADIUS_KM, julianDay } from "../science";
import {
  argumentOfPerihelion,
  eccentricAnomaly,
  keplerPosition,
  meanAnomaly,
  periodYears,
  secularElement,
  type Elements,
} from "./kepler";

export const SUN_RADIUS_KM = SOLAR_RADIUS_KM;
export const DAYS_PER_JULIAN_YEAR = 365.25;

export type PlanetId =
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

/** a (AU), e, I (deg), L (deg), ϖ (deg), Ω (deg); each with its rate per century. */
type JplRow = readonly [
  a: number,
  e: number,
  I: number,
  L: number,
  periLong: number,
  node: number,
  aDot: number,
  eDot: number,
  IDot: number,
  LDot: number,
  periDot: number,
  nodeDot: number,
];

const JPL: Record<PlanetId | "pluto", JplRow> = {
  mercury: [
    0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 0.00000037,
    0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081,
  ],
  venus: [
    0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 0.0000039,
    -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418,
  ],
  /* JPL's Earth–Moon barycentre row: the Earth itself sits at most 4,700 km (3 × 10⁻⁵ au) off it. */
  earth: [
    1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392,
    -0.01294668, 35999.37244981, 0.32327364, 0.0,
  ],
  mars: [
    1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847,
    0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343,
  ],
  jupiter: [
    5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607,
    -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106,
  ],
  saturn: [
    9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506,
    -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794,
  ],
  uranus: [
    19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503, -0.00196176,
    -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589,
  ],
  neptune: [
    30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291,
    0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664,
  ],
  pluto: [
    39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684, -0.00031596,
    0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482,
  ],
};

/** IAU mean radii in km (WGCCRE 2015, Archinal et al. 2018); shapes are in figures.ts. */
export const PLANET_RADIUS_KM: Record<PlanetId, number> = {
  mercury: 2439.4,
  venus: 6051.8,
  earth: 6371.0,
  mars: 3389.5,
  jupiter: 69911,
  saturn: 58232,
  uranus: 25362,
  neptune: 24622,
};

export const PLANET_IDS: readonly PlanetId[] = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];

export const GIANTS: ReadonlySet<PlanetId> = new Set(["jupiter", "saturn", "uranus", "neptune"]);

/** Julian centuries since J2000 for a date. */
export function centuriesSinceJ2000(date: Date) {
  return (julianDay(date) - J2000_JD) / 36525;
}

/** Osculating elements at the given epoch from the JPL table. */
function six(values: readonly number[]): [number, number, number, number, number, number] {
  const [a, e, i, L, varpi, node] = values;
  if (
    a === undefined ||
    e === undefined ||
    i === undefined ||
    L === undefined ||
    varpi === undefined ||
    node === undefined
  ) {
    throw new Error("JPL elements need six secular terms.");
  }
  return [a, e, i, L, varpi, node];
}

/**
 * Elements from the JPL table `T` Julian centuries after J2000; the fit holds for 1800–2050.
 * `driftYears` carries the body on along that orbit at its mean rate (the mean longitude
 * alone), never ageing the orbit itself: the secular rates do not extrapolate.
 */
export function jplElements(id: PlanetId | "pluto", T: number, driftYears = 0): Elements {
  const r = JPL[id];
  const at = (k: number) => secularElement.compute({ x0: r[k]!, rate: r[k + 6]!, T });
  const [a, e, i, L0, varpi, node] = six(Array.from({ length: 6 }, (_, k) => at(k)));
  const L = L0 + r[9] * (driftYears / 100);
  return {
    a,
    e,
    i,
    omega: wrap(argumentOfPerihelion.compute({ varpi, node }), 360),
    node: wrap(node, 360),
    M: wrap(meanAnomaly.compute({ L, varpi }), 360),
  };
}

export type NamedId = "pluto" | "sedna" | "halley";

export type NamedBody = {
  id: NamedId;
  radiusKm: number;
  /** Present-day elements at the given date, shifted by `extraYears`. */
  elementsAt: (date: Date, extraYears: number) => Elements;
};

/** Mean anomaly from a perihelion passage date and period. */
function meanAnomalyFromPerihelion(date: Date, extraYears: number, periYear: number, P: number) {
  const year = 2000 + (julianDay(date) - J2000_JD) / DAYS_PER_JULIAN_YEAR + extraYears;
  return wrap(((year - periYear) / P) * 360, 360);
}

/**
 * Sedna: JPL Horizons barycentric elements (q ≈ 76.2 AU, perihelion February 2076).
 * Halley: Horizons osculating elements of 1994 Feb 17, after the 1986 perihelion,
 * timed by the 1986 and 2061 perihelia (9 February 1986, 28 July 2061).
 */
export const NAMED: readonly NamedBody[] = [
  {
    id: "pluto",
    /* New Horizons, 1188.3 ± 1.6 km (Nimmo et al. 2017, Icarus 287, 12). */
    radiusKm: 1188.3,
    elementsAt: (date, extraYears) => jplElements("pluto", centuriesSinceJ2000(date), extraYears),
  },
  {
    id: "sedna",
    /* Herschel thermal fit, D = 995 ± 80 km (Pál et al. 2012, A&A 541, L6). */
    radiusKm: 497.5,
    elementsAt: (date, extraYears) => ({
      a: 506,
      e: 0.8496,
      i: 11.93,
      omega: 311.29,
      node: 144.4,
      M: meanAnomalyFromPerihelion(date, extraYears, 2076.12, periodYears(506)),
    }),
  },
  {
    id: "halley",
    /* Giotto: a ~15 × 8 × 8 km nucleus (Keller et al. 1987); 5.5 km effective radius (Lamy et al. 2004). */
    radiusKm: 5.5,
    elementsAt: (date, extraYears) => ({
      a: 17.834,
      e: 0.96714,
      i: 162.26,
      omega: 111.33,
      node: 58.42,
      M: meanAnomalyFromPerihelion(date, extraYears, 1986.108, 75.464),
    }),
  },
];

export function namedById(id: NamedId) {
  const found = NAMED.find((body) => body.id === id);
  if (!found) throw new Error(`Unknown body ${id}`);
  return found;
}

/** Numerical regression checks, exercised by the test suite. */
export function ephemerisSelfCheck(): string[] {
  const errors: string[] = [];
  const j2000 = new Date(Date.UTC(2000, 0, 1, 12));
  const earth = keplerPosition(jplElements("earth", 0));
  const r = Math.hypot(earth[0], earth[1], earth[2]);
  if (Math.abs(r - 0.9833) > 0.01) errors.push(`Earth at J2000 should be near perihelion: ${r}`);
  // J2000 fell on 1 January: the Earth–Sun line points toward ecliptic longitude ~100°.
  const lon = wrap((Math.atan2(-earth[2], earth[0]) * 180) / Math.PI, 360);
  if (Math.abs(lon - 100) > 2) errors.push(`Earth longitude at J2000 ${lon}`);
  const E = eccentricAnomaly(Math.PI / 3, 0.5);
  if (Math.abs(E - 0.5 * Math.sin(E) - Math.PI / 3) > 1e-9) errors.push("Kepler solver");
  const halley = namedById("halley").elementsAt(j2000, 0);
  if (!(halley.M > 60 && halley.M < 70)) errors.push(`Halley M at J2000 ${halley.M}`);
  if (Math.abs(periodYears(30.07) - 164.9) > 0.5) errors.push("Neptune period");
  return errors;
}
