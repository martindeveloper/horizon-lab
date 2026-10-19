import data from "./atmospheres.json";

/**
 * Stellar photospheres from Castelli & Kurucz's (2003) ATLAS9 models
 * (scripts/fetch-model-atmospheres.mjs): temperature, pressures and the mass of gas above each
 * Rosseland optical depth from 10⁻⁴ to 10^1.5, so starlight can be integrated through a real
 * model rather than a guess.
 */

/** One depth in a model. */
export type Layer = {
  /** log₁₀ τ_Ross: the continuum's optical depth (Rosseland mean). */
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
  a[0] + t * (b[0] - a[0]),
  a[1] + t * (b[1] - a[1]),
  a[2] + t * (b[2] - a[2]),
  a[3] + t * (b[3] - a[3]),
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

/** The ATLAS9 model nearest a named star. */
export function starPhotosphere(id: string): Photosphere {
  const model = (data.stars as Record<string, Model>)[id];
  if (!model) throw new Error(`No model atmosphere for ${id}`);
  return photosphere(model.teff, model.logg, rowsOf(model));
}

const SEQUENCE = data.sequence as Model[];
/** The main-sequence models' temperature span, K. */
export const SEQUENCE_RANGE = [SEQUENCE[0]!.teff, SEQUENCE[SEQUENCE.length - 1]!.teff] as const;

/**
 * A main-sequence (log g = 4) photosphere at any effective temperature in the grid's span,
 * between its two neighbouring models (linear in log T_eff, depth by depth).
 */
export function mainSequencePhotosphere(teff: number): Photosphere {
  const clamped = Math.min(SEQUENCE_RANGE[1], Math.max(SEQUENCE_RANGE[0], teff));
  const i = Math.max(
    1,
    SEQUENCE.findIndex((m) => m.teff >= clamped),
  );
  const a = SEQUENCE[i - 1]!;
  const b = SEQUENCE[i]!;
  const t = Math.log(clamped / a.teff) / Math.log(b.teff / a.teff);
  const rows = rowsOf(a).map((row, k) => mix(row, rowsOf(b)[k]!, t));
  return photosphere(clamped, 4, rows);
}

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
