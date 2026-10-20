/**
 * What every zoomable scene's store holds besides its view and selection: the fields its
 * engine's bridge reads, the visitor's distance unit and the scale bar the HUD writes. Types
 * only from the toolkit's scene, so a store never pulls the renderer into the page.
 */
import type { OrbitTurn } from "@horizon/toolkit/camera";
import type { RenderQuality } from "@horizon/toolkit/rendering";
import type { SceneAntialias, ScaleReadout } from "@horizon/toolkit/scene";
import type { DistanceChoice } from "@horizon/toolkit/science";

/** What the engine's bridge reads of a simulation's store. */
export type SceneStoreState = {
  view: unknown;
  /** Bumps whenever the camera should fly to the view again. */
  flight: number;
  /** The latest button step for the camera; a new object each time. */
  turn: OrbitTurn | null;
  ready: boolean;
  setReady: (ready: boolean) => void;
};

/** The camera's angles round its aim, whole degrees: heading 0–359, tilt the elevation above the map's plane. */
export type CameraAngles = { heading: number; tilt: number };

export type SceneSlice = Omit<SceneStoreState, "view"> &
  ScaleReadout & {
    /** Written by the HUD with the scale bar, for the camera pad's readout. */
    cameraAngles: CameraAngles;
    /** The visitor's readout unit; `auto` picks au or ly by each distance's size. */
    distanceUnit: DistanceChoice;
    /** The visitor's anti-aliasing, for this visit; null (the device's default) until the engine publishes it. */
    antialias: SceneAntialias | null;
    /** The visitor's render quality (`sceneQuality`), for this visit. */
    quality: RenderQuality;
    rotate: (turn: OrbitTurn) => void;
    setDistanceUnit: (unit: DistanceChoice) => void;
    setAntialias: (mode: SceneAntialias) => void;
    setQuality: (quality: RenderQuality) => void;
  };

/** The shared settings as a visit starts, for every `resetView`: the unit, anti-aliasing and quality. */
export const RESET_SCENE_SETTINGS: Pick<SceneSlice, "distanceUnit" | "antialias" | "quality"> = {
  distanceUnit: "auto",
  antialias: null,
  quality: "standard",
};

/** The shared fields at rest, with the scale bar's first reading, and their actions. */
export function sceneSlice(
  set: (patch: Partial<SceneSlice>) => void,
  scale: ScaleReadout,
): SceneSlice {
  return {
    flight: 0,
    turn: null,
    ready: false,
    distanceUnit: "auto",
    antialias: null,
    quality: "standard",
    cameraAngles: { heading: 0, tilt: 0 },
    ...scale,
    rotate: (turn) => set({ turn: { ...turn } }),
    setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
    setAntialias: (antialias) => set({ antialias }),
    setQuality: (quality) => set({ quality }),
    setReady: (ready) => set({ ready }),
  };
}

/** Something open beside the scene: a panel, or a card for the selection. */
export const asideOpen = (s: { panel: string; selection: unknown }) =>
  s.panel !== "none" || s.selection !== null;

/** A simulation's stepped guide, and the visitor's own settings it gives back when it ends. */
export type GuideSlice<Saved> = {
  guideOpen: boolean;
  guideStep: number;
  /** What the visitor had before the guide, given back when it ends; kept across its steps. */
  savedBeforeGuide: Saved | null;
  startGuide: () => void;
  /** Applies a step; past the last one the guide ends. */
  goGuide: (step: number) => void;
  endGuide: () => void;
};

/**
 * The guide's machine, the same in every simulation: starting it keeps the visitor's settings
 * (`save`), closes the panel and applies the first step; each step is `apply`'d within the
 * tour, and the step past the last ends the guide; ending it gives the settings back
 * (`restore`) and lets go of the selection. `open` and `close` add what else a simulation's
 * guide sets as it starts and ends.
 */
export function guideSlice<
  S extends GuideSlice<Saved> & { panel: string; selection: unknown },
  Step,
  Saved,
>(
  set: NoInfer<(patch: (state: S) => Partial<S>) => void>,
  get: () => S,
  guide: {
    tour: readonly Step[];
    save: (state: S) => Saved;
    restore: (saved: Saved) => Partial<S>;
    apply: (step: Step, state: S) => Partial<S>;
    open?: (state: S) => Partial<S>;
    close?: (state: S) => Partial<S>;
  },
): GuideSlice<Saved> {
  /* `panel: "none"` and `selection: null` hold in every store with a panel and a selection. */
  const patch = (fields: object) => fields as Partial<S>;
  return {
    guideOpen: false,
    guideStep: 0,
    savedBeforeGuide: null,
    startGuide: () => {
      set((s) =>
        patch({
          guideOpen: true,
          savedBeforeGuide: s.savedBeforeGuide ?? guide.save(s),
          panel: "none",
          ...guide.open?.(s),
        }),
      );
      get().goGuide(0);
    },
    goGuide: (index) => {
      const step = guide.tour[index];
      if (!get().guideOpen || index < 0) return;
      if (!step) return get().endGuide();
      set((s) => patch({ guideStep: index, ...guide.apply(step, s) }));
    },
    endGuide: () =>
      set((s) =>
        patch({
          guideOpen: false,
          guideStep: 0,
          selection: null,
          ...(s.savedBeforeGuide === null ? {} : guide.restore(s.savedBeforeGuide)),
          savedBeforeGuide: null,
          ...guide.close?.(s),
        }),
      ),
  };
}
