/**
 * What the Sun's model hands the renderer each frame: the shared contract (`src/space/sun`),
 * in the body frame (y the pole), lengths in solar radii, angles in radians. The engine draws
 * it and only interpolates for smooth motion.
 */
import { surfacePoint } from "@/space/sun/model/field";

export { PLACE_IDS, bipoleAxis, tiltedAxis, type PlaceId } from "@/space/sun/frame";
export type {
  Eruption,
  PassbandId,
  Polyline,
  Prominence,
  Region,
  SunFrame,
} from "@/space/sun/frame";

/** The unit vector of a latitude and longitude in the body frame, as the model places it. */
export const directionOf = surfacePoint;
