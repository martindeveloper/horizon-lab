/**
 * The major moons in three.js: planet-centred positions, orbit lines and
 * synchronous spin from the toolkit's mean elements (`@horizon/toolkit/bodies`).
 */
import { Matrix4, Quaternion, Vector3 } from "three";

import {
  MOONS,
  eccentricAnomaly,
  meanRates,
  type Moon,
  type MoonId,
} from "@horizon/toolkit/bodies";
import { wrap } from "@horizon/toolkit/math";
import { AU_KM, J2000_JD, julianDay, RAD_PER_DEG as RAD } from "@horizon/toolkit/science";

import { equatorialToScene } from "./coordinates";

/** The reference plane's axes in the scene frame: node, 90° on, pole. */
type Frame = { x: Vector3; y: Vector3; z: Vector3 };
function frameOf(moon: Moon): Frame {
  if (moon.plane === "ecliptic")
    return { x: new Vector3(1, 0, 0), y: new Vector3(0, 0, -1), z: new Vector3(0, 1, 0) };
  const [ra, dec] = moon.plane;
  const z = equatorialToScene(ra, dec);
  const x = equatorialToScene(ra + 90, 0);
  return { x, y: new Vector3().crossVectors(z, x), z };
}

type Track = { moon: Moon; frame: Frame; rates: ReturnType<typeof meanRates> };
const TRACKS = new Map<MoonId, Track>(
  MOONS.map((moon) => [moon.id, { moon, frame: frameOf(moon), rates: meanRates(moon) }]),
);

/** Perifocal axes P̂ (to periapsis) and Q̂ (90° on) in the scene frame at d days from J2000. */
const P_AXIS = new Vector3();
const Q_AXIS = new Vector3();
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
  P_AXIS.set(0, 0, 0)
    .addScaledVector(frame.x, cw * cn - sw * sn * ci)
    .addScaledVector(frame.y, cw * sn + sw * cn * ci)
    .addScaledVector(frame.z, sw * si);
  Q_AXIS.set(0, 0, 0)
    .addScaledVector(frame.x, -sw * cn - cw * sn * ci)
    .addScaledVector(frame.y, -sw * sn + cw * cn * ci)
    .addScaledVector(frame.z, cw * si);
  return wrap(moon.M + rates.M * d, 360) * RAD;
}

const daysOf = (date: Date) => julianDay(date) - J2000_JD;

/**
 * The moon's offset from its planet in the scene frame, au. `mean` puts it at
 * its mean anomaly on a circle: the direction a synchronous rotator faces.
 */
export function moonOffset(id: MoonId, date: Date, out = new Vector3(), mean = false) {
  const track = TRACKS.get(id)!;
  const M = axesAt(track, daysOf(date));
  const { aKm, e } = track.moon;
  const a = aKm / AU_KM;
  if (mean)
    return out
      .copy(P_AXIS)
      .multiplyScalar(a * Math.cos(M))
      .addScaledVector(Q_AXIS, a * Math.sin(M));
  const E = eccentricAnomaly(M, e);
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return out.copy(P_AXIS).multiplyScalar(x).addScaledVector(Q_AXIS, y);
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
    out[s * 3] = P_AXIS.x * x + Q_AXIS.x * y;
    out[s * 3 + 1] = P_AXIS.y * x + Q_AXIS.y * y;
    out[s * 3 + 2] = P_AXIS.z * x + Q_AXIS.z * y;
  }
}

const basis = new Matrix4();
const pole = new Vector3();
const outward = new Vector3();
const east = new Vector3();
const lean = new Vector3();

/**
 * Synchronous rotation: local +Y is the spin pole (the orbit normal, or the
 * Moon's Cassini-state axis) and longitude 0 (local −X, as in the toolkit's `bodyOrientation`)
 * faces the planet along the mean orbit, so the true orbit's eccentricity
 * shows as libration. Maps' north is the orbit's angular momentum, which is
 * Triton's IAU south: it orbits backwards.
 */
export function moonOrientation(id: MoonId, date: Date, out = new Quaternion()) {
  const track = TRACKS.get(id)!;
  moonOffset(id, date, outward, true);
  pole.crossVectors(P_AXIS, Q_AXIS);
  const tilt = track.moon.cassini;
  if (tilt) {
    const z = track.frame.z;
    lean.copy(pole).addScaledVector(z, -pole.dot(z)).normalize();
    pole
      .copy(z)
      .multiplyScalar(Math.cos(tilt * RAD))
      .addScaledVector(lean, -Math.sin(tilt * RAD));
  }
  outward.addScaledVector(pole, -outward.dot(pole)).normalize();
  east.crossVectors(outward, pole);
  basis.makeBasis(outward, pole, east);
  return out.setFromRotationMatrix(basis);
}
