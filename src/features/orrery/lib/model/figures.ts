import { AU_KM, convert, lightTime, measure } from "@horizon/toolkit/science";

import {
  ARM_PITCH_DEG,
  ARM_START_KPC,
  BAR_ANGLE_DEG,
  CLEAR_DONE,
  EMBRYOS_AFTER,
  GALACTIC_YEAR,
  GAS_DISK_LIFETIME,
  LHB_CLASSIC,
  MODEL_START,
  PLANETESIMALS_AFTER,
  RADIAL_AMPLITUDE_LY,
  RADIAL_PERIOD,
  SNOW_LINE_AU,
  SUN_BIRTH,
  SUN_GALACTIC_RADIUS_LY,
  SUN_HEIGHT_LY,
  VERTICAL_AMPLITUDE_LY,
  VERTICAL_PERIOD,
  WARP_START_KPC,
} from "./parameters";

/** Rounds to `step` (10, 0.01…), so ICU prints "27,000" and "8.28" rather than float noise. */
const round = (value: number, step: number) => Math.round(value / step) * step;
const toFixed = (value: number, digits: number) => Number(value.toFixed(digits));

/** Figures the cards format themselves, computed from the shared constants. */
export const ORRERY_FIGURES = {
  /** 1 au in millions of km (149.6). */
  auMillionKm: AU_KM / 1e6,
  /** Light-time across 1 au, in minutes (8.3). */
  auLightMinutes: lightTime(1).value,
  /** Nominal solar radius in km (695,700) and in au (0.0047). */
  sunRadiusKm: measure(1, "Rsun").in("km"),
  sunRadiusAu: measure(1, "Rsun").in("au"),
};

/**
 * ICU arguments for copy that quotes the model's own numbers. Messages write
 * `{galacticYearMyr} million years` instead of "230", so a change in
 * `parameters.ts` reaches the scene, the formulas and every sentence at once.
 */
export const ORRERY_COPY = {
  sunBirthGyr: SUN_BIRTH / 1e9,
  gasMyr: GAS_DISK_LIFETIME / 1e6,
  planetesimalsKyr: PLANETESIMALS_AFTER / 1e3,
  embryosMyr: EMBRYOS_AFTER / 1e6,
  snowLineAu: SNOW_LINE_AU,
  lhbGyr: LHB_CLASSIC / 1e9,
  modelStartGyr: MODEL_START / 1e9,
  clearDoneGyr: CLEAR_DONE / 1e9,
  galacticYearMyr: GALACTIC_YEAR / 1e6,
  /** Laps since the Sun formed (≈ 21). */
  laps: Math.round(SUN_BIRTH / GALACTIC_YEAR),
  sunRadiusLy: SUN_GALACTIC_RADIUS_LY,
  sunRadiusKpc: toFixed(convert(SUN_GALACTIC_RADIUS_LY, "ly", "kpc"), 2),
  /** The full radial swing, inner to outer end. */
  radialSwingLy: round(2 * RADIAL_AMPLITUDE_LY, 100),
  radialSwingKpc: round(convert(2 * RADIAL_AMPLITUDE_LY, "ly", "kpc"), 1),
  radialMyr: RADIAL_PERIOD / 1e6,
  verticalLy: VERTICAL_AMPLITUDE_LY,
  verticalPc: round(convert(VERTICAL_AMPLITUDE_LY, "ly", "pc"), 10),
  verticalMyr: VERTICAL_PERIOD / 1e6,
  heightLy: SUN_HEIGHT_LY,
  heightPc: Math.round(convert(SUN_HEIGHT_LY, "ly", "pc")),
  barLy: round(convert(2 * ARM_START_KPC, "kpc", "ly"), 1000),
  barKpc: toFixed(2 * ARM_START_KPC, 1),
  barHalfKpc: ARM_START_KPC,
  barDeg: BAR_ANGLE_DEG,
  pitchDeg: ARM_PITCH_DEG,
  warpStartKpc: WARP_START_KPC,
};
