/**
 * The great observatories near Earth: Hubble in low orbit, Chandra on its long ellipse a third
 * of the way to the Moon, and Webb circling the Sun–Earth L2 point four times as far out. Hubble
 * and Chandra move on their latest element sets (observatory-orbits.json, from
 * scripts/fetch-observatory-orbits.mjs): Kepler's ellipse about Earth, its plane and perigee
 * turned by Earth's equatorial bulge (J2). Webb flies its JPL Horizons trajectory, kept in the
 * frame that turns with Earth round the Sun, where its halo holds still, and turned back with
 * whichever Earth the host draws. All positions are geocentric, in the scene frame, au.
 */
import type { Value } from "@/lib/facts";
import type { SpacecraftId } from "@/space/spacecraft/models";
import {
  EARTH_EQUATORIAL_RADIUS_KM,
  GM_KM3_S2,
  equatorialFrameToScene,
  keplerPosition,
  orbitShape,
  type Elements,
  type OrbitShape,
  type Vec3,
} from "@horizon/toolkit/bodies";
import { includesId } from "@horizon/toolkit/records";
import { AU_KM, RAD_PER_DEG as RAD, defineEquation } from "@horizon/toolkit/science";

import type { SolarMoment } from "./moment";
import ORBITS from "./observatory-orbits.json";
import { positionOf } from "./position";

export type ObservatoryId = "hubble" | "chandra" | "webb";

/** What a tap on an observatory opens. */
export type ObservatorySelection = { kind: "observatory"; id: ObservatoryId };

export const isObservatorySelection = (sel: { kind: string } | null): sel is ObservatorySelection =>
  sel?.kind === "observatory";

type Observatory = {
  id: ObservatoryId;
  /** Its model (`SPACECRAFT`). */
  model: SpacecraftId;
  /** Launch, UTC date. */
  launched: string;
};

/** Nearest Earth first. */
export const OBSERVATORIES: readonly Observatory[] = [
  { id: "hubble", model: "hubble", launched: "1990-04-24" },
  { id: "chandra", model: "chandra", launched: "1999-07-23" },
  { id: "webb", model: "webb", launched: "2021-12-25" },
];

export const OBSERVATORY_IDS = OBSERVATORIES.map((o) => o.id);

/** A tapped object's `userData.pick`, if it is an observatory. */
export function observatoryPick(pick: unknown): ObservatorySelection | null {
  if (typeof pick !== "object" || pick === null || !("kind" in pick) || !("id" in pick))
    return null;
  const { kind, id } = pick;
  return kind === "observatory" && typeof id === "string" && includesId(OBSERVATORY_IDS, id)
    ? { kind, id }
    : null;
}

export const observatoryById = (id: ObservatoryId) => OBSERVATORIES.find((o) => o.id === id)!;

/** Earth's second zonal harmonic: how much its equatorial bulge turns a near orbit. */
export const EARTH_J2: Value = {
  value: 1.0826359e-3,
  unit: "ratio",
  digits: 8,
  source: "iers2010",
  status: "flag",
  note: "dynamical form factor, zero-tide; turns Hubble's and Chandra's orbits",
};

/** Kepler's third law about any mass: the orbit's size from how fast a body goes round. */
export const meanMotionAxis = defineEquation({
  id: "mean-motion-axis",
  text: "a = (GM / n²)^(1/3)",
  latex: "a = \\left(\\frac{GM}{n^2}\\right)^{1/3}",
  output: "a",
  variables: {
    GM: { symbol: "GM", latex: "GM" },
    n: { symbol: "n", latex: "n" },
    a: { symbol: "a", latex: "a", unit: "km" },
  },
  compute: ({ GM, n }) => Math.cbrt(GM / (n * n)),
  source: "Kepler, Harmonices Mundi (1619); Newton, Principia (1687)",
});

/** The orbit's node sliding westward round the bulge (prograde orbits). */
export const nodalRegression = defineEquation({
  id: "j2-nodal-regression",
  text: "Ω̇ = −(3/2) n J₂ (R⊕ / p)² cos i,  p = a (1 − e²)",
  latex: "\\dot\\Omega = -\\tfrac{3}{2}\\, n J_2 \\left(\\frac{R_\\oplus}{p}\\right)^2 \\cos i",
  output: "rate",
  variables: {
    n: { symbol: "n", latex: "n" },
    J2: { symbol: "J₂", latex: "J_2" },
    k: { symbol: "R⊕ / p", latex: "R_\\oplus / p" },
    i: { symbol: "i", latex: "i", unit: "rad" },
    rate: { symbol: "Ω̇", latex: "\\dot\\Omega" },
  },
  compute: ({ n, J2, k, i }) => -1.5 * n * J2 * k * k * Math.cos(i),
  source: "Vallado, Fundamentals of Astrodynamics and Applications, secular J2 rates",
});

/** The perigee turning within the plane, forward below 63.4° of tilt and back above it. */
export const apsidalPrecession = defineEquation({
  id: "j2-apsidal-precession",
  text: "ω̇ = (3/4) n J₂ (R⊕ / p)² (5 cos² i − 1)",
  latex:
    "\\dot\\omega = \\tfrac{3}{4}\\, n J_2 \\left(\\frac{R_\\oplus}{p}\\right)^2 (5\\cos^2 i - 1)",
  output: "rate",
  variables: {
    n: { symbol: "n", latex: "n" },
    J2: { symbol: "J₂", latex: "J_2" },
    k: { symbol: "R⊕ / p", latex: "R_\\oplus / p" },
    i: { symbol: "i", latex: "i", unit: "rad" },
    rate: { symbol: "ω̇", latex: "\\dot\\omega" },
  },
  compute: ({ n, J2, k, i }) => 0.75 * n * J2 * k * k * (5 * Math.cos(i) ** 2 - 1),
  source: "Vallado, Fundamentals of Astrodynamics and Applications, secular J2 rates",
});

/**
 * The Sun–Earth L2 point in the restricted three-body problem: past Earth by `x` (as a share of
 * Earth's distance from the Sun), where the two pulls and the swing round the Sun balance. `μ` is
 * Earth's and the Moon's share of the three masses.
 */
export const secondLagrangePoint = defineEquation({
  id: "second-lagrange-point",
  text: "(1 − μ) / (1 + x)² + μ / x² = 1 + x − μ   (x ≈ (μ/3)^(1/3))",
  latex: "\\frac{1-\\mu}{(1+x)^2} + \\frac{\\mu}{x^2} = 1 + x - \\mu",
  output: "x",
  variables: {
    mu: { symbol: "μ", latex: "\\mu" },
    x: { symbol: "x", latex: "x" },
  },
  compute: ({ mu }) => {
    /* Positions from the barycentre, the larger mass at −μ, the smaller at 1 − μ. */
    const f = (x: number) => (1 - mu) / (1 + x) ** 2 + mu / (x * x) - (1 + x - mu);
    let x = Math.cbrt(mu / 3);
    for (let k = 0; k < 50; k++) {
      const h = x * 1e-7;
      const dx = f(x) / ((f(x + h) - f(x - h)) / (2 * h));
      x -= dx;
      if (Math.abs(dx) < 1e-15) break;
    }
    return x;
  },
  source: "Szebehely, Theory of Orbits (1967), the collinear points",
});

/** The observatories' formulas, for a lab's printed equation list. */
export const OBSERVATORY_EQUATIONS = [
  meanMotionAxis,
  nodalRegression,
  apsidalPrecession,
  secondLagrangePoint,
] as const;

/** Earth and the Moon's share of the Sun–Earth–Moon mass. */
const EARTH_MOON_SHARE =
  (GM_KM3_S2.earth + GM_KM3_S2.moon) / (GM_KM3_S2.sun + GM_KM3_S2.earth + GM_KM3_S2.moon);

/** How far beyond Earth the L2 point lies, km, at Earth's mean distance (one au). */
export const L2_KM = secondLagrangePoint.compute({ mu: EARTH_MOON_SHARE }) * AU_KM;

/** The observatories in orbit about Earth itself, on element sets. */
export type SatelliteId = Exclude<ObservatoryId, "webb">;

export const isSatellite = (id: ObservatoryId): id is SatelliteId => id !== "webb";
type ElementSet = (typeof ORBITS.satellites)[SatelliteId];

const DAY_S = 86_400;
const DAY_MS = DAY_S * 1e3;
const R_EARTH = EARTH_EQUATORIAL_RADIUS_KM;

/**
 * An element set's orbit, derived once: its mean motion (rad/s), size (km), and how fast the
 * bulge turns its node and perigee (rad/s).
 */
function satelliteOrbit(set: ElementSet) {
  const n = (set.revsPerDay * 2 * Math.PI) / DAY_S;
  const a = meanMotionAxis.compute({ GM: GM_KM3_S2.earth, n });
  const i = set.i * RAD;
  const rates = { n, J2: EARTH_J2.value, k: R_EARTH / (a * (1 - set.e ** 2)), i };
  return {
    set,
    epoch: new Date(set.epoch).getTime(),
    n,
    a,
    node: nodalRegression.compute(rates),
    perigee: apsidalPrecession.compute(rates),
  };
}

const SATELLITES = {
  hubble: satelliteOrbit(ORBITS.satellites.hubble),
  chandra: satelliteOrbit(ORBITS.satellites.chandra),
} satisfies Record<SatelliteId, ReturnType<typeof satelliteOrbit>>;

/** The element set's epoch: how old the orbit a card prints is. */
export const elementEpoch = (id: SatelliteId) => new Date(SATELLITES[id].epoch);

/**
 * A satellite's orbit at a date: its size (km), shape and period (s), and its nearest and
 * farthest heights above Earth's equator (km).
 */
export function satelliteFigures(id: SatelliteId) {
  const { a, n, set } = SATELLITES[id];
  return {
    a,
    e: set.e,
    /** Tilt to Earth's equator, degrees. */
    i: set.i,
    periodS: (2 * Math.PI) / n,
    perigeeKm: a * (1 - set.e) - R_EARTH,
    apogeeKm: a * (1 + set.e) - R_EARTH,
  };
}

const elements: Elements = { a: 0, e: 0, i: 0, omega: 0, node: 0, M: 0 };

/** The element set moved on to `date` in Earth's equatorial frame: a in au, angles in degrees. */
function elementsAt(id: SatelliteId, date: Date): Elements {
  const orbit = SATELLITES[id];
  const { set } = orbit;
  const t = (date.getTime() - orbit.epoch) / 1e3;
  elements.a = orbit.a / AU_KM;
  elements.e = set.e;
  elements.i = set.i;
  elements.node = set.node + (orbit.node * t) / RAD;
  elements.omega = set.omega + (orbit.perigee * t) / RAD;
  elements.M = set.M + (orbit.n * t) / RAD;
  return elements;
}

/**
 * `keplerPosition` and `orbitShape` turn elements about a reference plane into the scene as
 * if that plane were the ecliptic, (x, y, z) to (x, z, −y): an equatorial orbit's vector comes
 * back to equatorial axes, and on into the scene.
 */
function planeToScene(v: Vec3) {
  return equatorialFrameToScene(v[0], -v[2], v[1], v);
}

/** Webb's track: rows of km in the frame turning with Earth, every `stepDays` from `start`. */
const WEBB = ORBITS.webb;
const WEBB_START = new Date(WEBB.start).getTime();
const WEBB_SAMPLES = WEBB.km.length / 3;
const turning: Vec3 = [0, 0, 0];

/** Where Webb is in the turning frame at a fractional sample, km; the track's ends hold. */
function webbTurning(f: number, out: Vec3) {
  const at = Math.min(Math.max(f, 0), WEBB_SAMPLES - 1);
  const i = Math.min(Math.floor(at), WEBB_SAMPLES - 2);
  const t = at - i;
  for (let k = 0; k < 3; k++)
    out[k] = WEBB.km[i * 3 + k]! + (WEBB.km[(i + 1) * 3 + k]! - WEBB.km[i * 3 + k]!) * t;
  return out;
}
const webbSample = (date: Date) => (date.getTime() - WEBB_START) / (WEBB.stepDays * DAY_MS);

/**
 * A turning-frame vector (km: away from the Sun, along Earth's motion, north) as a scene
 * offset, au, for an Earth at `earth` (scene frame, heliocentric).
 */
function turnWithEarth(v: Vec3, earth: Readonly<Vec3>, out: Vec3) {
  /* Earth's direction from the Sun in the ecliptic: scene x, and −z for ecliptic y. */
  const r = Math.hypot(earth[0], earth[2]) || 1;
  const ux = earth[0] / r;
  const uy = -earth[2] / r;
  const x = v[0] * ux - v[1] * uy;
  const y = v[0] * uy + v[1] * ux;
  out[0] = x / AU_KM;
  out[1] = v[2] / AU_KM;
  out[2] = -y / AU_KM;
  return out;
}

/**
 * Where an observatory is from Earth's centre at `date`, scene frame, au. `earth` is the Earth
 * the host draws (heliocentric): Webb keeps its place beyond it, away from the Sun, even when a
 * sped-up clock has moved that Earth on from today's.
 */
export function observatoryOffset(
  id: ObservatoryId,
  date: Date,
  earth: Readonly<Vec3>,
  out: Vec3 = [0, 0, 0],
): Vec3 {
  if (id === "webb") return turnWithEarth(webbTurning(webbSample(date), turning), earth, out);
  return planeToScene(keplerPosition(elementsAt(id, date), out));
}

const earthAt: Vec3 = [0, 0, 0];

/**
 * Where an observatory is in the scene (au, the Sun at the origin) at a moment: beyond the
 * Earth the scene draws then, as `observatoryOffset` places it.
 */
export function observatoryPosition(
  id: ObservatoryId,
  moment: Pick<SolarMoment, "mig" | "driftYears">,
  date: Date,
  out: Vec3 = [0, 0, 0],
): Vec3 {
  const earth = positionOf({ kind: "planet", id: "earth" }, moment, date, earthAt)!;
  observatoryOffset(id, date, earth, out);
  out[0] += earth[0];
  out[1] += earth[1];
  out[2] += earth[2];
  return out;
}

/** Hubble's or Chandra's ellipse at `date` (`OrbitShape`, au, about Earth's centre). */
export function satelliteShape(id: SatelliteId, date: Date, out: OrbitShape): OrbitShape {
  orbitShape(elementsAt(id, date), true, out);
  planeToScene(out.p);
  planeToScene(out.q);
  return out;
}

/** Days Webb takes round L2: the mean time between its crossings of the Sun–Earth line's plane. */
export const WEBB_HALO_DAYS = (() => {
  const crossings: number[] = [];
  for (let i = 1; i < WEBB_SAMPLES; i++) {
    const before = WEBB.km[(i - 1) * 3 + 1]!;
    const after = WEBB.km[i * 3 + 1]!;
    if (before < 0 && after >= 0) crossings.push(i - 1 + before / (before - after));
  }
  return ((crossings.at(-1)! - crossings[0]!) / (crossings.length - 1)) * WEBB.stepDays;
})();

/** Points on Webb's halo, one turn of it centred on `date`. */
export const WEBB_HALO_POINTS = Math.ceil(WEBB_HALO_DAYS / WEBB.stepDays) + 1;
const point: Vec3 = [0, 0, 0];

/**
 * Webb's halo about L2 as it looks from Earth turning round the Sun: one turn of its track
 * centred on `date`, geocentric scene offsets, au, into `out` (`WEBB_HALO_POINTS` xyz rows).
 */
export function webbHalo(date: Date, earth: Readonly<Vec3>, out: Float32Array) {
  const now = webbSample(date);
  const span = WEBB_HALO_DAYS / WEBB.stepDays;
  for (let j = 0; j < WEBB_HALO_POINTS; j++) {
    const f = now - span / 2 + (span * j) / (WEBB_HALO_POINTS - 1);
    out.set(turnWithEarth(webbTurning(f, turning), earth, point), j * 3);
  }
  return out;
}

/** How far Webb is from Earth's centre at `date`, km. */
export const webbFromEarthKm = (date: Date) => {
  const [x, y, z] = webbTurning(webbSample(date), turning);
  return Math.hypot(x, y, z);
};

/** The date Webb's track runs to: past it the scene holds its last place. */
export const WEBB_TRACK_END = new Date(WEBB_START + (WEBB_SAMPLES - 1) * WEBB.stepDays * DAY_MS);
