/**
 * The orbit camera: its pose about an aim point, the map it is on, zoom limits,
 * and the log-distance flight between views.
 */
import { Vector3, type PerspectiveCamera } from "three";

import { smootherstep, toLogFraction } from "@horizon/toolkit/math";

import { sunGalactic } from "../model/galactic-orbit";
import { sunExists } from "../model/timeline";
import { viewById, type ViewId } from "../model/views";
import type { OrreryStore } from "../store";
import { closeUpLimits } from "./close-up-flight";
import { GALAXY_NEAR, SOLAR_EDGE } from "./kit";

/** What the rig needs to know about a close-up in progress. */
export type CloseUpFrame = { phase: "in" | "on" | "out"; radius: number; frame: number };

export type CameraRig = ReturnType<typeof createCameraRig>;

export function createCameraRig(
  camera: PerspectiveCamera,
  options: {
    state: () => OrreryStore;
    reduceMotion: MediaQueryList;
    closeUp: () => CloseUpFrame | null;
  },
) {
  const { state, reduceMotion, closeUp } = options;
  const tmp: [number, number, number] = [0, 0, 0];
  const rig = {
    pose: { azimuth: 0.6, inclination: 0.52, distance: 72 },
    aim: new Vector3(),
    realm: viewById(state().view).realm,
    flying: false,
    flightTarget: 72,
    /** Galaxy camera target: the centre from afar, the Sun up close (0..1 of the way). */
    homing: 0,
    /** Accumulated zoom past a map's edge, in e-folds; a deliberate push crosses over. */
    edgePush: 0,

    /* The two maps meet at the Sun: zooming into it in the Galaxy enters the solar map at
       its outer edge, and pushing past that edge pulls back out to the Galaxy. */
    limits() {
      const s = state();
      const close = closeUp();
      if (close) {
        /* Around the body once arrived; open while a flight carries the camera. */
        return close.phase === "on"
          ? closeUpLimits(close.radius, close.frame)
          : { min: 1e-12, max: SOLAR_EDGE };
      }
      return rig.realm === "galaxy"
        ? {
            min: sunExists(s.yearsAgo) ? GALAXY_NEAR : 6_000,
            max: s.show.halo ? 2_400_000 : 230_000,
          }
        : { min: 0.35, max: SOLAR_EDGE };
    },
    /** Where a crossing between maps starts: the solar edge, or just off the Sun in the Galaxy. */
    seamDistance() {
      return rig.realm === "solar" ? SOLAR_EDGE : rig.limits().min * 1.6;
    },

    snapToView(id: ViewId) {
      const view = viewById(id);
      rig.realm = view.realm;
      rig.pose.azimuth = view.azimuth ?? 0.6;
      rig.pose.inclination = view.inclination ?? (view.realm === "galaxy" ? 0.58 : 0.52);
      rig.pose.distance = view.dist;
      rig.flightTarget = view.dist;
      rig.flying = false;
    },
    flyToView(id: ViewId) {
      const view = viewById(id);
      // Reduced motion: no zoom flight across scales, arrive at once.
      if (reduceMotion.matches) {
        rig.snapToView(id);
        return;
      }
      if (view.realm !== rig.realm) {
        rig.snapToView(id);
        rig.pose.distance = rig.seamDistance();
        rig.flying = true;
        return;
      }
      rig.flightTarget = view.dist;
      rig.flying =
        Math.abs(rig.flightTarget - rig.pose.distance) > Math.max(0.2, rig.flightTarget * 0.012);
    },
    /** Eases in log distance, so a jump across scales reads as one steady zoom. */
    stepFlight(dt: number) {
      if (!rig.flying) return;
      const { pose, flightTarget } = rig;
      const gap = Math.log(flightTarget / pose.distance);
      pose.distance *= Math.exp(gap * (1 - Math.exp(-3 * dt)));
      if (Math.abs(pose.distance - flightTarget) < Math.max(0.2, flightTarget * 0.012)) {
        pose.distance = flightTarget;
        rig.flying = false;
      }
    },
    /** Close in, the Galaxy camera turns about the Sun; the bulge card keeps it on the centre. */
    home() {
      const s = state();
      const sun = rig.realm === "galaxy" ? sunGalactic(s.yearsAgo, s.show.elliptical, tmp) : null;
      const bulge = s.selection?.kind === "galaxy" && s.selection.id === "bulge";
      rig.homing =
        sun && !bulge ? smootherstep(1 - toLogFraction(rig.pose.distance, 9_000, 40_000)) : 0;
      if (sun) rig.aim.set(sun[0], sun[1], sun[2]).multiplyScalar(rig.homing);
      else rig.aim.set(0, 0, 0);
    },

    applyPose() {
      const { pose, aim } = rig;
      const { azimuth, inclination, distance } = pose;
      camera.position.set(
        aim.x + distance * Math.cos(inclination) * Math.sin(azimuth),
        aim.y + distance * Math.sin(inclination),
        aim.z + distance * Math.cos(inclination) * Math.cos(azimuth),
      );
      camera.lookAt(aim);
      camera.near = Math.max(rig.realm === "galaxy" ? 30 : 0.008, distance / 5000);
      /* In a close-up this frustum draws the rest of the system; the body gets its own pass. */
      camera.far = closeUp() ? Math.max(distance * 40, aim.length() * 2 + 60) : distance * 40;
      camera.updateProjectionMatrix();
      /* Labels are projected before the renderer refreshes these; keep them on this frame's pose. */
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    },
  };
  return rig;
}
