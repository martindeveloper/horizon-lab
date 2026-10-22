import { Vector3, type PerspectiveCamera } from "three";

import { ATLAS_LANDMARKS, isAtlasLandmark } from "@/space/cosmos/model/atlas";
import { cosmicAim } from "@/space/cosmos/model/cosmos";
import {
  GALAXY_FRAME,
  LY,
  MLY,
  SUPERGALACTIC_FRAME,
  galaxyMix,
  galaxyToWorld,
  realmOf,
  cosmicToWorld,
} from "@/space/galaxy/scene/frames";
import { SOLAR_FRAMING } from "@/space/solar-system/model/views";
/**
 * Deep Field's orbit camera (the toolkit's orbit rig): one zoom from the Sun's neighbourhood to
 * the edge of the observable universe. As the camera pulls out past the nearest stars, the
 * orbit frame turns from the ecliptic to the galactic plane and the aim slides from the Sun to
 * the galactic centre; past the halo the frame turns again, to the supergalactic plane, and
 * the aim travels on to the heart of each larger structure.
 */
import type { Vec3 } from "@horizon/toolkit/bodies";
import { smootherstep, toLogFraction } from "@horizon/toolkit/math";
import { createOrbitRig, createViewMoves, type ZoomLimits } from "@horizon/toolkit/scene";

import { LADDER_LY } from "../model/depth";
import type { ViewId } from "../model/view-ids";
import { viewById, worldDistance, type Realm } from "../model/views";
import type { Selection } from "../store";
import { GALAXY_NEAR } from "./kit";

export type CameraRig = ReturnType<typeof createCameraRig>;

/**
 * A close-up's hold on the camera (`probe-close-up.ts`): the aim, the zoom's bounds about it,
 * and whether the close-up's flight owns the distance.
 */
export type CameraFocus = { at: Vector3; limits: ZoomLimits; flying: boolean };

/** Default azimuth, and tilt of each scale's views: the solar framing out to the stars, steeper beyond. */
const AZIMUTH = SOLAR_FRAMING.azimuth;
const inclinationOf = (realm: Realm) =>
  realm === "solar" || realm === "stars" ? SOLAR_FRAMING.inclination : 0.58;
/** Seconds for a bulge/halo card to take the aim to the centre or give it back. */
const HOLD_S = 0.8;

export function createCameraRig(
  camera: PerspectiveCamera,
  options: {
    state: () => { selection: Selection | null };
    reduceMotion: { matches: boolean };
  },
) {
  const { state, reduceMotion } = options;
  /** A close-up holding the camera (`holdFocus`), or null. */
  let focus: CameraFocus | null = null;
  const centre = galaxyToWorld(0, 0, 0, new Vector3());
  const beyond = new Vector3();
  const heart: Vec3 = [0, 0, 0];
  /** 0..1 of the way a Galactic component has taken the aim to the centre. */
  let hold = 0;
  let atlasHold = 0;
  const atlasAim = new Vector3();
  const atlasTarget = new Vector3();
  const atlasHeld = () => {
    const sel = state().selection;
    return sel?.kind === "cosmos" && isAtlasLandmark(sel.id) ? ATLAS_LANDMARKS[sel.id] : null;
  };
  const bulgeHeld = () => {
    const sel = state().selection;
    return sel?.kind === "galaxy" && sel.id === "bulge";
  };
  const haloHeld = () => {
    const sel = state().selection;
    return sel?.kind === "galaxy" && sel.id === "halo";
  };

  const rig = createOrbitRig(camera, {
    pose: {
      azimuth: AZIMUTH,
      inclination: inclinationOf("galaxy"),
      distance: worldDistance(viewById("galaxy").ly),
    },
    reduceMotion,
    /* The ladder's ends; while the bulge card holds the aim on the centre, the Galaxy map's
       floor; in a close-up, its own. */
    limits: () =>
      focus?.limits ?? {
        min: (bulgeHeld() ? GALAXY_NEAR : LADDER_LY.near) * LY,
        max: LADDER_LY.far * LY,
      },
    /* A close-up's flight sets the distance itself. */
    follow: () => ({ held: focus?.flying ?? false, clamp: true }),
    nearFloor: SOLAR_FRAMING.nearFloor,
    onStep: (dt) => {
      hold =
        bulgeHeld() || haloHeld()
          ? Math.min(1, hold + dt / HOLD_S)
          : Math.max(0, hold - dt / HOLD_S);
      const landmark = atlasHeld();
      if (landmark) {
        cosmicToWorld(landmark.at, atlasTarget);
        if (atlasHold === 0 || reduceMotion.matches) atlasAim.copy(atlasTarget);
        else atlasAim.lerp(atlasTarget, 1 - Math.exp(-dt / 0.18));
      }
      atlasHold = reduceMotion.matches
        ? landmark
          ? 1
          : 0
        : landmark
          ? Math.min(1, atlasHold + dt / HOLD_S)
          : Math.max(0, atlasHold - dt / HOLD_S);
    },
    /* The aim on its way to or from the centre. */
    busy: () =>
      (hold > 0 && hold < 1) ||
      (atlasHold > 0 && atlasHold < 1) ||
      (atlasHold > 0 && atlasAim.distanceTo(atlasTarget) > LY),
    /* Close in, the camera turns about the Sun; farther, about the galactic centre; past the
       halo, about the heart of the structure in view. */
    home: (aim, pose) => {
      const homing =
        smootherstep(1 - toLogFraction(pose.distance / LY, 9_000, 40_000)) *
        (1 - smootherstep(hold));
      aim.copy(centre).multiplyScalar(1 - homing);
      cosmicAim(pose.distance / LY, heart);
      if (heart[0] !== 0 || heart[1] !== 0 || heart[2] !== 0)
        aim.add(
          beyond
            .set(heart[0], heart[1], heart[2])
            .applyQuaternion(GALAXY_FRAME)
            .multiplyScalar(MLY * (1 - smootherstep(hold))),
        );
      /* The expanded atlas reaches either side of the old web framing. Selecting
         a landmark brings it into view on a narrow phone without relocating data. */
      aim.lerp(
        atlasAim,
        smootherstep(atlasHold) * smootherstep(toLogFraction(pose.distance / LY, 80e6, 450e6)),
      );
      if (focus) aim.copy(focus.at);
    },
    /* The orbit frame turns from the ecliptic to the galactic plane past the nearest stars,
       then to the supergalactic plane as the nearby galaxies come into view. */
    orient: (distance, frame) => {
      frame
        .identity()
        .slerp(GALAXY_FRAME, galaxyMix(distance))
        .slerp(SUPERGALACTIC_FRAME, smootherstep(toLogFraction(distance / LY, 2e6, 4e7)));
    },
  });

  /* Across scales a flight turns to the view's framing; within one it keeps the angles. */
  const moves = createViewMoves(
    rig,
    (id: ViewId) => {
      const view = viewById(id);
      return {
        azimuth: view.azimuth ?? AZIMUTH,
        inclination: view.inclination ?? inclinationOf(view.realm),
        distance: worldDistance(view.ly),
      };
    },
    (id) => viewById(id).realm !== realmOf(rig.pose.distance),
  );

  return Object.assign(rig, moves, {
    /** A close-up takes the aim and the zoom's bounds, or (null) gives them back. */
    holdFocus(next: CameraFocus | null) {
      focus = next;
    },
  });
}
