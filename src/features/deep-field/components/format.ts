import type { Format, Translate } from "@/lib/facts";
import { CMB_AGE_YEARS } from "@/space/cosmos/model/cosmos";
import { convert } from "@horizon/toolkit/science";

import type { Then } from "../lib/model/depth";

/**
 * How long ago light set out: "43 minutes ago" from Jupiter, "4.25 years ago" from Proxima,
 * "2.5 million years ago" from Andromeda.
 */
export function formatAgo(t: Translate, f: Format, years: number) {
  const n = (v: number) => f.number(v, { maximumSignificantDigits: 3 });
  const minutes = convert(years, "yr", "min");
  if (minutes < 120) return t("time.minutes", { value: n(minutes) });
  const hours = minutes / 60;
  if (hours < 48) return t("time.hours", { value: n(hours) });
  if (years < 1) return t("time.days", { value: n(convert(years, "yr", "d")) });
  if (years < 1e6) return t("time.years", { value: n(years) });
  if (years < 1e9) return t("time.million", { value: n(years / 1e6) });
  return t("time.billion", { value: n(years / 1e9) });
}

/**
 * When that light set out, in the reader's terms: "It set out at 14:05", "in 2022", "in 9700
 * BC", then Earth at the time: "On Earth: the age of dinosaurs".
 */
export function formatThen(t: Translate, f: Format, then: Then) {
  /* The app formats in UTC; a clock time reads in the visitor's own zone (the page is client-only). */
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  switch (then.kind) {
    case "clock":
      return t("then.clock", {
        time: f.dateTime(then.at, { hour: "numeric", minute: "2-digit", timeZone }),
      });
    case "date":
      return t("then.date", {
        date: f.dateTime(then.at, { day: "numeric", month: "long", timeZone }),
      });
    case "year":
      return then.year > 0
        ? t("then.year", { year: String(then.year) })
        : t("then.yearBce", { year: String(1 - then.year) });
    case "era":
      return t(`then.${then.id}`);
    case "cmb":
      return t("then.cmb", { age: f.number(CMB_AGE_YEARS, { maximumSignificantDigits: 2 }) });
  }
}
