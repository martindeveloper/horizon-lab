/**
 * Numbers the Sun's shared graphics are built with, once: the continuum and limb tables Giants
 * and the Sun lab sample, and the supergranular network's scale. Each lab's header defines what
 * its own shaders read; `shader-defines.ts` writes the shared shaders' header.
 */

/** CIE/Planck continuum lookup (log-spaced) and the limb/latitude profiles, sampled at texel centres. */
export const SPECTRUM_MIN_K = 500;
export const SPECTRUM_MAX_K = 100_000;
export const SPECTRUM_SAMPLES = 384;
export const PROFILE_SAMPLES = 129;
/** A supergranule is about this many granules across (30,000 km against 1,000 km on the Sun). */
export const NETWORK_GRANULES = 30;
