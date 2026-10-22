import { create } from "zustand";

import { driftSlice, type DriftSlice } from "@/lib/drift";
import { helpSlice, type HelpSlice } from "@/lib/help";
import {
  RESET_SCENE_SETTINGS,
  guideSlice,
  sceneSlice,
  type GuideSlice,
  type SceneSlice,
} from "@/lib/scene-store";
import { isPresentEra } from "@/space/solar-system/model/moment";
import {
  isObservatorySelection,
  type ObservatoryId,
} from "@/space/solar-system/model/observatories";
import { MODEL_START } from "@/space/solar-system/model/parameters";
import { solarViewById, type SolarViewId } from "@/space/solar-system/model/views";
import type { SolarShow } from "@/space/solar-system/scene/kit";
import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { viewFromPath } from "../routing";
import { HELP } from "./help";
import {
  EARTH,
  canFlyTo,
  orreryKey,
  sameSystem,
  upFrom,
  type CloseUpSelection,
  type OrrerySelection,
} from "./model/selection";
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
  faintRings: false,
  elliptical: true,
  drift: true,
};

/** What the `?` tour's steps change and give back: the view, the clock, a close-up, the switches. */
type HelpSaved = {
  view: SolarViewId;
  viewDist: number;
  yearsAgo: number;
  playing: boolean;
  closeUp: CloseUpSelection | null;
  solarActivity: boolean;
  solarActivityPaused: boolean;
  show: Show;
};

export type OrreryStore = SceneSlice &
  GuideSlice<Show> &
  HelpSlice<HelpSaved> &
  DriftSlice & {
    yearsAgo: number;
    playing: boolean;
    view: SolarViewId;
    selection: OrrerySelection | null;
    /**
     * The body (or observatory) filling the view at its true size, or null on the map; the
     * engine flies in and out. The card may show another of its system (the Moon from the
     * Earth's).
     */
    closeUp: CloseUpSelection | null;
    /** Explicitly enabled illustrative prominences; reset on leaving the close-up. */
    solarActivity: boolean;
    solarActivityPaused: boolean;
    panel: Panel;
    show: Show;
    /* HUD readouts written by the engine a few times per second, besides the scale bar. */
    viewDist: number;
    driftRate: number;
    /** An observatory is near enough to show at its true size and its model is on its way. */
    sharpening: boolean;
    /** Years the Motion switch has advanced the real clock, published by the engine. */
    driftYears: number;
    setYearsAgo: (yearsAgo: number) => void;
    setYearsFromPlay: (yearsAgo: number) => void;
    togglePlay: () => void;
    replay: () => void;
    setView: (view: SolarViewId) => void;
    select: (selection: OrrerySelection | null) => void;
    /** Flies to the selected body when it has a surface to look at, or to an observatory. */
    enterCloseUp: () => void;
    /**
     * Back up a level: from a moon or an observatory to its planet's close-up, from a planet to
     * the map; `toMap` all the way.
     */
    leaveCloseUp: (toMap?: boolean) => void;
    /** An observatory's card, from Earth's close-up, where its orbit shows; today, as they exist only now. */
    findObservatory: (id: ObservatoryId) => void;
    toggleSolarActivity: () => void;
    toggleSolarActivityPaused: () => void;
    patchShow: (patch: Partial<Show>) => void;
    /** The View panel's settings as a visit starts: layers, switches, distance unit, render quality. */
    resetView: () => void;
    setPanel: (panel: Panel) => void;
  };

/** Close-ups show today's surfaces and observatories, outside the guide. */
export function canCloseUp(s: Pick<OrreryStore, "selection" | "guideOpen" | "yearsAgo">) {
  return canFlyTo(s.selection) && !s.guideOpen && isPresentEra(s.yearsAgo);
}

/** A close-up that only deep time rules out: the card shows it disabled, with why. */
export function closeUpAwaitsPresent(s: Pick<OrreryStore, "selection" | "guideOpen" | "yearsAgo">) {
  return canFlyTo(s.selection) && !s.guideOpen && !isPresentEra(s.yearsAgo);
}

function sameSelection(a: OrrerySelection | null, b: OrrerySelection | null) {
  return !!a && !!b && orreryKey(a) === orreryKey(b);
}

const SUN_ACTIVITY_OFF = { solarActivity: false, solarActivityPaused: false };
const closeUpState = (closeUp: CloseUpSelection | null) =>
  closeUp ? { closeUp } : { closeUp, ...SUN_ACTIVITY_OFF };

/**
 * The clock at `yearsAgo`: close-ups show today's surfaces and the observatories exist only
 * now, so leaving the present ends a close-up and lets an observatory go.
 */
const atTime = (s: Pick<OrreryStore, "selection" | "closeUp">, yearsAgo: number) => {
  const today = isPresentEra(yearsAgo);
  return {
    yearsAgo,
    ...closeUpState(today ? s.closeUp : null),
    ...(today || !isObservatorySelection(s.selection) ? {} : { selection: null }),
  };
};

export const useOrrery = create<OrreryStore>((set, get) => ({
  ...sceneSlice(set, { scalePx: 120, scaleValue: 10, scaleUnit: "au" }),
  ...guideSlice(set, get, {
    tour: TOUR,
    /* The visitor's switches, given back when the tour ends. */
    save: (s) => s.show,
    restore: (show) => ({ show }),
    open: () => closeUpState(null),
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
  ...helpSlice(set, get, {
    steps: HELP,
    save: (s) => ({
      view: s.view,
      viewDist: s.viewDist,
      yearsAgo: s.yearsAgo,
      playing: s.playing,
      closeUp: s.closeUp,
      solarActivity: s.solarActivity,
      solarActivityPaused: s.solarActivityPaused,
      show: s.show,
    }),
    restore: (saved) => saved,
  }),
  yearsAgo: 0,
  playing: false,
  view: typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath(),
  selection: null,
  closeUp: null,
  ...SUN_ACTIVITY_OFF,
  panel: "none",
  show: DEFAULT_SHOW,
  viewDist: 72,
  driftRate: 2.5,
  sharpening: false,
  driftYears: 0,
  setYearsAgo: (yearsAgo) => set((s) => ({ ...atTime(s, yearsAgo), playing: false })),
  setYearsFromPlay: (yearsAgo) => set((s) => atTime(s, yearsAgo)),
  /** Pauses while playing; otherwise plays on, or from the start once the track has ended. */
  togglePlay: () =>
    set((s) =>
      s.playing
        ? { playing: false }
        : s.yearsAgo <= 0
          ? { ...atTime(s, OLDEST), playing: true }
          : { playing: true },
    ),
  replay: () =>
    set((s) => ({
      ...atTime(s, MODEL_START),
      playing: true,
      view: "giants",
      viewDist: solarViewById("giants").dist,
      flight: s.flight + 1,
      panel: "none",
    })),
  setView: (view) => {
    const v = solarViewById(view);
    set((s) => ({
      view,
      viewDist: v.dist,
      flight: s.flight + 1,
      ...closeUpState(null),
    }));
  },
  /* A close-up stays while the card shows its own system (the Moon from the Earth's); picking
     anything else, or nothing, ends it. */
  select: (selection) =>
    set((s) => ({
      selection,
      ...closeUpState(
        s.closeUp && selection && sameSystem(s.closeUp, selection) ? s.closeUp : null,
      ),
    })),
  enterCloseUp: () => {
    const s = get();
    const body = s.selection;
    if (canFlyTo(body) && canCloseUp(s) && !sameSelection(s.closeUp, body))
      set({ closeUp: body, panel: "none", playing: false });
  },
  leaveCloseUp: (toMap = false) =>
    set((s) => {
      const up = !toMap && s.closeUp ? upFrom(s.closeUp) : null;
      return up ? { selection: up, closeUp: up } : closeUpState(null);
    }),
  findObservatory: (id) => {
    const api = get();
    if (!isPresentEra(api.yearsAgo)) api.setYearsAgo(0);
    api.select(EARTH);
    api.enterCloseUp();
    api.select({ kind: "observatory", id });
  },
  toggleSolarActivity: () =>
    set((s) =>
      s.closeUp?.kind === "sun" && canCloseUp(s)
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
      return { panel: "none" as const, selection: null, ...closeUpState(null) };
    },
  }),
}));
