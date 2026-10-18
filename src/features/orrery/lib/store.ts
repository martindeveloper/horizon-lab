import { create } from "zustand";

import type { NamedId, PlanetId } from "@horizon/toolkit/bodies";
import type { OrbitTurn } from "@horizon/toolkit/camera";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import type { DistanceUnit } from "@horizon/toolkit/science";

import { viewFromPath } from "../routing";
import type { NeighbourId } from "./model/neighbours";
import { OLDEST, isPresentEra } from "./model/timeline";
import { TOUR } from "./model/tour";
import { type Bin } from "./model/tracers";
import { DEFAULT_VIEW, viewById, type Realm, type ViewId } from "./model/views";

export type Show = {
  disk: boolean;
  kuiper: boolean;
  scattered: boolean;
  oort: boolean;
  ejected: boolean;
  plane: boolean;
  halo: boolean;
  names: boolean;
  /** Dashed rulers with distances from the selected body (or the Sun) to the others. */
  distances: boolean;
  trueSize: boolean;
  elliptical: boolean;
  drift: boolean;
};

export type Selection =
  | { kind: "sun" }
  | { kind: "planet"; id: PlanetId }
  | { kind: "named"; id: NamedId }
  | { kind: "population"; id: "asteroids" | Bin }
  | { kind: "galaxy"; id: "milkyway" | "sun" | "bulge" | "halo" }
  | { kind: "star"; id: NeighbourId }
  | { kind: "tracer"; index: number };

export type Panel = "none" | "objects" | "reading";

export const DEFAULT_SHOW: Show = {
  disk: true,
  kuiper: true,
  scattered: true,
  oort: true,
  ejected: true,
  plane: true,
  halo: false,
  names: true,
  distances: false,
  trueSize: false,
  elliptical: true,
  drift: true,
};

export type OrreryStore = {
  yearsAgo: number;
  playing: boolean;
  view: ViewId;
  /** Bumps whenever the camera should fly to the view distance again. */
  flight: number;
  /** The latest button step for the camera; a new object each time. */
  turn: OrbitTurn | null;
  selection: Selection | null;
  /** The selected body fills the view at its true size; the engine flies in and out. */
  closeUp: boolean;
  /** Explicitly enabled illustrative prominences; reset on leaving the close-up. */
  solarActivity: boolean;
  solarActivityPaused: boolean;
  panel: Panel;
  show: Show;
  /** Unit for every distance readout: labels, cards and the scale bar. */
  distanceUnit: DistanceUnit;
  guideOpen: boolean;
  guideStep: number;
  ready: boolean;
  /** HUD readouts written by the engine a few times per second. */
  viewDist: number;
  viewRealm: Realm;
  scalePx: number;
  scaleValue: number;
  driftRate: number;
  /** Years the Motion switch has advanced the real clock, published by the engine. */
  driftYears: number;
  setYearsAgo: (yearsAgo: number) => void;
  setYearsFromPlay: (yearsAgo: number) => void;
  togglePlay: () => void;
  replay: () => void;
  setView: (view: ViewId) => void;
  rotate: (turn: OrbitTurn) => void;
  select: (selection: Selection | null) => void;
  /** Flies to the selected body when it has a surface to look at. */
  enterCloseUp: () => void;
  leaveCloseUp: () => void;
  toggleSolarActivity: () => void;
  toggleSolarActivityPaused: () => void;
  patchShow: (patch: Partial<Show>) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setPanel: (panel: Panel) => void;
  setReady: (ready: boolean) => void;
  startGuide: () => void;
  /** Applies a tour step; past the last step the guide ends. */
  goGuide: (step: number) => void;
  endGuide: () => void;
};

/** Bodies with a globe to fly to: the Sun, the planets and the named bodies. */
export function hasSurface(selection: Selection | null) {
  return selection?.kind === "sun" || selection?.kind === "planet" || selection?.kind === "named";
}

/** Close-ups show today's surfaces, in the solar map, outside the guide. */
export function canCloseUp(
  s: Pick<OrreryStore, "selection" | "viewRealm" | "guideOpen" | "yearsAgo">,
) {
  return (
    hasSurface(s.selection) && s.viewRealm === "solar" && !s.guideOpen && isPresentEra(s.yearsAgo)
  );
}

/** A close-up that only deep time rules out: the card shows it disabled, with why. */
export function closeUpAwaitsPresent(
  s: Pick<OrreryStore, "selection" | "viewRealm" | "guideOpen" | "yearsAgo">,
) {
  return (
    hasSurface(s.selection) && s.viewRealm === "solar" && !s.guideOpen && !isPresentEra(s.yearsAgo)
  );
}

function sameSelection(a: Selection | null, b: Selection | null) {
  return !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
}

const SUN_ACTIVITY_OFF = { solarActivity: false, solarActivityPaused: false };
const closeUpState = (closeUp: boolean) =>
  closeUp ? { closeUp } : { closeUp, ...SUN_ACTIVITY_OFF };

/** Display switches the visitor had before the guide, restored when it ends. */
let showBeforeGuide: Show | null = null;

export const useOrrery = create<OrreryStore>((set, get) => ({
  yearsAgo: 0,
  playing: false,
  view: typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath(),
  flight: 0,
  turn: null,
  selection: null,
  closeUp: false,
  ...SUN_ACTIVITY_OFF,
  panel: "none",
  show: DEFAULT_SHOW,
  distanceUnit: "au",
  guideOpen: false,
  guideStep: 0,
  ready: false,
  viewDist: 72,
  viewRealm: "solar",
  scalePx: 120,
  scaleValue: 10,
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
      yearsAgo: 4.5e9,
      playing: true,
      view: "giants",
      viewDist: viewById("giants").dist,
      viewRealm: "solar",
      flight: s.flight + 1,
      panel: "none",
      ...closeUpState(false),
    })),
  setView: (view) => {
    const v = viewById(view);
    set((s) => ({
      view,
      viewDist: v.dist,
      viewRealm: v.realm,
      flight: s.flight + 1,
      ...closeUpState(false),
    }));
  },
  rotate: (turn) => set({ turn: { ...turn } }),
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
  toggleSolarActivity: () =>
    set((s) =>
      s.closeUp && s.selection?.kind === "sun" && canCloseUp(s)
        ? { solarActivity: !s.solarActivity, solarActivityPaused: false }
        : SUN_ACTIVITY_OFF,
    ),
  toggleSolarActivityPaused: () =>
    set((s) => (s.solarActivity ? { solarActivityPaused: !s.solarActivityPaused } : {})),
  patchShow: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),
  setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
  setPanel: (panel) => set({ panel }),
  setReady: (ready) => set({ ready }),
  startGuide: () => {
    showBeforeGuide ??= get().show;
    set({ guideOpen: true, panel: "none", ...closeUpState(false) });
    get().goGuide(0);
  },
  goGuide: (index) => {
    const step = TOUR[index];
    if (!get().guideOpen || index < 0) return;
    if (!step) {
      get().endGuide();
      return;
    }
    /* Each step starts from the default layers; Motion keeps the visitor's choice. */
    const drift = (showBeforeGuide ?? get().show).drift;
    const v = viewById(step.view);
    set({
      guideStep: index,
      view: step.view,
      viewDist: v.dist,
      viewRealm: v.realm,
      yearsAgo: step.yearsAgo,
      playing: Boolean(step.playing) && !prefersReducedMotion(),
      show: { ...DEFAULT_SHOW, drift, ...step.show },
      selection: step.focus ?? null,
    });
  },
  endGuide: () => {
    const show = showBeforeGuide ?? get().show;
    showBeforeGuide = null;
    set({ guideOpen: false, guideStep: 0, playing: false, selection: null, show });
  },
}));
