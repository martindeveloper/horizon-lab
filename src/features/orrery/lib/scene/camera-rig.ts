/**
 * The Orrery's orbit camera (the toolkit's orbit rig): one zoom from a true-size close-up to
 * just past the Oort cloud, turning about the Sun (or Earth), or about a body in a close-up.
 */
import type { PerspectiveCamera, Vector3 } from "three";

import { closeUpFar, closeUpZoom, type CloseUpFrame } from "@/space/solar-system/model/close-up";
import {
  SOLAR_FRAMING,
  solarViewById,
  solarViewPose,
  type SolarViewId,
} from "@/space/solar-system/model/views";
import { createOrbitRig, createViewMoves } from "@horizon/toolkit/scene";

import { ORRERY_EDGE, SOLAR_EDGE } from "./kit";

export type CameraRig = ReturnType<typeof createCameraRig>;

export function createCameraRig(
  camera: PerspectiveCamera,
  options: {
    reduceMotion: { matches: boolean };
    closeUp: () => CloseUpFrame | null;
    /** Places the aim for the frame: the Sun, or Earth in the view from Earth; the Sun by default. */
    home?: (aim: Vector3) => void;
  },
) {
  const { reduceMotion, closeUp, home } = options;
  const rig = createOrbitRig(camera, {
    pose: { ...SOLAR_FRAMING, distance: 72 },
    reduceMotion,
    /* From a true-size close-up to just past the Oort cloud; a close-up's own bounds in one. */
    limits: () =>
      closeUp()
        ? closeUpZoom(closeUp(), { min: 1e-12, max: SOLAR_EDGE })
        : { min: 0.35, max: ORRERY_EDGE },
    /* While a close-up flight owns the distance the zoom only follows; in a close-up, limits
       that moved never pull it back. */
    follow: () => {
      const close = closeUp();
      return { held: close !== null && close.phase !== "on", clamp: !close };
    },
    nearFloor: SOLAR_FRAMING.nearFloor,
    /* In a close-up this frustum draws the rest of the system; the body gets its own pass. */
    far: (distance, aim) => (closeUp() ? closeUpFar(distance, aim) : distance * 40),
    ...(home ? { home } : {}),
  });

  /* Flights between views keep the angles; reduced motion lands framed as the view is. */
  const moves = createViewMoves(rig, (id: SolarViewId) => solarViewPose(solarViewById(id)));

  return Object.assign(rig, moves, {
    /** Accumulated zoom past a close-up's far limit, in e-folds; a deliberate push leaves. */
    edgePush: 0,
  });
}
