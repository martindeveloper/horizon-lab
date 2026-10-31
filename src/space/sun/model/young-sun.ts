/**
 * The main-sequence Sun's brightening and the habitable zone that moves with it, for any
 * simulation that shows the Sun by age: the Orrery along its timeline, Afterglow across the
 * Sun's whole life. Gough's (1981) interpolation of standard solar models gives the luminosity
 * by age, within a few per cent of them after the first ~0.2 Gyr (Feulner 2012); the habitable
 * zone's edges move with its square root, where the same sunlight falls (Kopparapu et al. 2013
 * set today's).
 */
import type { Facts } from "@/lib/facts";
import { SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { defineEquation, formatNumber } from "@horizon/toolkit/science";

const n = (value: number) => formatNumber(value, "en", 3);
const gyr = (years: number) => n(years / 1e9);

/** The young Sun shone at about 70 % of today: L(t) = L☉ / (1 + 0.4 (1 − t/t☉)). */
export const YOUNG_SUN_DIMMING = 0.4;
/**
 * The habitable zone's conservative edges today, moist to maximum greenhouse (Kopparapu et al.
 * 2013): one home for every lab that draws or quotes them (the Sun's catalogue lists them).
 */
export const HABITABLE_ZONE = {
  inner: {
    value: 0.99,
    unit: "au",
    source: "kopparapu2013",
    status: "verified",
    note: "moist greenhouse: the conservative inner edge, clouds left out",
  },
  outer: {
    value: 1.7,
    unit: "au",
    source: "kopparapu2013",
    status: "verified",
    note: "maximum greenhouse: the conservative outer edge",
  },
} as const satisfies Facts;
/** The same edges as numbers, au. */
export const HABITABLE_ZONE_AU: readonly [number, number] = [
  HABITABLE_ZONE.inner.value,
  HABITABLE_ZONE.outer.value,
];

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

/** The habitable zone's edges (au) at a luminosity (L☉). */
export function habitableZoneAt(L: number): { inner: number; outer: number } {
  const [inner, outer] = HABITABLE_ZONE_AU;
  return {
    inner: habitableZoneEdge.compute({ today: inner, L }),
    outer: habitableZoneEdge.compute({ today: outer, L }),
  };
}
