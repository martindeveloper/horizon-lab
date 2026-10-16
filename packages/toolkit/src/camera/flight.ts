import { lerp, smootherstep } from "../math/index";
export type OrbitPose = { azimuth: number; inclination: number; distance: number };
/**
 * yaw is a signed angular displacement, not an absolute heading. Angles are radians.
 * The optional shaping terms default to 0 and vanish at both ends of the flight.
 */
export type OrbitFlight = {
  yaw: number;
  inclination: number;
  distance: number;
  /** Inclination added at mid-flight: a crane arc over (+) or under (−) the straight path. */
  lift?: number;
  /** Fractional distance change at mid-flight: + pulls back, − dives in. */
  swing?: number;
  /** −1…1: the turn runs ahead of (+) or behind (−) the dolly, so the path curves. */
  lead?: number;
};

/** Monotonic time warp with fixed ends; positive l front-loads, negative back-loads. */
function warp(t: number, l: number) {
  const p = 1 + 1.6 * Math.abs(l);
  return l >= 0 ? 1 - (1 - t) ** p : t ** p;
}

export function sampleOrbitFlight(t: number, from: OrbitPose, target: OrbitFlight): OrbitPose {
  if (t <= 0) return { ...from };
  if (t >= 1)
    return {
      azimuth: from.azimuth + target.yaw,
      inclination: target.inclination,
      distance: target.distance,
    };
  const e = smootherstep(t);
  const turn = smootherstep(warp(t, Math.max(-1, Math.min(1, target.lead ?? 0))));
  const arc = Math.sin(Math.PI * e);
  // Geometric distance keeps the apparent zoom rate even on long push-ins.
  const span =
    from.distance > 0 && target.distance > 0
      ? from.distance * (target.distance / from.distance) ** e
      : lerp(from.distance, target.distance, e);
  return {
    azimuth: from.azimuth + target.yaw * turn,
    inclination: lerp(from.inclination, target.inclination, e) + (target.lift ?? 0) * arc,
    distance: span * (1 + (target.swing ?? 0) * arc),
  };
}
