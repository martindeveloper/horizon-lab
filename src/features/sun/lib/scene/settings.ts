/**
 * What the engine draws with, read every frame from the lab's store: the view, the cut, the
 * switches, the current light with its response and colour ramp, the layer radii, the corona's
 * weights and the render settings. Everything here is the visitor's choice or the model's
 * reading of it; the frame (`frame.ts`) is the Sun itself.
 */
import type { RenderQuality } from "@horizon/toolkit/rendering";
import type { SceneAntialias } from "@horizon/toolkit/scene";

import type { PassbandId } from "./frame";

export const SUN_VIEW_IDS = [
  "surface",
  "inside",
  "sunspot",
  "chromosphere",
  "corona",
  "eruption",
  "cycle",
  "orbit",
] as const;
export type SunViewId = (typeof SUN_VIEW_IDS)[number];

/** A light: its temperature response (a log-normal about `peakK`), its colour ramp and how much each layer shows in it. */
export type SunLight = {
  id: PassbandId;
  peakK: number;
  widthDex: number;
  /** Every temperature the band answers to, with weights (a second peak for 193 and 131); `peakK` alone when absent. */
  peaks?: readonly { kelvin: number; weight: number }[];
  /** Linear RGB stops, dark to bright. */
  ramp: readonly (readonly [number, number, number])[];
  weights: {
    photosphere: number;
    chromosphere: number;
    transition: number;
    corona: number;
    flare: number;
  };
  occultDisc: boolean;
};

export type SunSceneSettings = {
  view: SunViewId;
  /** Parker Solar Probe at its true size, the camera a few metres off. */
  closeUp: boolean;
  /** 0 closed … 1 a quarter wedge. */
  cut: number;
  fieldLines: boolean;
  names: boolean;
  grid: boolean;
  light: SunLight;
  /** Radii in R☉. */
  layers: { core: number; tachocline: number; photosphere: number };
  /** Baumbach's K-corona coefficients, and the F and E coronae's weights. */
  corona: { k: readonly [number, number, number]; f: number; e: number };
  quality: RenderQuality;
  antialias: SceneAntialias | null;
  bloom: boolean;
  lens: boolean;
  wideColour: boolean;
};
