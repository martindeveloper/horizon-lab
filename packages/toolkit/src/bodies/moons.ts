/**
 * The major moons' orbits: planet-centred mean elements and their rates.
 *
 * Elements are JPL's planetary satellite mean elements (SSD, epoch J2000 TDB):
 * the Moon's on the J2000 ecliptic, Charon's on Pluto's equator, the rest on
 * each moon's Laplace plane, given by its pole. Ω counts from that plane's
 * ascending node on the ICRF equator; ω and Ω precess at the table's periods
 * (signed here: + advances, − regresses). P is the sidereal period: NSSDC's for
 * the Moon and Triton, the IAU synchronous spin rate for the Galilean moons and
 * Charon (their tabulated P is the anomalistic period), JPL's for Titan.
 *
 * Titan's ω, M, Ω and Triton's i, Ω, M and nodal period are fitted to JPL
 * Horizons vectors (SAT441, NEP097/NEP098) for 2000–2032: the table's epoch angles
 * miss them by up to 163° and 13°. Every moon then matches Horizons to 0.2°, the
 * Moon to 3° (its mean elements leave out the Sun's perturbations).
 */
import { wrap } from "../math/index";
import { J2000_JD, julianDay } from "../science";
import { LUNAR_EQUATOR_INCLINATION_DEG } from "./almanac";
import { DAYS_PER_JULIAN_YEAR, type PlanetId } from "./ephemeris";

export type MoonId =
  | "moon"
  | "io"
  | "europa"
  | "ganymede"
  | "callisto"
  | "titan"
  | "triton"
  | "charon";
export type MoonHost = PlanetId | "pluto";

export type Moon = {
  id: MoonId;
  host: MoonHost;
  /** IAU mean radius, km (WGCCRE 2015, Archinal et al. 2018). */
  radiusKm: number;
  aKm: number;
  e: number;
  /** ω, M, i, Ω at J2000, degrees. */
  omega: number;
  M: number;
  i: number;
  node: number;
  /** Sidereal period, days. */
  periodDays: number;
  /** Precession periods of ω and Ω, years; + advances, − regresses, 0 none. */
  apsisYears: number;
  nodeYears: number;
  /** Reference plane: the J2000 ecliptic, or its pole as ICRF RA and Dec. */
  plane: "ecliptic" | readonly [ra: number, dec: number];
  /** Spin axis tilt from the plane's pole, away from the orbit normal (Cassini state). */
  cassini?: number;
};

const JUPITER_LAPLACE = [268.1, 64.5] as const;
/** IAU 2015 synchronous rotation rates (degrees per day) as sidereal periods. */
const spinPeriod = (rate: number) => 360 / rate;

export const MOONS: readonly Moon[] = [
  {
    id: "moon",
    host: "earth",
    radiusKm: 1737.4,
    aKm: 384_400,
    e: 0.0554,
    omega: 318.15,
    M: 135.27,
    i: 5.16,
    node: 125.08,
    periodDays: 27.321661,
    apsisYears: 5.997,
    nodeYears: -18.6,
    plane: "ecliptic",
    /** Cassini's third law: the spin axis leans 1.54° from the ecliptic pole, opposite the orbit's. */
    cassini: LUNAR_EQUATOR_INCLINATION_DEG,
  },
  {
    id: "io",
    host: "jupiter",
    radiusKm: 1821.49,
    aKm: 421_800,
    e: 0.004,
    omega: 49.1,
    M: 330.9,
    i: 0,
    node: 0,
    periodDays: spinPeriod(203.4889538),
    /** The forced eccentricity's apse follows the conjunctions with Europa, backwards. */
    apsisYears: -1.333,
    nodeYears: 0,
    plane: JUPITER_LAPLACE,
  },
  {
    id: "europa",
    host: "jupiter",
    radiusKm: 1560.8,
    aKm: 671_100,
    e: 0.009,
    omega: 45,
    M: 345.4,
    i: 0.5,
    node: 184,
    periodDays: spinPeriod(101.3747235),
    apsisYears: -1.394,
    nodeYears: -30.202,
    plane: JUPITER_LAPLACE,
  },
  {
    id: "ganymede",
    host: "jupiter",
    radiusKm: 2631.2,
    aKm: 1_070_400,
    e: 0.001,
    omega: 198.3,
    M: 324.8,
    i: 0.2,
    node: 58.5,
    periodDays: spinPeriod(50.3176081),
    apsisYears: 68.301,
    nodeYears: -137.812,
    plane: [268.2, 64.6],
  },
  {
    id: "callisto",
    host: "jupiter",
    radiusKm: 2410.3,
    aKm: 1_882_700,
    e: 0.007,
    omega: 43.8,
    M: 87.4,
    i: 0.3,
    node: 309.1,
    periodDays: spinPeriod(21.5710715),
    apsisYears: 277.921,
    nodeYears: -577.264,
    plane: [268.7, 64.8],
  },
  {
    id: "titan",
    host: "saturn",
    radiusKm: 2574.76,
    aKm: 1_221_900,
    e: 0.029,
    omega: 184.08,
    M: 163.53,
    i: 0.3,
    node: 24.1,
    periodDays: 15.945448,
    apsisYears: 346.68,
    nodeYears: -687.37,
    plane: [36.4, 84],
  },
  {
    id: "triton",
    host: "neptune",
    radiusKm: 1352.6,
    aKm: 354_800,
    e: 0,
    omega: 0,
    M: 57.74,
    i: 157.21,
    node: 176.78,
    periodDays: 5.876854,
    apsisYears: 0,
    /** A retrograde orbit's node advances. */
    nodeYears: 677.8,
    plane: [299.8, 43.1],
  },
  {
    id: "charon",
    host: "pluto",
    radiusKm: 606,
    aKm: 19_600,
    e: 0,
    omega: 0,
    M: 304.1,
    i: 0,
    node: 0,
    /** Pluto's own rate: the pair is mutually locked. */
    periodDays: spinPeriod(56.3625225),
    apsisYears: 0,
    nodeYears: 0,
    plane: [132.993, -6.163],
  },
];

export const MOON_IDS: readonly MoonId[] = MOONS.map((moon) => moon.id);

export function moonById(id: MoonId) {
  const found = MOONS.find((moon) => moon.id === id);
  if (!found) throw new Error(`Unknown moon ${id}`);
  return found;
}

const perDay = (years: number) => (years ? 360 / (years * DAYS_PER_JULIAN_YEAR) : 0);

/**
 * Rates in degrees per day. The mean longitude advances once per sidereal
 * period; a retrograde orbit counts its longitude backwards, Ω − ω − M.
 */
export function meanRates(moon: Moon) {
  const omega = perDay(moon.apsisYears);
  const node = perDay(moon.nodeYears);
  const sense = moon.i > 90 ? -1 : 1;
  return { omega, node, M: 360 / moon.periodDays - omega - sense * node };
}

/** Mean longitude Ω ± (ω + M) in the moon's reference plane, degrees. */
export function meanLongitude(id: MoonId, date: Date) {
  const moon = moonById(id);
  const rates = meanRates(moon);
  const d = julianDay(date) - J2000_JD;
  const sense = moon.i > 90 ? -1 : 1;
  const along = moon.omega + moon.M + (rates.omega + rates.M) * d;
  return wrap(moon.node + rates.node * d + sense * along, 360);
}
