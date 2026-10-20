/**
 * Deep Field's drift on its rig (the toolkit's rig drift): the programme's shots resolved to
 * the ladder's framings, flown while the store says the drift plays.
 */
import { driftRunState } from "@/lib/drift";
import { createRigDrift } from "@horizon/toolkit/scene";

import { DRIFT } from "../drift";
import type { useDeepField } from "../store";
import type { CameraRig } from "./camera-rig";

export function createDriftDirector(
  rig: CameraRig,
  store: typeof useDeepField,
  reduceMotion: { matches: boolean },
) {
  const drift = createRigDrift(
    rig,
    DRIFT.shots.map(({ view, pose, ...shot }) => ({ ...rig.framing(view), ...pose, ...shot })),
    { ...DRIFT.camera, reduceMotion },
  );
  return {
    /** Frames are needed while the drift plays. */
    get busy() {
      return store.getState().drift === "playing";
    },
    /** The viewer moved the camera: the drift waits for them. */
    takeOver() {
      store.getState().pauseDrift();
    },
    /** Call before the rig steps. */
    step(dt: number) {
      drift.step(driftRunState(store.getState().drift), dt);
    },
  };
}
