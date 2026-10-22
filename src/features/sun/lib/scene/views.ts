/**
 * The seven framings, each the pose that frames it (solar radii, radians). Four orbit the
 * Sun's centre: the whole disc, the cut open, the corona with the disc occulted, the pole
 * tipped for the cycle. Three orbit a feature (`viewAim`): a spot group from just above it,
 * a prominence at the limb, an active region seen obliquely; there the pose's distance is from
 * the feature, its inclination the elevation over the feature's horizon and its azimuth the
 * bearing round it, zero standing east. The views that look at a feature take their angles
 * from the frame; the rest keep the visitor's.
 */
import { Matrix4, Quaternion, Vector3 } from "three";

import {
  freeFromOrbit,
  orbitFromFree,
  type AimedPose,
  type FreeLook,
  type FreePose,
  type OrbitPose,
} from "@horizon/toolkit/camera";
import type { Vec3 } from "@horizon/toolkit/math";

import { directionOf, type SunFrame } from "./frame";
import { eruptionEnvelope, framedDistance, type SunViewport } from "./framing";
import type { SunViewId } from "./settings";

/** The distance each view frames at: from the centre, or from the feature it orbits. */
export const VIEW_DISTANCE: Readonly<Record<SunViewId, number>> = {
  surface: 3,
  inside: 3,
  sunspot: 0.08,
  chromosphere: 0.35,
  corona: 6,
  eruption: 0.9,
  cycle: 3,
};

/** The views that orbit a feature rather than the centre. */
const ORBITS_FEATURE: Readonly<Record<SunViewId, boolean>> = {
  surface: false,
  inside: false,
  sunspot: true,
  chromosphere: true,
  corona: false,
  eruption: true,
  cycle: false,
};
export const viewOrbitsFeature = (id: SunViewId) => ORBITS_FEATURE[id];

/** Elevation over the feature's horizon each feature view opens at, radians. */
const SUNSPOT_ELEVATION = 1.35;
const LIMB_ELEVATION = 0.06;
const ERUPTION_ELEVATION = 0.35;

/**
 * The rig's azimuth that puts a body longitude under the camera, about the centre: the rig
 * stands at (sin az, ·, cos az), a body longitude lies at the world angle −lon, and the body
 * has turned prograde by `surfaceTurn`, carrying it on by as much.
 */
export const azimuthOf = (lon: number, frame: SunFrame) => Math.PI / 2 + lon + frame.surfaceTurn;

/** A body-frame direction in the world: the body turned prograde by `surfaceTurn`. */
const worldDirection = (lat: number, lon: number, frame: SunFrame) =>
  directionOf(lat, lon + frame.surfaceTurn);

/** What a feature view orbits: the point, and the surface normal under it (its orbit's up). */
export type ViewAim = { point: Vec3; normal: Vec3 };

const scaled = (d: Vec3, r: number): Vec3 => [d[0] * r, d[1] * r, d[2] * r];

/** A point on the surface as something to orbit: the point and its normal, in the world this frame. */
export function surfaceAim(lat: number, lon: number, frame: SunFrame): ViewAim {
  const normal = worldDirection(lat, lon, frame);
  return { point: normal, normal };
}

/** Where a feature view orbits this frame; null for the views about the centre or with nothing to show. */
export function viewAim(id: SunViewId, frame: SunFrame): ViewAim | null {
  if (id === "chromosphere") {
    const prominence = featuredProminence(frame);
    if (!prominence) return null;
    const normal = worldDirection(prominence.lat, prominence.lon, frame);
    /* The prominence's middle, so it stands against the sky with the limb beneath. */
    return { point: scaled(normal, 1 + prominence.height * (1 + prominence.lift) * 0.5), normal };
  }
  if (id === "eruption" || id === "sunspot") {
    const region = featuredRegion(frame);
    if (!region) return null;
    const normal = worldDirection(region.lat, region.lon, frame);
    return {
      point: scaled(normal, id === "eruption" ? eruptionEnvelope(frame).centre : 1),
      normal,
    };
  }
  return null;
}

const up = new Vector3();
const east = new Vector3();
const south = new Vector3();
const basis = new Matrix4();

/**
 * The orbit's frame about a feature: its up the surface normal there, its azimuth zero
 * standing east (the horizontal tangent away from the direction of rotation).
 */
export function featureOrbitFrame(normal: Vec3, out = new Quaternion()) {
  up.set(normal[0], normal[1], normal[2]);
  east.set(-up.z, 0, up.x);
  if (east.lengthSq() < 1e-8) east.set(0, 0, 1);
  east.normalize();
  south.crossVectors(up, east);
  return out.setFromRotationMatrix(basis.makeBasis(south, up, east));
}

const frameTurn = new Quaternion();
const turned = new Quaternion();
const placed = new Vector3();

/**
 * A free pose written in an orbit's frame (centred on `origin`, turned by `orbit`) as the
 * world sees it.
 */
export function freeInWorld(pose: FreePose, origin: Vec3, orbit: Quaternion): FreePose {
  placed.fromArray(pose.position).applyQuaternion(orbit);
  turned.copy(orbit).multiply(frameTurn.fromArray(pose.orientation));
  return {
    position: [placed.x + origin[0], placed.y + origin[1], placed.z + origin[2]],
    orientation: [turned.x, turned.y, turned.z, turned.w],
  };
}

/** What a drift shot adds to its view's framing: nudges to the pose, where it looks and its tilt. */
export type ShotFraming = {
  pose?: Partial<OrbitPose> | undefined;
  look?: FreeLook | undefined;
  roll?: number | undefined;
};

/**
 * A view's framing for the drift, as a pose about the Sun's centre with the look that frames
 * it: the drift flies about the centre throughout, so its flights never change orbit. A view
 * about the centre keeps its pose and the shot's look; a view about a feature is placed as the
 * view places it (with the shot's nudges, look and tilt in the feature's frame), then written
 * about the centre, its look turned onto the feature.
 */
export function driftPose(
  id: SunViewId,
  frame: SunFrame,
  angles: Pick<OrbitPose, "azimuth" | "inclination">,
  shot: ShotFraming = {},
): Required<Omit<AimedPose, "ride">> {
  const framed = { ...viewPose(id, frame, angles), ...shot.pose };
  const look = shot.look ?? { yaw: 0, pitch: 0 };
  const roll = shot.roll ?? 0;
  const aim = viewAim(id, frame);
  if (!aim) return { ...framed, look, roll };
  const local = freeFromOrbit({ ...framed, look, roll });
  return orbitFromFree(freeInWorld(local, aim.point, featureOrbitFrame(aim.normal)));
}

/** The views that turn the camera to their own angles on a flight. */
const TURNS: Readonly<Record<SunViewId, boolean>> = {
  surface: false,
  inside: false,
  sunspot: true,
  chromosphere: true,
  corona: false,
  eruption: true,
  cycle: true,
};

export const viewTurns = (id: SunViewId) => TURNS[id];

/** The prominence the limb view shows: the tallest that is visible. */
export function featuredProminence(frame: SunFrame) {
  return frame.prominences.reduce<SunFrame["prominences"][number] | undefined>(
    (best, p) => (p.fade > 0 && (!best || p.fade * p.height > best.fade * best.height) ? p : best),
    undefined,
  );
}

/** The region a view looks at: the eruption's, else the strongest. */
export function featuredRegion(frame: SunFrame) {
  const erupting = frame.eruption
    ? frame.regions.find((region) => region.id === frame.eruption!.regionId)
    : undefined;
  if (erupting) return erupting;
  return frame.regions.reduce<SunFrame["regions"][number] | undefined>(
    (best, region) =>
      !best || region.strength * region.size > best.strength * best.size ? region : best,
    undefined,
  );
}

/** The pose that frames a view, given the frame's features and the camera's present angles. */
export function viewPose(
  id: SunViewId,
  frame: SunFrame,
  angles: Pick<OrbitPose, "azimuth" | "inclination">,
  viewport?: SunViewport,
): OrbitPose {
  const radius = viewSubjectRadius(id, frame);
  const distance = viewport
    ? Math.max(VIEW_DISTANCE[id], framedDistance(radius, viewport))
    : VIEW_DISTANCE[id];
  switch (id) {
    case "sunspot":
      /* Straight over the group, from where the visitor stands round it. */
      return { distance, azimuth: angles.azimuth, inclination: SUNSPOT_ELEVATION };
    case "eruption": {
      /* Along the neutral line, slightly oblique: the reconnection plane stays
       * open to view while neighbouring arcade slices still show their depth. */
      const region = featuredRegion(frame);
      const azimuth = Math.PI / 2 - (region ? Math.sign(region.lat || 1) * region.tilt : 0) + 0.15;
      return { distance, azimuth, inclination: ERUPTION_ELEVATION };
    }
    case "chromosphere": {
      /* Across the sheet, so its arch and fine threads read against the sky. */
      const p = featuredProminence(frame);
      const azimuth = Math.PI / 2 - (p ? Math.sign(p.lat || 1) * p.tilt : 0);
      return { distance, azimuth, inclination: LIMB_ELEVATION };
    }
    case "cycle":
      return { distance, azimuth: angles.azimuth, inclination: 0.5 };
    default:
      return { distance, azimuth: angles.azimuth, inclination: angles.inclination };
  }
}

/** What the preset promises to show; a visitor may zoom closer after it arrives. */
export function viewSubjectRadius(id: SunViewId, frame: SunFrame): number {
  if (id === "eruption") return eruptionEnvelope(frame).radius;
  if (id === "sunspot") return (featuredRegion(frame)?.size ?? 0.04) * 0.8;
  if (id === "chromosphere") {
    const p = featuredProminence(frame);
    return p ? Math.hypot(p.length * 0.52, p.height * (1 + p.lift) * 0.55) : 0.1;
  }
  return id === "corona" ? 1.7 : 1.05;
}

/**
 * How far from the centre a view's framing stands, radii: the pose's distance about the
 * centre, or, about a feature, the camera's reach from the feature's radius at its elevation.
 */
export function viewReach(id: SunViewId, frame: SunFrame) {
  const aim = viewAim(id, frame);
  if (!aim) return VIEW_DISTANCE[id];
  const { distance, inclination } = viewPose(id, frame, { azimuth: 0, inclination: 0 });
  const radius = Math.hypot(aim.point[0], aim.point[1], aim.point[2]);
  return Math.hypot(radius + distance * Math.sin(inclination), distance * Math.cos(inclination));
}
