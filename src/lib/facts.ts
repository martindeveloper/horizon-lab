/**
 * Catalogue facts and the cards built from them, for every simulation: a fact is a sourced
 * value or published span (`@horizon/toolkit/science`) citing the shared bibliography; a card
 * spec says which facts fill a card's rows and the placeholders of its words. Printing goes
 * through the simulation's messages, which hold only words: units, row labels, badges.
 */
import type { useFormatter } from "next-intl";

import type { SourceId } from "@/lib/sources";
import {
  formatDistance,
  lightTime,
  printFact,
  printFactSpan,
  quoteFact,
  type DistanceChoice,
  type DistanceFormat,
  type FactSpan,
  type FactValue,
  type Range,
} from "@horizon/toolkit/science";

export { type Status } from "@horizon/toolkit/science";

/** A measured or modelled value, with an optional published spread. */
export type Value = FactValue<SourceId> & Provenance;
/** Only a published span ("2,000–5,000 au"): no central value is claimed. */
export type Span = FactSpan<SourceId> & Provenance;

/** Additional input sources for a figure derived from more than one catalogue. */
type Provenance = { sources?: readonly SourceId[] };

export const factSources = (fact: Fact): SourceId[] => [
  ...new Set([fact.source, ...(fact.sources ?? [])]),
];

export type Fact = Value | Span;
/** One object's figures, by fact id. */
export type Facts = Readonly<Record<string, Fact>>;

/** A catalogue: groups of objects, each object's facts by id. */
type Catalogue = Readonly<Record<string, Readonly<Record<string, Facts>>>>;

/**
 * A literature figure, as a catalogue types it: a value with an optional published spread, or,
 * with `value` null, the spread alone.
 */
type LiteratureExtra = Provenance & {
  range?: Range;
  digits?: number;
  show?: NonNullable<Value["show"]>;
  note?: string;
};
export function literatureFact(
  value: number,
  unit: Value["unit"],
  source: SourceId,
  status: Value["status"],
  extra?: LiteratureExtra,
): Value;
export function literatureFact(
  value: null,
  unit: Value["unit"],
  source: SourceId,
  status: Value["status"],
  extra: LiteratureExtra & { range: Range },
): Span;
export function literatureFact(
  value: number | null,
  unit: Value["unit"],
  source: SourceId,
  status: Value["status"],
  extra: LiteratureExtra = {},
): Fact {
  const { range, ...rest } = extra;
  if (value === null) {
    if (!range) throw new Error("A span needs its range");
    return { range, unit, source, status, ...rest };
  }
  return { value, unit, source, status, ...(range ? { range } : {}), ...rest };
}

/** Every fact with its path ("planets.earth.radius"), for tests and the ledger. */
export function factsOf(catalogue: Catalogue): { path: string; fact: Fact }[] {
  return Object.entries(catalogue).flatMap(([group, entries]) =>
    Object.entries(entries).flatMap(([id, facts]) =>
      Object.entries(facts).map(([name, fact]) => ({ path: `${group}.${id}.${name}`, fact })),
    ),
  );
}

/** How a figure fills a placeholder: a value, or a published span. */
export type Ref =
  | { kind: "value"; fact: Value }
  | { kind: "span"; fact: (Value | Span) & { range: Range } };

export const v = (fact: Value): Extract<Ref, { kind: "value" }> => ({ kind: "value", fact });
export const r = (fact: (Value | Span) & { range: Range }): Extract<Ref, { kind: "span" }> => ({
  kind: "span",
  fact,
});

/** Prefer the supplied interval; keep a central value only when there is no interval. */
export const factRef = (fact: Fact): Ref =>
  fact.value === undefined ? r(fact) : fact.range ? r({ ...fact, range: fact.range }) : v(fact);

export type Args = Readonly<Record<string, Ref>>;

/**
 * A row: its label is `facts.<id>`; its value the message `text` with `args`, or a figure
 * alone (`figure`).
 */
export type Row =
  | { id: string; text: string; args?: Args; figure?: never }
  | { id: string; figure: Ref; text?: never; args?: never };

export const row = (id: string, text: string, args?: Args): Row =>
  args ? { id, text, args } : { id, text };
export const figureRow = (id: string, figure: Ref): Row => ({ id, figure });

export type CardSpec = {
  rows: readonly Row[];
  /** Arguments of the card's body and caution messages. */
  body?: Args;
  caution?: Args;
};

/** A card wholly described by its spec, with its kicker (`badges.<badge>`). */
export type StaticCard<Badge extends string = string> = CardSpec & { badge: Badge };

/** The member of a selection union with this `kind`. */
export type Of<S extends { kind: string }, K extends S["kind"]> = Extract<S, { kind: K }>;

/** What a card's kicker says about how far its figures can be trusted (`badges.<id>`); a simulation adds its own. */
export type Badge = "measured" | "mixed" | "inferred" | "sketch" | "schematic";

/** A card as the selection sheet shows it. */
export type Card = {
  badge: string;
  title: string;
  facts: CardFact[];
  body: string;
  caution: string;
};
export type CardFact = { id: string; label: string; value: string };

/** The page's number and date formatter (next-intl's `useFormatter`). */
export type Format = ReturnType<typeof useFormatter>;

/** A simulation's translator, scoped to its namespace. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The visitor's distance unit and language, for every distance readout. */
export type DistanceSettings = { unit: DistanceChoice; locale: string };

/** Distances in the visitor's unit, worded by the simulation's `units.*` and `names.*`. */
export function distanceFormat(t: Translate, d: DistanceSettings): DistanceFormat {
  return {
    unit: d.unit,
    locale: d.locale,
    symbols: { au: t("units.au"), ly: t("units.ly"), pc: t("units.pc") },
    millionWord: t("names.million"),
    billionWord: t("names.billion"),
  };
}

/** Same readout as the canvas labels: "5.37 au · light-time 45 min", "2.5 million ly". */
export function formatAu(t: Translate, d: DistanceSettings, au: number, withLightTime = false) {
  return formatDistance(au, {
    ...distanceFormat(t, d),
    ...(withLightTime ? { lightTimeLabel: t("names.lightTime") } : {}),
  });
}

/** How long light takes to cross `au`, in the unit that fits: "8.3 min", "4.1 h", "1.3 d". */
export function formatLightTime(f: Format, au: number) {
  const time = lightTime(au);
  return `${f.number(time.value, { maximumFractionDigits: time.digits })} ${time.unit}`;
}

/**
 * A catalogue figure in the visitor's language: lengths in their distance unit with its
 * symbol, other units in the unit the message words. Literature values keep their
 * significant figures; lengths at least two, so a conversion keeps its shape.
 */
export function figure(t: Translate, d: DistanceSettings, fact: Value) {
  return printFact(fact, fact.value, distanceFormat(t, d));
}

/** A published span, the unit once: "2.1–3.3 au", "1,300–2,000", "4–5" (billion years). */
export function span(t: Translate, d: DistanceSettings, fact: (Value | Span) & { range: Range }) {
  return printFactSpan(fact, distanceFormat(t, d));
}

/** A referenced figure, printed. */
export function print(t: Translate, d: DistanceSettings, ref: Ref) {
  return ref.kind === "value" ? figure(t, d, ref.fact) : span(t, d, ref.fact);
}

/** Every referenced figure, printed, as `t()` arguments. */
export function printAll(t: Translate, d: DistanceSettings, args: Args = {}) {
  return Object.fromEntries(Object.entries(args).map(([name, ref]) => [name, print(t, d, ref)]));
}

/** A spec's rows, and its body and caution arguments, printed. */
export function buildCard(t: Translate, d: DistanceSettings, spec: CardSpec) {
  const facts: CardFact[] = spec.rows.map((row) => ({
    id: row.id,
    label: t(`facts.${row.id}`),
    value: row.figure ? print(t, d, row.figure) : t(row.text, printAll(t, d, row.args)),
  }));
  return { facts, body: printAll(t, d, spec.body), caution: printAll(t, d, spec.caution) };
}

/** A card its spec describes whole, its words under `key` (`.title`, `.body`, `.caution`). */
export function staticCard(t: Translate, d: DistanceSettings, key: string, spec: StaticCard): Card {
  const built = buildCard(t, d, spec);
  return {
    badge: t(`badges.${spec.badge}`),
    title: t(`${key}.title`),
    facts: built.facts,
    body: t(`${key}.body`, built.body),
    caution: t(`${key}.caution`, built.caution),
  };
}

/**
 * A figure counted in a power of ten its sentence words, for prose only: "{massMillions}
 * million Suns" quotes 4.297 × 10⁶ M☉ as "4.3" (exponent 6, two digits). A plain count, so no
 * unit converts it again.
 */
export function inPowerOfTen(fact: Fact, exponent: number, digits: number): Fact {
  const { show: _show, value, range, ...rest } = fact;
  const scale = (v: number) => v / 10 ** exponent;
  const spread = range ? ([scale(range[0]), scale(range[1])] as const) : undefined;
  const base = { ...rest, unit: "count" as const, digits };
  if (value === undefined) {
    if (!spread) throw new Error("A span needs its range");
    return { ...base, range: spread };
  }
  return spread
    ? { ...base, value: scale(value), range: spread }
    : { ...base, value: scale(value) };
}

const proseCache = new WeakMap<object, Map<string, Record<string, string>>>();

/**
 * Every figure a simulation's prose quotes (`figures`, by placeholder name), each in the unit
 * its sentence names, as `t()` arguments; once per language.
 */
export function proseArgs(figures: Readonly<Record<string, Fact>>, locale: string) {
  let byLocale = proseCache.get(figures);
  if (!byLocale) proseCache.set(figures, (byLocale = new Map()));
  let args = byLocale.get(locale);
  if (!args) {
    args = Object.fromEntries(
      Object.entries(figures).map(([name, fact]) => [name, quoteFact(locale, fact)]),
    );
    byLocale.set(locale, args);
  }
  return args;
}
