/**
 * Deep Field's orbit camera (the toolkit's orbit rig): one zoom from the Sun's neighbourhood to
 * the edge of the observable universe. As the camera pulls out past the nearest stars, the
 * orbit frame turns from the ecliptic to the galactic plane and the aim slides from the Sun to
 * the galactic centre; past the halo the frame turns again, to the supergalactic plane, and
 * the aim travels on to the heart of each larger structure.
 */
import { Vector3, type PerspectiveCamera } from "three";

import { smootherstep, toLogFraction } from "@horizon/toolkit/math";
import { createOrbitRig, createViewMoves } from "@horizon/toolkit/scene";

import { cosmicAim, type Vec } from "../model/cosmos";
import { LADDER_LY } from "../model/depth";
import type { ViewId } from "../model/view-ids";
import { viewById, worldDistance, type Realm } from "../model/views";
import type { Selection } from "../store";
import { GALAXY_NEAR } from "./kit";
import {
  GALAXY_FRAME,
  LY,
  MLY,
  SUPERGALACTIC_FRAME,
  galaxyMix,
  galaxyToWorld,
  realmOf,
} from "./lod";

export type CameraRig = ReturnType<typeof createCameraRig>;

/** Default azimuth, and tilt of each scale's views. */
const AZIMUTH = 0.6;
const inclinationOf = (realm: Realm) => (realm === "solar" || realm === "stars" ? 0.52 : 0.58);
/** Seconds for the bulge card to take the aim to the centre or give it back. */
const HOLD_S = 0.8;

export function createCameraRig(
  camera: PerspectiveCamera,
  options: {
    state: () => { selection: Selection | null };
    reduceMotion: { matches: boolean };
  },
) {
  const { state, reduceMotion } = options;
  const centre = galaxyToWorld(0, 0, 0, new Vector3());
  const beyond = new Vector3();
  const heart: Vec = [0, 0, 0];
  /** 0..1 of the way the bulge card has taken the aim to the centre. */
  let hold = 0;
  const bulgeHeld = () => {
    const sel = state().selection;
    return sel?.kind === "galaxy" && sel.id === "bulge";
  };

  const rig = createOrbitRig(camera, {
    pose: {
      azimuth: AZIMUTH,
      inclination: inclinationOf("galaxy"),
      distance: worldDistance(viewById("galaxy").ly),
    },
    reduceMotion,
    /* The ladder's ends; while the bulge card holds the aim on the centre, the Galaxy map's floor. */
    limits: () => ({
      min: (bulgeHeld() ? GALAXY_NEAR : LADDER_LY.near) * LY,
      max: LADDER_LY.far * LY,
    }),
    nearFloor: 0.008,
    onStep: (dt) => {
      hold = bulgeHeld() ? Math.min(1, hold + dt / HOLD_S) : Math.max(0, hold - dt / HOLD_S);
    },
    /* The aim on its way to or from the centre. */
    busy: () => hold > 0 && hold < 1,
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
            .multiplyScalar(MLY),
        );
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

  return Object.assign(rig, moves);
}
