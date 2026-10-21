/**
 * Deep Field's drift on its rig (the toolkit's rig drift): the programme's shots resolved to
 * the ladder's framings, timed to the track's map once that has loaded (the drift's loader
 * fetches it), flown while the store says the drift plays, and opened on the shot whose cue
 * the music is nearest.
 */
import { ambientMusic } from "@/components/shell/ambient-music";
import { audioMapNow } from "@/lib/audio-maps";
import { driftRunState, openingFor, timedDrift } from "@/lib/drift";
import type { AudioMap } from "@horizon/toolkit/audio";
import { createRigDrift, type RigDrift } from "@horizon/toolkit/scene";

import { DRIFT } from "../drift";
import type { useDeepField } from "../store";
import type { CameraRig } from "./camera-rig";

export function createDriftDirector(
  rig: CameraRig,
  store: typeof useDeepField,
  reduceMotion: { matches: boolean },
) {
  let timedWith: AudioMap | null = null;
  let drift: RigDrift;
  /** The drift timed by `map`: a run on the rig, its shots framed by the ladder. */
  function build(map: AudioMap | null) {
    const timed = timedDrift(DRIFT, map);
    timedWith = map;
    drift = createRigDrift(
      rig,
      timed.shots.map(({ view, pose, ...shot }) => ({ ...rig.framing(view), ...pose, ...shot })),
      {
        ...DRIFT.camera,
        /* The drift's curtain covers a fresh start: the camera cuts to the opening shot. */
        cut: true,
        reduceMotion,
        opening: () => openingFor(timed, ambientMusic.position),
      },
    );
  }
  build(audioMapNow(DRIFT.music?.track));
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
      /* A map that arrived since retimes the drift, unless it is flying: that run keeps its timing. */
      const map = audioMapNow(DRIFT.music?.track);
      if (map !== timedWith && !drift.flying) build(map);
      drift.step(driftRunState(store.getState().drift), dt);
    },
  };
}
