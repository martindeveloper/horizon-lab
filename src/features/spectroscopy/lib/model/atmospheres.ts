import { lerp } from "@horizon/toolkit/math";

import data from "./atmospheres.json";
import { recentCache } from "./recent";

/**
 * Stellar photospheres from Castelli & Kurucz's (2003) ATLAS9 models
 * (scripts/fetch-model-atmospheres.mjs): temperature, pressures and the mass of gas above each
 * Rosseland optical depth from 10⁻⁴ to 10^1.5, so starlight can be integrated through a real
 * model rather than a guess.
 */

export type Layer = {
  /** log₁₀ τ_Ross: the model's depth scale, its optical depth in the Rosseland mean. */
  logTau: number;
  /** K. */
  temperature: number;
  /** Pa. */
  electronPressure: number;
  /** Pa. */
  gasPressure: number;
  /** Mass of gas above this depth, kg m⁻². */
  column: number;
};

export type Photosphere = {
  /** The effective temperature the model was computed for, K. */
  teff: number;
  /** Surface gravity, log₁₀ of g in cm s⁻². */
  logg: number;
  /** From the top down. */
  layers: readonly Layer[];
};

type Model = { teff: number; logg: number; layers: number[][] };
type Row = readonly [T: number, logPe: number, logPg: number, logColumn: number];

const DEPTHS: readonly number[] = data.depths;

const mix = (a: Row, b: Row, t: number): Row => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
  lerp(a[3], b[3], t),
];

function photosphere(teff: number, logg: number, rows: readonly Row[]): Photosphere {
  return {
    teff,
    logg,
    layers: rows.map(([T, logPe, logPg, logColumn], i) => ({
      logTau: DEPTHS[i]!,
      temperature: T,
      electronPressure: 10 ** logPe,
      gasPressure: 10 ** logPg,
      column: 10 ** logColumn,
    })),
  };
}

/** A model's layers, checked: four numbers each. */
const rowsOf = (model: Model): Row[] =>
  model.layers.map((layer) => {
    const [T, logPe, logPg, logColumn] = layer;
    if (layer.length !== 4 || [T, logPe, logPg, logColumn].some((v) => typeof v !== "number"))
      throw new Error(`Malformed layer in the ${model.teff} K model`);
    return [T!, logPe!, logPg!, logColumn!];
  });

const STAR_MODELS = data.stars as Record<string, Model>;

const starPhotospheres = recentCache<string, Photosphere>(Object.keys(STAR_MODELS).length);

/** The ATLAS9 model nearest a named star, built once. */
export const starPhotosphere = (id: string) =>
  starPhotospheres(id, () => {
    const model = STAR_MODELS[id];
    if (!model) throw new Error(`No model atmosphere for ${id}`);
    return photosphere(model.teff, model.logg, rowsOf(model));
  });

const SEQUENCE = data.sequence as Model[];
/** Each main-sequence model's layers, checked once. */
const SEQUENCE_ROWS = SEQUENCE.map(rowsOf);
/** The main-sequence models' temperature span, K. */
const GRID_RANGE = [SEQUENCE[0]!.teff, SEQUENCE[SEQUENCE.length - 1]!.teff] as const;

/**
 * The main-sequence stars the lab offers, K: down to the K/M boundary (3,890 K). Cooler, in
 * the M dwarfs, molecules (TiO above all) shape the spectrum, and the lab has none of them.
 */
export const SEQUENCE_RANGE = [3900, GRID_RANGE[1]] as const;

/** Main-sequence photospheres kept: the star in view and the few temperatures it glides through. */
const SEQUENCE_KEPT = 8;

const sequencePhotospheres = recentCache<number, Photosphere>(SEQUENCE_KEPT);

function sequencePhotosphere(teff: number) {
  const i = Math.max(
    1,
    SEQUENCE.findIndex((m) => m.teff >= teff),
  );
  const a = SEQUENCE[i - 1]!;
  const b = SEQUENCE[i]!;
  const t = Math.log(teff / a.teff) / Math.log(b.teff / a.teff);
  const above = SEQUENCE_ROWS[i]!;
  return photosphere(
    teff,
    4,
    SEQUENCE_ROWS[i - 1]!.map((row, k) => mix(row, above[k]!, t)),
  );
}

/**
 * A main-sequence (log g = 4) photosphere at any effective temperature in the grid's span,
 * between its two neighbouring models (linear in log T_eff, depth by depth); the same object
 * for the same temperature while it is in use.
 */
export const mainSequencePhotosphere = (teff: number): Photosphere =>
  sequencePhotospheres(Math.min(GRID_RANGE[1], Math.max(GRID_RANGE[0], teff)), sequencePhotosphere);

/** The layer at a depth, interpolated (pressures and column in logs). */
export function layerAt(atmosphere: Photosphere, logTau: number): Layer {
  const { layers } = atmosphere;
  const i = Math.min(
    layers.length - 1,
    Math.max(
      1,
      layers.findIndex((l) => l.logTau >= logTau),
    ),
  );
  const a = layers[i - 1]!;
  const b = layers[i]!;
  const t = Math.min(1, Math.max(0, (logTau - a.logTau) / (b.logTau - a.logTau)));
  const log = (x: number, y: number) => 10 ** (Math.log10(x) + t * (Math.log10(y) - Math.log10(x)));
  return {
    logTau,
    temperature: a.temperature + t * (b.temperature - a.temperature),
    electronPressure: log(a.electronPressure, b.electronPressure),
    gasPressure: log(a.gasPressure, b.gasPressure),
    column: log(a.column, b.column),
  };
}
