/**
 * The timeline and the teaching model that sits on top of the ephemeris.
 *
 * Today (and the recent past) is measured: elements from the JPL table. The
 * deep past is a sketch of the giant-planet instability (the Nice model family):
 * giants start packed, a planetesimal disk sits outside them, Neptune's outward
 * move clears it. Everything in that window is labelled as a model in the UI.
 */
import { GIANTS, type PlanetId } from "@horizon/toolkit/bodies";
import { clamp, lerp } from "@horizon/toolkit/math";

import { gasDisk, migrationProgress as migration } from "./equations";
import {
  BELT_STIRRED_AFTER,
  CLEAR_DONE,
  EMBRYOS_AFTER,
  GAS_DISK_LIFETIME,
  LHB_CLASSIC,
  MODEL_START,
  MOON_IMPACT_AFTER,
  PLANETESIMALS_AFTER,
  SUN_BIRTH,
  OLDEST,
} from "./parameters";

export { OLDEST };
/** Terrestrial planets finish accreting ~30–100 Myr after the first solids. */
export const TERRESTRIAL_DONE = MODEL_START;

const GAS_END = SUN_BIRTH - GAS_DISK_LIFETIME;
/** The gas-disk segment starts this long after the first solids; earlier is one step. */
const FIRST_SOLIDS_FLOOR = 1e3;
const GAS_DECADES = Math.log(GAS_DISK_LIFETIME / FIRST_SOLIDS_FLOOR);

type Segment = { end: number; from: number; to: number; log?: true };
/* Slider segments: ISM, the gas disk, accretion, clearing, then everything since. The gas
   disk is logarithmic in time since the first solids, so dust, planetesimals and embryos
   (thousands, then hundreds of thousands, then millions of years) each get room. */
const SEGMENTS: readonly Segment[] = [
  { end: 0.1, from: OLDEST, to: SUN_BIRTH },
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

export type Epoch = "sketch" | "birth" | "disk" | "clearing" | "today";
/** Finer, dated notes for the dock. Each one is a measured or well-established milestone. */
export type Note =
  | "merger"
  | "thinDisk"
  | "ingredients"
  | "collapse"
  | "dust"
  | "planetesimals"
  | "gasDisk"
  | "accretion"
  | "belt"
  | "moon"
  | "disk"
  | "clearing"
  | "bombardment"
  | "today";
export function noteOf(yearsAgo: number): Note {
  if (yearsAgo > 9.3e9) return "merger";
  if (yearsAgo > 7e9) return "thinDisk";
  if (yearsAgo > SUN_BIRTH + 1e6) return "ingredients";
  if (yearsAgo > SUN_BIRTH) return "collapse";
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
  if (yearsAgo > SUN_BIRTH) return "sketch";
  if (yearsAgo > 4.55e9) return "birth";
  if (yearsAgo > 4.49e9) return "disk";
  if (yearsAgo >= CLEAR_DONE) return "clearing";
  return "today";
}

/** Years of model time per real second while playing, by era. */
export function playRate(yearsAgo: number) {
  if (yearsAgo > SUN_BIRTH) return 1.6e8;
  /* The gas disk plays at a constant pace on its logarithmic slider segment. */
  if (yearsAgo > GAS_END) return 1.5 * Math.max(SUN_BIRTH - yearsAgo, FIRST_SOLIDS_FLOOR);
  if (yearsAgo > MODEL_START) return 1.2e7;
  if (yearsAgo > CLEAR_DONE) return 3.5e6;
  return 2.2e8;
}

/** One playback step. It stops at the Sun's birth so a frame never skips the gas disk. */
export function advancePlay(yearsAgo: number, dt: number) {
  const next = Math.max(0, yearsAgo - playRate(yearsAgo) * dt);
  return yearsAgo > SUN_BIRTH && next < SUN_BIRTH ? SUN_BIRTH : next;
}
