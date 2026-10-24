/**
 * Two dated changes the scene draws since the clearing. Saturn's rings come in across their
 * dated age window: nothing in the model forms them. The Moon is drawn from the narrated impact
 * on, its distance from Earth growing from just outside the fluid Roche limit through the tidal
 * records (rhythmites and Milankovitch cycles in dated rocks) to today's orbit; between records
 * it follows the constant-torque law, a sketch of a rate that swung with the oceans' resonances.
 */
import type { Facts } from "@/lib/facts";
import { FIGURES, GM_KM3_S2, moonById } from "@horizon/toolkit/bodies";
import { smoothstep } from "@horizon/toolkit/math";

import { rocheLimit, tidalRecession } from "./equations";
import { MOON_IMPACT_AFTER, SATURN_RINGS_AGE, SUN_BIRTH } from "./parameters";

const MOON = moonById("moon");
/** The Moodies Group's tidal bundles put the Moon at about this share of today's distance 3.22 Gyr ago. */
const MOODIES_SHARE_PERCENT = 70;

/** Saturn's rings as drawn: none before their dated window, whole from its younger bound on. */
export function saturnRingsFormed(yearsAgo: number) {
  return 1 - smoothstep(SATURN_RINGS_AGE[0], SATURN_RINGS_AGE[1], yearsAgo);
}

/** The Moon exists from the narrated impact on, years ago. */
export const MOON_FORMED = SUN_BIRTH - MOON_IMPACT_AFTER;
export const moonExists = (yearsAgo: number) => yearsAgo <= MOON_FORMED;

/** Earth's density over the Moon's, from the toolkit's GMs and mean radii. */
export const EARTH_MOON_DENSITY_RATIO =
  (GM_KM3_S2.earth / GM_KM3_S2.moon) * (MOON.radiusKm / FIGURES.earth.meanKm) ** 3;
/** The fluid Roche limit for the Moon about Earth, km: the Moon accreted just outside it. */
export const ROCHE_LIMIT_KM = rocheLimit.compute({
  R: FIGURES.earth.meanKm,
  ratio: EARTH_MOON_DENSITY_RATIO,
});

/** The Moon's distance from Earth at dated moments: the impact, then the tidal records. */
export const MOON_DISTANCE = {
  formed: {
    age: {
      value: MOON_FORMED,
      unit: "yr",
      show: "Gyr",
      digits: 3,
      source: "barboni2017",
      status: "teaching-choice",
      note: "the narrated impact, the oldest of the estimates",
    },
    distance: {
      value: ROCHE_LIMIT_KM,
      unit: "km",
      digits: 3,
      source: "salmonCanup2014",
      status: "derived",
      note: "the fluid Roche limit, 2.456 R⊕ (ρ⊕/ρ☾)^(1/3); the Moon accreted just outside it",
    },
  },
  moodies: {
    age: {
      value: 3.22e9,
      unit: "yr",
      show: "Gyr",
      digits: 3,
      source: "eulenfeld2023",
      status: "verified",
    },
    share: {
      value: MOODIES_SHARE_PERCENT,
      unit: "percent",
      source: "eulenfeld2023",
      status: "verified",
      note: "about 70 % of today's distance, from the Moodies Group's tidal bundles",
    },
    distance: {
      value: (MOODIES_SHARE_PERCENT / 100) * MOON.aKm,
      unit: "km",
      digits: 2,
      source: "eulenfeld2023",
      status: "derived",
      note: "the published share of today's semi-major axis",
    },
  },
  joffre: {
    age: {
      value: 2.46e9,
      unit: "yr",
      show: "Gyr",
      digits: 3,
      source: "lantink2022",
      status: "verified",
    },
    distance: {
      value: 321_800,
      unit: "km",
      digits: 3,
      source: "lantink2022",
      status: "verified",
      note: "321,800 ± 6,500 km, from Milankovitch cycles in the Joffre banded iron",
    },
  },
  xiamaling: {
    age: {
      value: 1.4e9,
      unit: "yr",
      show: "Gyr",
      digits: 2,
      source: "meyers2018",
      status: "verified",
    },
    distance: {
      value: 340_900,
      unit: "km",
      digits: 3,
      source: "meyers2018",
      status: "verified",
      note: "340,900 ± 2,600 km (2σ), from Milankovitch cycles in the Xiamaling Formation",
    },
  },
  elatina: {
    age: { value: 6.2e8, unit: "yr", show: "Myr", source: "williams2000", status: "verified" },
    distance: {
      value: 58.16 * FIGURES.earth.meanKm,
      unit: "km",
      digits: 3,
      source: "williams2000",
      status: "verified",
      note: "58.16 ± 0.30 Earth radii at Earth's mean radius, from the Elatina tidal rhythmites",
    },
  },
} satisfies Record<string, Facts>;

type Anchor = { yearsAgo: number; km: number };
/** The records in order of age, the impact first, today's orbit last. */
const ANCHORS: readonly Anchor[] = [
  ...Object.values(MOON_DISTANCE).map((record) => ({
    yearsAgo: record.age.value,
    km: record.distance.value,
  })),
  { yearsAgo: 0, km: MOON.aKm },
].sort((a, b) => b.yearsAgo - a.yearsAgo);

/** The Moon's distance from Earth at a moment, km; null before it exists. */
export function moonDistanceKm(yearsAgo: number): number | null {
  if (!moonExists(yearsAgo)) return null;
  for (let k = 0; k + 1 < ANCHORS.length; k += 1) {
    const older = ANCHORS[k]!;
    const younger = ANCHORS[k + 1]!;
    if (yearsAgo <= older.yearsAgo && yearsAgo >= younger.yearsAgo)
      return tidalRecession.compute({
        a0: older.km,
        a1: younger.km,
        t0: older.yearsAgo,
        t1: younger.yearsAgo,
        t: yearsAgo,
      });
  }
  return MOON.aKm;
}

/** The Moon's distance over today's; 0 before it exists. */
export function moonDistanceRatio(yearsAgo: number) {
  const km = moonDistanceKm(yearsAgo);
  return km === null ? 0 : km / MOON.aKm;
}
