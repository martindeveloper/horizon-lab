import { keysOf } from "../records";
import { formatReadout } from "./format";
import { Measure } from "./measure";
import { UNITS, type UnitId } from "./units";

export type Variable = {
  /** Unicode symbol as the UI prints it, e.g. "r₊". */
  symbol: string;
  latex: string;
  /** Unit the formula expects or returns; omit for pure numbers (or geometric units). */
  unit?: UnitId;
};

/** `V` names every variable, `O` the result; the inputs are the rest. */
export type EquationSpec<V extends string, O extends V> = {
  /** Stable ID that documents (technical.json) can reference. */
  id: string;
  /** Unicode text for the UI; several lines allowed. */
  text: string;
  latex: string;
  output: O;
  variables: Record<V, Variable>;
  /** Inputs in each variable's unit; result in the output's unit. */
  compute: (inputs: Record<Exclude<V, O>, number>) => number;
  source?: string;
};

/** What documents and copy need from any equation, whatever its variables: print it. */
export interface Formula {
  readonly id: string;
  readonly source?: string;
  toString(): string;
  toLatex(): string;
}

/**
 * One formula, written once: it computes, prints itself for the UI and for
 * LaTeX, and shows a worked example, so tests, code and copy cannot drift.
 *
 *   keplerThirdLaw.compute({ a: 5.2 })  // 11.86 (yr)
 *   keplerThirdLaw.toString()           // "P² = a³"
 *   keplerThirdLaw.toLatex()            // "P^2 = a^3"
 */
export class Equation<V extends string = string, O extends V = V> implements Formula {
  readonly id: string;
  readonly output: O;
  readonly variables: Record<V, Variable>;
  readonly source?: string;
  readonly #spec: EquationSpec<V, O>;
  readonly #inputs: Exclude<V, O>[];

  constructor(spec: EquationSpec<V, O>) {
    this.#spec = spec;
    this.#inputs = keysOf(spec.variables).filter(
      (key): key is Exclude<V, O> => key !== spec.output,
    );
    this.id = spec.id;
    this.output = spec.output;
    this.variables = spec.variables;
    if (spec.source !== undefined) this.source = spec.source;
  }

  /**
   * Numbers are taken in each variable's unit; a Measure is converted to it
   * first. Cheap enough for render loops: plain numbers go straight through,
   * and a non-finite result is returned as is (tests check finiteness).
   */
  compute(inputs: Record<Exclude<V, O>, number | Measure>): number {
    if (allNumbers(inputs, this.#inputs)) return this.#spec.compute(inputs);
    const values: Partial<Record<Exclude<V, O>, number>> = {};
    for (const key of this.#inputs) {
      const input = inputs[key];
      if (input === undefined) throw new TypeError(`${this.id}: missing ${key}`);
      const variable = this.variables[key];
      values[key] = toNumber(input, variable?.unit);
    }
    if (!completeInputs(values, this.#inputs)) throw new TypeError(`${this.id}: missing an input`);
    return this.#spec.compute(values);
  }

  /** The result with its unit, for converting and printing. */
  measure(inputs: Record<Exclude<V, O>, number | Measure>) {
    const unit = this.variables[this.output].unit;
    if (!unit) throw new TypeError(`${this.id}: the result has no unit`);
    return new Measure(this.compute(inputs), unit);
  }

  toString() {
    return this.#spec.text;
  }

  toLatex() {
    return this.#spec.latex;
  }

  /** Units of the variables that have one: "P [yr], a [au]". */
  units(symbols?: Partial<Record<UnitId, string>>) {
    return keysOf(this.variables)
      .flatMap((key) => {
        const variable = this.variables[key];
        const unit = variable?.unit;
        if (unit === undefined) return [];
        const defined = UNITS[unit];
        const symbol = symbols?.[unit] ?? defined.symbol;
        return [`${variable.symbol} [${symbol}]`];
      })
      .join(", ");
  }

  /** A worked example: "a = 5.2 au → P = 11.9 yr". */
  example(
    inputs: Record<Exclude<V, O>, number>,
    locale = "en",
    symbols?: Partial<Record<UnitId, string>>,
  ) {
    const show = (key: V, value: number) => {
      const v = this.variables[key];
      if (v === undefined) return "";
      const unit = v.unit ? ` ${symbols?.[v.unit] ?? UNITS[v.unit].symbol}` : "";
      return `${v.symbol} = ${formatReadout(value, locale)}${unit}`;
    };
    const given = keysOf(inputs)
      .flatMap((key) => {
        const value = inputs[key];
        return value === undefined ? [] : [show(key, value)];
      })
      .join(", ");
    return `${given} → ${show(this.output, this.compute(inputs))}`;
  }
}

export const defineEquation = <V extends string, O extends V>(spec: EquationSpec<V, O>) =>
  new Equation<V, O>(spec);

function toNumber(input: unknown, unit: UnitId | undefined): number {
  if (input instanceof Measure) return unit ? input.in(unit) : input.value;
  if (typeof input === "number") return input;
  throw new TypeError("Expected a number");
}

function allNumbers<K extends string>(
  inputs: Record<K, number | Measure>,
  keys: readonly K[],
): inputs is Record<K, number> {
  return keys.every((key) => typeof inputs[key] === "number");
}

function completeInputs<K extends string>(
  values: Partial<Record<K, number>>,
  keys: readonly K[],
): values is Record<K, number> {
  return keys.every((key) => typeof values[key] === "number");
}
