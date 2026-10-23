/**
 * The views' framings (`VIEWS`), each the pose that frames it (solar radii, radians), what it
 * orbits and how far the camera zooms round it; the featured region and prominence the lab
 * looks at; and a view's framing for the drift, written about the Sun's centre.
 */
import { Matrix4, Quaternion, Vector3 } from "three";

import { PARKER_CORONA_EDGE_R, REGION_SIZE_MEDIAN_RAD } from "@/space/sun/model/parameters";
import { PARKER_SEMI_MAJOR_R } from "@/space/sun/model/parker";
import { keplerPosition, type Elements } from "@horizon/toolkit/bodies";
import {
  freeFromOrbit,
  orbitFromFree,
  type AimedPose,
  type FreeLook,
  type FreePose,
  type OrbitPose,
} from "@horizon/toolkit/camera";
import type { Vec3 } from "@horizon/toolkit/math";
import { SCENE_FOV } from "@horizon/toolkit/scene";
import { RAD_PER_DEG } from "@horizon/toolkit/science";

import type { PlaceId } from "../model/places";
import {
  FEATURE_MAX_R,
  FEATURE_MIN_R,
  GRANULES_PER_RADIUS,
  GRANULE_FIELD,
  ORBIT_REACH_R,
  REGION_REACH,
} from "../parameters";
import { directionOf, parkerOrbitOf, type SunFrame } from "./frame";
import { eruptionEnvelope, framedDistance, type SunViewport } from "./framing";
import type { SunViewId } from "./settings";

/** The angles a visit opens at about the centre, and the drift's shots are placed from: a little above the equator. */
export const OPENING_ANGLES: Pick<OrbitPose, "azimuth" | "inclination"> = {
  azimuth: 0,
  inclination: 0.1,
};

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

/** On a spotless Sun, quiet surface stands here (body frame, radians): just off the disc's centre at the map's epoch. */
export const SPOTLESS_QUIET = { lat: 0.12, lon: 0.2 } as const;

/**
 * Where the lab shows quiet surface (its granulation) in the frame: the nearest the featured
 * group leaves quiet, equatorward of it where its marks end (`REGION_REACH` of its radius: no
 * plage, pores or photographed patch); on a spotless Sun, `SPOTLESS_QUIET`.
 */
export function quietSurface(frame: SunFrame): { lat: number; lon: number } {
  const region = featuredRegion(frame);
  if (!region) return SPOTLESS_QUIET;
  return {
    lat: region.lat - Math.sign(region.lat || 1) * REGION_REACH * region.size,
    lon: region.lon,
  };
}

/** A prominence's middle, radii from the centre: half its height, risen by its lift. */
export const prominenceMiddleR = (p: SunFrame["prominences"][number]) =>
  1 + p.height * (1 + p.lift) * 0.5;

const orbitElements: Elements = { a: 0, e: 0, i: 0, omega: 0, node: 0, M: 0 };
const orbitPerihelion: Vec3 = [0, 0, 0];
const ORBIT_AIM: ViewAim = { point: [0, 0, 0], normal: [0, 1, 0] };

/** Parker's orbit at the frame's moment seen whole: its centre, the semi-major axis back from the focus along its perihelion, the pole up. */
function orbitAim(frame: SunFrame) {
  parkerOrbitOf(frame, orbitElements);
  orbitElements.M = 0;
  keplerPosition(orbitElements, orbitPerihelion);
  const back = -orbitElements.e / (1 - orbitElements.e);
  ORBIT_AIM.point[0] = orbitPerihelion[0] * back;
  ORBIT_AIM.point[1] = orbitPerihelion[1] * back;
  ORBIT_AIM.point[2] = orbitPerihelion[2] * back;
  return ORBIT_AIM;
}

/**
 * What the orbit view promises to show about its centre at the frame's moment, radii: the
 * ellipse, and the corona's edge round the Sun at its focus, which reaches past the perihelion.
 */
function orbitSubject(frame: SunFrame) {
  const { a, e } = parkerOrbitOf(frame, orbitElements);
  return Math.max(a, a * e + PARKER_CORONA_EDGE_R);
}

/** Across a sheet or a neutral line seen from the north: its tilt from west, mirrored south. */
const across = (lat: number, tilt: number) => Math.PI / 2 - Math.sign(lat || 1) * tilt;

/** The disc whole, and the inner corona out to here, radii. */
const DISC_SUBJECT_R = 1.05;
const CORONA_SUBJECT_R = 1.7;
/** A spot group's framed share of its size; a prominence's of its length and lifted height. */
const SPOT_SUBJECT = 0.8;
const PROMINENCE_SUBJECT = { along: 0.52, up: 0.55 } as const;
/** The eruption's view sits this far off its neutral line, radians, so neighbouring arcade slices show depth. */
const ERUPTION_OBLIQUE = 0.15;
/** How near and far the camera zooms about a feature. */
const FEATURE_LIMITS = { min: FEATURE_MIN_R, max: FEATURE_MAX_R } as const;

/** One view's framing. */
type ViewFraming = {
  /** The distance it frames at: from the centre, or from the feature it orbits, radii. */
  distance: number;
  /** What it orbits this frame (a feature, with its up; null with none to show); absent: the Sun's centre. */
  aim?: (frame: SunFrame) => ViewAim | null;
  /** Its angles from the frame's feature and the camera's present ones; the inclination over the feature's horizon. */
  angles: (
    frame: SunFrame,
    angles: Pick<OrbitPose, "azimuth" | "inclination">,
  ) => Pick<OrbitPose, "azimuth" | "inclination">;
  /** It turns the camera to its own angles on a flight. */
  turns: boolean;
  /** What it promises to show, radii; a visitor may zoom closer once it arrives. */
  subject: (frame: SunFrame) => number;
  /** How near and far the camera may zoom about its aim. */
  limits: { min: number; max: number };
  /** Its aim eases when it jumps: the eruption's ejecta move radii in one scrub. */
  easesAim: boolean;
  /**
   * The places it orbits instead of its feature while chosen, with what each promises to show:
   * places of the view that stand elsewhere on the Sun. The camera turns to one where it stands
   * (`camera-rig.ts`).
   */
  focus?: Partial<
    Record<PlaceId, Pick<ViewFraming, "subject"> & { aim: (frame: SunFrame) => ViewAim }>
  >;
};

const keep: ViewFraming["angles"] = (_frame, angles) => angles;
const centre = (distance: number, subject: number, turns = false): ViewFraming => ({
  distance,
  angles: keep,
  turns,
  subject: () => subject,
  limits: FEATURE_LIMITS,
  easesAim: false,
});

/**
 * The views' framings. Four orbit the Sun's centre: the whole disc, the cut open, the corona
 * with the disc occulted, the pole tipped for the cycle. Four orbit a feature: a spot group
 * from just above it, a prominence at the limb, an active region seen obliquely, and Parker
 * Solar Probe's orbit from above the pole; there the pose's distance is from the feature, its
 * inclination the elevation over the feature's horizon and its azimuth the bearing round it,
 * zero standing east.
 */
const VIEWS: Readonly<Record<SunViewId, ViewFraming>> = {
  surface: centre(3, DISC_SUBJECT_R),
  inside: centre(3, DISC_SUBJECT_R),
  corona: centre(6, CORONA_SUBJECT_R),
  /* The pole tipped toward the camera, so the belts' drift in latitude reads. */
  cycle: {
    ...centre(3, DISC_SUBJECT_R, true),
    angles: (_frame, { azimuth }) => ({ azimuth, inclination: 0.5 }),
  },
  /* Straight over the group, from where the visitor stands round it. */
  sunspot: {
    distance: 0.08,
    aim: (frame) => {
      const region = featuredRegion(frame);
      return region ? surfaceAim(region.lat, region.lon, frame) : null;
    },
    angles: (_frame, { azimuth }) => ({ azimuth, inclination: 1.35 }),
    turns: true,
    subject: (frame) => (featuredRegion(frame)?.size ?? REGION_SIZE_MEDIAN_RAD) * SPOT_SUBJECT,
    limits: FEATURE_LIMITS,
    easesAim: false,
    /* Granules on quiet surface, not in the group's plage, near enough to see each one. */
    focus: {
      granule: {
        aim: (frame) => {
          const { lat, lon } = quietSurface(frame);
          return surfaceAim(lat, lon, frame);
        },
        subject: () => GRANULE_FIELD / GRANULES_PER_RADIUS,
      },
    },
  },
  /* Across the sheet at its middle, so its arch and fine threads read against the sky with the limb beneath. */
  chromosphere: {
    distance: 0.35,
    aim: (frame) => {
      const p = featuredProminence(frame);
      if (!p) return null;
      const normal = worldDirection(p.lat, p.lon, frame);
      return { point: scaled(normal, prominenceMiddleR(p)), normal };
    },
    angles: (frame) => {
      const p = featuredProminence(frame);
      return { azimuth: across(p?.lat ?? 0, p?.tilt ?? 0), inclination: 0.06 };
    },
    turns: true,
    subject: (frame) => {
      const p = featuredProminence(frame);
      if (!p) return 0.1;
      return Math.hypot(
        p.length * PROMINENCE_SUBJECT.along,
        p.height * (1 + p.lift) * PROMINENCE_SUBJECT.up,
      );
    },
    limits: FEATURE_LIMITS,
    easesAim: false,
  },
  /* Along the neutral line, slightly oblique: the reconnection plane open to view. */
  eruption: {
    distance: 0.9,
    aim: (frame) => {
      const region = featuredRegion(frame);
      if (!region) return null;
      const normal = worldDirection(region.lat, region.lon, frame);
      return { point: scaled(normal, eruptionEnvelope(frame).centre), normal };
    },
    angles: (frame) => {
      const region = featuredRegion(frame);
      return {
        azimuth: across(region?.lat ?? 0, region?.tilt ?? 0) + ERUPTION_OBLIQUE,
        inclination: 0.35,
      };
    },
    turns: true,
    subject: (frame) => eruptionEnvelope(frame).radius,
    limits: { min: FEATURE_MIN_R, max: ORBIT_REACH_R },
    easesAim: true,
  },
  /* Nearly down the pole, tipped enough to read the plane: the long axis across the view, the
     plunge to the right; the whole ellipse in a square frame, its semi-major axis across the
     scene's view, zoomed from a third of the way in to well past that. */
  orbit: {
    distance: PARKER_SEMI_MAJOR_R / Math.sin((SCENE_FOV / 2) * RAD_PER_DEG),
    aim: orbitAim,
    angles: () => ({ azimuth: 0, inclination: 1.3 }),
    turns: true,
    subject: orbitSubject,
    limits: {
      min: PARKER_SEMI_MAJOR_R / 3,
      max: (2 * PARKER_SEMI_MAJOR_R) / Math.sin((SCENE_FOV / 2) * RAD_PER_DEG),
    },
    easesAim: false,
  },
};

/** The views that orbit a feature rather than the centre. */
export const viewOrbitsFeature = (id: SunViewId) => VIEWS[id].aim !== undefined;

/** The chosen place a view orbits instead of its feature (`ViewFraming.focus`); null for its feature. */
export const viewFocus = (id: SunViewId, place: PlaceId | null): PlaceId | null =>
  place && VIEWS[id].focus?.[place] ? place : null;

/**
 * Where a feature view orbits this frame: its focus on the chosen place (`viewFocus`), else its
 * feature; null for the views about the centre or with nothing to show.
 */
export const viewAim = (
  id: SunViewId,
  frame: SunFrame,
  focus: PlaceId | null = null,
): ViewAim | null =>
  (focus && VIEWS[id].focus?.[focus]?.aim(frame)) || (VIEWS[id].aim?.(frame) ?? null);

/** What a view promises to show, radii: its focus's, else its own. */
const subjectOf = (id: SunViewId, frame: SunFrame, focus: PlaceId | null) =>
  (focus && VIEWS[id].focus?.[focus]?.subject(frame)) || VIEWS[id].subject(frame);

/** The views that turn the camera to their own angles on a flight. */
export const viewTurns = (id: SunViewId) => VIEWS[id].turns;

/** Whether a view's aim eases when it jumps. */
export const viewEasesAim = (id: SunViewId) => VIEWS[id].easesAim;

/**
 * How near and far the camera may zoom about a view's aim, radii: out at least as far as its
 * own framing, which a narrow portrait screen sets beyond the view's usual reach.
 */
export function featureLimits(
  id: SunViewId,
  frame: SunFrame,
  viewport: SunViewport,
  focus: PlaceId | null = null,
) {
  const { min, max } = VIEWS[id].limits;
  return { min, max: Math.max(max, framedDistance(subjectOf(id, frame, focus), viewport)) };
}

/** What the preset promises to show; a visitor may zoom closer after it arrives. */
export const viewSubjectRadius = (id: SunViewId, frame: SunFrame, focus: PlaceId | null = null) =>
  subjectOf(id, frame, focus);

/** The pose that frames a view, given the frame's features and the camera's present angles. */
export function viewPose(
  id: SunViewId,
  frame: SunFrame,
  angles: Pick<OrbitPose, "azimuth" | "inclination">,
  viewport?: SunViewport,
  focus: PlaceId | null = null,
): OrbitPose {
  const view = VIEWS[id];
  const distance = viewport
    ? Math.max(view.distance, framedDistance(subjectOf(id, frame, focus), viewport))
    : view.distance;
  /* Only the angles: a camera's whole pose passed in must not carry its distance over the view's. */
  const { azimuth, inclination } = view.angles(frame, angles);
  return { distance, azimuth, inclination };
}

/**
 * How far from the centre a view's framing stands, radii: the pose's distance about the
 * centre, or, about a feature, the camera's reach from the feature's radius at its elevation.
 */
export function viewReach(id: SunViewId, frame: SunFrame) {
  const aim = viewAim(id, frame);
  const { distance, inclination } = viewPose(id, frame, { azimuth: 0, inclination: 0 });
  if (!aim) return distance;
  const radius = Math.hypot(aim.point[0], aim.point[1], aim.point[2]);
  return Math.hypot(radius + distance * Math.sin(inclination), distance * Math.cos(inclination));
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

/** The prominence the limb view shows: the tallest that is visible. */
export function featuredProminence(frame: SunFrame) {
  return frame.prominences.reduce<SunFrame["prominences"][number] | undefined>(
    (best, p) => (p.fade > 0 && (!best || p.fade * p.height > best.fade * best.height) ? p : best),
    undefined,
  );
}

/** The region the lab looks at and names: the eruption's, else the strongest alive; none on a spotless Sun. */
export function featuredRegion(frame: SunFrame) {
  const erupting = frame.eruption
    ? frame.regions.find((region) => region.id === frame.eruption!.regionId)
    : undefined;
  if (erupting) return erupting;
  return frame.regions.reduce<SunFrame["regions"][number] | undefined>(
    (best, region) =>
      region.strength > 0 && (!best || region.strength * region.size > best.strength * best.size)
        ? region
        : best,
    undefined,
  );
}
