/** The Sun's orbit about the Galactic centre: its position, trail and laps. */
import { galacticAngle, galacticHeight, galacticRadius } from "./equations";
import {
  BAR_ANGLE_DEG,
  GALACTIC_YEAR,
  SUN_BIRTH,
  SUN_GALACTIC_RADIUS_LY,
  SUN_HEIGHT_LY,
} from "./parameters";

/** Orientation of the Galactic bar relative to the Sun–centre line (~28°). */
export const BAR_ANGLE = (BAR_ANGLE_DEG * Math.PI) / 180;

/**
 * Schematic galactic position of the Sun. Today is pinned at (R0, z☉, 0); the
 * phase in the deep past is not a known coordinate. Viewed from the north
 * galactic pole (scene +Y) the Sun orbits clockwise, as it really does.
 */
export function sunGalactic(
  yearsAgo: number,
  wobble: boolean,
  out: [number, number, number] = [0, 0, 0],
) {
  if (yearsAgo > SUN_BIRTH) return null;
  const theta = galacticAngle.compute({ t: yearsAgo });
  const vertical = wobble ? galacticHeight.compute({ t: yearsAgo }) : SUN_HEIGHT_LY;
  const R = wobble ? galacticRadius.compute({ t: yearsAgo }) : SUN_GALACTIC_RADIUS_LY;
  out[0] = R * Math.cos(theta);
  out[1] = vertical;
  out[2] = -R * Math.sin(theta);
  return out;
}

export function writeSunTrail(out: Float32Array, yearsAgo: number, wobble: boolean) {
  if (yearsAgo > SUN_BIRTH) return 0;
  const steps = out.length / 3 - 1;
  const span = 2 * GALACTIC_YEAR;
  const tmp: [number, number, number] = [0, 0, 0];
  let written = 0;
  for (let i = 0; i <= steps; i += 1) {
    const y = Math.min(SUN_BIRTH, yearsAgo + span * (1 - i / steps));
    if (!sunGalactic(y, wobble, tmp)) continue;
    out[i * 3] = tmp[0];
    out[i * 3 + 1] = tmp[1];
    out[i * 3 + 2] = tmp[2];
    written = i + 1;
  }
  return written;
}

/** Return a new vertex count only when the trail's inputs change; null keeps the GPU buffer. */
export function createSunTrailWriter(out: Float32Array) {
  let previousYears: number | undefined;
  let previousWobble: boolean | undefined;
  return (yearsAgo: number, wobble: boolean): number | null => {
    if (yearsAgo === previousYears && wobble === previousWobble) return null;
    const count = writeSunTrail(out, yearsAgo, wobble);
    previousYears = yearsAgo;
    previousWobble = wobble;
    return count;
  };
}

export const galacticLaps = (yearsAgo: number) => Math.max(0, SUN_BIRTH - yearsAgo) / GALACTIC_YEAR;
