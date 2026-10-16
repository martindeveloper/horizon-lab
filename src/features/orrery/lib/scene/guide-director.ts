/** The guided tour's camera: flights between steps, a slow hold while one is read, its sketches. */
import type { Object3D } from "three";

import type { OrbitPose } from "@horizon/toolkit/camera";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import { createTourSketch } from "../graphics/tour-sketch";
import { TOUR, sampleTourFlight, shortestTurn, tourFlightSeconds } from "../model/tour";
import { viewById } from "../model/views";
import type { OrreryStore } from "../store";
import type { CameraRig } from "./camera-rig";
import type { Frame } from "./kit";

export type GuideDirector = ReturnType<typeof createGuideDirector>;

export function createGuideDirector(
  scope: DisposalScope,
  parent: Object3D,
  rig: CameraRig,
  options: { reducedMotion: boolean; holdBlocked: () => boolean },
) {
  const { reducedMotion } = options;
  const { pose } = rig;
  const sketch = createTourSketch();
  scope.defer(() => sketch.dispose());
  parent.add(sketch.group);

  /* Flights: the step being flown to, the pose it left from and progress 0..1. */
  let step = -1;
  let from: OrbitPose = { ...pose };
  let t = 1;
  /* Hold: a slow orbit while a landed step is read, until the viewer takes the camera. */
  let holdT = 0;
  let holdDir = 1;
  let holdOff = false;
  /* The step whose drawing is shown, its age and its fade. */
  let sketchStep = -1;
  let sketchT = 0;
  let sketchFade = 0;
  let sketchBusy = false;

  const holding = (s: OrreryStore) => s.guideOpen && t >= 1 && !holdOff && !options.holdBlocked();

  return {
    /** Frames are needed while a step is flown, held or its sketch is drawing. */
    busy(s: OrreryStore) {
      return t < 1 || holding(s) || sketchBusy;
    },
    /** Ends any flight; the camera belongs to someone else now. */
    cancelFlight() {
      t = 1;
    },
    /** The viewer moved the camera: no flight, no hold. */
    takeOver() {
      t = 1;
      holdOff = true;
    },
    /** Flies to the store's step, or holds over a landed one. */
    stepCamera(s: OrreryStore, dt: number) {
      const next = s.guideOpen ? s.guideStep : -1;
      if (next !== step) {
        step = next;
        const tour = TOUR[next];
        if (tour) {
          /* Crossing between the solar and Galaxy maps cuts, then settles in from farther out. */
          if (viewById(tour.view).realm !== rig.realm) {
            rig.snapToView(tour.view);
            pose.distance = rig.seamDistance();
          }
          from = { ...pose };
          t = reducedMotion ? 1 : 0;
          holdT = 0;
          holdOff = false;
          holdDir = Math.sign(shortestTurn(pose.azimuth, tour.azimuth)) || 1;
          rig.flying = false;
          if (reducedMotion) Object.assign(pose, sampleTourFlight(1, from, tour));
        } else t = 1;
      }
      const tour = TOUR[step];
      if (tour && t < 1) {
        t = Math.min(1, t + dt / tourFlightSeconds(tour));
        Object.assign(pose, sampleTourFlight(t, from, tour));
      } else if (tour && holding(s)) {
        holdT += dt;
        pose.azimuth += (tour.drift ?? 0.01 * holdDir) * (1 - Math.exp(-holdT / 3)) * dt;
      }
    },
    /** Fades between the landed steps' drawings. */
    stepSketch(s: OrreryStore, f: Frame) {
      const landed = s.guideOpen && t >= 1 && TOUR[step]?.sketch ? step : -1;
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
        elapsed: reducedMotion ? 30 : sketchT,
        fade: sketchFade,
        mig: f.mig,
        driftYears: f.driftYears,
        date: f.now,
      });
      sketchBusy =
        sketchStep !== landed || (id !== null && !reducedMotion && (sketchT < 6 || id === "sense"));
    },
  };
}
