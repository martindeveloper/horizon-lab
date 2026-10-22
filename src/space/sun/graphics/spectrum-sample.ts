import { SPECTRUM_MAX_K, SPECTRUM_MIN_K, SPECTRUM_SAMPLES } from "./parameters";

/** The shader's logarithmic, linearly interpolated float table; no new spectrum model. */
export function sampleSpectrum(table: Float32Array, kelvin: number, out: Float32Array) {
  const at =
    Math.min(
      1,
      Math.max(
        0,
        Math.log(Math.max(kelvin, SPECTRUM_MIN_K) / SPECTRUM_MIN_K) /
          Math.log(SPECTRUM_MAX_K / SPECTRUM_MIN_K),
      ),
    ) *
    (SPECTRUM_SAMPLES - 1);
  const lo = Math.floor(at);
  const hi = Math.min(lo + 1, SPECTRUM_SAMPLES - 1);
  for (let c = 0; c < 4; c++) {
    const a = table[lo * 4 + c]!;
    out[c] = a + (table[hi * 4 + c]! - a) * (at - lo);
  }
  return out;
}
