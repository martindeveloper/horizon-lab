/**
 * Where a planet's centre is beside its system's barycentre. The planetary elements
 * (`@horizon/toolkit/bodies`, JPL) place the Earth–Moon and Pluto–Charon barycentres, not the
 * planets: the Moon swings Earth's centre 4,670 km (0.73 Earth radii) about the barycentre,
 * and Charon swings Pluto's 2,100 km, outside Pluto's surface. On a map of the solar system
 * that is below a pixel; a camera at a planet sees it, and it moves the day of Earth's
 * perihelion by up to a day and a half.
 */
import type { MoonId, PlanetId, Vec3 } from "@horizon/toolkit/bodies";

import { moonOffset } from "./moon-orbits";
import { CHARON_PLUTO_MASS_RATIO, MOON_EARTH_MASS_RATIO } from "./parameters";

/** The hosts whose elements are their system's barycentre, and the moon that moves them. */
export type BarycentreHost = Extract<PlanetId, "earth"> | "pluto";

const PARTNER: Record<BarycentreHost, { moon: MoonId; ratio: number }> = {
  earth: { moon: "moon", ratio: MOON_EARTH_MASS_RATIO },
  pluto: { moon: "charon", ratio: CHARON_PLUTO_MASS_RATIO },
};

/** The barycentre's place along the line from the host to its moon: m / (M + m). */
export const barycentreShare = (host: BarycentreHost) =>
  PARTNER[host].ratio / (1 + PARTNER[host].ratio);

export const isBarycentreHost = (id: string): id is BarycentreHost =>
  id === "earth" || id === "pluto";

/**
 * The host's centre relative to its system's barycentre at `date`, au, scene axes: the moon's
 * offset scaled by −m / (M + m). Add it to the host's Kepler position for the host itself.
 */
export function barycentreOffset(host: BarycentreHost, date: Date, out: Vec3 = [0, 0, 0]): Vec3 {
  moonOffset(PARTNER[host].moon, date, out);
  const share = -barycentreShare(host);
  out[0] *= share;
  out[1] *= share;
  out[2] *= share;
  return out;
}
