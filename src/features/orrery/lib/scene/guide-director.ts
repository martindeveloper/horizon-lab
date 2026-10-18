/** The guided tour's camera (the toolkit's tour camera) and the drawings its steps lay in. */
import type { Object3D } from "three";

import type { SolarFrame } from "@/space/solar-system/scene/kit";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { createTourCamera } from "@horizon/toolkit/scene";

import { createTourSketch } from "../graphics/tour-sketch";
import { TOUR } from "../model/tour";
import type { OrreryStore } from "../store";
import type { CameraRig } from "./camera-rig";

export type GuideDirector = ReturnType<typeof createGuideDirector>;

export function createGuideDirector(
  scope: DisposalScope,
  parent: Object3D,
  rig: CameraRig,
  options: { reduceMotion: { matches: boolean }; holdBlocked: () => boolean },
) {
  const { reduceMotion } = options;
  const camera = createTourCamera(rig, options);
  const sketch = createTourSketch();
  scope.defer(() => sketch.dispose());
  parent.add(sketch.group);

  /* The step whose drawing is shown, its age and its fade. */
  let sketchStep = -1;
  let sketchT = 0;
  let sketchFade = 0;
  let sketchBusy = false;
  let step = -1;

  return {
    /** Frames are needed while a step is flown, held or its sketch is drawing. */
    busy() {
      return camera.busy || sketchBusy;
    },
    /** Ends any flight; the camera belongs to someone else now. */
    cancelFlight: camera.cancel,
    /** The viewer moved the camera: no flight, no hold. */
    takeOver: camera.takeOver,
    /** Flies to the store's step, or holds over a landed one. */
    stepCamera(s: OrreryStore, dt: number) {
      step = s.guideOpen ? s.guideStep : -1;
      camera.step(step < 0 ? null : step, TOUR[step] ?? null, dt);
    },
    /** Fades between the landed steps' drawings. */
    stepSketch(s: OrreryStore, f: SolarFrame) {
      const landed = s.guideOpen && camera.landed && TOUR[step]?.sketch ? step : -1;
      if (sketchStep !== landed) {
        sketchFade = sketchStep < 0 ? 0 : sketchFade - f.dt / 0.7;
        if (sketchFade <= 0) {
          sketchStep = landed;
          sketchFade = 1;
          sketchT = 0;
        }
      }
      if (sketchStep >= 0) sketchT += f.dt;
      const id = TOUR[sketchStep]?.sketch ?? null;
      sketch.update(id, {
        elapsed: reduceMotion.matches ? 30 : sketchT,
        fade: sketchFade,
        mig: f.mig,
        driftYears: f.driftYears,
        date: f.now,
      });
      sketchBusy =
        sketchStep !== landed ||
        (id !== null && !reduceMotion.matches && (sketchT < 6 || id === "sense"));
    },
  };
}
