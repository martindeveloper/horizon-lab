import { AU_KM, LIGHT_YEAR_KM, SPEED_OF_LIGHT } from "./constants";
import { formatReadout, formatSignificant, numberFormat } from "./format";
import { convert } from "./units";

/** IAU symbols: au (2012 Resolution B2), ly, pc. */
export type DistanceUnit = "au" | "ly" | "pc";
export const DISTANCE_UNITS: readonly DistanceUnit[] = ["au", "ly", "pc"];
/** A readout unit, or `auto`: each distance picks au or ly by its own size. */
export type DistanceChoice = DistanceUnit | "auto";

/** Where `auto` switches from au to ly: half a light-year (≈ 31,600 au), past the planets and the inner Oort cloud. */
export const AUTO_LIGHT_YEAR_FROM_AU = 0.5 * (LIGHT_YEAR_KM / AU_KM);

/** The unit a distance in au reads best in: au inside the Oort cloud's inner reach, ly beyond. */
export function autoDistanceUnit(au: number): DistanceUnit {
  return Math.abs(au) < AUTO_LIGHT_YEAR_FROM_AU ? "au" : "ly";
}

/** A choice resolved for a distance (au) of this size. */
export const resolveDistanceUnit = (choice: DistanceChoice, au: number): DistanceUnit =>
  choice === "auto" ? autoDistanceUnit(au) : choice;

/** Light-time across 1 au, in seconds (both definitions exact: 499.004784 s). */
export const AU_LIGHT_SECONDS = (AU_KM * 1000) / SPEED_OF_LIGHT;
/** Julian light-year in au. */
export const LIGHT_YEAR_AU = LIGHT_YEAR_KM / AU_KM;
/** IAU 2015 Resolution B2: one parsec is exactly 648 000/π au. */
export const PARSEC_AU = 648_000 / Math.PI;
export const PARSEC_KM = PARSEC_AU * AU_KM;

function finite(value: number) {
  if (!Number.isFinite(value)) throw new RangeError("Distance must be finite");
}

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit) {
  return convert(value, from, to);
}

export type LightTimeUnit = "s" | "min" | "h" | "d";
export type LightTime = { value: number; unit: LightTimeUnit; digits: number };

/** How long light takes to cross a distance given in au: seconds, minutes (under 3 h), hours, days. */
export function lightTime(au: number): LightTime {
  finite(au);
  const seconds = Math.abs(au) * AU_LIGHT_SECONDS;
  const pick = (value: number, unit: LightTimeUnit) => ({
    value,
    unit,
    digits: value < 10 ? 1 : 0,
  });
  if (seconds < 120) return pick(seconds, "s");
  if (seconds < 3 * 3600) return pick(seconds / 60, "min");
  if (seconds < 48 * 3600) return pick(seconds / 3600, "h");
  return pick(seconds / 86400, "d");
}

export type DistanceFormat = {
  /** `auto` picks au or ly for each distance (the larger end of a range). */
  unit: DistanceChoice;
  locale: string;
  /** Localized unit symbols, e.g. Czech "sv. r." for ly. */
  symbols: Record<DistanceUnit, string>;
  /** Phrase before the light-time ("light-time"); omit for no light-time. */
  lightTimeLabel?: string;
  /** Show the light-time from this distance in au (default 0.2)… */
  lightTimeFrom?: number;
  /** …up to this one (default 0.05 ly, about 18 light-days). */
  lightTimeTo?: number;
  /** Keep trailing zeros in both numbers, so a live readout holds its digit count. */
  fixed?: boolean;
  /** Localized word for a million ("million"): ly and pc from a million read "53.8 million ly". */
  millionWord?: string;
  /** Round to this many significant figures (a literature value), instead of the readout's ~3. */
  significant?: number;
};

function formatValue(value: number, options: DistanceFormat) {
  return options.significant
    ? formatSignificant(value, options.locale, options.significant)
    : formatReadout(value, options.locale, options.fixed);
}

/** The value in the chosen unit, divided down to millions where the host has a word for it. */
function scaled(au: number, magnitudeAu: number, options: DistanceFormat) {
  const unit = resolveDistanceUnit(options.unit, magnitudeAu);
  const value = convertDistance(au, "au", unit);
  const million =
    !!options.millionWord &&
    unit !== "au" &&
    /* A converted million (1 Mly) can land a rounding error below 10⁶. */
    Math.abs(convertDistance(magnitudeAu, "au", unit)) >= 1e6 * (1 - 1e-12);
  return { value: million ? value / 1e6 : value, million, unit };
}

function unitText(unit: DistanceUnit, million: boolean, options: DistanceFormat) {
  const symbol = options.symbols[unit];
  return million ? `${options.millionWord} ${symbol}` : symbol;
}

/**
 * One distance readout for every simulation: the value in the chosen unit,
 * then, inside the given range, how long light takes ("5.37 au · light-time
 * 45 min"). Labels come from the host; numbers from Intl.
 */
export function formatDistance(au: number, options: DistanceFormat) {
  const { locale, lightTimeLabel } = options;
  const { value, million, unit } = scaled(au, au, options);
  const text = `${formatValue(value, options)} ${unitText(unit, million, options)}`;
  if (million) return text;
  const from = options.lightTimeFrom ?? 0.2;
  const to = options.lightTimeTo ?? 0.05 * LIGHT_YEAR_AU;
  const abs = Math.abs(au);
  if (!lightTimeLabel || abs < from || abs > to) return text;
  const time = lightTime(au);
  const number = numberFormat(locale, time.digits, options.fixed ?? false).format(time.value);
  return `${text} · ${lightTimeLabel} ${number} ${time.unit}`;
}

/**
 * A span in the same readout, the unit once: "2.1–3.3 au", "1.6–3.2 ly". The larger end
 * picks the million scaling for both; ranges carry no light-time.
 */
export function formatDistanceRange(lowAu: number, highAu: number, options: DistanceFormat) {
  finite(lowAu);
  finite(highAu);
  const magnitude = Math.max(Math.abs(lowAu), Math.abs(highAu));
  const low = scaled(lowAu, magnitude, options);
  const high = scaled(highAu, magnitude, options);
  return `${formatValue(low.value, options)}–${formatValue(high.value, options)} ${unitText(high.unit, high.million, options)}`;
}
