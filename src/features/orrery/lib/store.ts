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
import { TOUR } from "./model/tour";
import { DEFAULT_VIEW } from "./model/views";

/** The solar system scene's switches, and rulers from the selection to the other bodies. */
export type Show = SolarShow & { distances: boolean };

export type Panel = "none" | "objects" | "view" | "reading" | "moments";

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
};

/** What the guide gives back as it ends: the visitor's switches and whether time ran. */
type GuideSaved = { show: Show; playing: boolean };

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
  GuideSlice<GuideSaved> &
  HelpSlice<HelpSaved> &
  DriftSlice & {
    yearsAgo: number;
    /**
     * Time runs: history on to today, then the present on along today's orbits, faster than
     * real time. Paused, everything holds. The one clock control; a seek keeps it as it is.
     */
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
    /** Years playing has run the clock on from (or back to before) now, published by the engine. */
    driftYears: number;
    /** The clock set to a moment: years from now, negative for one gone by; stamped so the same offset can be asked again. */
    clock: { years: number; stamp: number } | null;
    setYearsAgo: (yearsAgo: number) => void;
    /** Sets the clock `years` from now (0: back to now), in the present era. */
    setClock: (years: number) => void;
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
    save: (s) => ({ show: s.show, playing: s.playing }),
    restore: (saved) => saved,
    open: () => closeUpState(null),
    apply: (step) => ({
      view: step.view,
      viewDist: solarViewById(step.view).dist,
      yearsAgo: step.yearsAgo,
      playing: Boolean(step.playing) && !prefersReducedMotion(),
      /* Each step starts from the default layers. */
      show: { ...DEFAULT_SHOW, ...step.show },
      selection: step.focus ?? null,
    }),
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
  /* Time runs from the start; the engine holds it under reduced motion. */
  playing: true,
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
  clock: null,
  setYearsAgo: (yearsAgo) => set((s) => atTime(s, yearsAgo)),
  setClock: (years) =>
    set((s) => ({
      ...atTime(s, 0),
      clock: { years, stamp: (s.clock?.stamp ?? 0) + 1 },
    })),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
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
      set({ closeUp: body, panel: "none" });
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
  resetView: () => set({ show: DEFAULT_SHOW, ...RESET_SCENE_SETTINGS }),
  setPanel: (panel) => set({ panel }),
  /* The drift (lib/drift.ts) leaves a close-up and the panel and ends the tour; the clock runs on. */
  ...driftSlice(set, get, {
    open: (s) => {
      if (s.guideOpen) s.endGuide();
      return { panel: "none" as const, selection: null, ...closeUpState(null) };
    },
  }),
}));
