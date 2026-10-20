/**
 * The Orrery's drift on its rig (the toolkit's rig drift). The programme's framed shots fly on
 * the drift camera; its close-ups are handoffs: the director selects the body and opens the
 * close-up, whose own flight takes the camera in, then circles the body slowly and drifts
 * nearer for the hold, swinging out midway to show the body with its largest moon, lets the
 * selection go so the close-up flies out, and resumes the drift from there. Flying on after a
 * pause leaves any close-up first.
 */
import { driftRunState } from "@/lib/drift";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { clamp, lerp, smootherstep } from "@horizon/toolkit/math";
import { createRigDrift } from "@horizon/toolkit/scene";

import { DRIFT } from "../drift";
import { canCloseUp, type useOrrery } from "../store";
import type { CameraRig } from "./camera-rig";
import { moonSwing } from "./close-up-flight";

/** What the director needs to know about a close-up in progress. */
type CloseUpFrame = { phase: "in" | "on" | "out" };

/** Radians the camera sways above and below its arrival tilt at a body. */
const SWAY = 0.12;

/** A visit to a body: waiting for the flight in, circling, or waiting for the flight out. */
type Visit =
  | { phase: "in" }
  | {
      phase: "on";
      held: number;
      hold: number;
      distance: number;
      inclination: number;
      azimuth: number;
    }
  | { phase: "out" };

export function createDriftDirector(
  rig: CameraRig,
  store: typeof useOrrery,
  options: {
    reduceMotion: { matches: boolean };
    closeUp: () => CloseUpFrame | null;
    /** The pose that frames the visited body with its largest moon, from a pose; null without one. */
    moonPose: (base: OrbitPose) => OrbitPose | null;
  },
) {
  const { reduceMotion, closeUp, moonPose } = options;
  let visit: Visit | null = null;

  /** Begins the close-up the handoff names, or skips it when the clock forbids one. */
  function enter(index: number, resume: () => void) {
    const shot = DRIFT.shots[index];
    const s = store.getState();
    if (!shot || !("closeUp" in shot) || !canCloseUp({ ...s, selection: shot.closeUp }))
      return resume();
    s.select(shot.closeUp);
    s.enterCloseUp();
    visit = { phase: "in" };
  }

  /** Circles the body and drifts nearer through the hold, swinging out to its moon midway. */
  function circle(at: Extract<Visit, { phase: "on" }>, dt: number) {
    at.held += dt;
    if (!reduceMotion.matches) {
      const t = Math.min(1, at.held / at.hold);
      const ramp = 1 - Math.exp(-at.held / 3);
      at.azimuth += DRIFT.closeUp.orbit * ramp * dt;
      const { min, max } = rig.limits();
      const base = {
        azimuth: at.azimuth,
        inclination: at.inclination + SWAY * Math.sin(t * Math.PI),
        distance: clamp(at.distance * DRIFT.closeUp.dive ** smootherstep(t), min, max),
      };
      const swing = moonSwing(t, DRIFT.closeUp.moon);
      const moon = swing > 0 ? moonPose(base) : null;
      Object.assign(
        rig.pose,
        moon
          ? {
              azimuth: lerp(base.azimuth, moon.azimuth, swing),
              inclination: lerp(base.inclination, moon.inclination, swing),
              distance: Math.exp(lerp(Math.log(base.distance), Math.log(moon.distance), swing)),
            }
          : base,
      );
      rig.settle();
    }
    if (at.held >= at.hold) {
      /* Letting the selection go leaves the close-up too, and takes the body's marker with it. */
      store.getState().select(null);
      visit = { phase: "out" };
    }
  }

  /** The handoff shot's visit, frame by frame, until the close-up has closed again. */
  function stepVisit(index: number, dt: number, resume: () => void) {
    const close = closeUp();
    if (!visit) return enter(index, resume);
    if (visit.phase === "in") {
      if (!close) return resume();
      if (close.phase === "on") {
        const shot = DRIFT.shots[index];
        const hold = (shot && "closeUp" in shot ? shot.hold : undefined) ?? DRIFT.closeUp.hold;
        visit = {
          phase: "on",
          held: 0,
          hold,
          distance: rig.pose.distance,
          inclination: rig.pose.inclination,
          azimuth: rig.pose.azimuth,
        };
      }
      return;
    }
    if (visit.phase === "on") {
      if (!close) visit = { phase: "out" };
      else circle(visit, dt);
    }
    if (visit.phase === "out" && !close) {
      visit = null;
      resume();
    }
  }

  const drift = createRigDrift(
    rig,
    DRIFT.shots.map((shot) => {
      if ("closeUp" in shot) return { handoff: true as const };
      const { view, pose, ...rest } = shot;
      return { ...rig.framing(view), ...pose, ...rest };
    }),
    { ...DRIFT.camera, reduceMotion },
    { handoff: stepVisit },
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
      const state = store.getState();
      /* A close-up left from a pause (or the visitor's own) flies out before the drift goes on. */
      const leaving = state.drift === "playing" && !drift.flying && closeUp() !== null;
      if (leaving && state.closeUp) state.leaveCloseUp(true);
      if (state.drift !== "playing") visit = null;
      drift.step(driftRunState(state.drift), dt, leaving);
    },
  };
}
