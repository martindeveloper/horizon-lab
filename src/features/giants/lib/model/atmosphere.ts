/**
 * Display atmosphere: CIE-integrated Planck continuum plus empirical atmosphere limb fits.
 * R,V,B passbands approximate the display's RGB angular response; they are NOT RGB spectra.
 * Solar metallicity and xi=2 km/s are display assumptions. Outside the grid, clamp to its
 * boundary; compact remnants use the Eddington grey fallback, never extrapolated ATLAS fits.
 */
import { planckRadiance, spectrumXyz, xyzToLinearSrgb } from "@horizon/toolkit/science";

import { SPECTRUM_MIN_K, SPECTRUM_MAX_K, SPECTRUM_SAMPLES, PROFILE_SAMPLES } from "../parameters";
import grid from "./limb-grid.json";

export type Coefficients = readonly [number, number, number, number];
type Row = readonly [string, number, number, Coefficients, Coefficients, Coefficients];
const isCoefficients = (value: unknown): value is Coefficients =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every((n) => typeof n === "number" && Number.isFinite(n));
const isRow = (value: unknown): value is Row =>
  Array.isArray(value) &&
  value.length === 6 &&
  typeof value[0] === "string" &&
  typeof value[1] === "number" &&
  typeof value[2] === "number" &&
  isCoefficients(value[3]) &&
  isCoefficients(value[4]) &&
  isCoefficients(value[5]);
const rows: readonly Row[] = grid.rows.map((row) => {
  if (!isRow(row)) throw new Error("Invalid stellar atmosphere row");
  return row;
});

/** Full continuum colour normalized to CIE Y=1, and log photopic radiance for exposure. */
export function stellarContinuum(kelvin: number): readonly [number, number, number, number] {
  const T = Math.max(SPECTRUM_MIN_K, Math.min(SPECTRUM_MAX_K, kelvin));
  const xyz = spectrumXyz((nm) => planckRadiance(nm, T), 380, 780, 5);
  const rgb = xyzToLinearSrgb(xyz);
  // Retain out-of-gamut components until the shader's final gamut/tone mapping.
  return [rgb[0] / xyz[1], rgb[1] / xyz[1], rgb[2] / xyz[1], Math.log(xyz[1])];
}

export function continuumTable() {
  const data = new Float32Array(SPECTRUM_SAMPLES * 4);
  for (let j = 0; j < SPECTRUM_SAMPLES; j++)
    data.set(
      stellarContinuum(
        SPECTRUM_MIN_K * (SPECTRUM_MAX_K / SPECTRUM_MIN_K) ** (j / (SPECTRUM_SAMPLES - 1)),
      ),
      j * 4,
    );
  return data;
}

/** Four-coefficient Claret law: I(mu)/I(1), bounded only against fit overshoot. */
export function limbIntensity(coefficients: Coefficients, mu: number) {
  const m = Math.max(0, Math.min(1, mu));
  return Math.max(
    0,
    Math.min(1, 1 - coefficients.reduce((sum, a, k) => sum + a * (1 - m ** ((k + 1) / 2)), 0)),
  );
}

const mix = (a: Coefficients, b: Coefficients, t: number): Coefficients => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
  a[3] + (b[3] - a[3]) * t,
];

/** Interpolate gravity inside each temperature slice, then temperature; never extrapolate. */
export function limbCoefficients(kelvin: number, logg: number): readonly Coefficients[] {
  const model = kelvin < 3500 && logg >= 3.5 ? "PHOENIX" : "ATLAS";
  const models = rows.filter((r) => r[0] === model);
  const temperatures = [...new Set(models.map((r) => r[1]))].sort((a, b) => a - b);
  const highT = temperatures.find((T) => T >= kelvin) ?? temperatures.at(-1)!;
  const lowT = temperatures.filter((T) => T <= kelvin).at(-1) ?? temperatures[0]!;
  const slice = (T: number) => {
    const at = models.filter((r) => r[1] === T).sort((a, b) => a[2] - b[2]);
    const hi = at.find((r) => r[2] >= logg) ?? at.at(-1)!;
    const lo = at.filter((r) => r[2] <= logg).at(-1) ?? at[0]!;
    const f = hi[2] === lo[2] ? 0 : (logg - lo[2]) / (hi[2] - lo[2]);
    return ([3, 4, 5] as const).map((i) => mix(lo[i], hi[i], f));
  };
  const low = slice(lowT);
  const high = slice(highT);
  const f = lowT === highT ? 0 : (kelvin - lowT) / (highT - lowT);
  return low.map((a, j) => mix(a, high[j]!, f));
}

/** Each row: R,V,B limb intensities at mu=x, temperature at unit-sphere latitude |y|=x. */
export function atmosphereProfile(
  kelvin: number,
  logg: number | null,
  temperatures?: Float64Array,
) {
  const coefficients = logg === null ? null : limbCoefficients(kelvin, logg);
  const data = new Float32Array(PROFILE_SAMPLES * 4);
  for (let j = 0; j < PROFILE_SAMPLES; j++) {
    const mu = j / (PROFILE_SAMPLES - 1);
    for (let c = 0; c < 3; c++)
      data[j * 4 + c] = coefficients ? limbIntensity(coefficients[c]!, mu) : 0.4 + 0.6 * mu;
    data[j * 4 + 3] = temperatures?.[j] ?? kelvin;
  }
  return data;
}
