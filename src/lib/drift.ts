/**
 * Drift: the lean-back mode. The scene enters immersive view, the music lifts (and may change
 * to the simulation's own track), and the camera flies itself from shot to shot until the
 * visitor takes it, pauses it or leaves. Each simulation describes its drift in
 * `src/features/<slug>/lib/drift.ts` as a `DriftProgramme`; the shared pieces here hold the
 * state every store carries and the shape of that programme. No React, no renderer.
 */
import type { DriftSettings } from "@horizon/toolkit/camera";

export type DriftState = "off" | "playing" | "paused";

/** What the music does while a drift is on. */
export type DriftMusic = {
  /** The ambient playlist track (by title) the drift holds on; the playlist runs on without it. */
  track?: string;
  /** Level 0..1 while drifting; the drift level by default. */
  level?: number;
};

/** A simulation's drift: its music, the camera's pace and spread, and the shots it flies. */
export type DriftProgramme<Shot> = {
  music?: DriftMusic;
  camera: Partial<Omit<DriftSettings, "random" | "reduceMotion">>;
  shots: readonly Shot[];
};

export type DriftSlice = {
  drift: DriftState;
  /** Begins the drift: the camera flies from where it is. */
  startDrift: () => void;
  /** The camera is the visitor's for now; the music stays. */
  pauseDrift: () => void;
  /** Flies on from wherever the camera is. */
  resumeDrift: () => void;
  toggleDrift: () => void;
  stopDrift: () => void;
};

/**
 * The drift's machine, the same in every simulation: `open` clears what stands in the way as
 * the drift starts (a guide, panels, a close-up) and may call the store's own actions; `close`
 * sets things back when the drift ends. Both run before the drift's own state is written.
 */
export function driftSlice<S extends DriftSlice>(
  set: NoInfer<(patch: (state: S) => Partial<S>) => void>,
  get: () => S,
  hooks: {
    open?: (state: S) => Partial<S>;
    close?: (state: S) => Partial<S>;
  } = {},
): DriftSlice {
  const patch = (fields: object) => fields as Partial<S>;
  return {
    drift: "off",
    startDrift: () => {
      if (get().drift !== "off") return;
      const opened = hooks.open?.(get());
      set(() => patch({ drift: "playing", ...opened }));
    },
    pauseDrift: () => {
      if (get().drift === "playing") set(() => patch({ drift: "paused" }));
    },
    resumeDrift: () => {
      if (get().drift === "paused") set(() => patch({ drift: "playing" }));
    },
    toggleDrift: () => {
      const s = get();
      if (s.drift === "playing") s.pauseDrift();
      else if (s.drift === "paused") s.resumeDrift();
    },
    stopDrift: () => {
      if (get().drift === "off") return;
      const closed = hooks.close?.(get());
      set(() => patch({ drift: "off", ...closed }));
    },
  };
}
