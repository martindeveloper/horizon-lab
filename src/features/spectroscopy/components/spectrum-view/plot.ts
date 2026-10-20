import { useMemo } from "react";

import type { Spectrum } from "../../lib/model/spectrum";

/** Flux gridlines, and the values labelled on them. */
export const FLUX_GRID = [0, 0.25, 0.5, 0.75, 1];
export const FLUX_LABELS = [0, 0.5, 1];

/** The plot's path, in a viewBox one unit per sample by 100. */
export type PlotPath = {
  /** Samples across. */
  n: number;
  /** The flux, and the continuum (empty when normalized or glowing). */
  line: string;
  cont: string;
  /** Where a normalized flux of 1 lies. */
  unit: number;
  /** The top of the scale, in units of the peak or the continuum. */
  ceiling: number;
};

function plotPath(spectrum: Spectrum, normalized: boolean, glowing: boolean): PlotPath {
  const { flux, continuum, peak } = spectrum;
  const n = flux.length;
  const values = new Float64Array(n);
  let top = 0;
  for (let i = 0; i < n; i++) {
    values[i] = normalized ? flux[i]! / (continuum[i]! || 1) : flux[i]! / (peak || 1);
    top = Math.max(top, values[i]!);
  }
  const ceiling = normalized ? Math.max(1.08, top * 1.04) : 1.06;
  const y = (v: number) => 100 - (v / ceiling) * 100;
  let line = "";
  let cont = "";
  for (let i = 0; i < n; i++) {
    line += `${i ? "L" : "M"}${i} ${y(values[i]!).toFixed(2)}`;
    if (!normalized && !glowing)
      cont += `${i ? "L" : "M"}${i} ${y(continuum[i]! / (peak || 1)).toFixed(2)}`;
  }
  return { n, line, cont, unit: y(1), ceiling };
}

export function usePlotPath(spectrum: Spectrum | null, normalized: boolean, glowing: boolean) {
  return useMemo(
    () => (spectrum ? plotPath(spectrum, normalized, glowing) : null),
    [spectrum, normalized, glowing],
  );
}

/** Tick spacing for a window: about eight labelled ticks. */
function tickStep(span: number) {
  for (const step of [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]) if (span / step <= 9) return step;
  return 100;
}

/** The wavelength axis of a window: labelled ticks every `step` nm and the minor ticks between. */
export function axisTicks(from: number, to: number) {
  const step = tickStep(to - from);
  const ticks: number[] = [];
  for (let v = Math.ceil(from / step) * step; v <= to + 1e-9; v += step) ticks.push(v);
  /* Minor ticks: fifths of a step, or quarters of a step of 2. */
  const minor = step / (String(step).replace(/[0.]/g, "").startsWith("2") ? 4 : 5);
  const minorTicks: number[] = [];
  for (let k = Math.ceil(from / minor); k * minor <= to + 1e-9; k++)
    if (Math.abs((k * minor) / step - Math.round((k * minor) / step)) > 1e-6)
      minorTicks.push(k * minor);
  return { step, ticks, minorTicks };
}
