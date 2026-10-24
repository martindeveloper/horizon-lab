/**
 * The Orrery's drift on its rig (the toolkit's rig drift). The programme's framed shots fly on
 * the drift camera; its close-ups are handoffs to the shared visits (`@/space/drift-visits`):
 * the body selected and its close-up opened, one dive in, a slow circle that drifts nearer, and
 * one pull away. Here the hold ends pulled out to show the body with its largest moon, and the
 * pull away leaves from there.
 */
import { ambientMusic } from "@/components/shell/ambient-music";
import { audioMapNow } from "@/lib/audio-maps";
import { driftRunState, openingFor, timedDrift } from "@/lib/drift";
import { createDriftVisits, type VisitFrame } from "@/space/drift-visits";
import { moonSwing } from "@/space/solar-system/scene/close-up-framing";
import type { AudioMap } from "@horizon/toolkit/audio";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { lerp } from "@horizon/toolkit/math";
import { createRigDrift, type RigDrift } from "@horizon/toolkit/scene";

import { DRIFT, type CloseUpBody } from "../drift";
import { canCloseUp, type useOrrery } from "../store";
import type { CameraRig } from "./camera-rig";

export function createDriftDirector(
  rig: CameraRig,
  store: typeof useOrrery,
  options: {
    reduceMotion: { matches: boolean };
    closeUp: () => VisitFrame | null;
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
  const { reduceMotion, moonPose } = options;
  /** The programme timed to its track's map: a hold at a body may linger to meet a cue. */
  let timed = timedDrift(DRIFT, null);
  let timedWith: AudioMap | null = null;
  let drift: RigDrift;
  /** The shot last flown to: a shot's timeline is set once, as its flight begins. */
  let flownTo = -1;
  const visits = createDriftVisits<CloseUpBody>(rig, {
    ...options,
    settings: DRIFT.closeUp,
    shots: () => timed.shots,
    drift: () => drift,
    open: (body) => {
      const s = store.getState();
      if (!canCloseUp({ ...s, selection: body })) return false;
      s.select(body);
      s.enterCloseUp();
      return true;
    },
    /* Letting the selection go leaves the close-up too, and takes the body's marker with it. */
    letGo: () => store.getState().select(null),
    leave: () => {
      const s = store.getState();
      if (s.closeUp) s.leaveCloseUp(true);
    },
    /* Out to the largest moon toward the hold's end. */
    frame: (base, t) => {
      const swing = moonSwing(t, DRIFT.closeUp.moon);
      const moon = swing > 0 ? moonPose(base) : null;
      if (!moon) return base;
      return {
        azimuth: lerp(base.azimuth, moon.azimuth, swing),
        inclination: lerp(base.inclination, moon.inclination, swing),
        distance: Math.exp(lerp(Math.log(base.distance), Math.log(moon.distance), swing)),
      };
    },
  });

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
      { handoff: visits.handoff },
    );
  }
  build(audioMapNow(DRIFT.music?.track));

  return {
    /** How the drift's visits fly; the clock eases with them as well. */
    visitStyle: visits.style,
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
      const leaving = visits.step(state.drift);
      /* A map that arrived since retimes the drift, unless it is flying: that run keeps its timing. */
      const map = audioMapNow(DRIFT.music?.track);
      if (map !== timedWith && !drift.flying) build(map);
      drift.step(driftRunState(state.drift), dt, leaving);
      if (state.drift === "off") flownTo = -1;
      else if (drift.shot !== flownTo) {
        flownTo = drift.shot;
        const shot = timed.shots[flownTo];
        /* Under reduced motion the timeline stays the visitor's: the formation would not play. */
        if (shot && "timeline" in shot && shot.timeline && !reduceMotion.matches) {
          const s = store.getState();
          s.setYearsAgo(shot.timeline.yearsAgo);
          if (!s.playing) s.togglePlay();
        }
      }
    },
  };
}
