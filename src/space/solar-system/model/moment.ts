/**
 * The solar system at a moment, the teaching model on top of the ephemeris.
 *
 * Today (and the recent past) is measured: elements from the JPL table. The deep past is a
 * sketch of the giant-planet instability (the Nice model family): giants start packed, a
 * planetesimal disk sits outside them, Neptune's outward move clears it. Everything in that
 * window is labelled as a model where it is shown.
 */
import { GIANTS, type PlanetId } from "@horizon/toolkit/bodies";
import { clamp } from "@horizon/toolkit/math";

import { gasDisk, migrationProgress as migration } from "./equations";
import { MODEL_START, SUN_BIRTH } from "./parameters";

/** Terrestrial planets finish accreting ~30–100 Myr after the first solids. */
const TERRESTRIAL_DONE = MODEL_START;

/** 0 = disk intact, 1 = clearing finished. Smooth inside the window only. */
export function migrationProgress(yearsAgo: number) {
  return migration.compute({ t: yearsAgo });
}

export const sunExists = (yearsAgo: number) => yearsAgo <= SUN_BIRTH;
/** 0 at the first solids, 1 once the gas disk is gone. */
export function gasDiskFade(yearsAgo: number) {
  return 1 - gasDisk.compute({ t: yearsAgo });
}
/**
 * How grown a planet is, 0–1. Giants had to finish inside the gas disk;
 * terrestrial planets kept accreting for tens of millions of years after it.
 */
export function planetGrowth(id: PlanetId, yearsAgo: number) {
  if (yearsAgo > SUN_BIRTH) return 0;
  const since = SUN_BIRTH - yearsAgo;
  if (GIANTS.has(id)) {
    const lead = id === "jupiter" ? 0.5e6 : id === "saturn" ? 1.5e6 : 2.5e6;
    return clamp((since - lead) / 2e6, 0, 1);
  }
  return clamp(since / (SUN_BIRTH - TERRESTRIAL_DONE), 0, 1);
}
/** Within this the ephemeris is used as is; older than this only the sketch is drawn. */
export const isPresentEra = (yearsAgo: number) => yearsAgo < 5e6;

/** A moment the scene is drawn at: years ago, Neptune's migration, and the Motion offset. */
export type SolarMoment = {
  yearsAgo: number;
  /** Neptune's migration, 0..1. */
  mig: number;
  /** Within the ephemeris's era. */
  present: boolean;
  /** Years the Motion switch has run the clock on from now. */
  driftYears: number;
};

export function momentAt(yearsAgo: number, driftYears = 0): SolarMoment {
  return {
    yearsAgo,
    mig: migrationProgress(yearsAgo),
    present: isPresentEra(yearsAgo),
    driftYears,
  };
}

/** Now: the solar system as measured. */
export const TODAY: SolarMoment = momentAt(0);
