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
import { eccentricAnomaly, keplerPosition, periodYears, type Elements } from "./kepler";

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

/**
 * IAU mean radii in km (WGCCRE 2015, Archinal et al. 2018); shapes are in figures.ts.
 * Jupiter's is the volumetric mean of the Juno 1-bar figure (Galanti et al. 2026), not the
 * IAU nominal unit; the paper's own 69,886 km mean follows its non-ellipsoidal shape.
 */
export const PLANET_RADIUS_KM: Record<PlanetId, number> = {
  mercury: 2439.4,
  venus: 6051.8,
  earth: 6371.0,
  mars: 3389.5,
  jupiter: 69905,
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

/**
 * Elements from the JPL table `T` Julian centuries after J2000; the fit holds for 1800–2050.
 * `driftYears` carries the body on along that orbit at its mean rate (the mean longitude
 * alone), never ageing the orbit itself: the secular rates do not extrapolate. A scene asks
 * many times a frame, so the sums of `secularElement`, `argumentOfPerihelion` and
 * `meanAnomaly` are written out here, and `out` takes the result without allocating.
 */
export function jplElements(
  id: PlanetId | "pluto",
  T: number,
  driftYears = 0,
  out: Elements = { a: 0, e: 0, i: 0, omega: 0, node: 0, M: 0 },
): Elements {
  const r = JPL[id];
  const varpi = r[4] + r[10] * T;
  const node = r[5] + r[11] * T;
  const L = r[3] + r[9] * T + r[9] * (driftYears / 100);
  out.a = r[0] + r[6] * T;
  out.e = r[1] + r[7] * T;
  out.i = r[2] + r[8] * T;
  out.omega = wrap(varpi - node, 360);
  out.node = wrap(node, 360);
  out.M = wrap(L - varpi, 360);
  return out;
}

export type NamedId = "ceres" | "pluto" | "haumea" | "makemake" | "eris" | "sedna" | "halley";

export type NamedBody = {
  id: NamedId;
  radiusKm: number;
  /** Present-day elements at the given date, shifted by `extraYears`; written into `out` when given. */
  elementsAt: (date: Date, extraYears: number, out?: Elements) => Elements;
};

/** Mean anomaly from a perihelion passage date and period. */
function meanAnomalyFromPerihelion(date: Date, extraYears: number, periYear: number, P: number) {
  const year = 2000 + (julianDay(date) - J2000_JD) / DAYS_PER_JULIAN_YEAR + extraYears;
  return wrap(((year - periYear) / P) * 360, 360);
}

/** A fixed orbit's elements with this mean anomaly, into `out` when given. */
function fixedOrbit(orbit: Omit<Elements, "M">, M: number, out?: Elements): Elements {
  return Object.assign(out ?? { a: 0, e: 0, i: 0, omega: 0, node: 0, M: 0 }, orbit, { M });
}

/** Perihelion passage as a decimal year, from its Julian day. */
const yearOf = (jd: number) => 2000 + (jd - J2000_JD) / DAYS_PER_JULIAN_YEAR;

/**
 * The dwarf planets Ceres, Haumea, Makemake and Eris: JPL Small-Body Database osculating
 * heliocentric elements at epoch JD 2461200.5 (2026 June), timed by their perihelion passages.
 * Sedna: JPL Horizons barycentric elements (q ≈ 76.2 AU, perihelion February 2076).
 * Halley: Horizons osculating elements of 1994 Feb 17, after the 1986 perihelion,
 * timed by the 1986 and 2061 perihelia (9 February 1986, 28 July 2061).
 * Sun-ward first, the comet last: a list prints them in this order.
 */
export const NAMED: readonly NamedBody[] = [
  {
    id: "ceres",
    /* Dawn: 482.1 × 482.1 × 445.9 km, mean 469.7 km (Park et al. 2016, Nature 537, 515). */
    radiusKm: 469.7,
    elementsAt: (date, extraYears, out) =>
      fixedOrbit(
        { a: 2.76555, e: 0.07969, i: 10.588, omega: 73.294, node: 80.249 },
        meanAnomalyFromPerihelion(date, extraYears, yearOf(2461599.84), periodYears(2.76555)),
        out,
      ),
  },
  {
    id: "pluto",
    /* New Horizons, 1188.3 ± 1.6 km (Nimmo et al. 2017, Icarus 287, 12). */
    radiusKm: 1188.3,
    elementsAt: (date, extraYears, out) =>
      jplElements("pluto", centuriesSinceJ2000(date), extraYears, out),
  },
  {
    id: "haumea",
    /* Occultation ellipsoid 1,161 × 852 × 513 km, volume-equivalent 798 km (Ortiz et al. 2017, Nature 550, 219). */
    radiusKm: 798,
    elementsAt: (date, extraYears, out) =>
      fixedOrbit(
        { a: 43.0603, e: 0.19444, i: 28.208, omega: 240.691, node: 121.786 },
        meanAnomalyFromPerihelion(date, extraYears, yearOf(2500416.6), periodYears(43.0603)),
        out,
      ),
  },
  {
    id: "makemake",
    /* Occultation 1,430 × 1,502 km (Ortiz et al. 2012, Nature 491, 566): 715 km mean. */
    radiusKm: 715,
    elementsAt: (date, extraYears, out) =>
      fixedOrbit(
        { a: 45.5709, e: 0.15889, i: 29.028, omega: 297.092, node: 79.295 },
        meanAnomalyFromPerihelion(date, extraYears, yearOf(2408158.69), periodYears(45.5709)),
        out,
      ),
  },
  {
    id: "eris",
    /* Occultation of 6 November 2010, 1,163 ± 6 km (Sicardy et al. 2011, Nature 478, 493). */
    radiusKm: 1163,
    elementsAt: (date, extraYears, out) =>
      fixedOrbit(
        { a: 67.9339, e: 0.43824, i: 43.926, omega: 150.795, node: 36.005 },
        meanAnomalyFromPerihelion(date, extraYears, yearOf(2545407.72), periodYears(67.9339)),
        out,
      ),
  },
  {
    id: "sedna",
    /* Herschel thermal fit, D = 995 ± 80 km (Pál et al. 2012, A&A 541, L6). */
    radiusKm: 497.5,
    elementsAt: (date, extraYears, out) =>
      fixedOrbit(
        { a: 506, e: 0.8496, i: 11.93, omega: 311.29, node: 144.4 },
        meanAnomalyFromPerihelion(date, extraYears, 2076.12, periodYears(506)),
        out,
      ),
  },
  {
    id: "halley",
    /* Giotto: a ~15 × 8 × 8 km nucleus (Keller et al. 1987); 5.5 km effective radius (Lamy et al. 2004). */
    radiusKm: 5.5,
    elementsAt: (date, extraYears, out) =>
      fixedOrbit(
        { a: 17.834, e: 0.96714, i: 162.26, omega: 111.33, node: 58.42 },
        meanAnomalyFromPerihelion(date, extraYears, 1986.108, 75.464),
        out,
      ),
  },
];

export const NAMED_IDS: readonly NamedId[] = NAMED.map((body) => body.id);

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
