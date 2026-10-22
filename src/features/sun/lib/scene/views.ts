/**
 * The seven framings, each the pose that frames it (solar radii, radians). Four orbit the
 * Sun's centre: the whole disc, the cut open, the corona with the disc occulted, the pole
 * tipped for the cycle. Three orbit a feature (`viewAim`): a spot group from just above it,
 * a prominence at the limb, an active region seen obliquely; there the pose's distance is from
 * the feature, its inclination the elevation over the feature's horizon and its azimuth the
 * bearing round it, zero standing east. The views that look at a feature take their angles
 * from the frame; the rest keep the visitor's.
 */
import type { OrbitPose } from "@horizon/toolkit/camera";
import type { Vec3 } from "@horizon/toolkit/math";

import { directionOf, type SunFrame } from "./frame";
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

/** The eruption view orbits this height over its region, radii from the centre: the arcade's middle. */
const ERUPTION_AIM_R = 1.12;
/** Elevation over the feature's horizon each feature view opens at, radians. */
const SUNSPOT_ELEVATION = 1.35;
const LIMB_ELEVATION = 0.2;
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
    return { point: scaled(normal, id === "eruption" ? ERUPTION_AIM_R : 1), normal };
  }
  return null;
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
): OrbitPose {
  const distance = VIEW_DISTANCE[id];
  switch (id) {
    case "sunspot":
      /* Straight over the group, from where the visitor stands round it. */
      return { distance, azimuth: angles.azimuth, inclination: SUNSPOT_ELEVATION };
    case "eruption":
      /* East of the region, low: the arcade's loops in profile, standing into dark sky. */
      return { distance, azimuth: 0, inclination: ERUPTION_ELEVATION };
    case "chromosphere":
      /* Beside the prominence at its own height, so it stands against the sky over the limb. */
      return { distance, azimuth: 0, inclination: LIMB_ELEVATION };
    case "cycle":
      return { distance, azimuth: angles.azimuth, inclination: 0.5 };
    default:
      return { distance, azimuth: angles.azimuth, inclination: angles.inclination };
  }
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
