/**
 * Lightning in Earth's storms, seen from orbit as flickers in the cloud on the night side. The
 * rate is the globe's measured one today (Christian et al. 2003, five years of the Optical
 * Transient Detector), spread evenly over the globe: the real flashes crowd over tropical land,
 * ten to one against the sea, which the scene has no storm map for. Away from today it is a
 * model: thunderstorms are water's, so the flashes thin as the oceans go (`oceans.ts`) and end
 * with them.
 */
import { literatureFact } from "@/lib/facts";

import { earthDryness } from "./oceans";

/** Flashes a second over the whole globe, in cloud and to the ground together. */
export const FLASH_RATE = literatureFact(44, "count", "christian2003", "verified", {
  range: [39, 49],
  note: "lightning flashes a second over the whole globe, in cloud and to the ground together",
});

/** Flashes a second per steradian of the globe, seen from its centre, at an age. */
export function flashDensity(age: number) {
  return (FLASH_RATE.value / (4 * Math.PI)) * (1 - earthDryness(age));
}
