import { reach, shapeAt, type Profile } from "../profile";
import { TELLURIC } from "../telluric";
import type { Instrument, Spectrum } from "./types";

/** Below this, a line's optical depth is ignored. */
export const TAU_FLOOR = 1e-4;
/** The finest step in ln λ (0.45 km/s), and the most samples a window may take. */
const FINE_STEP = 1.5e-6;
export const MAX_FINE = { slab: 160_000, star: 60_000 };
const FWHM_PER_SIGMA = 2 * Math.sqrt(2 * Math.LN2);

export type Grid = { lnStart: number; step: number; count: number };

/** Calls `visit(i, nm)` at the grid's samples `first` through `last`, walking the log grid. */
export function forEachSample(
  grid: Grid,
  visit: (i: number, nm: number) => void,
  first = 0,
  last = grid.count - 1,
) {
  const ratio = Math.exp(grid.step);
  let nm = Math.exp(grid.lnStart + first * grid.step);
  for (let i = first; i <= last; i++) {
    visit(i, nm);
    nm *= ratio;
  }
}

/**
 * Calls `visit(i, offset)` at every grid sample the profile reaches, offset from centre in nm,
 * out to at most `cap` widths.
 */
export function sweep(
  p: Profile,
  grid: Grid,
  visit: (i: number, offset: number) => void,
  cap = 40,
) {
  const width = reach(p, TAU_FLOOR, cap);
  /* Wings wider than the line's own wavelength start at the grid's first sample, not at λ ≤ 0. */
  const blue = p.centre - width;
  const first = blue > 0 ? Math.max(0, Math.ceil((Math.log(blue) - grid.lnStart) / grid.step)) : 0;
  const last = Math.min(
    grid.count - 1,
    Math.floor((Math.log(p.centre + width) - grid.lnStart) / grid.step),
  );
  forEachSample(grid, (i, nm) => visit(i, nm - p.centre), first, last);
}

function airTransmission(grid: Grid, airmass: number) {
  const tau = new Float64Array(grid.count);
  if (airmass > 0)
    for (const p of TELLURIC)
      sweep({ ...p, peak: p.peak * airmass }, grid, (i, offset) => {
        tau[i]! += p.peak * airmass * shapeAt(p, offset / p.doppler);
      });
  /* Most of the window has no O₂ line: e^0 is 1, no exponential needed. */
  return tau.map((t) => (t > 0 ? Math.exp(-t) : 1));
}

/** Box-averages `values` in groups of `k`, then convolves with a Gaussian of σ samples. */
function smooth(values: Float64Array, k: number, sigma: number) {
  const n = Math.floor(values.length / k);
  let binned = values;
  if (k > 1) {
    binned = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < k; j++) sum += values[i * k + j]!;
      binned[i] = sum / k;
    }
  }
  if (sigma < 0.3) return binned;
  /* One side of the kernel, which is symmetric, and its whole weight, which every sample away
     from the ends receives. */
  const half = Math.ceil(4 * sigma);
  const kernel = new Float64Array(half + 1);
  for (let j = 0; j <= half; j++) kernel[j] = Math.exp(-0.5 * (j / sigma) ** 2);
  let whole = kernel[0]!;
  for (let j = 1; j <= half; j++) whole += 2 * kernel[j]!;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (i >= half && i < n - half) {
      let sum = binned[i]! * kernel[0]!;
      for (let j = 1; j <= half; j++) sum += (binned[i - j]! + binned[i + j]!) * kernel[j]!;
      out[i] = sum / whole;
      continue;
    }
    let sum = 0;
    let weight = 0;
    for (let j = Math.max(-half, -i); j <= Math.min(half, n - 1 - i); j++) {
      sum += binned[i + j]! * kernel[Math.abs(j)]!;
      weight += kernel[Math.abs(j)]!;
    }
    out[i] = sum / weight;
  }
  return out;
}

/** The instrument's blur, then the fine grid resampled to `samples` evenly spaced pixels. */
function observe(
  fine: Float64Array,
  grid: Grid,
  resolution: number,
  from: number,
  to: number,
  samples: number,
  continuumAt: (nm: number) => number,
): Spectrum {
  const sigma = 1 / (resolution * FWHM_PER_SIGMA);
  const k = Math.max(1, Math.floor(sigma / (3 * grid.step)));
  const blurred = smooth(fine, k, sigma / (k * grid.step));
  const coarseStep = k * grid.step;
  const coarseStart = grid.lnStart + ((k - 1) / 2) * grid.step;
  /* Running sums, so each pixel can average the light across its own width, as a detector does. */
  const sums = new Float64Array(blurred.length + 1);
  for (let i = 0; i < blurred.length; i++) sums[i + 1] = sums[i]! + blurred[i]!;
  const indexOf = (nm: number) =>
    Math.min(blurred.length - 1, Math.max(0, (Math.log(nm) - coarseStart) / coarseStep));
  const sumTo = (x: number) => {
    const i = Math.floor(x + 0.5);
    return sums[i]! + (x + 0.5 - i) * (blurred[Math.min(i, blurred.length - 1)] ?? 0);
  };
  const pixel = samples > 1 ? (to - from) / (samples - 1) : 0;
  const wavelengths = new Float64Array(samples);
  const flux = new Float64Array(samples);
  const continuum = new Float64Array(samples);
  let peak = 0;
  for (let s = 0; s < samples; s++) {
    const nm = samples === 1 ? from : from + pixel * s;
    wavelengths[s] = nm;
    const a = indexOf(nm - pixel / 2);
    const b = indexOf(nm + pixel / 2);
    if (b - a >= 1) flux[s] = (sumTo(b) - sumTo(a)) / (b - a);
    else {
      const x = indexOf(nm);
      const i = Math.min(blurred.length - 2, Math.floor(x));
      const t = x - i;
      flux[s] = blurred[i]! * (1 - t) + blurred[i + 1]! * t;
    }
    continuum[s] = continuumAt(nm);
    peak = Math.max(peak, flux[s]!, continuum[s]!);
  }
  return { wavelengths, flux, continuum, peak };
}

/**
 * What both sources share once their light is known: `intensityAt(i, nm)` on the fine grid,
 * through Earth's air, then the instrument (`observe`), with `continuumAt` for the plot.
 */
export function render(
  grid: Grid,
  obs: Instrument,
  from: number,
  to: number,
  samples: number,
  intensityAt: (i: number, nm: number) => number,
  continuumAt: (nm: number) => number,
): Spectrum {
  const air = airTransmission(grid, obs.airmass);
  const fine = new Float64Array(grid.count);
  forEachSample(grid, (i, nm) => {
    fine[i] = intensityAt(i, nm) * air[i]!;
  });
  return observe(fine, grid, obs.resolution, from, to, samples, continuumAt);
}

/* ─── Lattices: samples kept between windows ─── */

/**
 * A source's spectrum is worked out at rest, on a lattice in ln λ: samples at whole multiples
 * of `FINE_STEP` · 2^level, the level the coarsest a window needs (`MAX_FINE`). A velocity only
 * moves the lattice (ln λ_observed = ln λ_rest + ln(λ/λ₀)), and a window that slides or a
 * velocity that changes reuses what was worked out: the lattice is kept in chunks of this many
 * samples, each filled the first time a window reaches it.
 */
const CHUNK = 2048;
/** Sources kept with their lattices: the one in view and the few a visit switches between. */
export const MODELS_KEPT = 4;

/** A source's samples at rest, by level and then by chunk. */
export type Lattices = Map<number, Map<number, Float32Array | Float64Array>>;

/** A source's fine grid for a window: on the lattice at rest, moved by the source's `shift`. */
export type LatticeGrid = Grid & { level: number; first: number };

export function latticeFor(
  from: number,
  to: number,
  resolution: number,
  shift: number,
  max: number,
): LatticeGrid {
  const sigma = 1 / (resolution * FWHM_PER_SIGMA);
  const lnShift = Math.log(shift);
  const lo = Math.log(from) - 5 * sigma - lnShift;
  const hi = Math.log(to) + 5 * sigma - lnShift;
  for (let level = 0; ; level++) {
    const step = FINE_STEP * 2 ** level;
    const first = Math.floor(lo / step);
    const count = Math.ceil(hi / step) - first + 1;
    if (count <= max) return { lnStart: first * step + lnShift, step, count, level, first };
  }
}

/** The lattice's own samples for a grid: the same ones, at rest. */
export const restGrid = (grid: LatticeGrid): Grid => ({ ...grid, lnStart: grid.first * grid.step });

/** The grid's samples from `lattices`, each chunk made by `fill` (at rest) when first reached. */
export function latticeSamples(
  lattices: Lattices,
  { level, first, count, step }: LatticeGrid,
  fill: (chunk: Grid) => Float32Array | Float64Array,
) {
  let chunks = lattices.get(level);
  if (!chunks) lattices.set(level, (chunks = new Map()));
  const out = new Float64Array(count);
  for (let c = Math.floor(first / CHUNK); c * CHUNK < first + count; c++) {
    let chunk = chunks.get(c);
    if (!chunk) {
      chunk = fill({ lnStart: c * CHUNK * step, step, count: CHUNK });
      chunks.set(c, chunk);
    }
    const from = Math.max(first, c * CHUNK);
    const to = Math.min(first + count, (c + 1) * CHUNK);
    out.set(chunk.subarray(from - c * CHUNK, to - c * CHUNK), from - first);
  }
  return out;
}
