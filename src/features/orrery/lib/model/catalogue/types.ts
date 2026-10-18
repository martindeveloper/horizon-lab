import type { UnitId } from "@horizon/toolkit/science";

import type { SourceId } from "./sources";

/**
 * Units are the science kit's (`UNITS`), so a figure converts with `convert` like every
 * other number in Horizon; `count`, `percent` and `ratio` are plain numbers.
 */
export type Unit = UnitId | "count" | "percent" | "ratio";
/** Lengths a card shows in the visitor's distance unit (au, ly or pc) with its symbol. */
export type LengthUnit = "au" | "ly" | "Mly" | "pc" | "kpc" | "Mpc";

const LENGTHS: ReadonlySet<Unit> = new Set<LengthUnit>(["au", "ly", "Mly", "pc", "kpc", "Mpc"]);
export const isLength = (unit: Unit): unit is LengthUnit => LENGTHS.has(unit);

/**
 * How a figure was checked (docs/science-sources.md): opened in the source, computed from
 * checked inputs, a deliberate model choice, or not yet confirmed. Every fact states it.
 */
export type Status = "verified" | "derived" | "teaching-choice" | "flag";

export type Range = readonly [low: number, high: number];

type Common = {
  unit: Unit;
  source: SourceId;
  status: Status;
  /** Significant figures to print; by default as many as the value (or range) is written with. */
  digits?: number;
  /**
   * Print in this unit of the kit, the one the message words: years as "Gyr" for "billion
   * years". Lengths ignore it and follow the visitor's distance unit.
   */
  show?: UnitId;
  /** Arithmetic or caveat for the ledger. */
  note?: string;
};

/** A measured or modelled value, with an optional published spread. */
export type Value = Common & { value: number; range?: Range; at?: never };
/** Only a published span ("2,000–5,000 au"): no central value is claimed. */
export type Span = Common & { range: Range; value?: never; at?: never };
/** A value the model gives for any moment on the slider; `value` is today's. */
export type Live = Common & { value: number; at: (yearsAgo: number) => number; range?: never };

export type Fact = Value | Span | Live;
/** One object's figures, by fact id. */
export type Facts = Readonly<Record<string, Fact>>;
