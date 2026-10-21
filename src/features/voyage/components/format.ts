import { formatAu, type DistanceSettings, type Format, type Translate } from "@/lib/facts";
import { AU_KM, convert } from "@horizon/toolkit/science";

import { dateAt, withinCalendar } from "../lib/model/calendar";
import { speedFigure } from "../lib/model/instruments";
import { STANDARD_GRAVITY_KM_S2 } from "../lib/model/parameters";

/** What a readout shows for a value it has none of. */
export const NONE = "—";
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

/** A trip's duration (`formatDuration`), or "never" for one no drive completes. */
export const formatTrip = (t: Translate, f: Format, seconds: number) =>
  seconds === Infinity ? t("hud.never") : formatDuration(t, f, seconds);

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

/** A speed (`speedFigure`), and the Lorentz factor once that is more than one. */
export function formatSpeed(t: Translate, f: Format, kmPerS: number, gamma = 1) {
  if (!Number.isFinite(kmPerS)) return NONE;
  const { ofC, value, digits } = speedFigure(kmPerS);
  const number = f.number(value, { maximumFractionDigits: digits });
  const speed = t(ofC ? "units.lightSpeed" : "units.kmPerS", { value: number });
  if (!(gamma >= 1.01)) return speed;
  return `${speed} · ${t("units.gamma", { value: f.number(gamma, { maximumSignificantDigits: 3 }) })}`;
}

/** A pull in standard gravities: "0.06 g", "6E-4 g", "2.1E-14 g" between the stars. */
export function formatGravity(t: Translate, f: Format, kmPerS2: number) {
  if (!Number.isFinite(kmPerS2)) return NONE;
  const g = kmPerS2 / STANDARD_GRAVITY_KM_S2;
  const value =
    g < 1e-3
      ? f.number(g, { notation: "scientific", maximumSignificantDigits: 2 })
      : f.number(g, { maximumSignificantDigits: 2 });
  return t("units.gravity", { value });
}

/** A time warp: "3,600×", "3.2M×". */
export function formatWarp(t: Translate, f: Format, warp: number) {
  if (!Number.isFinite(warp)) return NONE;
  return t("units.warp", {
    value: f.number(warp, { notation: "compact", maximumSignificantDigits: 2 }),
  });
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
