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
import type { GalaxyShow, Realm, WorldSelection } from "@/space/galaxy/show";
import { isReachSelection, type ProbeId } from "@/space/solar-system/model/probes";
import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { viewFromPath } from "../routing";
import { HELP } from "./help";
import { TOUR } from "./model/tour";
import { DEFAULT_VIEW, type ViewId } from "./model/view-ids";
import { viewById } from "./model/views";

/** Deep Field's switches are the shared worlds' (`@/space/galaxy/show`). */
export type Show = GalaxyShow;

export type { CosmosId } from "@/space/galaxy/show";

/** What Deep Field can select: anything the shared worlds name, the solar system's included. */
export type Selection = WorldSelection;

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

type Panel = "none" | "objects" | "view";

/** The probe the selection names, if it is one. */
const probeOf = (sel: Selection | null): ProbeId | null =>
  sel && isReachSelection(sel) && sel.id !== "heliopause" ? sel.id : null;

/**
 * A probe can be flown to at its true size while the journey does not hold the camera; the
 * drift visits one itself (its card hidden meanwhile).
 */
export const canCloseUp = (s: Pick<DeepFieldStore, "selection" | "guideOpen">) =>
  probeOf(s.selection) !== null && !s.guideOpen;

const DEFAULT_SHOW: Show = { halo: false, names: true, distances: false, lightTime: true };

/** What the `?` tour's steps change and give back: the view, a ladder drag, the switches. */
type HelpSaved = { view: ViewId; viewLy: number; seek: { ly: number } | null; show: Show };

export type DeepFieldStore = SceneSlice &
  GuideSlice<Show> &
  HelpSlice<HelpSaved> &
  DriftSlice & {
    view: ViewId;
    /** A depth the visitor dragged the ladder to (camera distance, ly), or null. */
    seek: { ly: number } | null;
    selection: Selection | null;
    /** The probe the camera has flown to at its true size, or null. */
    closeUp: ProbeId | null;
    /** A probe's model the view would show is still on its way (written by the scene). */
    sharpening: boolean;
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
    /** Flies to the selected probe at its true size. */
    enterCloseUp: () => void;
    leaveCloseUp: () => void;
    patchShow: (patch: Partial<Show>) => void;
    /** The View panel's settings as a visit starts: switches, distance unit, render quality. */
    resetView: () => void;
    setPanel: (panel: Panel) => void;
    /* The guided journey (model/tour.ts). */
    /** The journey moves on by itself once a shot has been read; off under reduced motion. */
    guidePlaying: boolean;
    /** The camera has landed on the step's shot (written by the scene). */
    guideLanded: boolean;
    toggleGuidePlaying: () => void;
  };

export const useDeepField = create<DeepFieldStore>((set, get) => ({
  ...sceneSlice(set, { scalePx: 120, scaleValue: 10_000, scaleUnit: "ly" }),
  view: typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath(),
  seek: null,
  selection: null,
  closeUp: null,
  sharpening: false,
  panel: "none",
  show: DEFAULT_SHOW,
  viewLy: viewById(DEFAULT_VIEW).ly,
  reachLy: viewById(DEFAULT_VIEW).ly,
  setView: (view) => {
    const v = viewById(view);
    set((s) => ({ view, viewLy: v.ly, flight: s.flight + 1, seek: null, closeUp: null }));
  },
  seekTo: (ly) => set({ seek: { ly }, closeUp: null }),
  /* Another selection lets go of a close-up. */
  select: (selection) =>
    set((s) => ({ selection, closeUp: probeOf(selection) === s.closeUp ? s.closeUp : null })),
  enterCloseUp: () => {
    const s = get();
    if (canCloseUp(s)) set({ closeUp: probeOf(s.selection), panel: "none", seek: null });
  },
  leaveCloseUp: () => set({ closeUp: null }),
  patchShow: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),
  resetView: () => set({ show: DEFAULT_SHOW, ...RESET_SCENE_SETTINGS }),
  setPanel: (panel) => set({ panel }),
  ...guideSlice(set, get, {
    tour: TOUR,
    /* The visitor's switches, given back when the journey ends. */
    save: (s) => s.show,
    restore: (show) => ({ show }),
    open: () => ({ guidePlaying: !prefersReducedMotion(), seek: null, closeUp: null }),
    apply: (step, s) => ({
      guideLanded: false,
      view: step.view,
      selection: step.focus ?? null,
      show: { ...(s.savedBeforeGuide ?? DEFAULT_SHOW), ...step.show },
    }),
    close: () => ({ guideLanded: false }),
  }),
  ...helpSlice(set, get, {
    steps: HELP,
    save: (s) => ({ view: s.view, viewLy: s.viewLy, seek: s.seek, show: s.show }),
    restore: (saved) => saved,
  }),
  guidePlaying: false,
  guideLanded: false,
  toggleGuidePlaying: () => set((s) => ({ guidePlaying: !s.guidePlaying })),
  /* The drift closes the panel and the card and ends the journey; the view follows the camera. */
  ...driftSlice(set, get, {
    open: (s) => {
      if (s.guideOpen) s.endGuide();
      return { panel: "none" as const, selection: null, seek: null, closeUp: null };
    },
  }),
}));
