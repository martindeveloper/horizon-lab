/**
 * What the passes draw with: the sky's and the Sun's uniforms, the Sun's colour from the shared
 * CIE/Planck continuum and its limb darkening from the shared Claret tables, each worked out
 * once per temperature and gravity rather than per frame. The globe's own look is the shared
 * solar system's (`@/space/solar-system/graphics/looks`).
 */
import { DataTexture, FloatType, NearestFilter, RGBAFormat, Vector2, Vector3 } from "three";

import { atmosphereProfile, continuumTable } from "@/space/sun/graphics/atmosphere";
import { PROFILE_SAMPLES, SPECTRUM_SAMPLES } from "@/space/sun/graphics/parameters";
import type { DisposalScope } from "@horizon/toolkit/rendering";

/** The limb tables stop at main-sequence gravities; a remnant takes the grey law. */
const GREY_ABOVE_LOGG = 6;
/** A temperature within this share of the last, and a gravity within this much, keep their tables. */
const TEFF_TOLERANCE = 0.004;
const LOGG_TOLERANCE = 0.05;

/** The wide view the sky is drawn in. */
export function viewUniforms() {
  return {
    uRight: { value: new Vector3(1, 0, 0) },
    uUp: { value: new Vector3(0, 1, 0) },
    uForward: { value: new Vector3(0, 0, -1) },
    uTan: { value: new Vector2(1, 1) },
  };
}

/** The Sun as the sky pass sees it: its direction, size, colour and brightness as a point. */
export function sunUniforms() {
  return {
    uSunDirWide: { value: new Vector3(0, 0, -1) },
    uSunRadius: { value: 0.005 },
    uSunColour: { value: new Vector3(1, 1, 1) },
    uPointBright: { value: 0 },
    uGlow: { value: 0 },
    /* A pixel's angle in the wide view and in the disc's frame, radians. */
    uPixel: { value: 0.001 },
    uDiscPixel: { value: 0.001 },
  };
}

export function skyUniforms() {
  return {
    uGlare: { value: 1 },
    uNebula: { value: 0 },
  };
}

function floatTable(data: Float32Array, width: number) {
  const texture = new DataTexture(data, width, 1, RGBAFormat, FloatType);
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The Sun's globe's tables and uniforms: the shared continuum once, the limb profile rewritten
 * only when the temperature or gravity has moved enough to change it.
 */
export function createStarLook(scope: DisposalScope) {
  const spectrum = scope.own(floatTable(continuumTable(), SPECTRUM_SAMPLES));
  const profileData = new Float32Array(PROFILE_SAMPLES * 4);
  const profile = scope.own(floatTable(profileData, PROFILE_SAMPLES));
  const uniforms = {
    uSpectrum: { value: spectrum },
    uProfile: { value: profile },
    uKelvin: { value: 5772 },
    uRefLogY: { value: 0 },
    uExposure: { value: 1 },
    uCells: { value: 1 },
    uTime: { value: 0 },
    uRadiusPx: { value: 1 },
  };
  let teff = 0;
  let logg = Number.NaN;
  return {
    uniforms,
    /** The limb at a temperature and gravity: Claret's fit on the grid, the grey law for a remnant. */
    set(kelvin: number, gravity: number) {
      const sameTeff = Math.abs(kelvin - teff) <= teff * TEFF_TOLERANCE;
      const sameLogg = Math.abs(gravity - logg) <= LOGG_TOLERANCE;
      if (sameTeff && sameLogg) return;
      teff = kelvin;
      logg = gravity;
      profileData.set(atmosphereProfile(kelvin, gravity > GREY_ABOVE_LOGG ? null : gravity));
      profile.needsUpdate = true;
    },
  };
}
