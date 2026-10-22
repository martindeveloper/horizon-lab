import { create } from "zustand";

import {
  LAB_RENDER,
  guideSlice,
  renderSlice,
  type GuideSlice,
  type RenderFields,
  type RenderSlice,
} from "@/lib/scene-store";
import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { rungFromPath } from "../routing";
import type { Reference } from "./model/compare";
import type { SurfaceZoom } from "./model/inspection";
import type { Ruler } from "./model/ruler";
import { DEFAULT_RUNG, RUNG_IDS, rungIndex, type RungId } from "./model/rungs";
import { TOUR } from "./model/tour";
import type { GiantsAntialias } from "./quality";

type Panel = "none" | "stars" | "view";

/** What the guide gives back when it ends: where the visitor stood and their orbits switch. */
type Saved = { goal: number; orbits: boolean };

/** The render settings the View panel offers (`RenderSection`); bloom and wide colour are nothing while off. */
type GiantsRender = Pick<
  RenderFields<GiantsAntialias>,
  "quality" | "antialias" | "bloom" | "wideColour"
>;

type GiantsStore = GuideSlice<Saved> &
  RenderSlice<GiantsRender> & {
    /** The rung the address names; reaching the page or a link flies there. */
    view: RungId;
    /** The rung the camera heads for, and a count that changes with every flight asked for. */
    goal: number;
    flight: number;
    /** The camera's place on the ladder and the rung nearest it, as the engine last published them. */
    place: number;
    focus: number;
    /** Metres per CSS pixel at the camera's place, for the ruler. */
    scale: number;
    /**
     * The card of the body in focus, which follows it up and down the ladder: beside the stage
     * on wide screens, where it is open as a visit starts; a sheet over the dock on phones, where
     * the dock shows the key figures and the sheet opens on demand.
     */
    card: boolean;
    sheet: boolean;
    /** What the card measures the body in focus against. */
    reference: Reference;
    panel: Panel;
    /** The planets' orbits round the body in focus, as if it stood in the Sun's place. */
    orbits: boolean;
    ruler: Ruler;
    surfaceZoom: SurfaceZoom;
    setSurfaceZoom: (zoom: SurfaceZoom) => void;
    /** Optional presentation blur of neighbouring bodies; no physical depth implied. */
    focusBlur: boolean;
    setFocusBlur: (enabled: boolean) => void;
    /** The first frame is drawn. */
    ready: boolean;
    /** The guide moves on by itself once a step has been read; off under reduced motion. */
    guidePlaying: boolean;
    /** The step's flight has arrived. */
    guideLanded: boolean;
    setReady: (ready: boolean) => void;
    setView: (view: RungId) => void;
    /** Flies to a rung (clamped to the ladder). */
    go: (index: number) => void;
    /** Flies a number of rungs on from the one in focus. */
    step: (by: number) => void;
    /** The engine's report: the camera's place, the rung nearest it and the scale. */
    publish: (place: number, focus: number, scale: number) => void;
    /** Opens or closes the card: both its places, so a phone and a wide screen agree. */
    setCard: (open: boolean) => void;
    /** Flies to a body and opens its card: a body's name or dot was picked. */
    goTo: (id: RungId) => void;
    setReference: (reference: Reference) => void;
    setPanel: (panel: Panel) => void;
    setOrbits: (orbits: boolean) => void;
    setRuler: (ruler: Ruler) => void;
    /** The View panel's settings as a visit starts. */
    resetView: () => void;
    /** The engine's report that the guide's flight has arrived. */
    landGuide: () => void;
    toggleGuidePlaying: () => void;
  };

const LAST = RUNG_IDS.length - 1;
const clampIndex = (index: number) => Math.min(LAST, Math.max(0, Math.round(index)));

/** Every flight asked for gets a new number, so the engine flies again even to the same rung. */
let flights = 0;
const nextFlight = () => ++flights;

/** The render settings as a visit starts: a lab's, without anti-aliasing. */
const RENDER_DEFAULTS: GiantsRender = {
  quality: LAB_RENDER.quality,
  antialias: "off",
  bloom: LAB_RENDER.bloom,
  wideColour: LAB_RENDER.wideColour,
};

/** The View panel's settings as a visit starts; `resetView` puts them back. */
const VIEW_DEFAULTS = {
  orbits: false,
  ruler: "auto",
  surfaceZoom: 1,
  focusBlur: false,
  ...RENDER_DEFAULTS,
} as const satisfies Partial<GiantsStore>;

const initialView: RungId = typeof window === "undefined" ? DEFAULT_RUNG : rungFromPath();
const initialIndex = rungIndex(initialView);

export const useGiants = create<GiantsStore>((set, get) => ({
  view: initialView,
  goal: initialIndex,
  flight: 0,
  place: initialIndex,
  focus: initialIndex,
  scale: 0,
  card: true,
  sheet: false,
  reference: "sun",
  panel: "none",
  orbits: VIEW_DEFAULTS.orbits,
  ruler: VIEW_DEFAULTS.ruler,
  surfaceZoom: VIEW_DEFAULTS.surfaceZoom,
  focusBlur: VIEW_DEFAULTS.focusBlur,
  ...renderSlice(set, RENDER_DEFAULTS),
  ready: false,
  guidePlaying: false,
  guideLanded: false,
  setReady: (ready) => set({ ready }),
  setView: (view) => set({ view, goal: rungIndex(view), flight: nextFlight(), surfaceZoom: 1 }),
  go: (index) => set({ goal: clampIndex(index), flight: nextFlight(), surfaceZoom: 1 }),
  step: (by) => get().go(get().focus + by),
  publish: (place, focus, scale) => set({ place, focus, scale }),
  setCard: (open) => set({ card: open, sheet: open }),
  goTo: (id) => {
    get().setCard(true);
    if (rungIndex(id) !== get().focus) get().go(rungIndex(id));
  },
  setReference: (reference) => set({ reference }),
  setPanel: (panel) => set({ panel }),
  setOrbits: (orbits) => set({ orbits }),
  setRuler: (ruler) => set({ ruler }),
  setSurfaceZoom: (surfaceZoom) => set({ surfaceZoom }),
  setFocusBlur: (focusBlur) => set({ focusBlur }),
  resetView: () => set(VIEW_DEFAULTS),
  ...guideSlice(set, get, {
    tour: TOUR,
    save: (s) => ({ goal: s.focus, orbits: s.orbits }),
    restore: (saved) => ({ goal: saved.goal, orbits: saved.orbits, flight: nextFlight() }),
    open: () => ({ guidePlaying: !prefersReducedMotion(), surfaceZoom: 1 as const }),
    apply: (step) => ({
      goal: rungIndex(step.rung),
      flight: nextFlight(),
      orbits: step.orbits ?? false,
      guideLanded: false,
    }),
    close: () => ({ guideLanded: false }),
  }),
  landGuide: () => {
    if (get().guideOpen && !get().guideLanded) set({ guideLanded: true });
  },
  toggleGuidePlaying: () => set((s) => ({ guidePlaying: !s.guidePlaying })),
}));
