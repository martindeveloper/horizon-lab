import type { Quality } from "./holes/types";

export type { Quality, HoleKind, BlackHoleParams, Preset } from "./holes/types";
export { paramsFromPreset } from "./holes/types";
export { PRESETS, DEFAULT_PRESET, holeById, HOLES } from "./holes";

export const MIN_DIST = 0.32;
export const MAX_DIST = 480;

export const QUALITY_STEPS: Record<Quality, number> = {
  economy: 144,
  standard: 192,
  cinema: 256,
};

export const QUALITY_SCALE: Record<Quality, number> = {
  economy: 0.72,
  standard: 0.9,
  cinema: 1,
};
