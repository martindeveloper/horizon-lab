/**
 * The journey's camera (the toolkit's tour camera): each step's shot is its view framed as the
 * ladder frames it, nudged by the step. The scene tells the store when a shot has landed, so
 * the caption knows when to start counting.
 */
import { createTourCamera, type TourShot } from "@horizon/toolkit/scene";

import { TOUR } from "../model/tour";
import type { useDeepField } from "../store";
import type { CameraRig } from "./camera-rig";

export type Guide = ReturnType<typeof createGuide>;

export function createGuide(
  rig: CameraRig,
  store: typeof useDeepField,
  reduceMotion: { matches: boolean },
) {
  const camera = createTourCamera(rig, { reduceMotion });
  let shot: TourShot | null = null;
  let shotOf = -1;

  return {
    get busy() {
      return camera.busy;
    },
    /** The viewer moved the camera: the shot is theirs, and the journey waits for them. */
    takeOver() {
      camera.takeOver();
      const s = store.getState();
      if (s.guideOpen && s.guidePlaying) s.toggleGuidePlaying();
    },
    /** Flies to the store's step, or holds over a landed one. Call before the rig steps. */
    step(dt: number) {
      const s = store.getState();
      const index = s.guideOpen ? s.guideStep : -1;
      const step = TOUR[index];
      if (index !== shotOf) {
        shotOf = index;
        shot = step
          ? {
              ...rig.framing(step.view),
              ...step.pose,
              ...(step.flight ? { flight: step.flight } : {}),
              ...(step.drift === undefined ? {} : { drift: step.drift }),
            }
          : null;
      }
      camera.step(step ? index : null, shot, dt);
      if (step && camera.landed !== s.guideLanded) store.setState({ guideLanded: camera.landed });
    },
  };
}
