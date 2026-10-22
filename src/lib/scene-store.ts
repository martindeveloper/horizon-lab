/**
 * What every zoomable scene's store holds besides its view and selection: the fields its
 * engine's bridge reads, the visitor's distance unit and the scale bar the HUD writes. Types
 * only from the toolkit's scene, so a store never pulls the renderer into the page.
 */
import type { OrbitTurn } from "@horizon/toolkit/camera";
import type { RenderQuality } from "@horizon/toolkit/rendering";
import type { SceneAntialias, ScaleReadout } from "@horizon/toolkit/scene";
import type { DistanceChoice } from "@horizon/toolkit/science";

/**
 * The render settings a simulation's settings panel offers (`RenderSection`): quality,
 * anti-aliasing (each renderer has its own modes), bloom, the lens and wide colour. A store
 * keeps the ones its renderer has.
 */
export type RenderFields<A = unknown> = {
  quality: RenderQuality;
  antialias: A;
  bloom: boolean;
  lens: boolean;
  wideColour: boolean;
};

/** A setter per kept setting: `setQuality`, `setAntialias`, … */
export type RenderSetters<T> = {
  [K in keyof T & string as `set${Capitalize<K>}`]: (value: T[K]) => void;
};

export type RenderSlice<T> = T & RenderSetters<T>;

export const LAB_RENDER = {
  quality: "standard",
  bloom: false,
  lens: false,
  wideColour: false,
} as const;
export const EXPERIENCE_RENDER = { ...LAB_RENDER, bloom: true, lens: true } as const;

/**
 * The settings a store keeps (`defaults`, the values a visit starts with and every reset
 * gives back) with a setter for each, the same in every simulation.
 */
export function renderSlice<T extends Partial<RenderFields>>(
  set: (patch: Partial<T>) => void,
  defaults: T,
): RenderSlice<T> {
  /* Each key is one of the defaults' own, so its patch holds for `T`. */
  const patch = (fields: object) => fields as Partial<T>;
  const setters = Object.fromEntries(
    Object.keys(defaults).map((key) => [
      `set${key[0]!.toUpperCase()}${key.slice(1)}`,
      (value: unknown) => set(patch({ [key]: value })),
    ]),
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a setter named `set<Key>` for each of the defaults' own keys is exactly `RenderSetters<T>`; TypeScript cannot follow the template-literal names through `Object.fromEntries`.
  return { ...defaults, ...setters } as RenderSlice<T>;
}

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

/**
 * The camera as its engine lends it to the store while the scene is up (`lendCamera` in
 * `scene-bridge.ts`): a way back to where it stands, and the moves a tour makes. Null before.
 */
export type SceneCamera = {
  /** Where the camera stands now, as a flight back there (a cut with reduced motion). */
  mark: () => () => void;
  /** Zooms by a factor of the distance (below 1 nearer), easing as the wheel does. */
  zoom: (factor: number) => void;
  /** Turns by button steps, as the camera pad does. */
  turn: (step: OrbitTurn) => void;
};

/** The camera's angles round its aim, whole degrees: heading 0–359, tilt the elevation above the map's plane. */
export type CameraAngles = { heading: number; tilt: number };

/**
 * A zoomable scene's render settings: anti-aliasing is null (the device's default) until the
 * engine publishes it; bloom brightens light, the lens spikes the brightest and fringes the
 * corners. Quality is read through `sceneQuality`.
 */
type SceneRender = Pick<
  RenderFields<SceneAntialias | null>,
  "quality" | "antialias" | "bloom" | "lens"
>;

export type SceneSlice = Omit<SceneStoreState, "view"> &
  ScaleReadout &
  RenderSlice<SceneRender> & {
    /** Written by the HUD with the scale bar, for the camera pad's readout. */
    cameraAngles: CameraAngles;
    camera: SceneCamera | null;
    /** The visitor's readout unit; `auto` picks au or ly by each distance's size. */
    distanceUnit: DistanceChoice;
    rotate: (turn: OrbitTurn) => void;
    setDistanceUnit: (unit: DistanceChoice) => void;
  };

type SceneSettings = SceneRender & Pick<SceneSlice, "distanceUnit">;

/** A lab's shared settings as a visit starts, for every `resetView`: the unit and the render settings. */
export const RESET_SCENE_SETTINGS: SceneSettings = {
  distanceUnit: "auto",
  antialias: null,
  quality: LAB_RENDER.quality,
  bloom: LAB_RENDER.bloom,
  lens: LAB_RENDER.lens,
};

export const EXPERIENCE_SCENE_SETTINGS: SceneSettings = {
  ...RESET_SCENE_SETTINGS,
  bloom: EXPERIENCE_RENDER.bloom,
  lens: EXPERIENCE_RENDER.lens,
};

/**
 * The shared fields at rest, with the scale bar's first reading and the visit's starting
 * settings (a lab's by default), and their actions.
 */
export function sceneSlice(
  set: (patch: Partial<SceneSlice>) => void,
  scale: ScaleReadout,
  settings = RESET_SCENE_SETTINGS,
): SceneSlice {
  const { distanceUnit, ...render } = settings;
  return {
    flight: 0,
    turn: null,
    ready: false,
    distanceUnit,
    ...renderSlice<SceneRender>(set, render),
    cameraAngles: { heading: 0, tilt: 0 },
    camera: null,
    ...scale,
    rotate: (turn) => set({ turn: { ...turn } }),
    setDistanceUnit: (unit) => set({ distanceUnit: unit }),
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
 * (`save`), closes the panel (where the store has one) and applies the first step; each step is `apply`'d within the
 * tour, and the step past the last ends the guide; ending it gives the settings back
 * (`restore`) and lets go of the selection, where the store has one (a card that follows the
 * view needs none). `open` and `close` add what else a simulation's guide sets as it starts
 * and ends. `tour` is the steps, or a function of the state that gives them, for a simulation
 * whose tour depends on what it shows.
 */
export function guideSlice<
  S extends GuideSlice<Saved> & { panel?: string; selection?: unknown },
  Step,
  Saved,
>(
  set: NoInfer<(patch: (state: S) => Partial<S>) => void>,
  get: () => S,
  guide: {
    tour: readonly Step[] | ((state: S) => readonly Step[]);
    save: (state: S) => Saved;
    restore: (saved: Saved) => Partial<S>;
    apply: (step: Step, state: S) => Partial<S>;
    open?: (state: S) => Partial<S>;
    close?: (state: S) => Partial<S>;
  },
): GuideSlice<Saved> {
  /* `panel: "none"` and `selection: null` hold in every store with a panel or a selection. */
  const patch = (fields: object) => fields as Partial<S>;
  const { tour } = guide;
  const stepsOf = typeof tour === "function" ? tour : () => tour;
  return {
    guideOpen: false,
    guideStep: 0,
    savedBeforeGuide: null,
    startGuide: () => {
      set((s) =>
        patch({
          guideOpen: true,
          savedBeforeGuide: s.savedBeforeGuide ?? guide.save(s),
          ...("panel" in s ? { panel: "none" } : {}),
          ...guide.open?.(s),
        }),
      );
      get().goGuide(0);
    },
    goGuide: (index) => {
      const step = stepsOf(get())[index];
      if (!get().guideOpen || index < 0) return;
      if (!step) return get().endGuide();
      set((s) => patch({ guideStep: index, ...guide.apply(step, s) }));
    },
    endGuide: () =>
      set((s) =>
        patch({
          guideOpen: false,
          guideStep: 0,
          ...("selection" in s ? { selection: null } : {}),
          ...(s.savedBeforeGuide === null ? {} : guide.restore(s.savedBeforeGuide)),
          savedBeforeGuide: null,
          ...guide.close?.(s),
        }),
      ),
  };
}
