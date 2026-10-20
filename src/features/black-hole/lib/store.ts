import { create } from "zustand";

import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { TAU, wrap } from "@horizon/toolkit/math";
import type { PassAntialias } from "@horizon/toolkit/rendering";

import { presetFromPath } from "../routing";
import {
  DEFAULT_PRESET,
  PRESETS,
  paramsFromPreset,
  type BlackHoleParams,
  type Quality,
} from "./holes";
import { cameraFloor } from "./physics";
import type { PinId } from "./pins";
import { tourFor } from "./tours";

type BlackHoleStore = BlackHoleParams & {
  /** Camera heading in radians, wrapped to [0, 2π); kept across presets. */
  azimuth: number;
  setAzimuth: (v: number) => void;
  animationPaused: boolean;
  setAnimationPaused: (v: boolean) => void;
  /** Off shows the same scene in flat space; presets and the guide turn it back on. */
  gravity: boolean;
  setGravity: (v: boolean) => void;
  guideOpen: boolean;
  guideBeat: number;
  guideArrived: boolean;
  settingsOpen: boolean;
  mapOpen: boolean;
  clocksOpen: boolean;
  skyReady: boolean;
  activePin: PinId | null;
  /** Whether the camera was orbiting before a pin or the guide stopped it, to resume after. */
  orbitBeforePin: boolean | null;
  orbitBeforeGuide: boolean | null;
  applyPreset: (id: string) => void;
  setSpin: (v: number) => void;
  setInclination: (v: number) => void;
  setDistance: (v: number) => void;
  setExposure: (v: number) => void;
  setDiskBrightness: (v: number) => void;
  setStarIntensity: (v: number) => void;
  setAutoRotate: (v: boolean) => void;
  setQuality: (v: Quality) => void;
  /** Anti-aliasing (experimental, off by default). */
  antialiasing: PassAntialias;
  setAntialiasing: (v: PassAntialias) => void;
  startGuide: () => void;
  advanceGuide: () => void;
  /** Back one beat; the camera flies back to it. */
  previousGuide: () => void;
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
  gravity: true,
  setGravity: (gravity) => set({ gravity }),
  guideOpen: false,
  guideBeat: 0,
  guideArrived: false,
  settingsOpen: false,
  mapOpen: false,
  clocksOpen: false,
  skyReady: false,
  activePin: null,
  orbitBeforePin: null,
  orbitBeforeGuide: null,
  applyPreset: (id) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (get().guideOpen) get().endGuide();
    if (get().activePin) get().setActivePin(null);
    const s = get();
    set({
      ...paramsFromPreset(preset, s.quality, s.autoRotate),
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
  setQuality: (quality) => set({ quality }),
  antialiasing: "off",
  setAntialiasing: (antialiasing) => set({ antialiasing }),
  startGuide: () => {
    const s = get();
    if (s.activePin) s.setActivePin(null);
    set({
      orbitBeforeGuide: get().orbitBeforeGuide ?? get().autoRotate,
      guideOpen: true,
      guideBeat: 0,
      guideArrived: false,
      autoRotate: false,
      gravity: true,
      settingsOpen: false,
      mapOpen: false,
      clocksOpen: false,
      activePin: null,
    });
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
  previousGuide: () => {
    const s = get();
    if (!s.guideOpen || s.guideBeat === 0) return;
    set({ guideBeat: s.guideBeat - 1, guideArrived: false });
  },
  endGuide: () => {
    const resume = get().orbitBeforeGuide;
    set({
      guideOpen: false,
      guideArrived: false,
      guideBeat: 0,
      orbitBeforeGuide: null,
      ...(resume ? { autoRotate: true } : {}),
    });
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
      quality: "standard",
      autoRotate: !reduce,
      animationPaused: reduce,
    });
  },
}));
