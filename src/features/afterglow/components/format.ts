/**
 * The readouts' words: an age as the clock counts it (years since the first solids) and as a
 * visitor feels it (ago, now, from now), spans of years, the Sun's width in the sky.
 */
import type { Format, Translate } from "@/lib/facts";
import { yearSpan, yearStep, type YearSpanOptions } from "@/lib/year-span";

import { chapterOf } from "../lib/model/chapters";
import { yearsPerSecondAt } from "../lib/model/pacing";
import { TODAY } from "../lib/model/track";

const DEG = 180 / Math.PI;

/** Afterglow's spans: two significant figures, three in billions, the shared unit rule (`yearSpan`). */
const SPAN: YearSpanOptions = { digits: (unit) => (unit === "billion" ? 3 : 2) };
const span = (f: Format, years: number, locale: string, steady: boolean) =>
  yearSpan(f, years, locale, { ...SPAN, steady });

/**
 * A span of years in the unit that fits: "320 thousand years", "1.2 million years", "7.6 billion
 * years". `steady` keeps every digit, trailing zeros too ("7.00 billion"), so a live readout
 * keeps its width as it counts.
 */
export function formatYears(
  t: Translate,
  f: Format,
  years: number,
  locale: string,
  steady = false,
) {
  const { unit, ...values } = span(f, years, locale, steady);
  return t(`span.${unit}`, values);
}

/** An age's place against today: "today", "2.1 billion years ago", "7.6 billion years from now". */
export function formatFromToday(
  t: Translate,
  f: Format,
  age: number,
  locale: string,
  steady = false,
) {
  const offset = age - TODAY;
  if (Math.abs(offset) < 5e5) return t("time.today");
  /* Each side its own sentence: a language may put the span in another case ("před 2 miliardami", "za 2 miliardy"). */
  const { unit, ...values } = span(f, offset, locale, steady);
  return t(`${offset < 0 ? "ago" : "ahead"}.${unit}`, values);
}

/**
 * The time since the chapter began, "+4,200 years", where it says more than the age does: a
 * second of play is worth less than the last digit of the age's place against today, so the age
 * would stand still while the Sun changes, and the chapter's own time is the finer of the two.
 * The age stays as coarse as the track knows it; the stretch's time is what the sources give.
 * Whole years, a single figure under ten. Null elsewhere.
 */
export function formatSince(t: Translate, f: Format, age: number, locale: string) {
  const since = Math.round(age - chapterOf(age).from);
  const step = yearStep(age - TODAY, SPAN);
  if (yearsPerSecondAt(age) >= step || yearStep(since, SPAN) >= step) return null;
  return t("time.since", { span: formatYears(t, f, since, locale, since >= 10) });
}

/** The Sun's width in the sky: degrees, or the whole sky once the vantage is inside it. */
export function formatWidth(t: Translate, f: Format, radians: number) {
  if (radians >= Math.PI - 1e-6) return t("hud.wholeSky");
  const degrees = radians * DEG;
  return t("units.degrees", {
    value: f.number(degrees, { maximumSignificantDigits: degrees < 10 ? 2 : 3 }),
  });
}

/** Years of the Sun's life per real second: "120 million years / s". */
export function formatPace(
  t: Translate,
  f: Format,
  yearsPerSecond: number,
  locale: string,
  steady = false,
) {
  return t("time.perSecond", { span: formatYears(t, f, yearsPerSecond, locale, steady) });
}
