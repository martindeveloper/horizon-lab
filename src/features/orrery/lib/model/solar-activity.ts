/**
 * Illustrative prominences, not an MHD solution or events inferred from the HMI map.
 * Magnetic arches and on-disc filaments follow NASA's qualitative description:
 * https://www.nasa.gov/image-article/what-solar-prominence/
 * Heights are fractions of the solar radius. Positions, colour and timing are authored.
 */
export const SUN_ACTIVITY_CYCLE_SECONDS = 28;
export const SUN_ACTIVITY_MAX_STRETCH = 2.1;
export const SUN_ACTIVITY_LEAN_LIMIT = 0.6;
export const SUN_ACTIVITY_TWIST_LIMIT = 0.45;
export const SUN_ACTIVITY_WAVE_AMPLITUDE = 0.06;
export const SUN_ACTIVITY_DEPTH_RATIO = 0.38;
export const SUN_ACTIVITY_MAX_HEIGHT = 0.11;
export const SUN_ACTIVITY_MAX_STEPS = 32;
export const SUN_ACTIVITY_EXTINCTION = 175;
/**
 * Linear RGB display colours inspired by pink/crimson visible-light prominences:
 * https://www.nasa.gov/image-article/suns-corona-seen-during-2017-solar-eclipse/
 * Authored, enhanced visibility; not a spectral fit, temperature scale or EUV colour table.
 */
export const SUN_ACTIVITY_CRIMSON_RGB = [0.8, 0.022, 0.065] as const;
export const SUN_ACTIVITY_PINK_RGB = [1.8, 0.24, 0.38] as const;
export const SUN_ACTIVITY_FILAMENT_RGB = [0.09, 0.018, 0.03] as const;

/** Latitude, longitude, tilt, height, footpoint separation, cycle offset. Angles in radians. */
export const PROMINENCE_REGIONS = [
  [0.31, 0.2, 1.15, 0.1, 0.25, 0.12],
  [-0.44, 1.22, 0.8, SUN_ACTIVITY_MAX_HEIGHT, 0.3, 0.29],
  [0.38, 2.5, 0.3, 0.065, 0.19, 0.48],
  [-0.26, 3.4, -1.2, 0.09, 0.26, 0.66],
  [0.48, 4.45, 0.6, 0.055, 0.17, 0.83],
  [-0.35, 5.65, -0.2, 0.075, 0.22, 0.96],
] as const;
export const SUN_ACTIVITY_REGION_COUNT = PROMINENCE_REGIONS.length;

export type SolarActivityState = {
  solarActivity: boolean;
  solarActivityPaused: boolean;
  closeUp: boolean;
  selection: { kind: string } | null;
};

/** The model is absent throughout camera flights and outside the Sun's close-up pass. */
export function solarActivityVisible(
  state: SolarActivityState,
  close: { id: string; phase: string } | null,
  solarVisible: boolean,
) {
  return (
    solarVisible &&
    state.solarActivity &&
    state.closeUp &&
    state.selection?.kind === "sun" &&
    close?.id === "sun" &&
    close.phase === "on"
  );
}
