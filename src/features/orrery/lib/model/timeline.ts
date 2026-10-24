import {
  COLLAPSE_BEGINS,
  FORMATION_BEGINS,
  FREE_FALL,
  PROTOSTAR_LIT,
} from "@/space/solar-system/model/formation";
/**
 * The timeline: the slider's track, its epochs, the dated notes and playback. What the
 * solar system looks like at a moment is the shared model's (`@/space/solar-system/model/moment`).
 */
import {
  CLEAR_DONE,
  GALACTIC_YEAR,
  GAS_DISK_LIFETIME,
  MODEL_START,
  SUN_BIRTH,
} from "@/space/solar-system/model/parameters";
import { clamp, lerp } from "@horizon/toolkit/math";

import {
  BELT_STIRRED_AFTER,
  CHICXULUB,
  EARTH_CRUST,
  EMBRYOS_AFTER,
  LHB_CLASSIC,
  MARS_DRY,
  MARS_DYNAMO_LAST,
  MOON_IMPACT_AFTER,
  OLDEST,
  PLANETESIMALS_AFTER,
  SATURN_RINGS_AGE,
  VREDEFORT,
} from "./parameters";

export { OLDEST };

const GAS_END = SUN_BIRTH - GAS_DISK_LIFETIME;
/** The gas-disk segment starts this long after the first solids; earlier is one step. */
const FIRST_SOLIDS_FLOOR = 1e3;
const GAS_DECADES = Math.log(GAS_DISK_LIFETIME / FIRST_SOLIDS_FLOOR);

type Segment = { end: number; from: number; to: number; log?: true };
/* Slider segments: ISM, the Sun's formation, the gas disk, accretion, clearing, then
   everything since. The gas disk is logarithmic in time since the first solids, so dust,
   planetesimals and embryos (thousands, then hundreds of thousands, then millions of years)
   each get room. */
const SEGMENTS: readonly Segment[] = [
  { end: 0.07, from: OLDEST, to: FORMATION_BEGINS },
  { end: 0.1, from: FORMATION_BEGINS, to: SUN_BIRTH },
  { end: 0.19, from: SUN_BIRTH, to: GAS_END, log: true },
  { end: 0.25, from: GAS_END, to: MODEL_START },
  { end: 0.62, from: MODEL_START, to: CLEAR_DONE },
  { end: 1, from: CLEAR_DONE, to: 0 },
];

function segmentYears(segment: Segment, f: number) {
  if (!segment.log) return lerp(segment.from, segment.to, f);
  return f <= 0 ? SUN_BIRTH : SUN_BIRTH - FIRST_SOLIDS_FLOOR * Math.exp(f * GAS_DECADES);
}

function segmentFraction(segment: Segment, y: number) {
  if (!segment.log) return clamp((y - segment.from) / (segment.to - segment.from), 0, 1);
  const since = Math.max(SUN_BIRTH - y, FIRST_SOLIDS_FLOOR);
  return clamp(Math.log(since / FIRST_SOLIDS_FLOOR) / GAS_DECADES, 0, 1);
}

/** Slider [0,1] → years ago, giving formation and clearing most of the track. */
export function sliderToYearsAgo(u: number) {
  const x = clamp(u, 0, 1);
  let start = 0;
  for (const segment of SEGMENTS) {
    if (x <= segment.end || segment.end === 1)
      return segmentYears(segment, (x - start) / (segment.end - start));
    start = segment.end;
  }
  return 0;
}

export function yearsAgoToSlider(y: number) {
  let start = 0;
  for (const segment of SEGMENTS) {
    if (y >= segment.to || segment.end === 1)
      return lerp(start, segment.end, segmentFraction(segment, y));
    start = segment.end;
  }
  return 1;
}

/** Readouts call anything this recent "today"; older is a moment on the slider. */
const TODAY_SPAN = 5e4;
export const isToday = (yearsAgo: number) => yearsAgo <= TODAY_SPAN;

type Epoch = "sketch" | "birth" | "disk" | "clearing" | "today";

/** The dated milestones since the clearing: stations on the slider's last stretch. */
export type Moment =
  | "earthCrust"
  | "bombardment"
  | "marsDynamo"
  | "marsDry"
  | "vredefort"
  | "saturnRings"
  | "chicxulub";
/** Each station, where it sits and how far either side of it its note holds (years). */
export const MOMENTS: readonly { id: Moment; yearsAgo: number; span: number }[] = [
  { id: "earthCrust", yearsAgo: EARTH_CRUST, span: 4e7 },
  { id: "bombardment", yearsAgo: LHB_CLASSIC, span: 1.5e8 },
  { id: "marsDynamo", yearsAgo: MARS_DYNAMO_LAST, span: 6e7 },
  { id: "marsDry", yearsAgo: MARS_DRY, span: 1e8 },
  { id: "vredefort", yearsAgo: VREDEFORT, span: 6e7 },
  {
    id: "saturnRings",
    yearsAgo: (SATURN_RINGS_AGE[0] + SATURN_RINGS_AGE[1]) / 2,
    span: (SATURN_RINGS_AGE[1] - SATURN_RINGS_AGE[0]) / 2,
  },
  { id: "chicxulub", yearsAgo: CHICXULUB, span: 1.5e7 },
];

/** Finer, dated notes for the dock. Each one is a measured or well-established milestone. */
type Note =
  | Moment
  | "merger"
  | "thinDisk"
  | "ingredients"
  | "core"
  | "collapse"
  | "protostar"
  | "dust"
  | "planetesimals"
  | "gasDisk"
  | "accretion"
  | "belt"
  | "moon"
  | "disk"
  | "clearing"
  | "today";
export function noteOf(yearsAgo: number): Note {
  if (yearsAgo > 9.3e9) return "merger";
  if (yearsAgo > 7e9) return "thinDisk";
  if (yearsAgo > FORMATION_BEGINS) return "ingredients";
  if (yearsAgo > COLLAPSE_BEGINS) return "core";
  if (yearsAgo > PROTOSTAR_LIT) return "collapse";
  if (yearsAgo > SUN_BIRTH) return "protostar";
  const since = SUN_BIRTH - yearsAgo;
  if (since < PLANETESIMALS_AFTER) return "dust";
  if (since < EMBRYOS_AFTER) return "planetesimals";
  if (since < GAS_DISK_LIFETIME) return "gasDisk";
  if (since < BELT_STIRRED_AFTER) return "accretion";
  if (since < MOON_IMPACT_AFTER) return "belt";
  if (yearsAgo > MODEL_START) return "moon";
  if (yearsAgo > 4.49e9) return "disk";
  if (yearsAgo >= CLEAR_DONE) return "clearing";
  /* The lunar basins' classic date, kept as its own stop on the way to today. */
  if (yearsAgo > LHB_CLASSIC - 1.5e8 && yearsAgo < LHB_CLASSIC + 2e8) return "bombardment";
  for (const moment of MOMENTS)
    if (Math.abs(yearsAgo - moment.yearsAgo) <= moment.span) return moment.id;
  return "today";
}
export const EPOCHS: readonly { id: Epoch; yearsAgo: number }[] = [
  { id: "sketch", yearsAgo: OLDEST },
  { id: "birth", yearsAgo: SUN_BIRTH },
  { id: "disk", yearsAgo: MODEL_START },
  { id: "clearing", yearsAgo: (MODEL_START + CLEAR_DONE) / 2 },
  { id: "today", yearsAgo: 0 },
];
export function epochOf(yearsAgo: number): Epoch {
  if (yearsAgo > FORMATION_BEGINS) return "sketch";
  if (yearsAgo > 4.55e9) return "birth";
  if (yearsAgo > 4.49e9) return "disk";
  if (yearsAgo >= CLEAR_DONE) return "clearing";
  return "today";
}

/** Seconds the core's free fall takes while playing: the formation's pace, quiet core to first solids. */
const FREE_FALL_SECONDS = 4;

/** Years of model time per real second while playing, by era. */
function playRate(yearsAgo: number) {
  if (yearsAgo > FORMATION_BEGINS) return 1.6e8;
  if (yearsAgo > SUN_BIRTH) return FREE_FALL / FREE_FALL_SECONDS;
  /* The gas disk plays at a constant pace on its logarithmic slider segment. */
  if (yearsAgo > GAS_END) return 1.5 * Math.max(SUN_BIRTH - yearsAgo, FIRST_SOLIDS_FLOOR);
  if (yearsAgo > MODEL_START) return 1.2e7;
  if (yearsAgo > CLEAR_DONE) return 3.5e6;
  return 2.2e8;
}

/** Moments a step never crosses: the formation's start and the first solids, so a long frame skips neither the collapse nor the dust. */
const PLAY_STOPS = [FORMATION_BEGINS, SUN_BIRTH];

/** One playback step. */
export function advancePlay(yearsAgo: number, dt: number) {
  const next = Math.max(0, yearsAgo - playRate(yearsAgo) * dt);
  for (const stop of PLAY_STOPS) if (yearsAgo > stop && next < stop) return stop;
  return next;
}

/** Laps of the Galaxy the Sun has made by `yearsAgo`, one per galactic year (schematic). */
export const galacticLaps = (yearsAgo: number) => Math.max(0, SUN_BIRTH - yearsAgo) / GALACTIC_YEAR;
