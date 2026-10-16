/**
 * Deterministic CPU value noise for procedural textures and point clouds,
 * output in [0, 1]. Same input, same value on every run; artwork that samples
 * it stays stable. Not the GPU `noiseGLSL` functions: the hashes differ.
 */

/** Integer lattice hash of a 2D cell to [0, 1). */
function hash2(ix: number, iy: number) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 2D value noise: bilinear blend of the four surrounding cell hashes. */
export function valueNoise2(x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** A shuffled lattice (Perlin's permutation trick): table lookups instead of hashing. */
function lattice() {
  const perm = new Uint8Array(512);
  const values = new Float32Array(256);
  let seed = 0x9e3779b9;
  const next = () => {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x297a2d39) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < 256; i += 1) {
    perm[i] = i;
    values[i] = next();
  }
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const t = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = t;
  }
  for (let i = 0; i < 256; i += 1) perm[i + 256] = perm[i]!;
  return { perm, values };
}
const { perm: PERM, values: LATTICE } = /* @__PURE__ */ lattice();

/**
 * Smooth 3D value noise, period 256 on each axis. Sample it on a unit sphere
 * for maps with no seam and no polar pinch.
 */
export function valueNoise3(x: number, y: number, z: number) {
  const fx0 = Math.floor(x);
  const fy0 = Math.floor(y);
  const fz0 = Math.floor(z);
  let fx = x - fx0;
  let fy = y - fy0;
  let fz = z - fz0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const x0 = fx0 & 255;
  const y0 = fy0 & 255;
  const z0 = fz0 & 255;
  const a = PERM[x0]! + y0;
  const b = PERM[x0 + 1]! + y0;
  const aa = PERM[a]! + z0;
  const ab = PERM[a + 1]! + z0;
  const ba = PERM[b]! + z0;
  const bb = PERM[b + 1]! + z0;
  const c000 = LATTICE[PERM[aa]!]!;
  const c100 = LATTICE[PERM[ba]!]!;
  const c010 = LATTICE[PERM[ab]!]!;
  const c110 = LATTICE[PERM[bb]!]!;
  const c001 = LATTICE[PERM[aa + 1]!]!;
  const c101 = LATTICE[PERM[ba + 1]!]!;
  const c011 = LATTICE[PERM[ab + 1]!]!;
  const c111 = LATTICE[PERM[bb + 1]!]!;
  const x00 = c000 + (c100 - c000) * fx;
  const x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx;
  const x11 = c011 + (c111 - c011) * fx;
  const y0v = x00 + (x10 - x00) * fy;
  return y0v + (x01 + (x11 - x01) * fy - y0v) * fz;
}

/**
 * Fractal sum of `valueNoise3`, normalized to [0, 1]: each octave halves the
 * amplitude and roughly doubles the frequency (2.03, offset so lattice
 * points do not line up between octaves).
 */
export function fbm3(x: number, y: number, z: number, octaves: number) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise3(x, y, z) * amp;
    norm += amp;
    amp *= 0.5;
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 4.1;
    z = z * 2.03 + 2.9;
  }
  return sum / norm;
}
