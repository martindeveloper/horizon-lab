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
import {
  ATLAS_DEFAULT_SHOW,
  isAtlasId,
  isAtlasLandmark,
  type AtlasMode,
  type AtlasShow,
} from "@/space/cosmos/model/atlas";
import { CMB_INITIAL_STATUS, type CmbStatus } from "@/space/cosmos/model/cmb";
import type { GalaxyShow, Realm, WorldSelection } from "@/space/galaxy/show";
import {
  canFlyTo,
  closeUpKey,
  sameSystem,
  upFrom,
  type CloseUpSelection,
} from "@/space/solar-system/model/close-up";
import { isReachSelection, type ProbeId } from "@/space/solar-system/model/probes";
import { isSolarSelection } from "@/space/solar-system/model/selection";
import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { viewFromPath } from "../routing";
import { HELP } from "./help";
import { ATLAS_EXPERIENCE_MODE } from "./model/atlas-mode";
import type { DarkView } from "./model/dark-universe";
import { TOUR } from "./model/tour";
import { DEFAULT_VIEW, type ViewId } from "./model/view-ids";
import { viewById } from "./model/views";

/** Deep Field's switches are the shared worlds' (`@/space/galaxy/show`). */
export type Show = GalaxyShow &
  AtlasShow & { cosmicMode: AtlasMode; haloBoundary: boolean; cmbDetail: boolean };

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
export const dropsSelection = (
  sel: Selection,
  realm: Realm,
  flyingTo: Realm | null,
  haloVisible = false,
) =>
  !(sel.kind === "galaxy" && sel.id === "halo" && haloVisible) &&
  realmOfSelection(sel) !== realm &&
  realmOfSelection(sel) !== flyingTo;

type Panel = "none" | "objects" | "view" | "dark";

/** A probe leaving the solar system, as a close-up flies to it. */
export type ProbeSelection = { kind: "reach"; id: ProbeId };

/** What a close-up flies to: a body with a globe at its true size, or a probe at its. */
export type DeepFieldCloseUp = CloseUpSelection | ProbeSelection;

/** The probe the selection names, if it is one. */
const probeOf = (sel: Selection | null): ProbeSelection | null =>
  sel && isReachSelection(sel) && sel.id !== "heliopause" ? { kind: "reach", id: sel.id } : null;

/** The close-up a selection offers: a body's, a probe's, or none. */
const closeUpOf = (sel: Selection | null): DeepFieldCloseUp | null =>
  canFlyTo(sel) ? sel : probeOf(sel);

/** A close-up as one string: equal for the same object. */
const closeUpId = (sel: DeepFieldCloseUp) =>
  sel.kind === "reach" ? `reach:${sel.id}` : closeUpKey(sel);

/** Whether a selection keeps a close-up open: the same object, or one of its planet's system. */
const keepsCloseUp = (closeUp: DeepFieldCloseUp, selection: Selection) =>
  closeUp.kind === "reach"
    ? isReachSelection(selection) && selection.id === closeUp.id
    : isSolarSelection(selection) && sameSystem(closeUp, selection);

/**
 * A body or a probe can be flown to at its true size while the journey does not hold the
 * camera; the drift visits one itself (its card hidden meanwhile).
 */
export const canCloseUp = (s: Pick<DeepFieldStore, "selection" | "guideOpen">) =>
  closeUpOf(s.selection) !== null && !s.guideOpen;

const DEFAULT_SHOW: Show = {
  halo: false,
  haloBoundary: false,
  cmbDetail: true,
  names: true,
  distances: false,
  lightTime: true,
  ...ATLAS_DEFAULT_SHOW,
  cosmicMode: ATLAS_EXPERIENCE_MODE.manual,
};

/** What the `?` tour's steps change and give back: the view, a ladder drag, a close-up, the switches. */
type HelpSaved = {
  view: ViewId;
  viewLy: number;
  seek: { ly: number } | null;
  closeUp: DeepFieldCloseUp | null;
  show: Show;
};

export type DeepFieldStore = SceneSlice &
  GuideSlice<Show> &
  HelpSlice<HelpSaved> &
  DriftSlice & {
    view: ViewId;
    /** A depth the visitor dragged the ladder to (camera distance, ly), or null. */
    seek: { ly: number } | null;
    selection: Selection | null;
    /** The body or probe the camera has flown to at its true size, or null. */
    closeUp: DeepFieldCloseUp | null;
    /** A probe's model the view would show is still on its way (written by the scene). */
    sharpening: boolean;
    cmbStatus: CmbStatus;
    cmbRetry: number;
    retryCmb: () => void;
    panel: Panel;
    darkView: DarkView;
    openDarkView: (view: DarkView) => void;
    show: Show;
    /** Manual layer choices, restored when Drift ends or hands over to Guide. */
    savedBeforeDrift: Show | null;
    /* HUD readouts written by the engine a few times per second, besides the scale bar. */
    /** Camera distance from its aim, ly. */
    viewLy: number;
    /** How far from us the view reaches: its centre's distance plus the field's half-height, ly. */
    reachLy: number;
    setView: (view: ViewId) => void;
    /** Glides the zoom to a camera distance (ly), as the ladder's thumb asks. */
    seekTo: (ly: number) => void;
    select: (selection: Selection | null) => void;
    /** Flies to the selected body or probe at its true size. */
    enterCloseUp: () => void;
    /** Back up a level: from a moon to its planet, else (or with `toMap`) to the map. */
    leaveCloseUp: (toMap?: boolean) => void;
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
  cmbStatus: { ...CMB_INITIAL_STATUS },
  cmbRetry: 0,
  retryCmb: () => set((s) => ({ cmbRetry: s.cmbRetry + 1 })),
  panel: "none",
  darkView: "halo",
  openDarkView: (darkView) => set({ panel: "dark", darkView }),
  show: DEFAULT_SHOW,
  savedBeforeDrift: null,
  viewLy: viewById(DEFAULT_VIEW).ly,
  reachLy: viewById(DEFAULT_VIEW).ly,
  setView: (view) => {
    const v = viewById(view);
    set((s) => ({
      view,
      viewLy: v.ly,
      flight: s.flight + 1,
      seek: null,
      closeUp: null,
      selection:
        s.selection?.kind === "cosmos" && isAtlasLandmark(s.selection.id) ? null : s.selection,
    }));
  },
  seekTo: (ly) => set({ seek: { ly }, closeUp: null }),
  /* Another selection lets go of a close-up, unless it is one of the same planet's system. */
  select: (selection) =>
    set((s) => ({
      selection,
      closeUp: s.closeUp && selection && keepsCloseUp(s.closeUp, selection) ? s.closeUp : null,
      // Finding a catalogue object must reveal it even from Illustration mode.
      show:
        selection?.kind === "cosmos" &&
        isAtlasId(selection.id) &&
        s.show.cosmicMode === "illustration"
          ? { ...s.show, cosmicMode: "both" }
          : s.show,
    })),
  enterCloseUp: () => {
    const s = get();
    const next = closeUpOf(s.selection);
    if (!next || s.guideOpen || (s.closeUp && closeUpId(s.closeUp) === closeUpId(next))) return;
    set({ closeUp: next, panel: "none", seek: null });
  },
  leaveCloseUp: (toMap = false) =>
    set((s) => {
      const up = !toMap && s.closeUp && s.closeUp.kind !== "reach" ? upFrom(s.closeUp) : null;
      return up ? { selection: up, closeUp: up } : { closeUp: null };
    }),
  patchShow: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),
  resetView: () => set({ show: DEFAULT_SHOW, ...RESET_SCENE_SETTINGS }),
  setPanel: (panel) => set({ panel }),
  ...guideSlice(set, get, {
    tour: TOUR,
    /* The visitor's switches, given back when the journey ends. */
    save: (s) => s.savedBeforeDrift ?? s.show,
    restore: (show) => ({ show }),
    open: () => ({
      guidePlaying: !prefersReducedMotion(),
      seek: null,
      closeUp: null,
      drift: "off" as const,
      savedBeforeDrift: null,
    }),
    apply: (step, s) => ({
      guideLanded: false,
      view: step.view,
      selection: step.focus ?? null,
      show: {
        ...(s.savedBeforeGuide ?? DEFAULT_SHOW),
        ...ATLAS_DEFAULT_SHOW,
        cosmicMode: ATLAS_EXPERIENCE_MODE.guide,
        // Scientific overlays appear only where the Guide explains them.
        halo: false,
        haloBoundary: false,
        ...step.show,
      },
    }),
    close: () => ({ guideLanded: false }),
  }),
  ...helpSlice(set, get, {
    steps: HELP,
    save: (s) => ({
      view: s.view,
      viewLy: s.viewLy,
      seek: s.seek,
      closeUp: s.closeUp,
      show: s.show,
    }),
    restore: (saved) => saved,
  }),
  guidePlaying: false,
  guideLanded: false,
  toggleGuidePlaying: () => set((s) => ({ guidePlaying: !s.guidePlaying })),
  /* The drift closes the panel and the card and ends the journey; the view follows the camera. */
  ...driftSlice(set, get, {
    open: (s) => {
      if (s.guideOpen) s.endGuide();
      // Ending Guide restores the manual preferences; read the fresh state before saving.
      const show = get().show;
      return {
        panel: "none" as const,
        selection: null,
        seek: null,
        closeUp: null,
        savedBeforeDrift: show,
        show: {
          ...show,
          ...ATLAS_DEFAULT_SHOW,
          cosmicMode: ATLAS_EXPERIENCE_MODE.drift,
          halo: false,
          haloBoundary: false,
        },
      };
    },
    close: (s) => ({ show: s.savedBeforeDrift ?? s.show, savedBeforeDrift: null }),
  }),
}));
