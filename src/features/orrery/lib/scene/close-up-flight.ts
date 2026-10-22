import { shortest, type Vec } from "@/space/close-up-flight";
import type { BodyId } from "@horizon/toolkit/bodies";
import type { OrbitPose } from "@horizon/toolkit/camera";
/**
 * The Orrery's own close-up framing: a body with its moon, and the detailed map a close-up
 * paints. The flight itself is shared (`@/space/close-up-flight`).
 */
import { clamp, dot3, smootherstep } from "@horizon/toolkit/math";

/** Where the swing puts the moon: this share of the free half-view off the body. */
export const MOON_FILL = 0.6;
/** Steepest tilt the swing turns to, so it never looks straight down a pole. */
const MOON_TILT = 0.6;

const cameraDirection = ({ azimuth, inclination }: Omit<OrbitPose, "distance">): Vec => [
  Math.cos(inclination) * Math.sin(azimuth),
  Math.sin(inclination),
  Math.cos(inclination) * Math.cos(azimuth),
];

/**
 * The pose that frames a body with its moon (`moon`, its offset from the body): from `base`,
 * turned the least way to see the pair side-on, and pulled back until the moon sits
 * `MOON_FILL` of the way to the edge of the free view (`halfTan`). Never nearer than `base`.
 */
export function moonFraming(moon: Vec, base: OrbitPose, halfTan: number): OrbitPose {
  const r = Math.hypot(...moon);
  const now = cameraDirection(base);
  const toward = dot3(now, moon) / (r * r);
  const x = now[0] - toward * moon[0];
  const y = now[1] - toward * moon[1];
  const z = now[2] - toward * moon[2];
  const level = Math.hypot(x, z);
  const azimuth =
    level > 1e-9 ? base.azimuth + shortest(base.azimuth, Math.atan2(x, z)) : base.azimuth;
  const inclination = clamp(Math.atan2(y, level), -MOON_TILT, MOON_TILT);
  const along = dot3(cameraDirection({ azimuth, inclination }), moon);
  const across = Math.sqrt(Math.max(0, r * r - along * along));
  return {
    azimuth,
    inclination,
    distance: Math.max(base.distance, along + across / (halfTan * MOON_FILL)),
  };
}

/**
 * How far into the swing to the moon a hold is at `t` (0..1 of the hold): out between the
 * first two marks, there until the third, back by the fourth. Marks that leave no time to come
 * back (`home` at or before `back`) keep the camera out at the moon to the end of the hold, so
 * the flight out leaves from there and the body is pulled away from only once.
 */
export function moonSwing(t: number, [out, there, back, home]: MoonSwing) {
  const go = smootherstep(clamp((t - out) / (there - out), 0, 1));
  if (home <= back) return go;
  return go * (1 - smootherstep(clamp((t - back) / (home - back), 0, 1)));
}
export type MoonSwing = readonly [out: number, there: number, back: number, home: number];

/** Width of the detailed map painted for a close-up; nearly featureless bodies need less. */
export function closeUpMapWidth(id: BodyId, light: boolean) {
  const plain = id === "uranus" || id === "neptune" || id === "sun";
  if (plain) return light ? 512 : 1024;
  return light ? 1024 : 2048;
}
