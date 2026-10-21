import { formatAu, type DistanceSettings, type Format, type Translate } from "@/lib/facts";
import { AU_KM, convert } from "@horizon/toolkit/science";

import { dateAt, withinCalendar } from "../lib/model/calendar";
import { C_KM_S } from "../lib/model/parameters";

/** What a readout shows for a value it has none of. */
const NONE = "—";
/** A clock time is the visitor's, as Deep Field's dates are. */
const VISITOR_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Durations: "4 min 12 s", "3 h 5 min", "12 d 4 h", "1.8 years", "2.5 million years". */
export function formatDuration(t: Translate, f: Format, seconds: number) {
  if (!Number.isFinite(seconds)) return NONE;
  const n = (v: number, digits = 0) => f.number(v, { maximumFractionDigits: digits });
  const s = Math.abs(seconds);
  if (s < 10) return t("time.seconds", { value: n(s, 1) });
  /* Whole units first, so a carry moves into the larger one: never "1 min 60 s". */
  const whole = Math.round(s);
  if (whole < 60) return t("time.seconds", { value: n(whole) });
  if (whole < 3600)
    return t("time.minutesSeconds", { minutes: n(Math.floor(whole / 60)), seconds: n(whole % 60) });
  const minutes = Math.round(s / 60);
  if (minutes < 24 * 60)
    return t("time.hoursMinutes", { hours: n(Math.floor(minutes / 60)), minutes: n(minutes % 60) });
  const hours = Math.round(s / 3600);
  if (hours < 60 * 24)
    return t("time.daysHours", { days: n(Math.floor(hours / 24)), hours: n(hours % 24) });
  const years = convert(s, "s", "yr");
  if (years < 1e4)
    return t("time.years", { value: n(years, years < 10 ? 2 : years < 100 ? 1 : 0) });
  if (years < 1e6)
    return t("time.years", { value: f.number(years, { maximumSignificantDigits: 3 }) });
  if (years < 1e9)
    return t("time.million", { value: f.number(years / 1e6, { maximumSignificantDigits: 3 }) });
  return t("time.billion", { value: f.number(years / 1e9, { maximumSignificantDigits: 3 }) });
}

/** Earth's calendar at a moment, when the calendar still reaches; null past it. */
export function formatCalendar(f: Format, epochMs: number, seconds: number) {
  if (!Number.isFinite(seconds) || !withinCalendar(seconds)) return null;
  const at = dateAt(epochMs, seconds);
  if (convert(seconds, "s", "yr") >= 2) return f.dateTime(at, { year: "numeric", month: "short" });
  return f.dateTime(at, { dateStyle: "medium", timeStyle: "short", timeZone: VISITOR_ZONE });
}

/** A distance, km near a body ("12,400 km"), au and light-time farther out. */
export function formatRange(t: Translate, f: Format, d: DistanceSettings, km: number) {
  if (!Number.isFinite(km)) return NONE;
  if (km < 0.02 * AU_KM)
    return t("units.kmValue", {
      value: f.number(km, { maximumFractionDigits: km < 100 ? 1 : 0 }),
    });
  return formatAu(t, d, km / AU_KM, true);
}

/**
 * A speed: km/s, or a fraction of light speed once it is a hundredth of c, with as many
 * digits as it takes to tell it from c ("0.99999 c"), and the Lorentz factor once that is
 * more than one.
 */
export function formatSpeed(t: Translate, f: Format, kmPerS: number, gamma = 1) {
  if (!Number.isFinite(kmPerS)) return NONE;
  const beta = kmPerS / C_KM_S;
  if (beta < 0.01)
    return t("units.kmPerS", {
      value: f.number(kmPerS, { maximumFractionDigits: kmPerS < 10 ? 2 : kmPerS < 1000 ? 1 : 0 }),
    });
  const digits = Math.min(9, Math.max(3, Math.ceil(-Math.log10(Math.max(1e-9, 1 - beta))) + 1));
  const speed = t("units.lightSpeed", { value: f.number(beta, { maximumFractionDigits: digits }) });
  if (!(gamma >= 1.01)) return speed;
  return `${speed} · ${t("units.gamma", { value: f.number(gamma, { maximumSignificantDigits: 3 }) })}`;
}

/** Sunlight: "1,361 W/m²", "0.9 W/m²", "5.3E-20 W/m²" out among the galaxies. */
export function formatIrradiance(t: Translate, f: Format, wPerM2: number) {
  if (!Number.isFinite(wPerM2)) return NONE;
  const value =
    wPerM2 < 1e-3
      ? f.number(wPerM2, { notation: "scientific", maximumSignificantDigits: 2 })
      : f.number(wPerM2, { maximumSignificantDigits: wPerM2 < 10 ? 2 : 4 });
  return t("units.irradiance", { value });
}
