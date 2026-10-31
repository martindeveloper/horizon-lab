/**
 * The faint young Sun along the Orrery's timeline, on the shared law (`@/space/sun/model/young-sun`):
 * the law is applied from the sketch's start, with the gas disk gone and the Sun on the main
 * sequence; the contracting Sun before it is not modelled.
 */
import { MODEL_START, SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { habitableZoneAt, youngSunLuminosity } from "@/space/sun/model/young-sun";

/** The law holds from the sketch's start on: the gas disk gone, the Sun on the main sequence. */
export const youngSunModelled = (yearsAgo: number) => yearsAgo <= MODEL_START;

/** The Sun's output at a moment, in today's (L☉); before the sketch's start, held at its first value. */
export function sunLuminosity(yearsAgo: number) {
  return youngSunLuminosity.compute({ t: SUN_BIRTH - Math.min(yearsAgo, MODEL_START) });
}

/** The habitable zone's edges at a moment (au). */
export function habitableZone(yearsAgo: number): { inner: number; outer: number } {
  return habitableZoneAt(sunLuminosity(yearsAgo));
}
