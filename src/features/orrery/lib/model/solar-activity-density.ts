import { lcg, smoothstep, valueNoise2, valueNoise3 } from "@horizon/toolkit/math";

type DensityVolume = {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
};

let fullCache: DensityVolume | null = null;
let tightCache: DensityVolume | null = null;

/** Where the hedgerow's pillars stand along the sheet, as fractions of the half-length. */
const FEET = [-0.74, -0.3, 0.18, 0.64] as const;

/**
 * A small, authored 3D density field baked once when enabled: one quiescent prominence in
 * its own frame (x along the polarity-inversion line, y up, z across the sheet). It is a
 * hedgerow: a thin sheet of near-vertical threads hanging in the field's dips, standing on
 * pillars at its feet with dark arches between them, its legs rooted at both ends, and barbs
 * leaning out and down to parasitic polarity on either side (Parenti 2014, LRSP 11, 1 §2;
 * Gibson 2018, LRSP 15, 7). Each region mirrors it along x and z for variety.
 */
export function createSolarActivityDensity(tight: boolean): DensityVolume {
  const cached = tight ? tightCache : fullCache;
  if (cached) return cached;

  const width = tight ? 96 : 160;
  const height = tight ? 64 : 96;
  const depth = tight ? 32 : 48;
  const field = new Float32Array(width * height * depth);
  const random = lcg(74329);
  const stride = width * height;
  const scale = width / 160;

  function splat(x: number, y: number, z: number, sigma: number, density: number) {
    const vx = (x * 0.5 + 0.5) * (width - 1);
    const vy = y * (height - 1);
    const vz = (z * 0.5 + 0.5) * (depth - 1);
    const rMax = sigma * 2.1;
    const radius = Math.max(1, Math.ceil(rMax));
    const cx = Math.round(vx);
    const cy = Math.round(vy);
    const cz = Math.round(vz);
    const invR2 = 1 / (rMax * rMax);
    for (let iz = Math.max(1, cz - radius); iz <= Math.min(depth - 2, cz + radius); iz++) {
      const dz2 = (iz - vz) ** 2;
      for (let iy = Math.max(1, cy - radius); iy <= Math.min(height - 2, cy + radius); iy++) {
        const dyz2 = dz2 + (iy - vy) ** 2;
        for (let ix = Math.max(1, cx - radius); ix <= Math.min(width - 2, cx + radius); ix++) {
          const u2 = (dyz2 + (ix - vx) ** 2) * invR2;
          if (u2 >= 1) continue;
          const falloff = 1 - u2;
          const weight = density * falloff * falloff;
          const at = ix + iy * width + iz * stride;
          // Soft accumulation preserves smooth gradients across overlapping threads.
          field[at] = 1 - (1 - field[at]!) * (1 - Math.min(0.85, weight));
        }
      }
    }
  }

  /* The sheet's profiles along x: its crest, its lower edge and where it winds across. */
  const ends = (x: number) => 1 - 0.75 * smoothstep(0.68, 0.95, Math.abs(x));
  const crest = (x: number) => (0.5 + 0.42 * valueNoise2(x * 2.4 + 3.1, 0.5)) * ends(x);
  const floor = (x: number) => {
    let pillars = 0;
    for (const foot of FEET) pillars += Math.exp(-(((x - foot) / 0.085) ** 2));
    const legs = smoothstep(0.78, 0.9, Math.abs(x));
    return (0.1 + 0.16 * valueNoise2(x * 2.6 + 7.3, 2.5)) * Math.max(0, 1 - pillars - legs);
  };
  const course = (x: number) => 0.18 * Math.sin(2.3 * x + 0.7) + 0.08 * Math.sin(5.1 * x + 2.9);

  // 1. The hedgerow's threads: near-vertical, each hanging from the crest toward the floor.
  const threads = tight ? 300 : 440;
  for (let thread = 0; thread < threads; thread++) {
    const x0 = -0.94 + random() * 1.88;
    const top = crest(x0) * (0.7 + 0.3 * random());
    const bottom = Math.min(top - 0.06, floor(x0) + random() * 0.07);
    const rooted = bottom <= 0.015;
    const outward = Math.sign(x0) * 0.6 * Math.max(0, Math.abs(x0) - 0.72);
    const lean = (random() - 0.5) * 0.12 + outward;
    const z0 = course(x0) + (random() - 0.5) * 0.14;
    const wobble = random() * Math.PI * 2;
    const sigma = Math.max(0.65, (0.62 + random() * 0.42) * scale);
    const strength = 0.28 + random() * 0.46;
    const knotPhase = random() * Math.PI * 2;
    for (let step = 0; step <= 60; step++) {
      const u = step / 60;
      const y = bottom + (top - bottom) * u;
      const x = x0 + lean * (y - bottom) + 0.015 * Math.sin(u * 9 + wobble);
      const z = z0 + 0.03 * Math.sin(u * 7 + wobble * 1.7);
      if (y <= 0.008 || y >= 0.97) continue;
      // Threads end softly in the corona; a pillar's thread stays dense down to its root.
      const topTaper = Math.min(1, (1 - u) * 3.3) ** 0.8;
      const footTaper = rooted ? 1 : Math.min(1, u * 6) ** 0.7;
      const knot = 0.66 + 0.34 * (0.5 + 0.5 * Math.sin(y * 26 + knotPhase)) ** 2;
      splat(x, y, z, sigma, strength * topTaper * footTaper * knot);
    }
  }

  // 2. Barbs: bundles leaning out of the sheet and down to parasitic polarity, alternating sides.
  const barbs = 7;
  for (let barb = 0; barb < barbs; barb++) {
    const xb = -0.7 + ((barb + 0.5) / barbs) * 1.4 + (random() - 0.5) * 0.08;
    const side = barb % 2 === 0 ? 1 : -1;
    const yb = Math.min(crest(xb) * 0.85, 0.28 + random() * 0.24);
    const zEnd = side * (0.55 + random() * 0.35);
    const xEnd = xb + (random() < 0.5 ? -1 : 1) * (0.14 + random() * 0.18);
    const strands = 8;
    for (let strand = 0; strand < strands; strand++) {
      const dx = (random() - 0.5) * 0.05;
      const dz = (random() - 0.5) * 0.12;
      const phase = random() * Math.PI * 2;
      const sigma = Math.max(0.7, (0.7 + random() * 0.4) * scale);
      const strength = 0.3 + random() * 0.3;
      for (let step = 0; step <= 48; step++) {
        const s = step / 48;
        const x = xb + (xEnd - xb) * s + dx + 0.012 * Math.sin(s * 8 + phase);
        const z = course(xb) + dz * (1 - s) + (zEnd - course(xb)) * s ** 0.9;
        const y = yb * (1 - s ** 1.6);
        if (y <= 0.008 || y >= 0.97) continue;
        splat(x, y, z, sigma, strength * (1 - 0.35 * s));
      }
    }
  }

  const data = new Uint8Array(field.length);
  for (let z = 1; z < depth - 1; z++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = x + y * width + z * stride;
        const val = field[i]!;
        if (val < 0.018) continue;
        // Band-limited fibril modulation without harsh voxel step clipping.
        const coarse = valueNoise3((x / width) * 12, (y / height) * 5, (z / depth) * 8);
        const fine = valueNoise3((x / width) * 36 + 5, (y / height) * 9, (z / depth) * 14);
        const fibril = Math.max(0, Math.min(1, (coarse * 0.55 + fine * 0.45 - 0.12) * 1.5));
        const shaped = val * (0.35 + 0.65 * fibril);
        if (shaped < 0.012) continue;
        data[i] = Math.min(255, Math.round(shaped * 290));
      }
    }
  }
  const result = { data, width, height, depth };
  if (tight) tightCache = result;
  else fullCache = result;
  return result;
}
