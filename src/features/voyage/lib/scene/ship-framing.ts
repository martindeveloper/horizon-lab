import type { Vector3 } from "three";

import { FRAME_RADII } from "@/space/solar-system/model/framing";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { clamp, wrapSigned } from "@horizon/toolkit/math";
import { ORBIT_INCLINATION, vec3d, type Vec3d } from "@horizon/toolkit/scene";

import { GALACTIC_NORTH, anchorRadius, isBodyAnchor, type AnchorId } from "../model/anchors";
import { ALTITUDE_FLOOR, SUN_ALTITUDE_FLOOR } from "../model/parameters";
import type { ShipState } from "../model/ship";
import type { ShipEphemeris } from "./ship-environment";

/** Arrival: this far round from the Sun (three-quarter light), this far above the ecliptic. */
const ARRIVE_SWING = 0.9;
export const ARRIVE_INCLINATION = 0.3;
/** The framed body's apparent radius, as a fraction of half the view's shorter side. */
const ARRIVE_FILL = 0.55;
/** How far an arrival may swing from its line of approach towards the lit side, radians. */
const APPROACH_SWING = 1.1;

export const floorOf = (id: AnchorId) =>
  anchorRadius(id) * (id === "sun" ? SUN_ALTITUDE_FLOOR : ALTITUDE_FLOOR);

export const offsetOf = ({ azimuth, inclination, distance }: OrbitPose, out: Vector3) =>
  out.set(
    distance * Math.cos(inclination) * Math.sin(azimuth),
    distance * Math.sin(inclination),
    distance * Math.cos(inclination) * Math.cos(azimuth),
  );

/** Arrival and parking poses relative to the moving bodies and the current view. */
export function createShipFraming(
  options: ShipEphemeris & { halfTan: () => number },
  pose: OrbitPose,
  ship: ShipState,
) {
  const { bodyAt, halfTan } = options;
  const toPos = vec3d();
  const aimPos = vec3d();
  /**
   * The pose that frames a body on arrival, lit three-quarters from the Sun; the Galaxy is
   * framed from its north, so the disk lies below. Coming in along `from` (unit, from the
   * body towards the ship), it keeps near that line, swinging towards the framing by at most
   * a little over a radian, so the body stays ahead to the end.
   */
  const arrival = (id: AnchorId, from?: Readonly<Vec3d>): OrbitPose => {
    const framed = framing(id);
    if (!from) return framed;
    const azimuth = Math.atan2(from[0], from[2]);
    const inclination = clamp(
      Math.asin(clamp(from[1], -1, 1)),
      ORBIT_INCLINATION.min,
      ORBIT_INCLINATION.max,
    );
    return {
      azimuth:
        azimuth +
        clamp(wrapSigned(framed.azimuth - azimuth, Math.PI * 2), -APPROACH_SWING, APPROACH_SWING),
      inclination:
        inclination + clamp(framed.inclination - inclination, -APPROACH_SWING, APPROACH_SWING),
      distance: framed.distance,
    };
  };

  /** How far from a body's centre the ship parks on arrival, km: the body framed in the view. */
  const orbitOf = (id: AnchorId) => {
    const frameRadius = anchorRadius(id) * ((isBodyAnchor(id) && FRAME_RADII[id]) || 1);
    return Math.max(floorOf(id), frameRadius / (halfTan() * ARRIVE_FILL));
  };

  const framing = (id: AnchorId): OrbitPose => {
    bodyAt(id, options.now(), toPos);
    const sunward =
      Math.hypot(toPos[0], toPos[2]) > 0 ? Math.atan2(-toPos[0], -toPos[2]) : pose.azimuth;
    const distance = orbitOf(id);
    if (id === "galacticCentre")
      return {
        azimuth: Math.atan2(GALACTIC_NORTH.x, GALACTIC_NORTH.z),
        inclination: clamp(
          Math.asin(GALACTIC_NORTH.y),
          ORBIT_INCLINATION.min,
          ORBIT_INCLINATION.max,
        ),
        distance,
      };
    return {
      azimuth: id === "sun" ? pose.azimuth : sunward + ARRIVE_SWING,
      inclination: ARRIVE_INCLINATION,
      distance,
    };
  };

  /** The pose about `id` that puts the ship where it is now. */
  const poseAbout = (id: AnchorId): OrbitPose => {
    bodyAt(id, options.now(), aimPos);
    const dx = ship.x[0] - aimPos[0];
    const dy = ship.x[1] - aimPos[1];
    const dz = ship.x[2] - aimPos[2];
    const distance = Math.hypot(dx, dy, dz);
    return {
      azimuth: Math.atan2(dx, dz),
      inclination: clamp(
        Math.asin(dy / Math.max(distance, 1e-9)),
        ORBIT_INCLINATION.min,
        ORBIT_INCLINATION.max,
      ),
      distance,
    };
  };

  return { arrival, poseAbout, orbitOf };
}
