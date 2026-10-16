/** Summary of frame times in milliseconds. Robust statistics: medians, not means, decide. */
export type TimingSummary = {
  count: number;
  min: number;
  median: number;
  p90: number;
  max: number;
  mean: number;
};

/** Nearest-rank percentile of an ascending array, p in [0, 1]. */
function percentile(sorted: readonly number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}

export function summarizeTimings(samples: readonly number[]): TimingSummary {
  if (samples.length === 0) throw new RangeError("No timing samples");
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0]!,
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted.at(-1)!,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

/**
 * Median of each sample's neighbourhood (`window` samples, centred). A
 * sequence's cost may change legitimately (a camera pushing in); the local
 * median follows that trend, so departures from it are hitches.
 */
export function rollingMedian(samples: readonly number[], window = 9): number[] {
  const half = Math.floor(window / 2);
  return samples.map((_, i) => {
    const neighbourhood = samples.slice(Math.max(0, i - half), i + half + 1);
    return summarizeTimings(neighbourhood).median;
  });
}

/** Frames slower than `factor` times their local median: hitches. Indices, worst first. */
export function findSpikes(samples: readonly number[], factor = 2, window = 9): number[] {
  if (samples.length < 3) return [];
  const local = rollingMedian(samples, window);
  return samples
    .map((value, index) => ({ value, index, ratio: value / local[index]! }))
    .filter(({ ratio }) => ratio > factor)
    .sort((a, b) => b.ratio - a.ratio)
    .map(({ index }) => index);
}

/**
 * Least-squares fit of frame time against pixel count: ms = fixed + perMegapixel · MP.
 * A fragment-bound renderer is close to linear (r² near 1, small fixed cost);
 * a large fixed cost points at per-frame CPU, upload or vertex work.
 */
export type ScalingFit = {
  fixedMs: number;
  msPerMegapixel: number;
  r2: number;
  points: number;
};

export function fitScaling(points: readonly { pixels: number; ms: number }[]): ScalingFit | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.pixels / 1e6);
  const ys = points.map((p) => p.ms);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return {
    fixedMs: my - slope * mx,
    msPerMegapixel: slope,
    r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy),
    points: points.length,
  };
}

/** How far two equally sized RGBA images differ; alpha is ignored. */
export type ImageDifference = {
  /** Mean absolute channel difference, 0–255. */
  meanAbs: number;
  /** Largest channel difference, 0–255. */
  maxAbs: number;
  /** Fraction of pixels with any channel differing by more than `threshold`. */
  changed: number;
};

export function compareRgba(
  a: Uint8Array | Uint8ClampedArray,
  b: Uint8Array | Uint8ClampedArray,
  threshold = 8,
): ImageDifference {
  if (a.length !== b.length || a.length % 4 !== 0) throw new RangeError("Image sizes differ");
  let total = 0;
  let maxAbs = 0;
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    let pixel = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[i + c]! - b[i + c]!);
      total += d;
      if (d > pixel) pixel = d;
    }
    if (pixel > maxAbs) maxAbs = pixel;
    if (pixel > threshold) changed++;
  }
  const pixels = a.length / 4;
  return { meanAbs: total / (pixels * 3), maxAbs, changed: changed / pixels };
}

/**
 * A heat map of the per-pixel difference as RGBA: black where equal, rising
 * through amber to white. `gain` amplifies small differences.
 */
export function differenceMap(
  a: Uint8Array | Uint8ClampedArray,
  b: Uint8Array | Uint8ClampedArray,
  gain = 4,
): Uint8Array {
  if (a.length !== b.length || a.length % 4 !== 0) throw new RangeError("Image sizes differ");
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a[i + c]! - b[i + c]!));
    const v = Math.min(1, (d * gain) / 255);
    out[i] = Math.round(255 * Math.min(1, v * 2));
    out[i + 1] = Math.round(255 * Math.min(1, Math.max(0, v * 2 - 0.35)));
    out[i + 2] = Math.round(255 * Math.max(0, v * 2 - 1));
    out[i + 3] = 255;
  }
  return out;
}
