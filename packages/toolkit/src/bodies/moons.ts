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
 * miss them by up to 163° and 13°. Phobos's and Deimos's angles, inclinations, mean
 * motions and precession periods are fitted the same way (MAR099): the table rounds
 * its angles to 0.1° and Phobos's apsidal period to 0.1 yr, which over decades turns
 * its small eccentricity the wrong way. So are Saturn's mid-size moons (SAT441) and
 * Uranus's five (URA182 elements, Horizons' URA184 vectors), keeping the table's node
 * periods where fitting them gains nothing. Mimas, Tethys, Enceladus and Miranda add
 * the librations their resonances drive in mean longitude: Mimas swings 43.6° over the
 * 70.56-year Mimas–Tethys cycle. Every moon then matches Horizons to 0.3°, the Moon
 * to 3° (its mean elements leave out the Sun's perturbations).
 *
 * Uranus's moons orbit its equator on the side of the pole their orbits turn about,
 * RA 77.311°, Dec 15.175°: the IAU's north pole for Uranus is the opposite one.
 */
import { wrap } from "../math/index";
import { J2000_JD, julianDay, RAD_PER_DEG as RAD } from "../science";
import { LUNAR_EQUATOR_INCLINATION_DEG } from "./almanac";
import { DAYS_PER_JULIAN_YEAR, type PlanetId } from "./ephemeris";

export type MoonId =
  | "moon"
  | "phobos"
  | "deimos"
  | "io"
  | "europa"
  | "ganymede"
  | "callisto"
  | "mimas"
  | "enceladus"
  | "tethys"
  | "dione"
  | "rhea"
  | "titan"
  | "iapetus"
  | "miranda"
  | "ariel"
  | "umbriel"
  | "titania"
  | "oberon"
  | "triton"
  | "charon";
export type MoonHost = PlanetId | "pluto";

export type Moon = {
  id: MoonId;
  host: MoonHost;
  /** IAU mean radius, km (WGCCRE 2015, Archinal et al. 2018). */
  radiusKm: number;
  /**
   * JPL's mean semi-major axis, km, printed there to the nearest 100 km for all but Mars's and
   * Uranus's moons. It sets the drawn distance alone; the motion runs on `periodDays`.
   */
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
  /**
   * Resonant librations of the mean longitude, added to M:
   * amplitude · sin(phase + 360° · years since J2000 / period).
   */
  libration?: readonly (readonly [degrees: number, years: number, phase: number])[];
};

const JUPITER_LAPLACE = [268.1, 64.5] as const;
/** The inner Saturnian moons' Laplace plane, close to Saturn's equator. */
const SATURN_LAPLACE = [40.6, 83.5] as const;
const URANUS_EQUATOR = [77.311, 15.175] as const;
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
    id: "phobos",
    host: "mars",
    radiusKm: 11.08,
    aKm: 9375,
    e: 0.0151,
    omega: 216.548,
    M: 189.266,
    i: 1.075,
    node: 169.138,
    periodDays: 0.318910074,
    apsisYears: 1.132,
    nodeYears: -2.262,
    plane: [317.7, 52.9],
  },
  {
    id: "deimos",
    host: "mars",
    radiusKm: 6.2,
    aKm: 23_457,
    e: 0.0002,
    omega: 197.011,
    M: 6.643,
    i: 1.78,
    node: 55.966,
    periodDays: 1.262440819,
    apsisYears: 27.157,
    nodeYears: -53.855,
    plane: [316.6, 53.5],
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
    id: "mimas",
    host: "saturn",
    radiusKm: 198.2,
    aKm: 186_000,
    e: 0.0197,
    omega: 332.778,
    M: 14.194,
    i: 1.568,
    node: 172.905,
    periodDays: 0.942421799,
    apsisYears: 0.49273,
    nodeYears: -0.98615,
    plane: SATURN_LAPLACE,
    /** Locked with Tethys in a 4:2 resonance: the pair trade longitude over 70.56 years. */
    libration: [
      [43.597, 70.56, 140.24],
      [0.717, 23.556, 66.82],
    ],
  },
  {
    id: "enceladus",
    host: "saturn",
    radiusKm: 252.1,
    aKm: 238_400,
    e: 0.005,
    omega: 346.873,
    M: 10.537,
    i: 0.037,
    node: 184.844,
    periodDays: 1.37021809,
    apsisYears: 2.9167,
    nodeYears: 0,
    plane: SATURN_LAPLACE,
    /** The 2:1 resonance with Dione: swings of 3.9 and 11 years. */
    libration: [
      [0.188, 3.886, 317.37],
      [0.261, 11.043, 73.58],
    ],
  },
  {
    id: "tethys",
    host: "saturn",
    radiusKm: 531.1,
    aKm: 295_000,
    e: 0.001,
    omega: 279.237,
    M: 9.009,
    i: 1.093,
    node: 259.884,
    periodDays: 1.88780217,
    apsisYears: 0.005,
    nodeYears: -4.9815,
    plane: SATURN_LAPLACE,
    /** Mimas's partner, swinging the opposite way. */
    libration: [[1.99, 70.56, 325.46]],
  },
  {
    id: "dione",
    host: "saturn",
    radiusKm: 561.4,
    aKm: 377_700,
    e: 0.002,
    omega: 25.043,
    M: 322.796,
    i: 0.043,
    node: 189.061,
    periodDays: 2.73691556,
    apsisYears: 11.689,
    nodeYears: 0,
    plane: SATURN_LAPLACE,
  },
  {
    id: "rhea",
    host: "saturn",
    radiusKm: 763.5,
    aKm: 527_200,
    e: 0.001,
    omega: 221.831,
    M: 198.777,
    i: 0.338,
    node: 351.559,
    periodDays: 4.51750274,
    apsisYears: 36.051,
    nodeYears: -35.775,
    plane: SATURN_LAPLACE,
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
    id: "iapetus",
    host: "saturn",
    radiusKm: 734.3,
    aKm: 3_561_700,
    e: 0.028,
    omega: 276.705,
    M: 208.748,
    i: 7.574,
    node: 74.757,
    periodDays: 79.3308997,
    apsisYears: 1670.8,
    nodeYears: -3130.3,
    plane: [288.7, 78.9],
  },
  {
    id: "miranda",
    host: "uranus",
    radiusKm: 235.8,
    aKm: 129_846,
    e: 0.001,
    omega: 156.618,
    M: 71.221,
    i: 4.427,
    node: 100.855,
    periodDays: 1.41347939,
    apsisYears: 8.96,
    nodeYears: -17.787,
    plane: URANUS_EQUATOR,
    /** A 12.5-year swing and its harmonic, measured in the Horizons vectors. */
    libration: [
      [1.434, 12.545, 318.04],
      [0.175, 6.277, 276],
    ],
  },
  {
    id: "ariel",
    host: "uranus",
    radiusKm: 578.9,
    aKm: 190_929,
    e: 0.001,
    omega: 304.204,
    M: 169.032,
    i: 0.009,
    node: 89.885,
    periodDays: 2.52037922,
    apsisYears: 46.302,
    nodeYears: 0,
    plane: URANUS_EQUATOR,
  },
  {
    id: "umbriel",
    host: "uranus",
    radiusKm: 584.7,
    aKm: 265_986,
    e: 0.004,
    omega: 166.676,
    M: 266.494,
    i: 0.066,
    node: 178.084,
    periodDays: 4.14417714,
    apsisYears: 60.942,
    nodeYears: -129.75,
    plane: URANUS_EQUATOR,
  },
  {
    id: "titania",
    host: "uranus",
    radiusKm: 788.9,
    aKm: 436_298,
    e: 0.002,
    omega: 232.355,
    M: 55.791,
    i: 0.066,
    node: 353.422,
    periodDays: 8.70586922,
    apsisYears: 227.07,
    nodeYears: -1644.6,
    plane: URANUS_EQUATOR,
  },
  {
    id: "oberon",
    host: "uranus",
    radiusKm: 761.4,
    aKm: 583_511,
    e: 0.002,
    omega: 116.335,
    M: 176.814,
    i: 0.193,
    node: 59.416,
    periodDays: 13.4632385,
    apsisYears: 143.51,
    nodeYears: -192.8,
    plane: URANUS_EQUATOR,
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

/** The moon's librations in mean longitude at d days from J2000, degrees. */
export function libration(moon: Moon, d: number) {
  let sum = 0;
  for (const [degrees, years, phase] of moon.libration ?? [])
    sum += degrees * Math.sin((phase + perDay(years) * d) * RAD);
  return sum;
}

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

/** Mean longitude Ω ± (ω + M) in the moon's reference plane, with its librations, degrees. */
export function meanLongitude(id: MoonId, date: Date) {
  const moon = moonById(id);
  const rates = meanRates(moon);
  const d = julianDay(date) - J2000_JD;
  const sense = moon.i > 90 ? -1 : 1;
  const along = moon.omega + moon.M + (rates.omega + rates.M) * d + libration(moon, d);
  return wrap(moon.node + rates.node * d + sense * along, 360);
}
