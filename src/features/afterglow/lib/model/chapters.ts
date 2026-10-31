/**
 * The chapters as the clock's dilation: each stretch of the Sun's life gets seconds of its own
 * at the clock's pace of 1, whatever its length in years, so the slow main sequence passes in
 * a few seconds each and the climb, the tip and the fade get the time; the track's segments
 * are proportional to them. The dwarf's fade runs on a logarithmic clock, as its cooling does.
 */
import { clamp } from "@horizon/toolkit/math";

import { CHAPTER_DEFINITIONS, type ChapterId } from "./chapter-ids";
import {
  END_AGE,
  FINAL_PULSE,
  HELIUM_END,
  MS_END,
  NEBULA_END,
  OCEANS_AFTER,
  RGB_TIP,
  SWEEP,
  TODAY,
} from "./track";

export type { ChapterId };

export type Chapter = {
  id: ChapterId;
  /** Where the chapter begins, years since the first solids. */
  from: number;
  /** Where it ends: the next chapter's start, or the track's end. */
  until: number;
  /** Real seconds it takes at the clock's pace of 1; its share of the track. */
  cells: number;
  /** The clock runs logarithmic in the time since the chapter began. */
  log?: true;
};

/** Where each chapter begins, in the chapters' order. */
const STARTS: Readonly<Record<ChapterId, number>> = {
  young: 0,
  today: TODAY,
  oceans: TODAY + OCEANS_AFTER,
  subgiant: MS_END,
  tip: RGB_TIP - SWEEP,
  flash: RGB_TIP,
  pulses: HELIUM_END,
  /* The last pulse and the wind that leaves the core: the nebula's making, on the nebula's seconds. */
  nebula: FINAL_PULSE,
  dwarf: NEBULA_END,
};
/** Seconds each chapter plays at the pace of 1: something visible changes every second, so a chapter with little to show is short. */
const SECONDS: Readonly<Record<ChapterId, number>> = {
  young: 4,
  today: 4,
  /* The seas dry over half of it (`oceans.ts`): long enough to watch them go. */
  oceans: 7,
  subgiant: 7,
  tip: 7,
  flash: 4,
  pulses: 3,
  nebula: 5,
  dwarf: 7,
};
const LOG: ReadonlySet<ChapterId> = new Set(["dwarf"]);

export const CHAPTERS: readonly Chapter[] = CHAPTER_DEFINITIONS.map(({ id }, index) => {
  const next = CHAPTER_DEFINITIONS[index + 1];
  return {
    id,
    from: STARTS[id],
    until: next ? STARTS[next.id] : END_AGE,
    cells: SECONDS[id],
    ...(LOG.has(id) ? { log: true as const } : {}),
  };
});

export const TRACK_CELLS = CHAPTERS.reduce((sum, chapter) => sum + chapter.cells, 0);

/** The chapter a moment falls in. */
export function chapterOf(age: number): Chapter {
  let found = CHAPTERS[0]!;
  for (const chapter of CHAPTERS) if (age >= chapter.from) found = chapter;
  return found;
}

export const chapterById = (id: ChapterId) => CHAPTERS.find((chapter) => chapter.id === id)!;

/** The floor of a logarithmic chapter's clock, years, so its first moments take room. */
const LOG_FLOOR = 1e4;

/** How far into a chapter a moment is, 0–1 along its cells. */
function within(chapter: Chapter, age: number) {
  const span = chapter.until - chapter.from;
  const since = clamp(age - chapter.from, 0, span);
  if (!chapter.log) return since / span;
  return Math.log(since / LOG_FLOOR + 1) / Math.log(span / LOG_FLOOR + 1);
}

function ageWithin(chapter: Chapter, f: number) {
  const span = chapter.until - chapter.from;
  if (!chapter.log) return chapter.from + span * f;
  return chapter.from + LOG_FLOOR * (Math.exp(f * Math.log(span / LOG_FLOOR + 1)) - 1);
}

/** Where each chapter's cells begin along the track, 0–1, worked out once. */
const STARTS_ALONG: ReadonlyMap<ChapterId, number> = (() => {
  let cells = 0;
  return new Map(
    CHAPTERS.map((chapter) => {
      const at = cells / TRACK_CELLS;
      cells += chapter.cells;
      return [chapter.id, at];
    }),
  );
})();

/** Where a chapter's cells begin along the track, 0–1. */
export const chapterStart = (chapter: Chapter) => STARTS_ALONG.get(chapter.id) ?? 0;

/** A moment's place along the track, 0–1. */
export function ageToSlider(age: number) {
  const chapter = chapterOf(age);
  return chapterStart(chapter) + (chapter.cells / TRACK_CELLS) * within(chapter, age);
}

/** The moment at a place along the track. */
export function sliderToAge(u: number) {
  const x = clamp(u, 0, 1);
  for (const chapter of CHAPTERS) {
    const start = chapterStart(chapter);
    const end = start + chapter.cells / TRACK_CELLS;
    if (x <= end || chapter === CHAPTERS[CHAPTERS.length - 1]) {
      return ageWithin(chapter, clamp((x - start) / (end - start), 0, 1));
    }
  }
  return END_AGE;
}

/** Years of the Sun's life per real second at a moment, at a pace of 1: each chapter takes its own seconds. */
export function playRate(age: number) {
  const chapter = chapterOf(age);
  const seconds = chapter.cells;
  if (!chapter.log) return (chapter.until - chapter.from) / seconds;
  /* On the logarithmic clock the rate grows with the time since the chapter began. */
  const span = chapter.until - chapter.from;
  const since = clamp(age - chapter.from, 0, span);
  return ((since + LOG_FLOOR) * Math.log(span / LOG_FLOOR + 1)) / seconds;
}

/** The clock's paces the dock steps through, as multiples of the chapters' own; named for the copy (`ratesShort.<id>`). */
export const PACES = [
  { id: "quarter", value: 0.25 },
  { id: "half", value: 0.5 },
  { id: "one", value: 1 },
  { id: "double", value: 2 },
  { id: "fourfold", value: 4 },
] as const;
export type PaceId = (typeof PACES)[number]["id"];
export const DEFAULT_PACE: PaceId = "one";
export const paceValue = (id: PaceId) => PACES.find((pace) => pace.id === id)!.value;
