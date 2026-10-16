import { create } from "zustand";

import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { wrap } from "@horizon/toolkit/math";

import { presetFromPath } from "../routing";
import type { PinId } from "./pins";
import {
  DEFAULT_PRESET,
  PRESETS,
  paramsFromPreset,
  type BlackHoleParams,
  type Quality,
} from "./presets";
import { tourFor } from "./tours";

export type BlackHoleStore = BlackHoleParams & {
  /** Camera heading in radians, wrapped to [0, 2π); kept across presets. */
  azimuth: number;
  setAzimuth: (v: number) => void;
  animationPaused: boolean;
  setAnimationPaused: (v: boolean) => void;
  guideOpen: boolean;
  guideBeat: number;
  guideArrived: boolean;
  settingsOpen: boolean;
  mapOpen: boolean;
  clocksOpen: boolean;
  skyReady: boolean;
  activePin: PinId | null;
  applyPreset: (id: string) => void;
  setSpin: (v: number) => void;
  setInclination: (v: number) => void;
  setDistance: (v: number) => void;
  setExposure: (v: number) => void;
  setDiskBrightness: (v: number) => void;
  setStarIntensity: (v: number) => void;
  setTempScale: (v: number) => void;
  setAutoRotate: (v: boolean) => void;
  setQuality: (v: Quality) => void;
  setGuideOpen: (v: boolean) => void;
  startGuide: () => void;
  advanceGuide: () => void;
  endGuide: () => void;
  setGuideArrived: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setMapOpen: (v: boolean) => void;
  closePanels: () => void;
  setClocksOpen: (v: boolean) => void;
  setSkyReady: (v: boolean) => void;
  setActivePin: (v: PinId | null) => void;
  calibrateDevice: () => void;
};

const TAU = Math.PI * 2;

let orbitBeforePin: boolean | null = null;
let orbitBeforeGuide: boolean | null = null;

export const useBlackHole = create<BlackHoleStore>((set, get) => ({
  ...paramsFromPreset(
    typeof window === "undefined" ? DEFAULT_PRESET : presetFromPath(),
    "standard",
    true,
  ),
  azimuth: 0.55,
  setAzimuth: (azimuth) => set({ azimuth: wrap(azimuth, TAU) }),
  animationPaused: false,
  setAnimationPaused: (animationPaused) => set({ animationPaused }),
  guideOpen: false,
  guideBeat: 0,
  guideArrived: false,
  settingsOpen: false,
  mapOpen: false,
  clocksOpen: false,
  skyReady: false,
  activePin: null,
  applyPreset: (id) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (get().guideOpen) get().endGuide();
    if (get().activePin) get().setActivePin(null);
    const s = get();
    set({
      ...paramsFromPreset(preset, s.quality, s.autoRotate),
      mapOpen: false,
      clocksOpen: false,
    });
  },
  setSpin: (spin) => set({ spin, presetId: "custom" }),
  setInclination: (inclination) => set({ inclination }),
  setDistance: (distance) => set({ distance }),
  setExposure: (exposure) => set({ exposure }),
  setDiskBrightness: (diskBrightness) => set({ diskBrightness }),
  setStarIntensity: (starIntensity) => set({ starIntensity }),
  setTempScale: (tempScale) => set({ tempScale, presetId: "custom" }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setQuality: (quality) => set({ quality }),
  setGuideOpen: (guideOpen) => {
    if (guideOpen) get().startGuide();
    else get().endGuide();
  },
  startGuide: () => {
    const s = get();
    if (s.activePin) s.setActivePin(null);
    if (orbitBeforeGuide === null) orbitBeforeGuide = get().autoRotate;
    set({
      guideOpen: true,
      guideBeat: 0,
      guideArrived: false,
      autoRotate: false,
      settingsOpen: false,
      mapOpen: false,
      clocksOpen: false,
      activePin: null,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("eh-guide-start"));
    }
  },
  advanceGuide: () => {
    const s = get();
    if (!s.guideOpen || !s.guideArrived) return;
    const beats = tourFor(s.presetId);
    if (s.guideBeat + 1 >= beats.length) {
      s.endGuide();
      return;
    }
    set({ guideBeat: s.guideBeat + 1, guideArrived: false });
  },
  endGuide: () => {
    const resume = orbitBeforeGuide;
    orbitBeforeGuide = null;
    set(
      resume
        ? { guideOpen: false, guideArrived: false, guideBeat: 0, autoRotate: true }
        : { guideOpen: false, guideArrived: false, guideBeat: 0 },
    );
  },
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
      const resume = orbitBeforePin;
      orbitBeforePin = null;
      set(resume ? { activePin: null, autoRotate: true } : { activePin: null });
      return;
    }
    if (get().activePin === null) {
      orbitBeforePin = get().autoRotate;
      set({ activePin, autoRotate: false, settingsOpen: false, clocksOpen: false });
      return;
    }
    set({ activePin });
  },
  calibrateDevice: () => {
    if (typeof window === "undefined") return;
    const reduce = prefersReducedMotion();
    set({
      quality: "standard",
      autoRotate: !reduce,
      animationPaused: reduce,
    });
  },
}));
