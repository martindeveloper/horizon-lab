/**
 * Deep Field's drift on its rig (the toolkit's rig drift): the programme's shots resolved to
 * the ladder's framings, timed to the track's map once that has loaded (the drift's loader
 * fetches it), flown while the store says the drift plays, and opened on the shot whose cue
 * the music is nearest. Its visits are handoffs to the shared visits (`@/space/drift-visits`):
 * the probe selected and its close-up opened, one dive in, a slow circle that drifts nearer,
 * and one pull away on the next shot's flight.
 */
import { ambientMusic } from "@/components/shell/ambient-music";
import { audioMapNow } from "@/lib/audio-maps";
import { driftRunState, openingFor, timedDrift } from "@/lib/drift";
import { createDriftVisits, type VisitFrame } from "@/space/drift-visits";
import type { ProbeId } from "@/space/solar-system/model/probes";
import type { AudioMap } from "@horizon/toolkit/audio";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { createRigDrift, type RigDrift } from "@horizon/toolkit/scene";

import { DRIFT } from "../drift";
import { canCloseUp, type useDeepField } from "../store";
import type { CameraRig } from "./camera-rig";

export function createDriftDirector(
  rig: CameraRig,
  store: typeof useDeepField,
  options: {
    reduceMotion: { matches: boolean };
    /** The probe close-up, as a visit drives it (`createProbeCloseUp`). */
    closeUp: {
      readonly current: VisitFrame | null;
      release: (landing: OrbitPose) => void;
      reclaim: () => void;
      end: () => void;
    };
  },
) {
  const { reduceMotion, closeUp } = options;
  /** The programme timed to its track's map: the hold at a probe may linger to meet a cue. */
  let timed = timedDrift(DRIFT, null);
  let timedWith: AudioMap | null = null;
  let drift: RigDrift;
  const visits = createDriftVisits<ProbeId>(rig, {
    settings: DRIFT.closeUp,
    reduceMotion,
    shots: () => timed.shots,
    drift: () => drift,
    open: (id) => {
      const selection = { kind: "reach", id } as const;
      const s = store.getState();
      if (!canCloseUp({ ...s, selection })) return false;
      s.select(selection);
      s.enterCloseUp();
      return true;
    },
    /* Letting the selection go leaves the close-up too, unless its flight out was released. */
    letGo: () => store.getState().select(null),
    leave: () => {
      const s = store.getState();
      if (s.closeUp) s.leaveCloseUp();
    },
    closeUp: () => closeUp.current,
    release: (landing) => closeUp.release(landing),
    reclaim: () => closeUp.reclaim(),
    finish: () => closeUp.end(),
  });

  /** The drift timed by `map`: a run on the rig, its shots framed by the ladder, its visits handed off. */
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
    /** How the drift's visits fly. */
    visitStyle: visits.style,
    /** Frames are needed while the drift plays. */
    get busy() {
      return store.getState().drift === "playing";
    },
    /** The viewer moved the camera: the drift waits for them. */
    takeOver() {
      store.getState().pauseDrift();
    },
    /** Call before the probe close-up and the rig step. */
    step(dt: number) {
      const state = store.getState();
      const leaving = visits.step(state.drift);
      /* A map that arrived since retimes the drift, unless it is flying: that run keeps its timing. */
      const map = audioMapNow(DRIFT.music?.track);
      if (map !== timedWith && !drift.flying) build(map);
      drift.step(driftRunState(state.drift), dt, leaving);
    },
  };
}
