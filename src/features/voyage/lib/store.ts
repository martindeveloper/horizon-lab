import { create } from "zustand";

import {
  RESET_SCENE_SETTINGS,
  guideSlice,
  sceneSlice,
  type GuideSlice,
  type SceneSlice,
} from "@/lib/scene-store";
import { CMB_KELVIN } from "@/space/cosmos/model/cosmos";
import type { WorldSelection } from "@/space/galaxy/show";
import type { FlightAxes } from "@horizon/toolkit/camera";

import { viewFromPath } from "../routing";
import type { AnchorId } from "./model/anchors";
import { DEFAULT_COMPRESSION, DEFAULT_DRIVE, type DriveId } from "./model/parameters";
import { placeById, placeFor } from "./model/places";
import type { ShipMode } from "./model/ship";

export type { ShipMode };
import { TOUR } from "./model/tour";
import { DEFAULT_VIEW, type ViewId } from "./model/view-ids";

export type Show = {
  /** The cockpit's canopy: the glass and its struts. */
  canopy: boolean;
  /** The cockpit's instruments: the markers, the scanner, the throttle. */
  instruments: boolean;
  names: boolean;
  /** The bodies' orbits, as faint lines. */
  orbits: boolean;
};

type Panel = "none" | "objects" | "view";

const DEFAULT_SHOW: Show = { canopy: true, instruments: true, names: true, orbits: true };

/** The HUD readouts the engine writes a few times a second. */
export type Readouts = {
  /** The ship's clock, seconds since the visit's epoch. */
  shipSeconds: number;
  /** Earth's clock, seconds since the epoch. */
  earthSeconds: number;
  /** The ship's speed relative to the Sun, km/s, and its Lorentz factor. */
  speed: number;
  gamma: number;
  /** The anchor the ship is at or heading for, and its distance from the ship's camera, km. */
  aim: AnchorId;
  range: number;
  /** How fast the ship closes on its aim, km/s; negative receding. */
  closing: number;
  /** The ship's distance from the Sun, km. */
  fromSun: number;
  /** Light-time from the ship to Earth, seconds. */
  lightToEarth: number;
  /** Sunlight on the ship, W/m². */
  irradiance: number;
  /** A flight is under way. */
  flying: boolean;
  /** Parked about a body, or flying free. The scene writes it when the keys take the ship. */
  mode: ShipMode;
  /** The microwave background's temperature at the ship's instant, kelvin. */
  cmbKelvin: number;
  /** The ship's heliocentric position, km, as last published. */
  shipKm: readonly [number, number, number];
  /** The visit's epoch (ms since 1970), as the scene set it: the clocks count from it. */
  epochMs: number;
};

export type VoyageStore = SceneSlice &
  GuideSlice<Show> &
  Readouts & {
    view: ViewId;
    /** The anchor the ship is parked at, or flying to. */
    destination: AnchorId;
    selection: WorldSelection | null;
    panel: Panel;
    show: Show;
    drive: DriveId;
    /** Ship seconds per real second; 0 holds the clocks. */
    compression: number;
    /** The rate to go back to from a hold. */
    heldCompression: number;
    /** A scripted pilot holding the ship's axes (a scene's flight), or none: the keys fly. */
    pilot: Partial<FlightAxes> | null;
    setView: (view: ViewId) => void;
    /** Flies the ship to an anchor. */
    goTo: (anchor: AnchorId) => void;
    select: (selection: WorldSelection | null) => void;
    patchShow: (patch: Partial<Show>) => void;
    /** The View panel's settings as a visit starts: switches, distance unit, render quality. */
    resetView: () => void;
    setPanel: (panel: Panel) => void;
    setDrive: (drive: DriveId) => void;
    setMode: (mode: ShipMode) => void;
    setCompression: (compression: number) => void;
    setPilot: (pilot: Partial<FlightAxes> | null) => void;
    /** Holds the clocks, or lets them run again at the rate they held. */
    toggleHold: () => void;
    /* The guided journey (model/tour.ts). */
    guidePlaying: boolean;
    guideLanded: boolean;
    toggleGuidePlaying: () => void;
  };

/** The readouts before the engine writes them; the engine starts its own from these. */
export const READOUTS: Readouts = {
  shipSeconds: 0,
  earthSeconds: 0,
  speed: 0,
  gamma: 1,
  aim: placeById(DEFAULT_VIEW).body,
  range: 0,
  closing: 0,
  fromSun: 0,
  lightToEarth: 0,
  irradiance: 0,
  flying: false,
  mode: "orbit",
  cmbKelvin: CMB_KELVIN,
  shipKm: [0, 0, 0],
  epochMs: 0,
};

/** The place the address opens at. */
const INITIAL_VIEW = typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath();

export const useVoyage = create<VoyageStore>((set, get) => ({
  ...sceneSlice(set, { scalePx: 120, scaleValue: 1, scaleUnit: "au" }),
  ...READOUTS,
  view: INITIAL_VIEW,
  destination: placeById(INITIAL_VIEW).body,
  selection: null,
  panel: "none",
  show: DEFAULT_SHOW,
  drive: DEFAULT_DRIVE,
  compression: DEFAULT_COMPRESSION,
  heldCompression: DEFAULT_COMPRESSION,
  pilot: null,
  setView: (view) =>
    set((s) => ({ view, destination: placeById(view).body, flight: s.flight + 1 })),
  goTo: (body) =>
    set((s) => ({
      destination: body,
      view: placeFor(body) ?? s.view,
      flight: s.flight + 1,
      panel: "none",
    })),
  select: (selection) => set({ selection }),
  patchShow: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),
  resetView: () => set({ show: DEFAULT_SHOW, ...RESET_SCENE_SETTINGS }),
  setPanel: (panel) => set({ panel }),
  setDrive: (drive) => set({ drive }),
  setMode: (mode) => set({ mode, panel: "none" }),
  setCompression: (compression) =>
    set((s) => ({
      compression,
      heldCompression: compression > 0 ? compression : s.heldCompression,
    })),
  setPilot: (pilot) => set({ pilot }),
  toggleHold: () => set((s) => ({ compression: s.compression > 0 ? 0 : s.heldCompression })),
  ...guideSlice(set, get, {
    tour: TOUR,
    save: (s) => s.show,
    restore: (show) => ({ show }),
    open: () => ({ guidePlaying: true }),
    apply: (step, s) => ({
      guideLanded: false,
      destination: step.body,
      view: placeFor(step.body) ?? s.view,
      flight: s.flight + 1,
      selection: step.focus ?? null,
      show: s.savedBeforeGuide ?? DEFAULT_SHOW,
    }),
    close: () => ({ guideLanded: false }),
  }),
  guidePlaying: false,
  guideLanded: false,
  toggleGuidePlaying: () => set((s) => ({ guidePlaying: !s.guidePlaying })),
}));
