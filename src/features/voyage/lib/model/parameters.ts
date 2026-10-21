/**
 * Voyage's numbers, once: the ship's drives and clocks, how close it may come, the irradiance
 * scale. The model computes with them and the technical notes print them.
 */
import { AU_KM, SPEED_OF_LIGHT } from "@horizon/toolkit/science";

/** The speed of light, km/s. */
export const C_KM_S = SPEED_OF_LIGHT / 1000;
/** Standard gravity, km/s² (CGPM 1901): the torch ship's one g. */
export const STANDARD_GRAVITY_KM_S2 = 9.80665e-3;

export type DriveId = "voyager" | "sail" | "torch";

/** A drive: what it does when the ship goes somewhere, and how fast it gets there. */
export type Drive =
  | { id: DriveId; kind: "coast"; /** Cruising speed, km/s. */ speed: number }
  | { id: DriveId; kind: "torch"; /** Proper acceleration, km/s². */ accel: number };

/**
 * The only ways to move. Voyager 1 leaves the solar system at 17 km/s (JPL, 16.9 km/s in
 * 2026); a light sail at a tenth of light speed is the Breakthrough Starshot goal; the torch
 * ship holds one g for as long as it burns, turning over halfway.
 */
export const DRIVES: Readonly<Record<DriveId, Drive>> = {
  voyager: { id: "voyager", kind: "coast", speed: 17 },
  sail: { id: "sail", kind: "coast", speed: 0.1 * C_KM_S },
  torch: { id: "torch", kind: "torch", accel: STANDARD_GRAVITY_KM_S2 },
};

export const DEFAULT_DRIVE: DriveId = "torch";

type ClockRateId = "realTime" | "minute" | "hour" | "day" | "month" | "decade" | "millennium";

/**
 * How many ship seconds pass per real second: the visitor's clock rates, named for the copy
 * (`rates.<id>`). Real time; a minute, an hour, a day, a month, ten years and a thousand
 * years per second.
 */
export const CLOCK_RATES: readonly { id: ClockRateId; value: number }[] = [
  { id: "realTime", value: 1 },
  { id: "minute", value: 60 },
  { id: "hour", value: 3_600 },
  { id: "day", value: 86_400 },
  { id: "month", value: 2.6e6 },
  { id: "decade", value: 3.2e8 },
  { id: "millennium", value: 3.2e10 },
];
export const DEFAULT_COMPRESSION = 3_600;

/** The ship stops this far from a body's centre, in its radii (the Sun's photosphere is hot). */
export const ALTITUDE_FLOOR = 1.02;
export const SUN_ALTITUDE_FLOOR = 1.5;
/** The nearest the frustum comes, km: a stop above a moon's surface still fits. */
export const NEAR_PLANE_KM = 0.5;
/**
 * Light-years from the Sun over which the painted Milky Way band gives way to the Galaxy map:
 * the disk is a thousand light-years thick, so the band is the sky well past the nearest stars.
 */
export const BAND_TO_MAP_LY = [100, 3000] as const;
/** The farthest the frustum reaches with the cosmic map drawn, km: past the microwave background. */
export const COSMIC_FAR_KM = 1e24;

/** Total solar irradiance at 1 au, W/m² (Kopp & Lean 2011, SORCE/TIM). */
export const SOLAR_CONSTANT_W_M2 = 1361;
/** Sunlight at a distance from the Sun, W/m²: the inverse square of its distance in au. */
export const irradianceAt = (km: number) => SOLAR_CONSTANT_W_M2 / (km / AU_KM) ** 2;
