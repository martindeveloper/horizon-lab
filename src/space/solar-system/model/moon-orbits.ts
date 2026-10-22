/**
 * The major moons' orbits in the scene frame, from the toolkit's mean elements
 * (`@horizon/toolkit/bodies`): planet-centred positions and orbit shapes, in plain arrays so
 * cards and positions need no renderer. graphics/moons.ts draws and spins them in three.js.
 * The Moon alone is placed by the lunar theory (`lunarPositionJ2000`): its mean elements
 * wander by degrees, and it is the one moon seen from close enough to tell.
 */
import {
  MOONS,
  eccentricAnomaly,
  equatorialToScene,
  libration,
  lunarPositionJ2000,
  meanRates,
  orbitShapeOf,
  type Moon,
  type MoonId,
  type OrbitShape,
  type Vec3,
} from "@horizon/toolkit/bodies";
import { cross3, wrap } from "@horizon/toolkit/math";
import { AU_KM, J2000_JD, julianDay, RAD_PER_DEG as RAD } from "@horizon/toolkit/science";

/** The reference plane's axes in the scene frame: node, 90° on, pole. */
type Frame = { x: Vec3; y: Vec3; z: Vec3 };
function frameOf(moon: Moon): Frame {
  if (moon.plane === "ecliptic") return { x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0] };
  const [ra, dec] = moon.plane;
  const z = equatorialToScene(ra, dec);
  const x = equatorialToScene(ra + 90, 0);
  return { x, y: cross3(z, x), z };
}

type Track = { moon: Moon; frame: Frame; rates: ReturnType<typeof meanRates> };
const TRACKS = new Map<MoonId, Track>(
  MOONS.map((moon) => [moon.id, { moon, frame: frameOf(moon), rates: meanRates(moon) }]),
);

/** A moon's reference plane: its pole (`z`) is the Cassini-state spin's reference. */
export const moonFrame = (id: MoonId): Readonly<Frame> => TRACKS.get(id)!.frame;

/** Perifocal axes: P̂ toward periapsis and Q̂ 90° on, scene frame; overwritten by each call. */
export const P_AXIS: Vec3 = [0, 0, 0];
export const Q_AXIS: Vec3 = [0, 0, 0];

/**
 * Sets `P_AXIS` and `Q_AXIS` for d days from J2000 and returns the mean anomaly with its
 * librations, radians.
 */
function axesAt(track: Track, d: number) {
  const { moon, frame, rates } = track;
  const w = (moon.omega + rates.omega * d) * RAD;
  const n = (moon.node + rates.node * d) * RAD;
  const i = moon.i * RAD;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cn = Math.cos(n);
  const sn = Math.sin(n);
  const ci = Math.cos(i);
  const si = Math.sin(i);
  const px = cw * cn - sw * sn * ci;
  const py = cw * sn + sw * cn * ci;
  const pz = sw * si;
  const qx = -sw * cn - cw * sn * ci;
  const qy = -sw * sn + cw * cn * ci;
  const qz = cw * si;
  for (let k = 0; k < 3; k += 1) {
    P_AXIS[k] = frame.x[k]! * px + frame.y[k]! * py + frame.z[k]! * pz;
    Q_AXIS[k] = frame.x[k]! * qx + frame.y[k]! * qy + frame.z[k]! * qz;
  }
  return wrap(moon.M + rates.M * d + libration(moon, d), 360) * RAD;
}

const daysOf = (date: Date) => julianDay(date) - J2000_JD;

const lunar: Vec3 = [0, 0, 0];

/**
 * The moon's offset from its planet in the scene frame, au; leaves `P_AXIS` and `Q_AXIS` at
 * that date. `mean` puts it at its mean anomaly on a circle: the direction a synchronous
 * rotator faces. The Moon's true place comes from the lunar theory; its axes still serve the
 * orbit line and the face it turns to Earth.
 */
export function moonOffset(id: MoonId, date: Date, out: Vec3 = [0, 0, 0], mean = false): Vec3 {
  const track = TRACKS.get(id)!;
  const M = axesAt(track, daysOf(date));
  if (id === "moon" && !mean) {
    /* J2000 ecliptic km to the scene frame (x the equinox, y the pole, z away from 90°), au. */
    lunarPositionJ2000(date, lunar);
    out[0] = lunar[0] / AU_KM;
    out[1] = lunar[2] / AU_KM;
    out[2] = -lunar[1] / AU_KM;
    return out;
  }
  const { aKm, e } = track.moon;
  const a = aKm / AU_KM;
  let x: number;
  let y: number;
  if (mean) {
    x = a * Math.cos(M);
    y = a * Math.sin(M);
  } else {
    const E = eccentricAnomaly(M, e);
    x = a * (Math.cos(E) - e);
    y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  }
  for (let k = 0; k < 3; k += 1) out[k] = P_AXIS[k]! * x + Q_AXIS[k]! * y;
  return out;
}

/**
 * The moon's orbit at a date, au, about its planet, with the moon on it as `moonOffset` puts it
 * (the Moon by its mean elements): the plane precesses, the size and shape hold.
 */
export function moonOrbitShape(id: MoonId, date: Date, out = orbitShapeOf()): OrbitShape {
  const track = TRACKS.get(id)!;
  const M = axesAt(track, daysOf(date));
  out.a = track.moon.aKm / AU_KM;
  out.e = track.moon.e;
  out.E = eccentricAnomaly(M, out.e);
  for (let k = 0; k < 3; k += 1) {
    out.p[k] = P_AXIS[k]!;
    out.q[k] = Q_AXIS[k]!;
  }
  return out;
}
