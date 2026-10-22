/**
 * Numbers the Sun's shared graphics are built with, once: the continuum and limb tables Giants
 * and the Sun lab sample, the supergranular network's scale, when a feature resolves, the
 * faculae's contrast and the chromosphere's and spicules' heights. Each lab's header defines what
 * its own shaders read; `shader-defines.ts` writes the shared shaders' header.
 */

import { SOLAR_RADIUS_KM } from "@horizon/toolkit/science";

import {
  CHROMOSPHERE_THICKNESS_KM,
  GRANULE_SIZE_KM,
  SPICULE_REACH_KM,
  SUPERGRANULE_SIZE_KM,
} from "../model/parameters";

/** CIE/Planck continuum lookup (log-spaced) and the limb/latitude profiles, sampled at texel centres. */
export const SPECTRUM_MIN_K = 500;
export const SPECTRUM_MAX_K = 100_000;
export const SPECTRUM_SAMPLES = 384;
export const PROFILE_SAMPLES = 129;
/** A supergranule is this many granules across: the supergranular network's scale. */
export const NETWORK_GRANULES = SUPERGRANULE_SIZE_KM / GRANULE_SIZE_KM;
/** A surface feature resolves above this many drawing-buffer pixels (`resolvedPixels`). */
export const SURFACE_RESOLVE_PX = 2;
/** Faculae round an active region: this much hotter where they show best, at the limb. */
export const FACULA_CONTRAST = 0.09;
/** The chromosphere's depth and the spicules' reach, in the star's radii: the Sun's, every star drawn alike. */
export const CHROMOSPHERE_HEIGHT = CHROMOSPHERE_THICKNESS_KM / SOLAR_RADIUS_KM;
export const SPICULE_HEIGHT = SPICULE_REACH_KM / SOLAR_RADIUS_KM;
