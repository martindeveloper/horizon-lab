/**
 * The seven framings, each the pose that frames it (solar radii, radians): the whole disc, the
 * cut open, a spot group from just above it, the limb, the corona with the disc occulted, an
 * active region obliquely and the pole tipped for the cycle. The views that look at a feature
 * take their angles from the frame; the rest keep the visitor's.
 */
import type { OrbitPose } from "@horizon/toolkit/camera";
import type { Vec3 } from "@horizon/toolkit/math";

import { directionOf, type SunFrame } from "./frame";
import type { SunViewId } from "./settings";

/** The distance each view frames at. */
export const VIEW_DISTANCE: Readonly<Record<SunViewId, number>> = {
  surface: 3,
  inside: 3,
  sunspot: 1.08,
  chromosphere: 1.5,
  corona: 6,
  eruption: 2.4,
  cycle: 3,
};

/** The eruption view looks at this height over its region, radii from the centre. */
const ERUPTION_LOOK_R = 1.4;
/** The eruption view keeps its region this far inside the limb, radians, and the camera this far below its latitude. */
const ERUPTION_INSIDE_LIMB = 0.12;
const ERUPTION_BELOW = 0.15;

/**
 * The rig's azimuth that puts a body longitude under the camera: the rig stands at
 * (sin az, ·, cos az), and the body has turned by `surfaceTurn` (a world azimuth is a body
 * longitude less the turn).
 */
export const azimuthOf = (lon: number, frame: SunFrame) => Math.PI / 2 - (lon - frame.surfaceTurn);

/** A body-frame direction in the world: the body turned by `surfaceTurn`. */
const worldDirection = (lat: number, lon: number, frame: SunFrame) =>
  directionOf(lat, lon - frame.surfaceTurn);

/**
 * Where a view looks, when not at the centre: the limb view at its prominence's foot, the
 * eruption view at its region, a little above the surface. The orbit still turns about the
 * centre; the camera is turned onto the point after its pose is set.
 */
export function viewLookAt(id: SunViewId, frame: SunFrame): Vec3 | null {
  if (id === "chromosphere") {
    const prominence = featuredProminence(frame);
    if (!prominence) return null;
    const top = 1 + prominence.height * (1 + prominence.lift) * 0.5;
    const d = worldDirection(prominence.lat, prominence.lon, frame);
    return [d[0] * top, d[1] * top, d[2] * top];
  }
  if (id === "eruption") {
    /* Above the region, so it sits low in the frame with the arcade standing into the sky. */
    const region = featuredRegion(frame);
    if (!region) return null;
    const d = worldDirection(region.lat, region.lon, frame);
    return [d[0] * ERUPTION_LOOK_R, d[1] * ERUPTION_LOOK_R, d[2] * ERUPTION_LOOK_R];
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
  const region = featuredRegion(frame);
  switch (id) {
    case "sunspot":
      return {
        distance,
        azimuth: region ? azimuthOf(region.lon, frame) : angles.azimuth,
        inclination: region?.lat ?? 0,
      };
    case "eruption":
      /* The region just inside the limb to the camera's side and a little below the camera,
         so the arcade stands up against dark sky with the limb to one side. */
      return {
        distance,
        azimuth:
          (region ? azimuthOf(region.lon, frame) : angles.azimuth) +
          Math.acos(1 / distance) -
          ERUPTION_INSIDE_LIMB,
        inclination: (region?.lat ?? 0) - ERUPTION_BELOW,
      };
    case "chromosphere": {
      /* The prominence on the left limb, the camera at its latitude: the limb seen from this
         distance stands acos(1/d) from the camera's axis, which along a parallel at latitude φ
         is a longitude step of acos((1/d − sin²φ) / cos²φ). */
      const prominence = featuredProminence(frame);
      if (!prominence) return { distance, azimuth: angles.azimuth, inclination: 0 };
      const sin2 = Math.sin(prominence.lat) ** 2;
      const step = Math.acos(Math.max(-1, Math.min(1, (1 / distance - sin2) / (1 - sin2))));
      return {
        distance,
        azimuth: azimuthOf(prominence.lon, frame) + step,
        inclination: prominence.lat,
      };
    }
    case "cycle":
      return { distance, azimuth: angles.azimuth, inclination: 0.5 };
    default:
      return { distance, azimuth: angles.azimuth, inclination: angles.inclination };
  }
}
