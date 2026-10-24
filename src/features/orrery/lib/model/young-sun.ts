/**
 * The faint young Sun: on the main sequence the Sun has brightened as its core turned hydrogen
 * to helium, so the young Sun shone at about seven tenths of today's output. Gough's (1981)
 * interpolation of standard solar models gives the luminosity by age, and the habitable zone
 * moves with its square root, where the same sunlight falls (Kopparapu et al. 2013 set today's
 * edges). The law is applied from the sketch's start, with the gas disk gone and the Sun on the
 * main sequence; the contracting Sun before it is not modelled.
 */
import { MODEL_START, SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { defineEquation, formatNumber } from "@horizon/toolkit/science";

import { HABITABLE_ZONE_AU, YOUNG_SUN_DIMMING } from "./parameters";

const n = (value: number) => formatNumber(value, "en", 3);
const gyr = (years: number) => n(years / 1e9);

/** Gough (1981): L(t) = L☉ / (1 + 0.4 (1 − t / t☉)), `t` the Sun's age. */
export const youngSunLuminosity = defineEquation({
  id: "young-sun-luminosity",
  text: `L(t) = L☉ / (1 + ${n(YOUNG_SUN_DIMMING)} (1 − t / ${gyr(SUN_BIRTH)} Gyr))`,
  latex: `L(t) = \\frac{L_\\odot}{1 + ${n(YOUNG_SUN_DIMMING)}\\left(1 - t / ${gyr(SUN_BIRTH)}\\,\\mathrm{Gyr}\\right)}`,
  output: "L",
  variables: {
    t: { symbol: "t", latex: "t", unit: "yr" },
    L: { symbol: "L", latex: "L", unit: "Lsun" },
  },
  compute: ({ t }) => 1 / (1 + YOUNG_SUN_DIMMING * (1 - t / SUN_BIRTH)),
});

/** An edge of the habitable zone at a luminosity: the distance the same sunlight falls at. */
export const habitableZoneEdge = defineEquation({
  id: "habitable-zone-edge",
  text: "d(L) = d_today √(L / L☉)",
  latex: "d(L) = d_{today}\\sqrt{L / L_\\odot}",
  output: "d",
  variables: {
    today: { symbol: "d_today", latex: "d_{today}", unit: "au" },
    L: { symbol: "L", latex: "L", unit: "Lsun" },
    d: { symbol: "d", latex: "d", unit: "au" },
  },
  compute: ({ today, L }) => today * Math.sqrt(L),
});

export const YOUNG_SUN_EQUATIONS = [youngSunLuminosity, habitableZoneEdge];

/** The law holds from the sketch's start on: the gas disk gone, the Sun on the main sequence. */
export const youngSunModelled = (yearsAgo: number) => yearsAgo <= MODEL_START;

/** The Sun's output at a moment, in today's (L☉); before the sketch's start, held at its first value. */
export function sunLuminosity(yearsAgo: number) {
  return youngSunLuminosity.compute({ t: SUN_BIRTH - Math.min(yearsAgo, MODEL_START) });
}

/** The habitable zone's edges at a moment (au). */
export function habitableZone(yearsAgo: number): { inner: number; outer: number } {
  const L = sunLuminosity(yearsAgo);
  const [inner, outer] = HABITABLE_ZONE_AU;
  return {
    inner: habitableZoneEdge.compute({ today: inner, L }),
    outer: habitableZoneEdge.compute({ today: outer, L }),
  };
}
