export type { Quality, HoleKind, BlackHoleParams, Preset } from "./holes/types";
export { paramsFromPreset } from "./holes/types";
export { PRESETS, DEFAULT_PRESET, holeById, HOLES } from "./holes";

/** Below every spin's `cameraFloor` (physics.ts), which the camera also respects. */
export const MIN_DIST = 1.6;
export const MAX_DIST = 480;
