import { create } from "zustand";

import {
  EXPERIENCE_SCENE_SETTINGS,
  guideSlice,
  sceneSlice,
  type GuideSlice,
  type SceneSlice,
} from "@/lib/scene-store";
import { CMB_KELVIN } from "@/space/cosmos/model/cosmos";
import type { WorldSelection } from "@/space/galaxy/show";

import { viewFromPath } from "../routing";
import { selectionOfAnchor, type AnchorId } from "./model/anchors";
import type { FlightPhase } from "./model/autopilot";
import { DEFAULT_COMPRESSION, DEFAULT_DRIVE, type DriveId } from "./model/parameters";
import { PLACE_BODY, placeFor } from "./model/places";
import type { Regime } from "./model/regime";
import type { ShipMode } from "./model/ship";
import { TOUR } from "./model/tour";
import { DEFAULT_VIEW, type ViewId } from "./model/view-ids";

export type Show = {
  /** The cockpit's canopy: the glass and its struts. */
  canopy: boolean;
  /** The cockpit's instruments: the markers and the scanner. */
  instruments: boolean;
  names: boolean;
  /** The bodies' orbits, as faint lines. */
  orbits: boolean;
  /** Dust streaming past the ship whenever it moves: the sense of speed. */
  streaks: boolean;
  /** Faint ring systems in a long exposure, each as bright as Saturn's: on, as an experience shows off. */
  faintRings: boolean;
  /**
   * The ship's feel: a crash's jolt, the drive spooling up, the view widening, an arrival's
   * settle. On, as an experience's effects are; reduced motion keeps only what does not move.
   */
  feel: boolean;
};

type Panel = "none" | "objects" | "view";

const DEFAULT_SHOW: Show = {
  canopy: true,
  instruments: true,
  names: true,
  orbits: true,
  streaks: true,
  faintRings: true,
  feel: true,
};

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
  /** A flight is under way, and what its autopilot is doing. */
  flying: boolean;
  phase: FlightPhase | null;
  /** The speed regime by what flows past: normal space, cruise between planets, warp beyond. */
  regime: Regime;
  /** Ship seconds per real second: the rate asked for, the autopilot's, or one gravity held back. */
  warp: number;
  /** The pull on the ship, km/s², and the body pulling hardest. */
  gravity: number;
  gravityFrom: AnchorId;
  /** The microwave background's temperature at the ship's instant, kelvin. */
  cmbKelvin: number;
  /** The visit's epoch (ms since 1970), as the scene set it: the clocks count from it. */
  epochMs: number;
};

/** Where the ship is and Earth's clock then, about once a second: the lists measure from it. */
export type Fix = {
  /** The ship's heliocentric position, km. */
  km: readonly [number, number, number];
  /** Earth's clock, seconds since the epoch. */
  seconds: number;
};

export type VoyageStore = SceneSlice &
  GuideSlice<Show> &
  Readouts & {
    fix: Fix;
    view: ViewId;
    /** The anchor the visitor last sent the ship to (`courseOf` says where it is bound now). */
    destination: AnchorId;
    /** In orbit about a body, or flown by hand. The scene writes it when the keys take the ship. */
    mode: ShipMode;
    selection: WorldSelection | null;
    panel: Panel;
    show: Show;
    drive: DriveId;
    /** Ship seconds per real second; 0 holds the clocks. */
    compression: number;
    /** The rate to go back to from a hold. */
    heldCompression: number;
    /** The throttle lever, 0…1: thrust ahead in manual flight. Opening it in orbit takes the helm. */
    throttle: number;
    /** Bumped to hand a flight to the pilot where it is. */
    abort: number;
    /** The ship lies wrecked on a body, struck at this speed (km/s); null while it flies. */
    crash: { body: AnchorId; speed: number } | null;
    /** Bumped to take the wreck back to orbit. */
    recoveries: number;
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
    setThrottle: (throttle: number) => void;
    /** Takes the ship off the autopilot: it flies on by hand at the speed it had. */
    disengage: () => void;
    /** After a crash: back to orbit about the body struck. */
    recover: () => void;
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
  aim: PLACE_BODY[DEFAULT_VIEW],
  range: 0,
  closing: 0,
  fromSun: 0,
  lightToEarth: 0,
  irradiance: 0,
  flying: false,
  phase: null,
  regime: "normal",
  warp: DEFAULT_COMPRESSION,
  gravity: 0,
  gravityFrom: "sun",
  cmbKelvin: CMB_KELVIN,
  epochMs: 0,
};

/** The anchor the ship is parked at or flying to; none while flown by hand or wrecked. */
export const courseOf = (s: VoyageStore): AnchorId | null =>
  s.crash || (s.mode === "free" && !s.flying) ? null : s.aim;

/** The place the address opens at. */
const INITIAL_VIEW = typeof window === "undefined" ? DEFAULT_VIEW : viewFromPath();

export const useVoyage = create<VoyageStore>((set, get) => ({
  ...sceneSlice(set, { scalePx: 120, scaleValue: 1, scaleUnit: "au" }, EXPERIENCE_SCENE_SETTINGS),
  ...READOUTS,
  fix: { km: [0, 0, 0], seconds: 0 },
  view: INITIAL_VIEW,
  destination: PLACE_BODY[INITIAL_VIEW],
  mode: "orbit",
  selection: null,
  panel: "none",
  show: DEFAULT_SHOW,
  drive: DEFAULT_DRIVE,
  compression: DEFAULT_COMPRESSION,
  heldCompression: DEFAULT_COMPRESSION,
  throttle: 0,
  abort: 0,
  crash: null,
  recoveries: 0,
  setView: (view) => set((s) => ({ view, destination: PLACE_BODY[view], flight: s.flight + 1 })),
  goTo: (body) =>
    set((s) => ({
      destination: body,
      view: placeFor(body) ?? s.view,
      flight: s.flight + 1,
      panel: "none",
      throttle: 0,
    })),
  select: (selection) => set({ selection }),
  patchShow: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),
  resetView: () => set({ show: DEFAULT_SHOW, ...EXPERIENCE_SCENE_SETTINGS }),
  setPanel: (panel) => set({ panel }),
  setDrive: (drive) => set({ drive }),
  setMode: (mode) => set({ mode, panel: "none", ...(mode === "orbit" ? { throttle: 0 } : {}) }),
  setCompression: (compression) =>
    set((s) => ({
      compression,
      heldCompression: compression > 0 ? compression : s.heldCompression,
    })),
  setThrottle: (throttle) => set({ throttle: Math.min(1, Math.max(0, throttle)) }),
  disengage: () => set((s) => (s.flying ? { abort: s.abort + 1, panel: "none" } : {})),
  recover: () =>
    set((s) =>
      s.crash ? { crash: null, recoveries: s.recoveries + 1, throttle: 0, panel: "none" } : {},
    ),
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
      throttle: 0,
      selection: selectionOfAnchor(step.body),
      show: s.savedBeforeGuide ?? DEFAULT_SHOW,
    }),
    close: () => ({ guideLanded: false }),
  }),
  guidePlaying: false,
  guideLanded: false,
  toggleGuidePlaying: () => set((s) => ({ guidePlaying: !s.guidePlaying })),
}));
