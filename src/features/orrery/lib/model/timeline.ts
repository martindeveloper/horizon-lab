import { GALAXY } from "@/space/galaxy/model/catalogue/galaxy";
import { THIN_DISK_ERA } from "@/space/galaxy/model/parameters";
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
import { convert } from "@horizon/toolkit/science";

import {
  BELT_STIRRED_AFTER,
  CHICXULUB,
  EARTH_CRUST,
  EMBRYOS_AFTER,
  JUPITER_CORE_AFTER,
  LHB_CLASSIC,
  MARS_DRY,
  MARS_DYNAMO_LAST,
  MARS_HALF_AFTER,
  MOON_IMPACT_AFTER,
  OLDEST,
  PLANETESIMALS_AFTER,
  SATURN_RINGS_AGE,
  VREDEFORT,
} from "./parameters";

export { OLDEST };

const GAS_END = SUN_BIRTH - GAS_DISK_LIFETIME;
/** The first million years' segment starts this long after the first solids; earlier is one step. */
const FIRST_SOLIDS_FLOOR = 1e3;

/** The intact disk's epoch opens once the embryos have grown; the clearing's once the giants are on the move. */
const DISK_EPOCH = 4.55e9;
const CLEARING_EPOCH = 4.49e9;

/** The dated milestones of the history: beads on the track, listed in the moments panel. */
export type Moment =
  | "merger"
  | "thinDisk"
  | "dust"
  | "jupiterCore"
  | "marsHalf"
  | "accretion"
  | "moon"
  | "earthCrust"
  | "bombardment"
  | "marsDynamo"
  | "marsDry"
  | "vredefort"
  | "saturnRings"
  | "chicxulub";
/**
 * Each milestone, where it sits and how far either side of it its note holds (years). A span
 * of 0 leaves the note to the eras' own stations below, which already tell that milestone.
 */
export const MOMENTS: readonly { id: Moment; yearsAgo: number; span: number }[] = [
  { id: "merger", yearsAgo: convert(GALAXY.milkyway.gaiaEnceladus.value, "Gyr", "yr"), span: 0 },
  { id: "thinDisk", yearsAgo: THIN_DISK_ERA, span: 0 },
  { id: "dust", yearsAgo: SUN_BIRTH, span: 0 },
  { id: "jupiterCore", yearsAgo: SUN_BIRTH - JUPITER_CORE_AFTER, span: 2.5e5 },
  { id: "marsHalf", yearsAgo: SUN_BIRTH - MARS_HALF_AFTER, span: 4e5 },
  { id: "accretion", yearsAgo: GAS_END, span: 0 },
  { id: "moon", yearsAgo: SUN_BIRTH - MOON_IMPACT_AFTER, span: 0 },
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

/**
 * The track is a row of equal cells, one per epoch. The Sun's birth and the ages since the
 * clearing take two, since they hold most of the milestones.
 */
const EPOCH_CELLS = { sketch: 1, birth: 2, disk: 1, clearing: 1, today: 2 } as const;
export const TRACK_CELLS = Object.values(EPOCH_CELLS).reduce((sum, cells) => sum + cells, 0);
/** Where each epoch's cells start, counted from the track's start. */
const CELL = {
  sketch: 0,
  birth: EPOCH_CELLS.sketch,
  disk: EPOCH_CELLS.sketch + EPOCH_CELLS.birth,
  clearing: EPOCH_CELLS.sketch + EPOCH_CELLS.birth + EPOCH_CELLS.disk,
  today: TRACK_CELLS - EPOCH_CELLS.today,
};
/** Inside the birth's cells: the core's fall, then the first million years, logarithmic since the first solids. */
const FALL_CELLS = 0.6;
const FIRST_MYR_CELLS = 0.6;
const FIRST_MYR_END = SUN_BIRTH - JUPITER_CORE_AFTER;

type Segment = { end: number; from: number; to: number; log?: true };
/** Track share at `cells` from the start. */
const cellEnd = (cells: number) => cells / TRACK_CELLS;

/**
 * Linear segments from `from` to `to` over cells `a` to `b`, with a knot at every milestone
 * between: the milestones' beads are spread evenly along their stretch of the track, so they
 * never crowd, and the thumb stands on a bead exactly at its date.
 */
function spread(from: number, to: number, a: number, b: number): Segment[] {
  const inner = MOMENTS.map((m) => m.yearsAgo)
    .filter((y) => y < from && y > to)
    .sort((x, y) => y - x);
  const knots = [from, ...inner, to];
  const step = (b - a) / (knots.length - 1);
  return knots.slice(1).map((y, k) => ({
    end: cellEnd(k === knots.length - 2 ? b : a + step * (k + 1)),
    from: knots[k] ?? from,
    to: y,
  }));
}

/* Slider segments. The Sun's birth gives the core's fall its room, then the first million
   years logarithmic since the first solids, so dust, planetesimals and Jupiter's core
   (thousands, hundreds of thousands, then a million years) each get room; its later
   milestones, like every other chapter's, are knots spread evenly along their stretch. */
const SEGMENTS: readonly Segment[] = [
  ...spread(OLDEST, FORMATION_BEGINS, CELL.sketch, CELL.birth),
  { end: cellEnd(CELL.birth + FALL_CELLS), from: FORMATION_BEGINS, to: SUN_BIRTH },
  {
    end: cellEnd(CELL.birth + FALL_CELLS + FIRST_MYR_CELLS),
    from: SUN_BIRTH,
    to: FIRST_MYR_END,
    log: true,
  },
  ...spread(FIRST_MYR_END, DISK_EPOCH, CELL.birth + FALL_CELLS + FIRST_MYR_CELLS, CELL.disk),
  ...spread(DISK_EPOCH, CLEARING_EPOCH, CELL.disk, CELL.clearing),
  ...spread(CLEARING_EPOCH, CLEAR_DONE, CELL.clearing, CELL.today),
  ...spread(CLEAR_DONE, 0, CELL.today, TRACK_CELLS),
];
const FIRST_MYR_DECADES = Math.log(JUPITER_CORE_AFTER / FIRST_SOLIDS_FLOOR);

function segmentYears(segment: Segment, f: number) {
  if (!segment.log) return lerp(segment.from, segment.to, f);
  return f <= 0 ? SUN_BIRTH : SUN_BIRTH - FIRST_SOLIDS_FLOOR * Math.exp(f * FIRST_MYR_DECADES);
}

function segmentFraction(segment: Segment, y: number) {
  if (!segment.log) return clamp((y - segment.from) / (segment.to - segment.from), 0, 1);
  const since = Math.max(SUN_BIRTH - y, FIRST_SOLIDS_FLOOR);
  return clamp(Math.log(since / FIRST_SOLIDS_FLOOR) / FIRST_MYR_DECADES, 0, 1);
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

/** Finer, dated notes for the dock. Each one is a measured or well-established milestone. */
type Note =
  | Moment
  | "ingredients"
  | "core"
  | "collapse"
  | "protostar"
  | "planetesimals"
  | "gasDisk"
  | "belt"
  | "disk"
  | "clearing"
  | "today";
export function noteOf(yearsAgo: number): Note {
  /* A dated milestone holds its note either side of it; the eras' stations tell the rest. */
  for (const moment of MOMENTS)
    if (moment.span > 0 && Math.abs(yearsAgo - moment.yearsAgo) <= moment.span) return moment.id;
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
  /* The lunar basins' classic date holds a little longer toward the crust's station. */
  if (yearsAgo > LHB_CLASSIC - 1.5e8 && yearsAgo < LHB_CLASSIC + 2e8) return "bombardment";
  return "today";
}
/** The slider's epochs: each with the moment the thumb stops at for it, and its cells of the track. */
export const EPOCHS: readonly { id: Epoch; yearsAgo: number; cells: number }[] = [
  { id: "sketch", yearsAgo: OLDEST, cells: EPOCH_CELLS.sketch },
  { id: "birth", yearsAgo: SUN_BIRTH, cells: EPOCH_CELLS.birth },
  { id: "disk", yearsAgo: MODEL_START, cells: EPOCH_CELLS.disk },
  { id: "clearing", yearsAgo: (MODEL_START + CLEAR_DONE) / 2, cells: EPOCH_CELLS.clearing },
  { id: "today", yearsAgo: 0, cells: EPOCH_CELLS.today },
];
/** Where one epoch hands over to the next, oldest first: each at a cell's edge of the track. */
export const EPOCH_BOUNDS: readonly number[] = [
  FORMATION_BEGINS,
  DISK_EPOCH,
  CLEARING_EPOCH,
  CLEAR_DONE,
];
export function epochOf(yearsAgo: number): Epoch {
  if (yearsAgo > FORMATION_BEGINS) return "sketch";
  if (yearsAgo > DISK_EPOCH) return "birth";
  if (yearsAgo > CLEARING_EPOCH) return "disk";
  if (yearsAgo >= CLEAR_DONE) return "clearing";
  return "today";
}

/** Seconds the core's free fall takes while playing: the formation's pace, quiet core to first solids. */
const FREE_FALL_SECONDS = 4;
/* Years of model time per real second, by era: the interstellar ages, the gas disk (per year
   since the first solids, a constant pace on its logarithmic segment), accretion, the clearing
   and the ages since. */
const INTERSTELLAR_PACE = 1.6e8;
const GAS_DISK_PACE = 1.5;
const ACCRETION_PACE = 1.2e7;
const CLEARING_PACE = 3.5e6;
const AGES_PACE = 2.2e8;

/** Years of model time per real second while playing, by era. */
export function playRate(yearsAgo: number) {
  if (yearsAgo > FORMATION_BEGINS) return INTERSTELLAR_PACE;
  if (yearsAgo > SUN_BIRTH) return FREE_FALL / FREE_FALL_SECONDS;
  if (yearsAgo > GAS_END) return GAS_DISK_PACE * Math.max(SUN_BIRTH - yearsAgo, FIRST_SOLIDS_FLOOR);
  if (yearsAgo > MODEL_START) return ACCRETION_PACE;
  if (yearsAgo > CLEAR_DONE) return CLEARING_PACE;
  return AGES_PACE;
}

/** The fastest and slowest paces playback takes: the ages since the clearing, and the first solids' floor. */
const FASTEST_PACE = Math.max(INTERSTELLAR_PACE, AGES_PACE);
const SLOWEST_PACE = GAS_DISK_PACE * FIRST_SOLIDS_FLOOR;

/**
 * How far playback is slowed below its fastest pace, 0 at the fastest to 1 at the slowest, by
 * decades: the timeline shows it as dilated time about the playhead.
 */
export function playDilation(yearsAgo: number) {
  return clamp(
    Math.log(FASTEST_PACE / playRate(yearsAgo)) / Math.log(FASTEST_PACE / SLOWEST_PACE),
    0,
    1,
  );
}

/** Moments a step never crosses: the formation's start and the first solids, so a long frame skips neither the collapse nor the dust. */
const PLAY_STOPS = [FORMATION_BEGINS, SUN_BIRTH];

/** One playback step. */
export function advancePlay(yearsAgo: number, dt: number) {
  const next = Math.max(0, yearsAgo - playRate(yearsAgo) * dt);
  for (const stop of PLAY_STOPS) if (yearsAgo > stop && next < stop) return stop;
  return next;
}

/**
 * The chapters Replay plays again, each from its start to where the next begins: the Sun's
 * formation (the quiet core to the first solids), the disk (the first solids to the sketch's
 * start: dust, planetesimals, embryos, the gas going, the rocky planets and the Moon), the
 * clearing (the sketch), and the ages since it; or the whole history, which runs on to today.
 */
export type Chapter = "history" | "formation" | "disk" | "clearing" | "ages";
export const CHAPTERS: Readonly<Record<Chapter, { from: number; until: number | null }>> = {
  history: { from: FORMATION_BEGINS, until: null },
  formation: { from: FORMATION_BEGINS, until: SUN_BIRTH },
  disk: { from: SUN_BIRTH, until: MODEL_START },
  clearing: { from: MODEL_START, until: CLEAR_DONE },
  ages: { from: CLEAR_DONE, until: null },
};

/** The chapter under the playhead: before the formation, and at today, the whole history. */
export function chapterOf(yearsAgo: number): Chapter {
  if (yearsAgo > FORMATION_BEGINS || isToday(yearsAgo)) return "history";
  if (yearsAgo > SUN_BIRTH) return "formation";
  if (yearsAgo > MODEL_START) return "disk";
  if (yearsAgo >= CLEAR_DONE) return "clearing";
  return "ages";
}

/** Laps of the Galaxy the Sun has made by `yearsAgo`, one per galactic year (schematic). */
export const galacticLaps = (yearsAgo: number) => Math.max(0, SUN_BIRTH - yearsAgo) / GALACTIC_YEAR;
