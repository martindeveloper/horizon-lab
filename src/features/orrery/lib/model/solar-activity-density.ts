import { lcg, valueNoise3 } from "@horizon/toolkit/math";

type DensityVolume = {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
};

let fullCache: DensityVolume | null = null;
let tightCache: DensityVolume | null = null;

/**
 * A small, authored 3D density field baked once when enabled. Models a twisted
 * coronal magnetic flux rope: braided field-aligned fibrils with a dipped
 * Kippenhahn–Schlüter crown spine, lateral prominence barbs tethered to
 * parasitic polarity patches, and converging chromospheric footpoint funnels
 * (Parenti 2014, LRSP 11, 1; Gibson 2018, LRSP 15, 7).
 */
export function createSolarActivityDensity(tight: boolean): DensityVolume {
  const cached = tight ? tightCache : fullCache;
  if (cached) return cached;

  const width = tight ? 80 : 128;
  const height = tight ? 64 : 112;
  const depth = tight ? 40 : 64;
  const field = new Float32Array(width * height * depth);
  const random = lcg(74329);
  const stride = width * height;
  const scale = width / 128;

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
          // Soft accumulation preserves smooth gradients across overlapping fibrils.
          field[at] = 1 - (1 - field[at]!) * (1 - Math.min(0.85, weight));
        }
      }
    }
  }

  // 1. Helical flux-rope spine & dipped arcade fibrils (84 strands).
  for (let strand = 0; strand < 84; strand++) {
    const coreStrand = strand < 34;
    const left = -0.6 + (random() - 0.5) * 0.14;
    const right = 0.58 + (random() - 0.5) * 0.14;
    const crown = (coreStrand ? 0.76 : 0.7) + random() * 0.16;
    const dipDepth = coreStrand ? 0.14 + random() * 0.07 : 0.05 + random() * 0.06;
    const shearZ = (random() - 0.5) * 0.26;
    const tubeR = (coreStrand ? 0.048 : 0.11) * (0.45 + random() * 0.75);
    const turns = (coreStrand ? 1.15 : 1.45) * (random() < 0.15 ? -1 : 1) * (0.8 + random() * 0.4);
    const theta0 = random() * Math.PI * 2;
    const phase = random() * Math.PI * 2;
    const start = random() < 0.68 ? 0 : random() * 0.35;
    const end = random() < 0.68 ? 1 : Math.min(1, start + 0.48 + random() * 0.48);
    const sigma = Math.max(
      0.48,
      (coreStrand ? 0.56 + random() * 0.38 : 0.48 + random() * 0.46) * scale,
    );
    const strength = (coreStrand ? 0.38 : 0.25) + random() * 0.38;

    for (let step = 0; step <= 144; step++) {
      const u = step / 144;
      const t = start + (end - start) * u;
      const s = 1 - t;
      const arch = 4 * t * s;
      const pinch = 0.3 + 0.7 * Math.sin(Math.PI * t);
      const helix = theta0 + turns * Math.PI * 2 * t;
      // Cubic magnetic arch with Kippenhahn–Schlüter dip across the upper spine.
      const xAxis =
        s * s * s * left +
        3 * s * s * t * (left * 0.44 - 0.05) +
        3 * s * t * t * (right * 0.44 + 0.04) +
        t * t * t * right;
      const yAxis =
        -0.02 + arch * crown * (1.1 - dipDepth * arch * arch) + 0.022 * Math.sin(t * 9 + phase);
      const zAxis = (t - 0.5) * shearZ * arch;

      const x = xAxis + Math.sin(helix) * tubeR * 0.52 * pinch;
      const y = yAxis + Math.cos(helix) * tubeR * 0.72 * pinch;
      const z = zAxis + Math.sin(helix) * tubeR * 1.3 * pinch;
      if (y <= 0.008 || y >= 0.96) continue;

      // Only taper ends that terminate in mid-corona; footpoints rooted in the Sun stay dense.
      const leftTaper = start > 0 ? Math.min(1, u * 4.5) ** 0.6 : 1;
      const rightTaper = end < 1 ? Math.min(1, (1 - u) * 4.5) ** 0.6 : 1;
      const knot = 0.54 + 0.46 * (0.5 + 0.5 * Math.sin(t * 15 + phase)) ** 2;
      const footBoost = 1 + 0.5 * Math.max(0, 1 - t * 6) + 0.5 * Math.max(0, 1 - s * 6);
      splat(x, y, z, sigma, strength * leftTaper * rightTaper * knot * footBoost);
    }
  }

  // 2. Lateral prominence barbs / pillars tethering the spine to the chromosphere (26 strands).
  for (let barb = 0; barb < 26; barb++) {
    const t0 = 0.2 + (barb / 26) * 0.6 + (random() - 0.5) * 0.04;
    const s0 = 1 - t0;
    const arch0 = 4 * t0 * s0;
    const xSpine = (t0 - 0.5) * 1.1;
    const ySpine = 0.38 + arch0 * (0.3 + random() * 0.14);
    const zSide = (barb % 2 === 0 ? 1 : -1) * (0.15 + random() * 0.32);
    const xFoot = xSpine + (t0 < 0.5 ? -0.09 : 0.09) + (random() - 0.5) * 0.06;
    const phase = random() * Math.PI * 2;
    const sigma = Math.max(0.48, (0.5 + random() * 0.36) * scale);
    const strength = 0.28 + random() * 0.34;
    for (let step = 0; step <= 64; step++) {
      const u = step / 64;
      // Curve smoothly from the spine (u=0) steeply down into the parasitic polarity patch (u=1).
      const x = xSpine + (xFoot - xSpine) * (u * u) + Math.sin(u * 8 + phase) * 0.018 * (1 - u);
      const y = ySpine * (1 - u ** 1.35);
      const z = zSide * (0.22 + 0.78 * u ** 0.85) + Math.cos(u * 7 + phase) * 0.02 * (1 - u);
      if (y <= 0.008 || y >= 0.96) continue;
      const spineJoin = Math.min(1, u * 4) ** 0.5;
      const rain = 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(u * 11 + phase)) ** 2;
      splat(x, y, z, sigma, strength * spineJoin * rain);
    }
  }

  const data = new Uint8Array(field.length);
  for (let z = 1; z < depth - 1; z++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = x + y * width + z * stride;
        const val = field[i]!;
        if (val < 0.018) continue;
        // Band-limited filamentary modulation without harsh voxel step clipping.
        const coarse = valueNoise3((x / width) * 10, (y / height) * 12, (z / depth) * 8);
        const fine = valueNoise3((x / width) * 22 + 5, (y / height) * 24, (z / depth) * 14);
        const fibril = Math.max(0, Math.min(1, (coarse * 0.65 + fine * 0.35 - 0.18) * 1.65));
        const shaped = val * fibril;
        if (shaped < 0.012) continue;
        data[i] = Math.min(255, Math.round(shaped * 270));
      }
    }
  }
  const result = { data, width, height, depth };
  if (tight) tightCache = result;
  else fullCache = result;
  return result;
}
