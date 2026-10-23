import { create } from "zustand";

import { driftSlice, type DriftSlice } from "@/lib/drift";
import { helpSlice, type HelpSlice } from "@/lib/help";
import {
  LAB_RENDER,
  RESET_SCENE_SETTINGS,
  guideSlice,
  sceneSlice,
  type GuideSlice,
  type SceneSlice,
} from "@/lib/scene-store";
import { MAP_EPOCH } from "@/space/sun/frame";
import { cyclePhaseAt, decimalYear } from "@/space/sun/model/cycle";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { clamp01 } from "@horizon/toolkit/math";

import { viewFromPath } from "../routing";
import { HELP } from "./help";
import type { ClockRate } from "./model/clock";
import { lightDraws } from "./model/drawn";
import type { LightId } from "./model/lights";
import { PLACES, type PlaceId } from "./model/places";
import { TOUR } from "./model/tour";
import { DEFAULT_VIEW, VIEW_DEFAULTS, initialViewState, type ViewId } from "./model/views";

type Panel = "none" | "places" | "view" | "record";

/** What the View panel switches on the scene. */
export type Show = {
  /** Magnetic field lines over the surface and the loops of the corona. */
  fieldLines: boolean;
  names: boolean;
  /** Latitude and longitude lines on the globe. */
  grid: boolean;
};

/** What the guide gives back when it ends: where the visitor stood and how they saw it. */
type Saved = {
  view: ViewId;
  light: LightId;
  clock: ClockRate;
  cut: number;
  eruption: number;
  show: Show;
};

/** What the `?` tour gives back besides the guide's: the clock's pause and the eruption's play. */
type HelpSaved = Saved & { paused: boolean; eruptionPlaying: boolean };

/** What a drift sets for its show, as the visitor had it before it began: bloom, and the clock. */
type DriftEffects = { bloom: boolean; clock: ClockRate };

/**
 * The drift's clock: a minute of the Sun each second, so granules boil, spicules flick and
 * loops drain while the features its shots frame stay where they were framed.
 */
const DRIFT_CLOCK: ClockRate = "minute";

const DEFAULT_SHOW: Show = { fieldLines: true, names: true, grid: false };

export type SunStore = SceneSlice &
  GuideSlice<Saved> &
  HelpSlice<HelpSaved> &
  DriftSlice & {
    view: ViewId;
    light: LightId;
    clock: ClockRate;
    /** The clock stands still. */
    paused: boolean;
    /** The wedge cut: 0 closed, 1 a quarter open. */
    cut: number;
    /** The eruption's moment, 0–1, and whether it plays on by itself. */
    eruption: number;
    eruptionPlaying: boolean;
    /** The activity cycle's phase, 0–1 from minimum to minimum: a visit opens at the map's epoch, the clock carries it on (the scene writes it back) and the dock sets it. */
    cyclePhase: number;
    show: Show;
    /** The canvas in Display P3, where the screen shows it; nothing while off. */
    wideColour: boolean;
    setWideColour: (wideColour: boolean) => void;
    selection: PlaceId | null;
    /** Parker Solar Probe at its true size (`canCloseUp`). */
    closeUp: boolean;
    /** In the close-up, riding behind the heat shield toward the Sun rather than facing it. */
    ride: boolean;
    enterCloseUp: () => void;
    /** Parker's close-up straight into the ride, from anywhere it may begin. */
    rideParker: () => void;
    setRide: (ride: boolean) => void;
    leaveCloseUp: () => void;
    panel: Panel;
    /* Readouts the engine writes a few times a second. */
    /** The Sun's time since the visit began, model seconds, and the moment the scene shows, ms since 1970. */
    elapsed: number;
    moment: number;
    /** The eruption's flare class while one is under way (an empty string otherwise). */
    flareClass: string;
    /** The decimal year the cycle's phase stands at, as the scene counts it. */
    cycleYear: number;
    /** The cycle is the Sun's own, so the photograph's groups are on the disc; false once the visitor has moved it. */
    photographed: boolean;
    /** Detail the view would show (the map's, Parker's model) is still on its way. */
    sharpening: boolean;
    setView: (view: ViewId) => void;
    setLight: (light: LightId) => void;
    setClock: (clock: ClockRate) => void;
    togglePaused: () => void;
    setCut: (cut: number) => void;
    setEruption: (eruption: number) => void;
    toggleEruptionPlaying: () => void;
    setCyclePhase: (phase: number) => void;
    patchShow: (patch: Partial<Show>) => void;
    select: (selection: PlaceId | null) => void;
    /** Shows a place: its view (the camera flies only when that changes), its light and clock, and its card. */
    goTo: (id: PlaceId) => void;
    setPanel: (panel: Panel) => void;
    /** The scene's report. */
    publish: (
      report: Pick<
        SunStore,
        "elapsed" | "moment" | "flareClass" | "cyclePhase" | "cycleYear" | "photographed"
      >,
    ) => void;
    /** The View panel's settings as a visit starts. */
    resetView: () => void;
    /** The guided journey moves on by itself once a step has been read; off under reduced motion. */
    guidePlaying: boolean;
    /** The step's flight has arrived (written by the scene). */
    guideLanded: boolean;
    toggleGuidePlaying: () => void;
    landGuide: () => void;
    /** The visitor's effects while a drift shows its own; null with no drift. */
    effectsBeforeDrift: DriftEffects | null;
  };

/** Parker's card offers its close-up while neither the journey nor the drift holds the camera. */
export const canCloseUp = (s: Pick<SunStore, "selection" | "guideOpen" | "drift">) =>
  s.selection === "parker" && !s.guideOpen && s.drift === "off";

/** Parker can be ridden whenever its card could offer the close-up. */
export const canRide = (s: Pick<SunStore, "guideOpen" | "drift">) =>
  canCloseUp({ ...s, selection: "parker" });

/** The View panel's settings as a visit starts; `resetView` puts them back. */
const VIEW_SETTINGS = {
  show: DEFAULT_SHOW,
  wideColour: LAB_RENDER.wideColour,
  ...RESET_SCENE_SETTINGS,
} as const;

const initialView: ViewId = typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath();

export const useSun = create<SunStore>((set, get) => ({
  /* The Sun draws no scale bar: its slice's reading stays empty. */
  ...sceneSlice(set, { scalePx: 0, scaleValue: 0, scaleUnit: "au" }),
  view: initialView,
  ...initialViewState(initialView),
  paused: false,
  eruption: 0,
  cyclePhase: cyclePhaseAt(MAP_EPOCH),
  show: DEFAULT_SHOW,
  wideColour: VIEW_SETTINGS.wideColour,
  setWideColour: (wideColour) => set({ wideColour }),
  selection: null,
  closeUp: false,
  ride: false,
  enterCloseUp: () => {
    if (canCloseUp(get())) set({ closeUp: true, ride: false, panel: "none" });
  },
  rideParker: () => {
    if (canRide(get())) set({ selection: "parker", closeUp: true, ride: true, panel: "none" });
  },
  setRide: (ride) => set({ ride }),
  leaveCloseUp: () => set({ closeUp: false }),
  panel: "none",
  elapsed: 0,
  moment: MAP_EPOCH,
  flareClass: "",
  cycleYear: decimalYear(MAP_EPOCH),
  photographed: true,
  sharpening: false,
  /* A view opens with its own light and clock; the cut opens inside and closes elsewhere, as
     the record does outside the cycle. */
  setView: (view) =>
    set((s) => ({
      view,
      flight: s.flight + 1,
      closeUp: false,
      panel: s.panel === "record" && view !== "cycle" ? "none" : s.panel,
      ...initialViewState(view),
    })),
  setLight: (light) => set({ light }),
  setClock: (clock) => set({ clock, paused: false }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setCut: (cut) => set({ cut: clamp01(cut) }),
  setEruption: (eruption) => set({ eruption: clamp01(eruption), eruptionPlaying: false }),
  toggleEruptionPlaying: () =>
    set((s) => ({
      eruptionPlaying: !s.eruptionPlaying,
      /* Playing from the end starts over. */
      eruption: !s.eruptionPlaying && s.eruption >= 1 ? 0 : s.eruption,
    })),
  setCyclePhase: (phase) => set({ cyclePhase: clamp01(phase) }),
  patchShow: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),
  /* Another selection lets go of the close-up. */
  select: (selection) => set((s) => ({ selection, closeUp: s.closeUp && selection === "parker" })),
  goTo: (id) => {
    const place = PLACES[id];
    const s = get();
    if (place.view !== s.view) s.setView(place.view);
    set((now) => ({
      selection: id,
      closeUp: now.closeUp && id === "parker",
      panel: "none",
      /* The light in use, unless it does not draw the place. */
      light: place.light && !lightDraws(id, now.light) ? place.light : now.light,
      clock: place.clock ?? now.clock,
      cut: place.cut ?? now.cut,
      ...(place.eruption === undefined ? {} : { eruption: place.eruption, eruptionPlaying: false }),
    }));
  },
  setPanel: (panel) => set({ panel }),
  publish: (report) => set(report),
  resetView: () => set(VIEW_SETTINGS),
  ...guideSlice(set, get, {
    tour: TOUR,
    save: (s) => ({
      view: s.view,
      light: s.light,
      clock: s.clock,
      cut: s.cut,
      eruption: s.eruption,
      show: s.show,
    }),
    restore: (saved) => ({ ...saved, flight: get().flight + 1, eruptionPlaying: false }),
    open: () => ({ guidePlaying: !prefersReducedMotion(), paused: false, closeUp: false }),
    apply: (step, s) => ({
      guideLanded: false,
      view: step.view,
      flight: s.flight + 1,
      light: step.light ?? VIEW_DEFAULTS[step.view].light,
      clock: step.clock ?? VIEW_DEFAULTS[step.view].clock,
      cut: step.cut ?? 0,
      ...(step.eruption === undefined
        ? { eruptionPlaying: false }
        : { eruption: step.eruption, eruptionPlaying: true }),
      selection: step.place ?? null,
    }),
    close: () => ({ guideLanded: false }),
  }),
  ...helpSlice(set, get, {
    steps: HELP,
    save: (s) => ({
      view: s.view,
      light: s.light,
      clock: s.clock,
      paused: s.paused,
      cut: s.cut,
      eruption: s.eruption,
      eruptionPlaying: s.eruptionPlaying,
      show: s.show,
    }),
    restore: (saved) => saved,
  }),
  guidePlaying: false,
  guideLanded: false,
  toggleGuidePlaying: () => set((s) => ({ guidePlaying: !s.guidePlaying })),
  landGuide: () => {
    if (get().guideOpen && !get().guideLanded) set({ guideLanded: true });
  },
  effectsBeforeDrift: null,
  /* The drift ends the guide, closes the panel and the card and flies the camera itself; as a
     show piece it turns bloom on and runs its own clock, and gives the visitor's back as it ends. */
  ...driftSlice(set, get, {
    open: (s) => {
      if (s.guideOpen) s.endGuide();
      return {
        panel: "none" as const,
        selection: null,
        closeUp: false,
        paused: false,
        effectsBeforeDrift: { bloom: s.bloom, clock: s.clock },
        bloom: true,
        clock: DRIFT_CLOCK,
      };
    },
    close: (s) => ({ ...s.effectsBeforeDrift, effectsBeforeDrift: null }),
  }),
}));
