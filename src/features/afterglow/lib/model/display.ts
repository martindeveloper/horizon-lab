/**
 * The display's exposure, one law for the globe and the Sun: the eye adapts to the world's
 * day side. Every radiance is relative to the light a white surface at Earth's orbit has today,
 * in the display's photopic bands (the shared CIE/Planck continuum), so a cool giant's
 * bolometric glare counts for what the eye sees of it.
 */
import { stellarContinuum } from "@/space/sun/graphics/atmosphere";
import { clamp, lerp } from "@horizon/toolkit/math";
import { SOLAR_TEFF_K } from "@horizon/toolkit/science";

import {
  DAY_CEILING,
  DAY_FLOOR,
  DAY_GAMMA,
  DAY_TODAY,
  DISC_PEAK,
  SUN_OVER_SUNLIGHT,
} from "./parameters";

/** Today's photosphere: the continuum colour the eye adapted to sunlight calls white, and its log radiance. */
const TODAY = stellarContinuum(SOLAR_TEFF_K);
export const TODAY_LOG_Y = TODAY[3];

export type Display = {
  /** The world's day side as shown, 0 to `DAY_CEILING`: a white surface facing the Sun. */
  day: number;
  /** The Sun's globe's own exposure: the world's, held so the disc's centre stays under `DISC_PEAK`. */
  discExposure: number;
  /** The continuum's colour, linear, its brightest channel 1: the Sun's light as a filter would show it. */
  colour: readonly [number, number, number];
  /** The Sun's colour against today's, linear: what the day side is tinted by. */
  tint: readonly [number, number, number];
  /** The Sun's visible light here as a share of Earth's today. */
  sunlight: number;
  /** The disc's centre's brightest channel as shown before the tone curve. */
  disc: number;
};

/**
 * The display at a vantage: the Sun's temperature, its radius and the distance in the same
 * unit, and how much of the view the disc fills (0–1). The visible sunlight is the
 * photosphere's radiance against today's, over the distance in radii squared, against the
 * same at one au today. The eye adapts both ways, the day side shown between the floor and
 * the ceiling with today's Earth at today's level, and to the field it sees: a disc that fills
 * the view sets the exposure, and the world is shown by it.
 */
export function displayOf(kelvin: number, radius: number, distance: number, fill: number): Display {
  const [r, g, b, logY] = stellarContinuum(kelvin);
  const radiance = Math.exp(logY - TODAY_LOG_Y);
  const sunlight = radiance * (radius / distance) ** 2 * SUN_OVER_SUNLIGHT;
  const raw = Math.max(sunlight, 1e-30) ** DAY_GAMMA;
  /* The eye on the world: today's level, held between the floor and the ceiling. */
  const dayExposure = Math.min(Math.max(DAY_TODAY, DAY_FLOOR / raw), DAY_CEILING / raw);
  /* The eye on the Sun: its centre's brightest channel at the disc's peak. */
  const peak = Math.max(r, g, b, 1e-6);
  const centre = (radiance * SUN_OVER_SUNLIGHT) ** DAY_GAMMA * peak;
  const sunExposure = DISC_PEAK / centre;
  const exposure = Math.exp(
    lerp(Math.log(dayExposure), Math.log(Math.min(dayExposure, sunExposure)), clamp(fill, 0, 1)),
  );
  const discExposure = Math.min(exposure, sunExposure);
  return {
    day: exposure * raw,
    discExposure,
    disc: discExposure * centre,
    colour: [Math.max(0, r) / peak, Math.max(0, g) / peak, Math.max(0, b) / peak],
    tint: [
      Math.max(0, r) / Math.max(TODAY[0], 1e-6),
      Math.max(0, g) / Math.max(TODAY[1], 1e-6),
      Math.max(0, b) / Math.max(TODAY[2], 1e-6),
    ],
    sunlight,
  };
}
