/**
 * Illustrative Hα prominences, not an MHD solution or features read off the HMI map. A
 * prominence is cool (~10⁴ K), dense plasma held in the dips of a sheared magnetic field
 * above a polarity-inversion line: a hedgerow of near-vertical threads with barbs reaching
 * down to the chromosphere, seen in Hα emission beyond the limb and as a dark filament
 * against the disc (Parenti 2014, LRSP 11, 1; Gibson 2018, LRSP 15, 7; Vial & Engvold 2015,
 * ASSL 415). Lengths and heights are fractions of the solar radius; positions, the timing of
 * each region's cycle and the course of its eruption are authored.
 */
export const SUN_RADIUS_MM = 695.7;
/** Model seconds per displayed second: a quarter of an hour of the Sun passes each second. */
export const SUN_ACTIVITY_TIME_SCALE = 900;
/** One region's cycle: a quiescent spell, a slow then fast rise, and re-formation (37.5 h). */
export const SUN_ACTIVITY_CYCLE_SECONDS = 150;
/** Phases of the cycle: the slow rise (4.5 h), the fast rise and eruption (80 min), re-formation. */
export const SUN_ACTIVITY_SLOW_RISE_START = 0.62;
export const SUN_ACTIVITY_FAST_RISE_START = 0.74;
export const SUN_ACTIVITY_FAST_RISE_END = 0.775;
/** Height multipliers: the end of the slow rise, and where the erupting plasma has thinned away. */
export const SUN_ACTIVITY_SLOW_RISE_LIFT = 1.2;
export const SUN_ACTIVITY_MAX_LIFT = 2.4;
/**
 * Thread flows, km/s: downflows draining the hedgerow's threads and counter-streaming along
 * them (Zirker, Engvold & Martin 1998, Nature 396, 440; Parenti 2014 §4), and how much faster
 * the legs drain while the body erupts.
 */
export const SUN_ACTIVITY_DRAIN_KMS = 15;
export const SUN_ACTIVITY_STREAM_KMS = 20;
export const SUN_ACTIVITY_ERUPTION_DRAIN = 3;
/** Kink oscillation of the whole body: period in minutes and damping ratio (Arregui et al. 2018, LRSP 15, 3). */
export const SUN_ACTIVITY_SWAY_PERIOD_MIN = 40;
export const SUN_ACTIVITY_SWAY_DAMPING = 0.08;
/** Sideways sway at the apex, in half-spans; one eruption's disturbance rocks the others. */
export const SUN_ACTIVITY_SWAY_LIMIT = 0.12;
export const SUN_ACTIVITY_SWAY_KICK = 0.1;
/** The baked volume's half-thickness across the sheet, as a fraction of the half-length. */
export const SUN_ACTIVITY_DEPTH_RATIO = 0.24;
/** A bound's floor sinks below the photosphere by this times the half-length squared, so the sheet's ends stay rooted on the curving surface. */
export const SUN_ACTIVITY_SINK = 0.55;
/** An erupting body widens across the sheet as it rises: the depth's growth per unit of lift. */
export const SUN_ACTIVITY_LIFT_WIDENING = 0.6;
/** The tallest quiescent body, solar radii (quiescent prominences reach 10–100 Mm). */
export const SUN_ACTIVITY_MAX_HEIGHT = 0.11;
export const SUN_ACTIVITY_MAX_STEPS = 48;
/** Hα optical depth per solar radius of unit density: a thread is translucent, a knot opaque. */
export const SUN_ACTIVITY_EXTINCTION = 150;
/**
 * Linear RGB display colours. Beyond the limb the threads glow in Balmer Hα (656.3 nm) with
 * Hβ and He I D₃ whitening the dense knots; against the disc a filament absorbs the
 * chromosphere's Hα. Authored for visibility over the visible-light map, not a spectral fit.
 */
export const SUN_ACTIVITY_THREAD_RGB = [0.95, 0.24, 0.2] as const;
export const SUN_ACTIVITY_KNOT_RGB = [1.5, 0.72, 0.62] as const;
export const SUN_ACTIVITY_FILAMENT_RGB = [0.12, 0.05, 0.04] as const;

/** The drain in solar radii per displayed second, and the counter-streaming relative to it. */
export const SUN_ACTIVITY_DRAIN_SPEED =
  (SUN_ACTIVITY_DRAIN_KMS * SUN_ACTIVITY_TIME_SCALE) / (SUN_RADIUS_MM * 1000);
export const SUN_ACTIVITY_STREAM_RATIO = SUN_ACTIVITY_STREAM_KMS / SUN_ACTIVITY_DRAIN_KMS;

/**
 * Latitude, longitude, Joy's-law tilt, height, length, cycle offset (radians, solar radii).
 * Anchored along the magnetic polarity-inversion channels of the May 2024 SDO/HMI active
 * regions (including AR 13664 at −19°) and higher-latitude quiescent filament channels:
 * active-region filaments are short and low, quiescent ones long and tall.
 */
export const PROMINENCE_REGIONS = [
  [-0.33, 3.35, 0.46, 0.075, 0.24, 0.08],
  [0.44, 4.08, -0.52, 0.105, 0.32, 0.24],
  [-0.25, 0.52, 0.42, 0.08, 0.26, 0.41],
  [0.34, 5.02, -0.38, 0.095, 0.3, 0.58],
  [-0.18, 5.88, 0.34, 0.07, 0.22, 0.74],
  [0.5, 1.72, -0.32, SUN_ACTIVITY_MAX_HEIGHT, 0.34, 0.91],
] as const;
export const SUN_ACTIVITY_REGION_COUNT = PROMINENCE_REGIONS.length;

type SolarActivityState = {
  solarActivity: boolean;
  solarActivityPaused: boolean;
  closeUp: { kind: string } | null;
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
    state.closeUp?.kind === "sun" &&
    close?.id === "sun" &&
    close.phase === "on"
  );
}
