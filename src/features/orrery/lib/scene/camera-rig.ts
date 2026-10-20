/**
 * The Orrery's orbit camera (the toolkit's orbit rig): one zoom from a true-size close-up to
 * just past the Oort cloud, turning about the Sun, or about a body in a close-up.
 */
import type { PerspectiveCamera } from "three";

import {
  SOLAR_FRAMING,
  solarViewById,
  solarViewPose,
  type SolarViewId,
} from "@/space/solar-system/model/views";
import { createOrbitRig, createViewMoves } from "@horizon/toolkit/scene";

import { closeUpLimits } from "./close-up-flight";
import { ORRERY_EDGE, SOLAR_EDGE } from "./kit";

/** What the rig needs to know about a close-up in progress. */
type CloseUpFrame = { phase: "in" | "on" | "out"; radius: number; frame: number };

export type CameraRig = ReturnType<typeof createCameraRig>;

export function createCameraRig(
  camera: PerspectiveCamera,
  options: { reduceMotion: { matches: boolean }; closeUp: () => CloseUpFrame | null },
) {
  const { reduceMotion, closeUp } = options;
  const rig = createOrbitRig(camera, {
    pose: { ...SOLAR_FRAMING, distance: 72 },
    reduceMotion,
    /* From a true-size close-up to just past the Oort cloud. */
    limits: () => {
      const close = closeUp();
      if (!close) return { min: 0.35, max: ORRERY_EDGE };
      /* Around the body once arrived; open while a flight carries the camera. */
      return close.phase === "on"
        ? closeUpLimits(close.radius, close.frame)
        : { min: 1e-12, max: SOLAR_EDGE };
    },
    /* While a close-up flight owns the distance the zoom only follows; in a close-up, limits
       that moved never pull it back. */
    follow: () => {
      const close = closeUp();
      return { held: close !== null && close.phase !== "on", clamp: !close };
    },
    nearFloor: SOLAR_FRAMING.nearFloor,
    /* In a close-up this frustum draws the rest of the system; the body gets its own pass. */
    far: (distance, aim) =>
      closeUp() ? Math.max(distance * 40, aim.length() * 2 + 60) : distance * 40,
  });

  /* Flights between views keep the angles; reduced motion lands framed as the view is. */
  const moves = createViewMoves(rig, (id: SolarViewId) => solarViewPose(solarViewById(id)));

  return Object.assign(rig, moves, {
    /** Accumulated zoom past a close-up's far limit, in e-folds; a deliberate push leaves. */
    edgePush: 0,
  });
}
