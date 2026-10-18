import { create } from "zustand";

import { sceneSlice, type SceneSlice } from "@/lib/scene-store";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { viewFromPath } from "../routing";
import type { NeighbourId } from "./model/neighbours";
import { TOUR } from "./model/tour";
import { DEFAULT_VIEW, type ViewId } from "./model/view-ids";
import { viewById, type Realm } from "./model/views";

export type Show = {
  /** The dark-matter halo's sphere. */
  halo: boolean;
  names: boolean;
  /** Dashed rulers with distances from the selection (or home) to what is in view. */
  distances: boolean;
};

/** Structures beyond the Galaxy with a card. */
export type CosmosId =
  | "localGroup"
  | "localSheet"
  | "andromeda"
  | "triangulum"
  | "virgo"
  | "fornax"
  | "supercluster"
  | "centaurus"
  | "hydra"
  | "greatAttractor"
  | "laniakea"
  | "perseusPisces"
  | "coma"
  | "shapley"
  | "sloanGreatWall"
  | "observableUniverse";

export type Selection =
  | SolarSelection
  | { kind: "star"; id: NeighbourId }
  | { kind: "galaxy"; id: "milkyway" | "sun" | "bulge" | "halo" }
  | { kind: "cosmos"; id: CosmosId };

/** The scale a selection belongs to; zooming into another lets it go. */
const realmOfSelection = (sel: Selection): Realm =>
  sel.kind === "star"
    ? "stars"
    : sel.kind === "galaxy" || sel.kind === "cosmos"
      ? sel.kind
      : "solar";

/**
 * Whether entering `realm` lets go of `sel`: it belongs to another scale, and no view flight
 * is carrying the camera to its scale (a flight may cross a scale on the way).
 */
export const dropsSelection = (sel: Selection, realm: Realm, flyingTo: Realm | null) =>
  realmOfSelection(sel) !== realm && realmOfSelection(sel) !== flyingTo;

export type Panel = "none" | "objects";

export const DEFAULT_SHOW: Show = { halo: false, names: true, distances: false };

export type DeepFieldStore = SceneSlice & {
  view: ViewId;
  /** A depth the visitor dragged the ladder to (camera distance, ly), or null. */
  seek: { ly: number } | null;
  selection: Selection | null;
  panel: Panel;
  show: Show;
  /* HUD readouts written by the engine a few times per second, besides the scale bar. */
  /** Camera distance from its aim, ly. */
  viewLy: number;
  /** How far from us the view reaches: its centre's distance plus the field's half-height, ly. */
  reachLy: number;
  setView: (view: ViewId) => void;
  /** Glides the zoom to a camera distance (ly), as the ladder's thumb asks. */
  seekTo: (ly: number) => void;
  select: (selection: Selection | null) => void;
  patchShow: (patch: Partial<Show>) => void;
  setPanel: (panel: Panel) => void;
  /* The guided journey (model/tour.ts). */
  guideOpen: boolean;
  guideStep: number;
  /** The journey moves on by itself once a shot has been read; off under reduced motion. */
  guidePlaying: boolean;
  /** The camera has landed on the step's shot (written by the scene). */
  guideLanded: boolean;
  /** The visitor's switches from before the journey, given back when it ends. */
  showBeforeGuide: Show | null;
  startGuide: () => void;
  /** Applies a step; past the last one the journey ends. */
  goGuide: (step: number) => void;
  toggleGuidePlaying: () => void;
  endGuide: () => void;
};

export const useDeepField = create<DeepFieldStore>((set, get) => ({
  ...sceneSlice(set, { scalePx: 120, scaleValue: 10_000, scaleUnit: "ly" }),
  view: typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath(),
  seek: null,
  selection: null,
  panel: "none",
  show: DEFAULT_SHOW,
  viewLy: viewById(DEFAULT_VIEW).ly,
  reachLy: viewById(DEFAULT_VIEW).ly,
  setView: (view) => {
    const v = viewById(view);
    set((s) => ({ view, viewLy: v.ly, flight: s.flight + 1, seek: null }));
  },
  seekTo: (ly) => set({ seek: { ly } }),
  select: (selection) => set({ selection }),
  patchShow: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),
  setPanel: (panel) => set({ panel }),
  guideOpen: false,
  guideStep: 0,
  guidePlaying: false,
  guideLanded: false,
  showBeforeGuide: null,
  startGuide: () => {
    set((s) => ({
      guideOpen: true,
      guidePlaying: !prefersReducedMotion(),
      showBeforeGuide: s.showBeforeGuide ?? s.show,
      panel: "none",
      seek: null,
    }));
    get().goGuide(0);
  },
  goGuide: (index) => {
    const step = TOUR[index];
    if (!get().guideOpen || index < 0) return;
    if (!step) return get().endGuide();
    set({
      guideStep: index,
      guideLanded: false,
      view: step.view,
      selection: step.focus ?? null,
      show: { ...(get().showBeforeGuide ?? DEFAULT_SHOW), ...step.show },
    });
  },
  toggleGuidePlaying: () => set((s) => ({ guidePlaying: !s.guidePlaying })),
  endGuide: () =>
    set((s) => ({
      guideOpen: false,
      guideStep: 0,
      guideLanded: false,
      selection: null,
      show: s.showBeforeGuide ?? s.show,
      showBeforeGuide: null,
    })),
}));
