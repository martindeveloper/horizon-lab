/**
 * The active regions the Sun's white-light map shows: the NOAA/SWPC Solar Region Summaries for
 * the HMI discs the mosaic is built from (1–22 May 2024; `regions-2024-05.json`, written by
 * `scripts/fetch-solar-regions.mjs`), each from the disc on which it stood nearest the central
 * meridian. Their Carrington coordinates are turned into the model's body frame at the map's
 * epoch. They are the catalogue's record of the reports; a visit starts from the groups the
 * photograph itself shows (`spot-groups.ts`), numbered from these where one matches.
 *
 * Frame: `lon` increases in the direction of rotation (heliographic west, Stonyhurst W positive);
 * the map's central meridian at `MAP_EPOCH` is longitude zero. A region's model longitude is its
 * Carrington longitude minus the central meridian's at the epoch (`MAP_CENTRAL_MERIDIAN_DEG`),
 * which the reports give directly (Lo − W) and which falls at the Carrington synodic rate.
 */
import { wrap } from "@horizon/toolkit/math";
import { RAD_PER_DEG } from "@horizon/toolkit/science";

import {
  DAY_S,
  MAP_EPOCH,
  MSH_PER_RAD2,
  OBSERVED_MIN_AREA_MSH,
  REGION_SIZE_MAX_RAD,
} from "./parameters";
import DATA from "./regions-2024-05.json";
import { CARRINGTON_SYNODIC_PERIOD_D } from "./rotation";

export type ObservedRegion = {
  /** The full NOAA number (13664). */
  number: number;
  /** Heliographic latitude, radians. */
  lat: number;
  /** Model longitude at `MAP_EPOCH`, radians. */
  lon: number;
  /** The group's angular radius, radians, from its area. */
  size: number;
  /** As reported: Carrington longitude and Stonyhurst longitude (west positive), degrees; area, millionths of a hemisphere. */
  carringtonLon: number;
  stonyhurstLon: number;
  areaMsh: number;
  /** Hale class ("Beta-Gamma-Delta") and the report's date. */
  hale: string;
  date: string;
};

/** Where the reports come from, for cards and the ledger. */
export const OBSERVED_SOURCE = {
  reference: DATA.reference,
  fetched: DATA.fetched,
  urls: DATA.urls,
  note: DATA.note,
};

/** The Carrington longitude of the central meridian on each disc's date, degrees. */
export const CENTRAL_MERIDIANS: readonly { date: number; lon: number }[] = DATA.reports.map(
  (report) => ({ date: Date.parse(report.date), lon: report.centralMeridianCarringtonLon }),
);

/** The central meridian's rate of change, degrees per day: westward features gain this much Stonyhurst longitude a day. */
export const CARRINGTON_RATE_DEG_PER_DAY = 360 / CARRINGTON_SYNODIC_PERIOD_D;

/** The central meridian's Carrington longitude at a time (ms), from the nearest report and the synodic rate. */
export function centralMeridianAt(timeMs: number) {
  let nearest = CENTRAL_MERIDIANS[0]!;
  for (const report of CENTRAL_MERIDIANS)
    if (Math.abs(report.date - timeMs) < Math.abs(nearest.date - timeMs)) nearest = report;
  const days = (timeMs - nearest.date) / (DAY_S * 1e3);
  return wrap(nearest.lon - CARRINGTON_RATE_DEG_PER_DAY * days, 360);
}

/** The map's central meridian at its epoch: the model's longitude zero, in Carrington degrees. */
export const MAP_CENTRAL_MERIDIAN_DEG = centralMeridianAt(MAP_EPOCH);

export const MAP_CENTRAL_MERIDIAN_RAD = MAP_CENTRAL_MERIDIAN_DEG * RAD_PER_DEG;

/** A region's model longitude from its Carrington longitude, radians. */
export const modelLongitude = (carringtonLonDeg: number) =>
  wrap((carringtonLonDeg - MAP_CENTRAL_MERIDIAN_DEG) * RAD_PER_DEG, 2 * Math.PI);

/**
 * Where a body-frame point lands on the measured map (`MAPS.sun`): the mosaic's u is Carrington
 * longitude over a turn, east increasing, so the model's longitude (zero at the epoch's central
 * meridian) is carried back to Carrington's; v is latitude from the south pole. The globe
 * shader samples the map by the same rule.
 */
export function mapUv(lat: number, lon: number): [number, number] {
  return [wrap(lon + MAP_CENTRAL_MERIDIAN_RAD, 2 * Math.PI) / (2 * Math.PI), 0.5 + lat / Math.PI];
}

/** A group's angular radius from its area in millionths of a hemisphere. */
export const sizeFromArea = (areaMsh: number) =>
  Math.min(REGION_SIZE_MAX_RAD, Math.sqrt(areaMsh / MSH_PER_RAD2));

/** The map's regions with spots, by NOAA number. */
export const OBSERVED_REGIONS: readonly ObservedRegion[] = DATA.regions
  .filter((region) => region.areaMsh >= OBSERVED_MIN_AREA_MSH)
  .map((region) => ({
    number: region.number,
    lat: region.lat * RAD_PER_DEG,
    lon: modelLongitude(region.carringtonLon),
    size: sizeFromArea(region.areaMsh),
    carringtonLon: region.carringtonLon,
    stonyhurstLon: region.stonyhurstLon,
    areaMsh: region.areaMsh,
    hale: region.hale,
    date: region.date,
  }));

/** The one the map is known for. */
export const AR_13664 = OBSERVED_REGIONS.find((region) => region.number === 13_664)!;
