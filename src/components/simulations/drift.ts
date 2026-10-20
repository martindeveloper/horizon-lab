"use client";

import { useEffect, useMemo, type ReactNode } from "react";

import { audioMapFor } from "@/lib/audio-maps";
import {
  DRIFT_LOADING,
  driftReady,
  type DriftMusic,
  type DriftProgramme,
  type DriftSlice,
  type DriftState,
} from "@/lib/drift";

import { MUSIC_LEVEL, ambientMusic } from "../shell/ambient-music";

/** Seconds the music takes to lift as a drift starts, and to settle back when it ends. */
const LIFT_SECONDS = 4;
const SETTLE_SECONDS = 3;

/** A simulation's drift, as its store holds it, for the immersive view to pause and stop. */
export type SimulationDrift = {
  state: DriftState;
  music?: DriftMusic | undefined;
  /** A short readout shown under the drift's controls (the Orrery's clock rate). */
  caption?: ReactNode;
  onToggle: () => void;
  onStop: () => void;
  /** The loader has gathered the drift's music and map: it may fly. */
  onReady: () => void;
};

/** A simulation's store as the drift's controls reach it: its state, read outside rendering. */
export type DriftStore<S extends DriftSlice> = { getState: () => S };

/**
 * The drift of a simulation, from its store and programme, for `SimulationImmersive`: its
 * state, its music, and the controls the immersive view calls. The caller selects `state` from
 * its own store hook (a hook passed in would be called dynamically, which the rules of hooks
 * forbid); `store` only serves the controls. `caption` is the one readout shown under them
 * (the Orrery's clock, Deep Field's distance), if the simulation has one.
 */
export function useSimulationDrift<S extends DriftSlice>(
  state: DriftState,
  store: DriftStore<S>,
  programme: Pick<DriftProgramme<unknown>, "music">,
  caption?: ReactNode,
): SimulationDrift {
  const controls = useMemo(
    () => ({
      onToggle: () => store.getState().toggleDrift(),
      onStop: () => store.getState().stopDrift(),
      onReady: () => store.getState().readyDrift(),
    }),
    [store],
  );
  return {
    state,
    ...controls,
    ...(programme.music !== undefined ? { music: programme.music } : {}),
    ...(caption !== undefined ? { caption } : {}),
  };
}

/**
 * The music's side of a drift: while `on`, the playlist holds on the programme's track (if it
 * names one the playlist has) and plays at the drift level; after, it runs on at the ambient
 * level. It never starts music the visitor has off.
 */
export function useDriftMusic(music: DriftMusic | undefined, on: boolean) {
  useEffect(() => {
    if (!on) return;
    const track = music?.track;
    const index =
      track === undefined ? -1 : ambientMusic.tracks.findIndex((t) => t.title === track);
    if (index >= 0) ambientMusic.hold(index);
    ambientMusic.setLevel(music?.level ?? MUSIC_LEVEL.drift, LIFT_SECONDS);
    return () => {
      ambientMusic.hold(null);
      ambientMusic.setLevel(MUSIC_LEVEL.ambient, SETTLE_SECONDS);
    };
  }, [on, music]);
}

/**
 * The loader's wait while a drift is `loading`: its track's audio map is fetched (a failure
 * counts as settled; the camera then keeps its written timing) and, when the music plays, the
 * held track must be audible (buffered and blended in). Then, after the loader's minimum and
 * never later than its timeout, the drift is told it is ready.
 */
export function useDriftReady(drift: SimulationDrift | undefined) {
  const loading = drift?.state === "loading";
  const music = drift?.music;
  const onReady = drift?.onReady;
  useEffect(() => {
    if (!loading || !onReady) return;
    const started = performance.now();
    const title = music?.track;
    const index =
      title === undefined ? -1 : ambientMusic.tracks.findIndex((t) => t.title === title);
    let map: "loading" | "settled" = "loading";
    let done = false;
    /* A staged piece begins at its first bar: a track already playing starts again behind the
       veil, and counts as audible once the blend into its intro has run. */
    const restarted =
      index >= 0 &&
      ambientMusic.getState() === "playing" &&
      ambientMusic.getTrack() === index &&
      ambientMusic.restart();
    /* The player blends to the held track within its skip fade; when it cannot (a loop
       crossfade is under way, and the hold waits for it), the music playing now is what plays. */
    const switchGrace = ambientMusic.skipFade + 1;
    const musicStatus = (elapsed: number) => {
      if (ambientMusic.getState() !== "playing") return "off";
      const held = index < 0 || ambientMusic.getTrack() === index;
      if (!held) return elapsed >= switchGrace ? "audible" : "buffering";
      if (restarted && elapsed < ambientMusic.skipFade + 0.5) return "buffering";
      return ambientMusic.getBuffering() ? "buffering" : "audible";
    };
    const check = () => {
      if (done) return;
      const elapsed = (performance.now() - started) / 1000;
      if (!driftReady({ map, music: musicStatus(elapsed), elapsed })) return;
      done = true;
      onReady();
    };
    void (title === undefined ? Promise.resolve(null) : audioMapFor(title)).then(() => {
      map = "settled";
      check();
    });
    const unsubscribe = ambientMusic.subscribe(check);
    const timers = [DRIFT_LOADING.minimum, switchGrace, DRIFT_LOADING.timeout].map((seconds) =>
      window.setTimeout(check, seconds * 1000 + 20),
    );
    check();
    return () => {
      done = true;
      unsubscribe();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [loading, music, onReady]);
}
