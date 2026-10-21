/**
 * The major moons' orbits in the scene frame, from the toolkit's mean elements
 * (`@horizon/toolkit/bodies`): planet-centred positions and orbit samples, in plain arrays so
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
  type Moon,
  type MoonId,
  type Vec3,
} from "@horizon/toolkit/bodies";
import { wrap } from "@horizon/toolkit/math";
import { AU_KM, J2000_JD, julianDay, RAD_PER_DEG as RAD } from "@horizon/toolkit/science";

/** The reference plane's axes in the scene frame: node, 90° on, pole. */
type Frame = { x: Vec3; y: Vec3; z: Vec3 };
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function frameOf(moon: Moon): Frame {
  if (moon.plane === "ecliptic") return { x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0] };
  const [ra, dec] = moon.plane;
  const z = equatorialToScene(ra, dec);
  const x = equatorialToScene(ra + 90, 0);
  return { x, y: cross(z, x), z };
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

/** Sample the orbit by true anomaly into a flat XYZ buffer (au, planet-centred). */
export function writeMoonOrbit(out: Float32Array, id: MoonId, date: Date) {
  const track = TRACKS.get(id)!;
  axesAt(track, daysOf(date));
  const { aKm, e } = track.moon;
  const p = (aKm / AU_KM) * (1 - e * e);
  const segments = out.length / 3 - 1;
  for (let s = 0; s <= segments; s += 1) {
    const nu = (s / segments) * Math.PI * 2;
    const r = p / (1 + e * Math.cos(nu));
    const x = r * Math.cos(nu);
    const y = r * Math.sin(nu);
    out[s * 3] = P_AXIS[0] * x + Q_AXIS[0] * y;
    out[s * 3 + 1] = P_AXIS[1] * x + Q_AXIS[1] * y;
    out[s * 3 + 2] = P_AXIS[2] * x + Q_AXIS[2] * y;
  }
}
