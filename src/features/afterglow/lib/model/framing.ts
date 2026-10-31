/**
 * The Sun's frame: the field of view the disc is drawn in, so it spans `DISC_SHARE` of the
 * view's height at today's radius and the radius to `DISC_GROWTH` past it, wherever it is seen
 * from; never under the narrowest frame nor past the widest. Shares are taken on the screen,
 * through the projection's tangents, so a giant in a wide frame keeps its size as exactly as a
 * dwarf in a narrow one. Pure, so the scene and the tests read one law.
 */
import { clamp } from "@horizon/toolkit/math";

import { DISC_GROWTH, DISC_SHARE, FOV_DEG } from "./parameters";

const DEG = Math.PI / 180;

/** The frame, vertical degrees, for a disc `radius` radians across its half that is `solarRadii` R☉. */
export function discFrame(radius: number, solarRadii: number) {
  const share = DISC_SHARE * solarRadii ** DISC_GROWTH;
  const framed = (2 * Math.atan(Math.tan(radius) / share)) / DEG;
  return clamp(framed, FOV_DEG.min, FOV_DEG.wide);
}

/** The disc's share of the view's height in its frame, on the screen. */
export const discShare = (radius: number, solarRadii: number) =>
  Math.tan(radius) / Math.tan((discFrame(radius, solarRadii) * DEG) / 2);
