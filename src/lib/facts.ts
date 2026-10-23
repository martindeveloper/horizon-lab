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
  formatFigure,
  pluralOf,
  type DistanceChoice,
  type DistanceFormat,
  type FactSpan,
  type FactValue,
  type FigureOptions,
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

/** How a figure fills a placeholder: a value, a published span, or a figure printed as `as` says (`quoteAs` for a card's words). */
export type Ref =
  | { kind: "value"; fact: Value }
  | { kind: "span"; fact: (Value | Span) & { range: Range } }
  | { kind: "styled"; fact: Fact; as: FigureOptions };

export const v = (fact: Value): Extract<Ref, { kind: "value" }> => ({ kind: "value", fact });
export const r = (fact: (Value | Span) & { range: Range }): Extract<Ref, { kind: "span" }> => ({
  kind: "span",
  fact,
});

/** A figure printed as its sentence names it: in this unit, these digits, this style. */
export const styled = (fact: Fact, as: FigureOptions): Extract<Ref, { kind: "styled" }> => ({
  kind: "styled",
  fact,
  as,
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

export type Of<S extends { kind: string }, K extends S["kind"]> = Extract<S, { kind: K }>;

/** What a card's kicker says about how far its figures can be trusted (`badges.<id>`); a simulation adds its own. */
export type Badge = "measured" | "mixed" | "inferred" | "sketch" | "schematic";

export type Card = {
  badge: string;
  title: string;
  facts: CardFact[];
  body: string;
  caution: string;
};
export type CardFact = { id: string; label: string; value: string };

export type Format = ReturnType<typeof useFormatter>;

/** A simulation's translator, scoped to its namespace. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

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

export function print(t: Translate, d: DistanceSettings, ref: Ref) {
  if (ref.kind === "styled") return formatFigure(d.locale, ref.fact, ref.as).text;
  return ref.kind === "value" ? figure(t, d, ref.fact) : span(t, d, ref.fact);
}

/**
 * Every referenced figure, printed, as `t()` arguments, each with its plural category as
 * printed (`<name>Plural`) for a word that agrees with it.
 */
export function printAll(t: Translate, d: DistanceSettings, args: Args = {}) {
  return Object.fromEntries(
    Object.entries(args).flatMap(([name, ref]) => {
      const text = print(t, d, ref);
      return [
        [name, text],
        [`${name}Plural`, pluralOf(d.locale, text)],
      ];
    }),
  );
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

/** A figure as one sentence quotes it: a catalogue fact and how that sentence prints it. */
export type ProseFigure = Fact | { fact: Fact; as: FigureOptions };

/**
 * A fact printed the way its sentence words it: in another unit ("{sgrLy} light-years"), to
 * other significant figures, per power of ten ("{massMillions} million"), as scientific
 * notation, an error or bounds, with its unit.
 */
export const quoteAs = (fact: Fact, as: FigureOptions): ProseFigure => ({ fact, as });

const factOf = (figure: ProseFigure): Fact => ("fact" in figure ? figure.fact : figure);
const optionsOf = (figure: ProseFigure): FigureOptions => ("as" in figure ? figure.as : {});

/** The catalogue facts behind a map of prose figures, for tests and the ledger. */
export const proseFacts = (figures: Readonly<Record<string, ProseFigure>>) =>
  Object.fromEntries(Object.entries(figures).map(([name, figure]) => [name, factOf(figure)]));

const proseCache = new WeakMap<object, Map<string, Record<string, string>>>();

/**
 * Every figure a simulation's prose quotes (`figures`, by placeholder name), each in the unit
 * its sentence names, as `t()` arguments; once per language. Beside each, `<name>Plural` is
 * the plural category of the number as printed, for the word after it:
 * `{lhbGyr} {lhbGyrPlural, select, one {miliardou} many {miliardy} other {miliardami}}`.
 */
export function proseArgs(figures: Readonly<Record<string, ProseFigure>>, locale: string) {
  let byLocale = proseCache.get(figures);
  if (!byLocale) {
    byLocale = new Map();
    proseCache.set(figures, byLocale);
  }
  let args = byLocale.get(locale);
  if (!args) {
    args = Object.fromEntries(
      Object.entries(figures).flatMap(([name, figure]) => {
        const { text, plural } = formatFigure(locale, factOf(figure), optionsOf(figure));
        return [
          [name, text],
          [`${name}Plural`, plural],
        ];
      }),
    );
    byLocale.set(locale, args);
  }
  return args;
}
