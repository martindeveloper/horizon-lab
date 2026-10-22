import { create } from "zustand";

import { driftSlice, type DriftSlice } from "@/lib/drift";
import { helpSlice, type HelpSlice } from "@/lib/help";
import {
  guideSlice,
  LAB_RENDER,
  renderSlice,
  type GuideSlice,
  type RenderFields,
  type RenderSlice,
  type SceneCamera,
} from "@/lib/scene-store";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { TAU, wrap } from "@horizon/toolkit/math";
import type { PassAntialias } from "@horizon/toolkit/rendering";

import { presetIdFromPath } from "../routing";
import { HELP } from "./help";
import {
  DEFAULT_PRESET,
  holeById,
  PRESETS,
  paramsFromPreset,
  type BlackHoleParams,
  type TourPose,
} from "./holes";
import { cameraFloor } from "./physics";
import type { PinId } from "./pins";
import { tourFor } from "./tours";

/**
 * The render settings (quality, anti-aliasing, which is experimental, bloom on the disk, jet
 * and sky, the lens's spikes and fringe, wide colour), as a lab's visit starts and Reset puts
 * them back.
 */
type Render = RenderFields<PassAntialias>;
const RENDER: Render = { ...LAB_RENDER, antialias: "off" };

/** What the guide gives back when it ends: whether the camera was orbiting. */
type Saved = { autoRotate: boolean };

/** What the `?` tour gives back when it ends: the hole's scene, gravity, the panels and a pin. */
type HelpSaved = BlackHoleParams & {
  gravity: boolean;
  settingsOpen: boolean;
  clocksOpen: boolean;
  activePin: PinId | null;
  orbitBeforePin: boolean | null;
};

export type BlackHoleStore = BlackHoleParams &
  DriftSlice &
  RenderSlice<Render> &
  GuideSlice<Saved> &
  HelpSlice<HelpSaved> & {
    /** Camera heading in radians, wrapped to [0, 2π); kept across presets. */
    azimuth: number;
    /** The engine's camera while it is up (`lendCamera`), for the `?` tour. */
    camera: SceneCamera | null;
    setAzimuth: (v: number) => void;
    animationPaused: boolean;
    setAnimationPaused: (v: boolean) => void;
    /** Off shows the same scene in flat space; presets and the guide turn it back on. */
    gravity: boolean;
    setGravity: (v: boolean) => void;
    /** The guide step's flight has landed. */
    guideArrived: boolean;
    settingsOpen: boolean;
    mapOpen: boolean;
    clocksOpen: boolean;
    skyReady: boolean;
    activePin: PinId | null;
    /** Whether the camera was orbiting before a pin stopped it, to resume after. */
    orbitBeforePin: boolean | null;
    applyPreset: (id: string) => void;
    setSpin: (v: number) => void;
    setInclination: (v: number) => void;
    setDistance: (v: number) => void;
    setExposure: (v: number) => void;
    setDiskBrightness: (v: number) => void;
    setStarIntensity: (v: number) => void;
    setAutoRotate: (v: boolean) => void;
    /** The render settings as a visit starts. */
    resetRender: () => void;
    setGuideArrived: (v: boolean) => void;
    setSettingsOpen: (v: boolean) => void;
    setMapOpen: (v: boolean) => void;
    closePanels: () => void;
    setClocksOpen: (v: boolean) => void;
    setSkyReady: (v: boolean) => void;
    setActivePin: (v: PinId | null) => void;
    calibrateDevice: () => void;
  };

export const useBlackHole = create<BlackHoleStore>((set, get) => {
  /**
   * The guide's machine: each hole has its own steps, the current one's. Starting stops the
   * orbit and gives the visitor's own setting back at the end: where a pin had stopped it, the
   * setting from before the pin.
   */
  const guide = guideSlice<BlackHoleStore, TourPose, Saved>(set, get, {
    tour: (s) => tourFor(s.presetId),
    save: (s) => ({
      autoRotate: s.activePin ? (s.orbitBeforePin ?? s.autoRotate) : s.autoRotate,
    }),
    restore: (saved) => ({ autoRotate: saved.autoRotate }),
    open: () => ({
      guideArrived: false,
      autoRotate: false,
      gravity: true,
      settingsOpen: false,
      mapOpen: false,
      clocksOpen: false,
      activePin: null,
      orbitBeforePin: null,
    }),
    apply: () => ({ guideArrived: false }),
    close: () => ({ guideArrived: false }),
  });
  return {
    ...paramsFromPreset(
      typeof window === "undefined" ? DEFAULT_PRESET : holeById(presetIdFromPath()),
      true,
    ),
    ...renderSlice<Render>(set, RENDER),
    azimuth: 0.55,
    camera: null,
    setAzimuth: (azimuth) => set({ azimuth: wrap(azimuth, TAU) }),
    animationPaused: false,
    setAnimationPaused: (animationPaused) => set({ animationPaused }),
    gravity: true,
    setGravity: (gravity) => set({ gravity }),
    ...guide,
    ...helpSlice(set, get, {
      steps: HELP,
      save: (s) => ({
        presetId: s.presetId,
        massSolar: s.massSolar,
        spin: s.spin,
        inclination: s.inclination,
        distance: s.distance,
        exposure: s.exposure,
        diskBrightness: s.diskBrightness,
        starIntensity: s.starIntensity,
        tempScale: s.tempScale,
        autoRotate: s.autoRotate,
        gravity: s.gravity,
        settingsOpen: s.settingsOpen,
        clocksOpen: s.clocksOpen,
        activePin: s.activePin,
        orbitBeforePin: s.orbitBeforePin,
      }),
      restore: (saved) => saved,
    }),
    guideArrived: false,
    settingsOpen: false,
    mapOpen: false,
    clocksOpen: false,
    skyReady: false,
    activePin: null,
    orbitBeforePin: null,
    applyPreset: (id) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) return;
      if (get().guideOpen) get().endGuide();
      if (get().activePin) get().setActivePin(null);
      const s = get();
      set({
        ...paramsFromPreset(preset, s.autoRotate),
        gravity: true,
        mapOpen: false,
        clocksOpen: false,
      });
    },
    // The camera stays outside the horizon, which grows as spin falls.
    setSpin: (spin) =>
      set((s) => ({ spin, presetId: "custom", distance: Math.max(s.distance, cameraFloor(spin)) })),
    setInclination: (inclination) => set({ inclination }),
    setDistance: (distance) => set((s) => ({ distance: Math.max(distance, cameraFloor(s.spin)) })),
    setExposure: (exposure) => set({ exposure }),
    setDiskBrightness: (diskBrightness) => set({ diskBrightness }),
    setStarIntensity: (starIntensity) => set({ starIntensity }),
    setAutoRotate: (autoRotate) => set({ autoRotate }),
    resetRender: () => set(RENDER),
    setGuideArrived: (guideArrived) => set({ guideArrived }),
    setSettingsOpen: (settingsOpen) =>
      set(settingsOpen ? { settingsOpen, mapOpen: false } : { settingsOpen }),
    setMapOpen: (mapOpen) => {
      if (mapOpen) {
        if (get().guideOpen) get().endGuide();
        if (get().activePin) get().setActivePin(null);
        set({ mapOpen: true, settingsOpen: false, clocksOpen: false });
        return;
      }
      set({ mapOpen: false });
    },
    closePanels: () => {
      if (get().guideOpen) get().endGuide();
      if (get().activePin) get().setActivePin(null);
      set({ settingsOpen: false, mapOpen: false, clocksOpen: false });
    },
    /* The drift (lib/drift.ts) takes the camera with the panels, the pins and the guide out of the way. */
    ...driftSlice(set, get, {
      open: (s) => {
        s.closePanels();
        return { gravity: true };
      },
    }),
    setClocksOpen: (clocksOpen) => {
      if (clocksOpen) {
        if (get().guideOpen) get().endGuide();
        if (get().activePin) get().setActivePin(null);
        set({
          clocksOpen: true,
          settingsOpen: false,
          mapOpen: false,
          activePin: null,
        });
        return;
      }
      set({ clocksOpen: false });
    },
    setSkyReady: (skyReady) => set({ skyReady }),
    setActivePin: (activePin) => {
      if (get().guideOpen) return;
      if (activePin === null) {
        const resume = get().orbitBeforePin;
        set({ activePin: null, orbitBeforePin: null, ...(resume ? { autoRotate: true } : {}) });
        return;
      }
      if (get().activePin === null) {
        set({
          activePin,
          orbitBeforePin: get().autoRotate,
          autoRotate: false,
          settingsOpen: false,
          clocksOpen: false,
        });
        return;
      }
      set({ activePin });
    },
    calibrateDevice: () => {
      if (typeof window === "undefined") return;
      const reduce = prefersReducedMotion();
      set({
        quality: RENDER.quality,
        autoRotate: !reduce,
        animationPaused: reduce,
      });
    },
  };
});
