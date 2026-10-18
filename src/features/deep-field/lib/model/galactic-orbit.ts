/** The Sun's orbit about the Galactic centre: where it is today and the path it came by. */
import { galacticAngle } from "@/space/solar-system/model/equations";
import { GALACTIC_YEAR } from "@/space/solar-system/model/parameters";

import { galacticHeight, galacticRadius } from "./equations";
import { BAR_ANGLE_DEG } from "./parameters";

/** Orientation of the Galactic bar relative to the Sun–centre line (~28°). */
export const BAR_ANGLE = (BAR_ANGLE_DEG * Math.PI) / 180;

/** Laps of the Galaxy that drawn path covers: the last two, a teaching choice. */
export const TRAIL_LAPS = 2;

/**
 * Schematic galactic position of the Sun `yearsAgo` years ago, ly from the centre. Today is
 * pinned at (R0, z☉, 0); the phase in the deep past is not a known coordinate. Viewed from the
 * north galactic pole (scene +Y) the Sun orbits clockwise, as it really does.
 */
export function sunGalactic(yearsAgo: number, out: [number, number, number] = [0, 0, 0]) {
  const theta = galacticAngle.compute({ t: yearsAgo });
  const R = galacticRadius.compute({ t: yearsAgo });
  out[0] = R * Math.cos(theta);
  out[1] = galacticHeight.compute({ t: yearsAgo });
  out[2] = -R * Math.sin(theta);
  return out;
}

/** The Sun's path over its last `TRAIL_LAPS` laps, oldest first; returns the vertex count. */
export function writeSunTrail(out: Float32Array) {
  const steps = out.length / 3 - 1;
  const tmp: [number, number, number] = [0, 0, 0];
  for (let i = 0; i <= steps; i += 1) {
    sunGalactic(TRAIL_LAPS * GALACTIC_YEAR * (1 - i / steps), tmp);
    out.set(tmp, i * 3);
  }
  return steps + 1;
}
