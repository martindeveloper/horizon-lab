import { create } from "zustand";

import { driftSlice, type DriftSlice } from "@/lib/drift";
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
import { referenceBody, type Reference } from "./model/compare";
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

/** The effects a drift shows off, as the visitor had them before it began. */
type DriftEffects = { focusBlur: boolean; bloom: boolean };

export type GiantsStore = GuideSlice<Saved> &
  RenderSlice<GiantsRender> &
  DriftSlice & {
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
     * Every body at once on a log scale (`overview.ts`), the camera kept where it was beneath;
     * any flight, the guide or the drift leaves it.
     */
    overview: boolean;
    setOverview: (on: boolean) => void;
    /**
     * The card of the body in focus, which follows it up and down the ladder: beside the stage
     * on wide screens, where it is open as a visit starts; a sheet over the dock on phones, where
     * the dock shows the key figures and the sheet opens on demand.
     */
    card: boolean;
    sheet: boolean;
    /** What the card measures the body in focus against, and the body picked for "other". */
    reference: Reference;
    otherBody: RungId;
    /**
     * The body in focus and the one it is measured against side by side at true scale
     * (`pair.ts`), the ladder kept beneath; any flight, the guide, the drift or the overview
     * leaves it.
     */
    sideBySide: boolean;
    setSideBySide: (on: boolean) => void;
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
    /** Flies to a body and opens its card: a body's name or dot was picked (from the overview, back down to it). */
    goTo: (id: RungId) => void;
    setReference: (reference: Reference) => void;
    /** Picks the body "other" names, and measures against it. */
    setOtherBody: (id: RungId) => void;
    setPanel: (panel: Panel) => void;
    setOrbits: (orbits: boolean) => void;
    setRuler: (ruler: Ruler) => void;
    /** The View panel's settings as a visit starts. */
    resetView: () => void;
    /** The engine's report that the guide's flight has arrived. */
    landGuide: () => void;
    toggleGuidePlaying: () => void;
    /** The visitor's effects while a drift shows its own; null with no drift. */
    effectsBeforeDrift: DriftEffects | null;
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

/** What a flight, the guide and the drift leave: the surface close-up, the overview, side by side. */
const LEAVE_MODES = { surfaceZoom: 1, overview: false, sideBySide: false } as const;

/** The body the one in focus is measured against (and stands beside, side by side), if any. */
export const comparedWith = (s: Pick<GiantsStore, "reference" | "focus" | "otherBody">) =>
  referenceBody(s.reference, RUNG_IDS[s.focus]!, s.otherBody);

const initialView: RungId = typeof window === "undefined" ? DEFAULT_RUNG : rungFromPath();
const initialIndex = rungIndex(initialView);

export const useGiants = create<GiantsStore>((set, get) => ({
  view: initialView,
  goal: initialIndex,
  flight: 0,
  place: initialIndex,
  focus: initialIndex,
  scale: 0,
  overview: false,
  card: true,
  sheet: false,
  reference: "sun",
  otherBody: "betelgeuse",
  sideBySide: false,
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
  setView: (view) => set({ view, goal: rungIndex(view), flight: nextFlight(), ...LEAVE_MODES }),
  go: (index) => set({ goal: clampIndex(index), flight: nextFlight(), ...LEAVE_MODES }),
  step: (by) => get().go(get().focus + by),
  publish: (place, focus, scale) => set({ place, focus, scale }),
  setOverview: (overview) => {
    if (overview && get().guideOpen) get().endGuide();
    if (overview) get().stopDrift();
    set({ overview, sideBySide: false, surfaceZoom: 1 });
  },
  setSideBySide: (sideBySide) => {
    if (sideBySide && !comparedWith(get())) return;
    if (sideBySide && get().guideOpen) get().endGuide();
    if (sideBySide) get().stopDrift();
    set({ sideBySide, overview: false, surfaceZoom: 1 });
  },
  setCard: (open) => set({ card: open, sheet: open }),
  goTo: (id) => {
    get().setCard(true);
    if (rungIndex(id) !== get().focus || get().overview) get().go(rungIndex(id));
  },
  setReference: (reference) => set({ reference }),
  setOtherBody: (otherBody) => set({ otherBody, reference: "other" }),
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
    open: () => ({ guidePlaying: !prefersReducedMotion(), ...LEAVE_MODES }),
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
  effectsBeforeDrift: null,
  /* The drift ends the guide, the overview and side by side, closes the panel and the card and flies the camera itself; as a
     show piece it turns the focus blur and bloom on, and gives the visitor's back as it ends. */
  ...driftSlice(set, get, {
    open: (s) => {
      if (s.guideOpen) s.endGuide();
      return {
        panel: "none" as const,
        card: false,
        sheet: false,
        ...LEAVE_MODES,
        effectsBeforeDrift: { focusBlur: s.focusBlur, bloom: s.bloom },
        focusBlur: true,
        bloom: true,
      };
    },
    close: (s) => ({ ...s.effectsBeforeDrift, effectsBeforeDrift: null }),
  }),
}));
