/**
 * The Orrery's drift on its rig (the toolkit's rig drift). The programme's framed shots fly on
 * the drift camera; its close-ups are handoffs: the director selects the body and opens the
 * close-up, whose own flight takes the camera in, then circles the body slowly and drifts
 * nearer for the hold, pulls out over its last part to show the body with its largest moon
 * and stays there, then lets go: one dive to a body and one pull away. A visit before a
 * framed shot pulls away on that shot's own flight (the close-up released to it, keeping the
 * body in view until the flight hands the aim home), so the release flows on without a stop;
 * before another visit the close-up flies out itself. Flying on after a pause leaves any
 * close-up first.
 */
import { ambientMusic } from "@/components/shell/ambient-music";
import { audioMapNow } from "@/lib/audio-maps";
import { driftRunState, openingFor, timedDrift } from "@/lib/drift";
import type { AudioMap } from "@horizon/toolkit/audio";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { clamp, lerp, smootherstep } from "@horizon/toolkit/math";
import { createRigDrift, type RigDrift } from "@horizon/toolkit/scene";

import { DRIFT, pullsAwayOnward } from "../drift";
import { canCloseUp, type useOrrery } from "../store";
import type { CameraRig } from "./camera-rig";
import type { CloseUpStyle } from "./close-up-controller";
import { moonSwing } from "./close-up-flight";

/** What the director needs to know about a close-up in progress. */
type CloseUpFrame = { phase: "in" | "on" | "out"; released: OrbitPose | null };

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
    /** Hands the close-up's flight out to the drift's flight landing on `landing`. */
    release: (landing: OrbitPose) => void;
    /** The close-up flies a released flight on to its landing itself. */
    reclaim: () => void;
    /** The released flight has landed: the close-up ends where the drift left the camera. */
    finish: () => void;
  },
) {
  const { reduceMotion, closeUp, moonPose } = options;
  let visit: Visit | null = null;
  /** The programme timed to its track's map: a hold at a body may linger to meet a cue. */
  let timed = timedDrift(DRIFT, null);
  let timedWith: AudioMap | null = null;

  /** Begins the close-up the handoff names, or skips it when the clock forbids one. */
  function enter(index: number, resume: () => void) {
    const shot = timed.shots[index];
    const s = store.getState();
    if (!shot || !("closeUp" in shot) || !canCloseUp({ ...s, selection: shot.closeUp }))
      return resume();
    s.select(shot.closeUp);
    s.enterCloseUp();
    visit = { phase: "in" };
  }

  /**
   * Lets the body go at the end of its hold: on the drift's next flight when a framed shot
   * follows (the drift flies on at once), else on the close-up's own flight out.
   */
  function letGo(index: number, resume: () => void) {
    if (pullsAwayOnward(timed.shots, index)) {
      resume();
      const landing = drift.landing;
      if (landing) options.release(landing);
      visit = null;
    } else visit = { phase: "out" };
    /* Letting the selection go leaves the close-up too, and takes the body's marker with it. */
    store.getState().select(null);
  }

  /** Circles the body and drifts nearer through the hold, pulling out to its moon toward the end. */
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
  }

  /** The handoff shot's visit, frame by frame, until the close-up has closed again. */
  function stepVisit(index: number, dt: number, resume: () => void) {
    const close = closeUp();
    if (!visit) return enter(index, resume);
    if (visit.phase === "in") {
      if (!close) return resume();
      if (close.phase === "on") {
        const shot = timed.shots[index];
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
      else {
        circle(visit, dt);
        if (visit.held >= visit.hold) return letGo(index, resume);
      }
    }
    if (visit.phase === "out" && !close) {
      visit = null;
      resume();
    }
  }

  let drift: RigDrift;
  /** The drift timed by `map`: a run on the rig, its framed shots posed by the views, its close-ups handed off. */
  function build(map: AudioMap | null) {
    timed = timedDrift(DRIFT, map);
    timedWith = map;
    drift = createRigDrift(
      rig,
      timed.shots.map((shot) => {
        if ("closeUp" in shot) return { handoff: true as const };
        const { view, pose, ...rest } = shot;
        return { ...rig.framing(view), ...pose, ...rest };
      }),
      {
        ...DRIFT.camera,
        /* The drift's curtain covers a fresh start: the camera cuts to the opening shot. */
        cut: true,
        reduceMotion,
        opening: () => openingFor(timed, ambientMusic.position),
      },
      { handoff: stepVisit },
    );
  }
  build(audioMapNow(DRIFT.music?.track));

  return {
    /**
     * How the drift's visits fly: at a lean-back pace, settling slowly onto the body, and
     * scripted, so the clock eases with them and the flight in carries on the camera's turn.
     */
    visitStyle(): CloseUpStyle {
      return {
        pace: DRIFT.closeUp.pace,
        lead: DRIFT.closeUp.lead,
        scripted: { motion: { ...drift.motion } },
      };
    },
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
      /* A released pull away ends as the drift's flight lands; one the drift no longer flies
         (it was paused, then resumed afresh, or stopped) the close-up flies on itself. A pause
         holds it where it is. */
      if (closeUp()?.released) {
        if (state.drift === "playing" && drift.flying) {
          if (!drift.landing) options.finish();
        } else if (state.drift !== "paused") options.reclaim();
      }
      /* A close-up left from a pause (or the visitor's own) flies out before the drift goes on. */
      const leaving = state.drift === "playing" && !drift.flying && closeUp() !== null;
      if (leaving && state.closeUp) state.leaveCloseUp(true);
      if (state.drift !== "playing") visit = null;
      /* A map that arrived since retimes the drift, unless it is flying: that run keeps its timing. */
      const map = audioMapNow(DRIFT.music?.track);
      if (map !== timedWith && !drift.flying) build(map);
      drift.step(driftRunState(state.drift), dt, leaving);
    },
  };
}
