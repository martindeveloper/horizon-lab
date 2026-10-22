/**
 * The hedgerow prominence volume's numbers, once: what its shaders read (through the shared
 * header) and what its hosts size it by. The Orrery's schedule of each region's cycle and the
 * Sun lab's frame place and move the bodies; this is the body itself.
 */
import { SOLAR_RADIUS_KM } from "@horizon/toolkit/science";

/** Bodies one draw holds at most (the uniform array the shaders index). */
export const SUN_ACTIVITY_MAX_REGIONS = 8;
/** Height multiplier at which the erupting plasma has thinned away. */
export const SUN_ACTIVITY_MAX_LIFT = 2.4;
/**
 * Thread flows, km/s: downflows draining the hedgerow's threads and counter-streaming along
 * them (Zirker, Engvold & Martin 1998, Nature 396, 440; Parenti 2014 §4).
 */
export const SUN_ACTIVITY_DRAIN_KMS = 15;
export const SUN_ACTIVITY_STREAM_KMS = 20;
/** The drain in solar radii per model second, and the counter-streaming relative to it. */
export const SUN_ACTIVITY_DRAIN_RADII_PER_S = SUN_ACTIVITY_DRAIN_KMS / SOLAR_RADIUS_KM;
export const SUN_ACTIVITY_STREAM_RATIO = SUN_ACTIVITY_STREAM_KMS / SUN_ACTIVITY_DRAIN_KMS;
/** How much faster the legs drain while the body erupts. */
export const SUN_ACTIVITY_ERUPTION_DRAIN = 3;
/** The drained length wraps here, far beyond a thread's streak period, keeping the uniform precise. */
export const SUN_ACTIVITY_FLOW_WRAP = 256;
/** Sideways sway at the apex, in half-spans, at most. */
export const SUN_ACTIVITY_SWAY_LIMIT = 0.12;
/** The baked volume's half-thickness across the sheet, as a fraction of the half-length. */
export const SUN_ACTIVITY_DEPTH_RATIO = 0.24;
/** A bound's floor sinks below the photosphere by this times the half-length squared, so the sheet's ends stay rooted on the curving surface. */
export const SUN_ACTIVITY_SINK = 0.55;
/** An erupting body widens across the sheet as it rises: the depth's growth per unit of lift. */
export const SUN_ACTIVITY_LIFT_WIDENING = 0.6;
/** The tallest quiescent body, solar radii (quiescent prominences reach 10–100 Mm). */
export const SUN_ACTIVITY_MAX_HEIGHT = 0.11;
/** Ray-march steps through a bound at most; a host's quality passes fewer. */
export const SUN_ACTIVITY_MAX_STEPS = 64;
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
