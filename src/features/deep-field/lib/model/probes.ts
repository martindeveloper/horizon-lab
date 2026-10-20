/**
 * Our reach: the five spacecraft leaving the solar system, the heliopause the Voyagers
 * crossed, and the light-time rings round the Sun. The probes fly their real paths, the JPL
 * Horizons trajectories (probe-tracks.json, from scripts/fetch-probe-tracks.mjs) read at the
 * visitor's date; everything else here is measured on those tracks or follows from the speed
 * of light.
 */
import { TODAY } from "@/space/solar-system/model/moment";
import { positionOf } from "@/space/solar-system/model/position";
import type { Vec3 } from "@horizon/toolkit/bodies";
import { AU_LIGHT_SECONDS, JULIAN_YEAR_SECONDS } from "@horizon/toolkit/science";

import TRACKS from "./probe-tracks.json";

export type ProbeId = "voyager1" | "voyager2" | "pioneer10" | "pioneer11" | "newHorizons";

type Probe = {
  id: ProbeId;
  /** Launch, UTC date. */
  launched: string;
  /** The last signal received, for a probe Earth no longer hears. */
  lastSignal?: string;
  /** When it crossed the solar wind's termination shock and the heliopause, UTC dates. */
  crossed?: { shock: string; heliopause: string };
};

/** Farthest first. */
export const PROBES: readonly Probe[] = [
  {
    id: "voyager1",
    launched: "1977-09-05",
    crossed: { shock: "2004-12-16", heliopause: "2012-08-25" },
  },
  { id: "pioneer10", launched: "1972-03-03", lastSignal: "2003-01-23" },
  {
    id: "voyager2",
    launched: "1977-08-20",
    crossed: { shock: "2007-08-30", heliopause: "2018-11-05" },
  },
  { id: "pioneer11", launched: "1973-04-06", lastSignal: "1995-11-24" },
  { id: "newHorizons", launched: "2006-01-19" },
];

export const probeById = (id: ProbeId) => PROBES.find((p) => p.id === id)!;

const J2000_MS = Date.UTC(2000, 0, 1, 12);
/** A date as a decimal year on the tracks' clock (Julian years from J2000). */
export const yearOf = (date: Date | string) =>
  2000 + (new Date(date).getTime() - J2000_MS) / (JULIAN_YEAR_SECONDS * 1000);

type Track = { years: readonly number[]; au: readonly number[] };
const trackOf = (id: ProbeId): Track => TRACKS.probes[id];

/** Ecliptic J2000 (x, y, z) to scene axes: x, ecliptic north up, −y (see toolkit frames). */
function toScene(au: readonly number[], i: number, out: Vec3) {
  out[0] = au[i * 3]!;
  out[1] = au[i * 3 + 2]!;
  out[2] = -au[i * 3 + 1]!;
  return out;
}

const a: Vec3 = [0, 0, 0];
const b: Vec3 = [0, 0, 0];

/**
 * Where a probe is in the scene (au, the Sun at the origin) at a decimal year: between two
 * samples of its track, or along its last leg past the end (by then it coasts in a near-straight
 * line). Before launch it is at its first sample.
 */
export function probePosition(id: ProbeId, year: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const { years, au } = trackOf(id);
  const last = years.length - 1;
  let i = 0;
  while (i < last - 1 && years[i + 1]! <= year) i++;
  if (year <= years[0]!) return toScene(au, 0, out);
  toScene(au, i, a);
  toScene(au, i + 1, b);
  const t = (year - years[i]!) / (years[i + 1]! - years[i]!);
  for (let k = 0; k < 3; k++) out[k] = a[k]! + (b[k]! - a[k]!) * t;
  return out;
}

/** The track from launch up to `year`, scene axes, au: a flat xyz list. */
export function probePath(id: ProbeId, year: number): Float32Array {
  const { years, au } = trackOf(id);
  const count = years.filter((y) => y < year).length;
  const out = new Float32Array((count + 1) * 3);
  const p: Vec3 = [0, 0, 0];
  for (let i = 0; i < count; i++) out.set(toScene(au, i, p), i * 3);
  out.set(probePosition(id, year, p), count * 3);
  return out;
}

const length = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const there: Vec3 = [0, 0, 0];
const later: Vec3 = [0, 0, 0];
const earth: Vec3 = [0, 0, 0];

/** How far a probe is from the Sun at a date, au. */
export const probeFromSun = (id: ProbeId, date: Date) =>
  length(probePosition(id, yearOf(date), there));

/** How far a probe is from Earth at a date, au: the gap its signal crosses. */
export function probeFromEarth(id: ProbeId, date: Date) {
  probePosition(id, yearOf(date), there);
  positionOf({ kind: "planet", id: "earth" }, TODAY, date, earth);
  return Math.hypot(there[0] - earth[0], there[1] - earth[1], there[2] - earth[2]);
}

/** Its speed away from the Sun's frame at a date, au/yr, over a fortnight. */
export function probeSpeed(id: ProbeId, date: Date) {
  const year = yearOf(date);
  const h = 7 / 365.25;
  probePosition(id, year - h, there);
  probePosition(id, year + h, later);
  return Math.hypot(later[0] - there[0], later[1] - there[1], later[2] - there[2]) / (2 * h);
}

const DAY_MS = 86_400_000;
/** A light-day, au: about 173. */
export const LIGHT_DAY_AU = 86_400 / AU_LIGHT_SECONDS;
const lightDays = new Map<ProbeId, Date | null>();

/**
 * When a probe first is a full light-day from Earth, on its track (to 2040), or null. Earth
 * swings a little under an au toward and away from it each year, so the scan is daily once
 * the probe is within an au of the mark from the Sun, then halves the day it falls in. The
 * interpolated track is good to the day, not the hour.
 */
export function firstLightDay(id: ProbeId): Date | null {
  if (lightDays.has(id)) return lightDays.get(id)!;
  const { years } = trackOf(id);
  const end = J2000_MS + (years.at(-1)! - 2000) * JULIAN_YEAR_SECONDS * 1000;
  const past = (ms: number) => probeFromEarth(id, new Date(ms)) >= LIGHT_DAY_AU;
  let ms = new Date(probeById(id).launched).getTime();
  while (ms < end && probeFromSun(id, new Date(ms)) < LIGHT_DAY_AU - 1.1) ms += 30 * DAY_MS;
  for (ms -= 30 * DAY_MS; ms < end && !past(ms); ms += DAY_MS);
  let found: Date | null = null;
  if (ms < end) {
    let before = ms - DAY_MS;
    while (ms - before > 60_000) {
      const mid = (before + ms) / 2;
      if (past(mid)) ms = mid;
      else before = mid;
    }
    found = new Date(ms);
  }
  lightDays.set(id, found);
  return found;
}

/** How far from the Sun a Voyager was on the day it crossed a boundary, au, from its track. */
export function crossingAu(id: ProbeId, boundary: "shock" | "heliopause") {
  const date = probeById(id).crossed?.[boundary];
  if (!date) throw new Error(`${id} has no ${boundary} crossing`);
  return length(probePosition(id, yearOf(date), there));
}

/**
 * The heliopause drawn as a sphere at the mean of the two Voyager crossings, au. Its true
 * shape is unknown: two crossings, on two sides, are all the measurements there are.
 */
export const HELIOPAUSE_AU =
  (crossingAu("voyager1", "heliopause") + crossingAu("voyager2", "heliopause")) / 2;

type LightRingId =
  | "lightMinutes"
  | "lightHour"
  | "lightDay"
  | "lightWeek"
  | "lightMonth"
  | "lightYear";

/**
 * How far sunlight gets in a given time, au: rings round the Sun from ten light-minutes (just
 * past Earth) to a light-year (deep in the Oort cloud). A month is a twelfth of a Julian year.
 */
export const LIGHT_RINGS: readonly { id: LightRingId; au: number }[] = (
  [
    ["lightMinutes", 600],
    ["lightHour", 3_600],
    ["lightDay", 86_400],
    ["lightWeek", 7 * 86_400],
    ["lightMonth", JULIAN_YEAR_SECONDS / 12],
    ["lightYear", JULIAN_YEAR_SECONDS],
  ] as const
).map(([id, seconds]) => ({ id, au: seconds / AU_LIGHT_SECONDS }));
