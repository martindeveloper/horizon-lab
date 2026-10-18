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
export const SUN_ACTIVITY_EXTINCTION = 215;
/**
 * Linear RGB display colours for visible-light prominences (Balmer Hα 656.3 nm +
 * Hβ 486.1 nm rose-crimson outer threads, warm He I D₃ 587.6 nm + continuum
 * dense core/footpoints, and dark on-disc Hα filament absorption):
 * https://www.nasa.gov/image-article/suns-corona-seen-during-2017-solar-eclipse/
 * Authored, enhanced visibility; not a spectral fit, temperature scale or EUV colour table.
 */
export const SUN_ACTIVITY_CRIMSON_RGB = [0.96, 0.14, 0.13] as const;
export const SUN_ACTIVITY_PINK_RGB = [2.25, 0.68, 0.42] as const;
export const SUN_ACTIVITY_FILAMENT_RGB = [0.14, 0.065, 0.05] as const;

/**
 * Latitude, longitude, Joy's-law tilt, height, footpoint separation, cycle offset (radians).
 * Anchored along the magnetic polarity inversion channels of the May 2024 SDO/HMI active
 * regions (including AR 13664 at −19° S) and high-latitude quiescent filament channels.
 */
export const PROMINENCE_REGIONS = [
  [-0.33, 3.35, 0.46, SUN_ACTIVITY_MAX_HEIGHT, 0.3, 0.08],
  [0.44, 4.08, -0.52, 0.105, 0.29, 0.24],
  [-0.25, 0.52, 0.42, 0.1, 0.28, 0.41],
  [0.34, 5.02, -0.38, 0.098, 0.27, 0.58],
  [-0.18, 5.88, 0.34, 0.102, 0.28, 0.74],
  [0.5, 1.72, -0.32, 0.108, 0.29, 0.91],
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
