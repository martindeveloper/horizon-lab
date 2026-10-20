import { create } from "zustand";

import { driftSlice, type DriftSlice } from "@/lib/drift";
import {
  RESET_SCENE_SETTINGS,
  guideSlice,
  sceneSlice,
  type GuideSlice,
  type SceneSlice,
} from "@/lib/scene-store";
import { isPresentEra } from "@/space/solar-system/model/moment";
import { MODEL_START } from "@/space/solar-system/model/parameters";
import {
  hasSurface,
  selectionKey,
  type SolarSelection,
} from "@/space/solar-system/model/selection";
import { solarViewById, type SolarViewId } from "@/space/solar-system/model/views";
import type { SolarShow } from "@/space/solar-system/scene/kit";
import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { viewFromPath } from "../routing";
import { OLDEST } from "./model/timeline";
import { TOUR } from "./model/tour";
import { DEFAULT_VIEW } from "./model/views";

/** The solar system scene's switches, and rulers from the selection to the other bodies. */
export type Show = SolarShow & { distances: boolean };

export type Panel = "none" | "objects" | "view" | "reading";

const DEFAULT_SHOW: Show = {
  disk: true,
  kuiper: true,
  scattered: true,
  oort: true,
  ejected: true,
  plane: true,
  names: true,
  distances: false,
  trueSize: false,
  elliptical: true,
  drift: true,
};

export type OrreryStore = SceneSlice &
  GuideSlice<Show> &
  DriftSlice & {
    yearsAgo: number;
    playing: boolean;
    view: SolarViewId;
    selection: SolarSelection | null;
    /** The selected body fills the view at its true size; the engine flies in and out. */
    closeUp: boolean;
    /** Explicitly enabled illustrative prominences; reset on leaving the close-up. */
    solarActivity: boolean;
    solarActivityPaused: boolean;
    panel: Panel;
    show: Show;
    /* HUD readouts written by the engine a few times per second, besides the scale bar. */
    viewDist: number;
    driftRate: number;
    /** Years the Motion switch has advanced the real clock, published by the engine. */
    driftYears: number;
    setYearsAgo: (yearsAgo: number) => void;
    setYearsFromPlay: (yearsAgo: number) => void;
    togglePlay: () => void;
    replay: () => void;
    setView: (view: SolarViewId) => void;
    select: (selection: SolarSelection | null) => void;
    /** Flies to the selected body when it has a surface to look at. */
    enterCloseUp: () => void;
    leaveCloseUp: () => void;
    /** In a close-up, flies straight on to another body's (a moon of the same planet). */
    switchCloseUp: (selection: SolarSelection) => void;
    toggleSolarActivity: () => void;
    toggleSolarActivityPaused: () => void;
    patchShow: (patch: Partial<Show>) => void;
    /** The View panel's settings as a visit starts: layers, switches, distance unit, render quality. */
    resetView: () => void;
    setPanel: (panel: Panel) => void;
  };

/** Close-ups show today's surfaces, outside the guide. */
export function canCloseUp(s: Pick<OrreryStore, "selection" | "guideOpen" | "yearsAgo">) {
  return hasSurface(s.selection) && !s.guideOpen && isPresentEra(s.yearsAgo);
}

/** A close-up that only deep time rules out: the card shows it disabled, with why. */
export function closeUpAwaitsPresent(s: Pick<OrreryStore, "selection" | "guideOpen" | "yearsAgo">) {
  return hasSurface(s.selection) && !s.guideOpen && !isPresentEra(s.yearsAgo);
}

function sameSelection(a: SolarSelection | null, b: SolarSelection | null) {
  return !!a && !!b && selectionKey(a) === selectionKey(b);
}

const SUN_ACTIVITY_OFF = { solarActivity: false, solarActivityPaused: false };
const closeUpState = (closeUp: boolean) =>
  closeUp ? { closeUp } : { closeUp, ...SUN_ACTIVITY_OFF };

export const useOrrery = create<OrreryStore>((set, get) => ({
  ...sceneSlice(set, { scalePx: 120, scaleValue: 10, scaleUnit: "au" }),
  ...guideSlice(set, get, {
    tour: TOUR,
    /* The visitor's switches, given back when the tour ends. */
    save: (s) => s.show,
    restore: (show) => ({ show }),
    open: () => closeUpState(false),
    apply: (step, s) => ({
      view: step.view,
      viewDist: solarViewById(step.view).dist,
      yearsAgo: step.yearsAgo,
      playing: Boolean(step.playing) && !prefersReducedMotion(),
      /* Each step starts from the default layers; Motion keeps the visitor's choice. */
      show: { ...DEFAULT_SHOW, drift: (s.savedBeforeGuide ?? s.show).drift, ...step.show },
      selection: step.focus ?? null,
    }),
    close: () => ({ playing: false }),
  }),
  yearsAgo: 0,
  playing: false,
  view: typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath(),
  selection: null,
  closeUp: false,
  ...SUN_ACTIVITY_OFF,
  panel: "none",
  show: DEFAULT_SHOW,
  viewDist: 72,
  driftRate: 2.5,
  driftYears: 0,
  /* Close-up maps show today's surfaces, so leaving the present ends a close-up. */
  setYearsAgo: (yearsAgo) =>
    set((s) => ({
      yearsAgo,
      playing: false,
      ...closeUpState(s.closeUp && isPresentEra(yearsAgo)),
    })),
  setYearsFromPlay: (yearsAgo) =>
    set((s) => ({ yearsAgo, ...closeUpState(s.closeUp && isPresentEra(yearsAgo)) })),
  /** Pauses while playing; otherwise plays on, or from the start once the track has ended. */
  togglePlay: () =>
    set((s) =>
      s.playing
        ? { playing: false }
        : s.yearsAgo <= 0
          ? { yearsAgo: OLDEST, playing: true, ...closeUpState(false) }
          : { playing: true },
    ),
  replay: () =>
    set((s) => ({
      yearsAgo: MODEL_START,
      playing: true,
      view: "giants",
      viewDist: solarViewById("giants").dist,
      flight: s.flight + 1,
      panel: "none",
      ...closeUpState(false),
    })),
  setView: (view) => {
    const v = solarViewById(view);
    set((s) => ({
      view,
      viewDist: v.dist,
      flight: s.flight + 1,
      ...closeUpState(false),
    }));
  },
  /* Picking another body (or nothing) ends a close-up; the same body keeps it. */
  select: (selection) =>
    set((s) => ({
      selection,
      ...closeUpState(s.closeUp && sameSelection(s.selection, selection)),
    })),
  enterCloseUp: () => {
    const s = get();
    if (canCloseUp(s)) set({ closeUp: true, panel: "none", playing: false });
  },
  leaveCloseUp: () => set(closeUpState(false)),
  switchCloseUp: (selection) =>
    set((s) => (s.closeUp && canCloseUp({ ...s, selection }) ? { selection } : {})),
  toggleSolarActivity: () =>
    set((s) =>
      s.closeUp && s.selection?.kind === "sun" && canCloseUp(s)
        ? { solarActivity: !s.solarActivity, solarActivityPaused: false }
        : SUN_ACTIVITY_OFF,
    ),
  toggleSolarActivityPaused: () =>
    set((s) => (s.solarActivity ? { solarActivityPaused: !s.solarActivityPaused } : {})),
  patchShow: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),
  /* Motion starts off under reduced motion (the engine), so a reset keeps it off there. */
  resetView: () =>
    set({ show: { ...DEFAULT_SHOW, drift: !prefersReducedMotion() }, ...RESET_SCENE_SETTINGS }),
  setPanel: (panel) => set({ panel }),
  /* The drift (lib/drift.ts) leaves a close-up and the panel and ends the tour; the clock runs on. */
  ...driftSlice(set, get, {
    open: (s) => {
      if (s.guideOpen) s.endGuide();
      return { panel: "none" as const, selection: null, ...closeUpState(false) };
    },
  }),
}));
