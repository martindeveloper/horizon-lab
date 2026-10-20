"use client";

import { useEffect, useMemo, type ReactNode } from "react";

import type { DriftMusic, DriftProgramme, DriftSlice, DriftState } from "@/lib/drift";

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
};

/** A simulation's store as the drift reads it: a hook with a selector, and its state. */
export type DriftStore<S extends DriftSlice> = {
  <T>(selector: (state: S) => T): T;
  getState: () => S;
};

/**
 * The drift of a simulation, from its store and programme, for `SimulationImmersive`: its
 * state, its music, and the controls the immersive view calls. `caption` is the one readout
 * shown under them (the Orrery's clock), if the simulation has one.
 */
export function useSimulationDrift<S extends DriftSlice>(
  store: DriftStore<S>,
  programme: Pick<DriftProgramme<unknown>, "music">,
  caption?: ReactNode,
): SimulationDrift {
  const state = store((s) => s.drift);
  const controls = useMemo(
    () => ({
      onToggle: () => store.getState().toggleDrift(),
      onStop: () => store.getState().stopDrift(),
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
