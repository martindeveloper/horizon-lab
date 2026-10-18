import { lcg, valueNoise3 } from "@horizon/toolkit/math";

/**
 * A small, authored density field, baked once when enabled. Unequal, broken plasma
 * threads share an arch and branch into barbs; they are not drawn field lines.
 * No image assets, per-frame texture uploads or full-screen volume are involved.
 */
export function createSolarActivityDensity(tight: boolean) {
  const width = tight ? 80 : 128;
  const height = tight ? 64 : 112;
  const depth = tight ? 40 : 64;
  const field = new Float32Array(width * height * depth);
  const random = lcg(74329);
  const stride = width * height;
  const threads = 100;
  for (let thread = 0; thread < threads; thread++) {
    const barb = random() < 0.12;
    const left = -0.65 + random() * 0.2;
    const right = 0.4 + random() * 0.25;
    const crown = 0.72 + random() * 0.18;
    const z0 = (random() - 0.5) * 0.7;
    const z1 = (random() - 0.5) * 0.7;
    const bend = (random() - 0.5) * 0.3;
    const phase = random() * Math.PI * 2;
    const start = random() < 0.18 ? 0 : random() * 0.6;
    const end = Math.min(1, start + 0.22 + random() * 0.66);
    // Preserve physical thread width at the lower resolution instead of inflating its opacity.
    const sigma = Math.max(0.4, ((0.55 + random() * 0.65) * width) / 128);
    const radius = Math.max(1, Math.ceil(sigma * 2.4));
    const strength = 0.2 + random() * 0.65;
    for (let step = 0; step <= 140; step++) {
      const t = start + ((end - start) * step) / 140;
      const s = 1 - t;
      // Unequal cubic legs with small correlated kinks, not concentric semicircles.
      const x =
        s * s * s * left +
        3 * s * s * t * (left - 0.18 + bend) +
        3 * s * t * t * (right + 0.06) +
        t * t * t * right +
        Math.sin(Math.PI * t) *
          (0.07 * Math.sin(t * 8) +
            0.035 * Math.sin(t * 23 + 0.7) +
            0.03 * Math.sin(t * 17 + phase) +
            0.012 * Math.sin(t * 41 + phase));
      const y = barb
        ? -0.12 + t * crown + Math.sin(t * 6 + phase) * 0.035
        : -0.12 +
          3 * s * s * t * crown * 1.55 +
          3 * s * t * t * crown * 1.1 +
          Math.sin(Math.PI * t) *
            (0.09 * Math.sin(t * 11 + 0.6) +
              0.045 * Math.sin(t * 29) +
              0.035 * Math.sin(t * 19 + phase) +
              0.12 * (valueNoise3(t * 11, phase, 3) - 0.5));
      const z = z0 * s + z1 * t + Math.sin(t * 8 + phase) * Math.sin(Math.PI * t) * 0.12;
      const vx = (x * 0.5 + 0.5) * (width - 1);
      const vy = y * (height - 1);
      const vz = (z * 0.5 + 0.5) * (depth - 1);
      const density = strength * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 19 + phase)) ** 2);
      const cx = Math.round(vx),
        cy = Math.round(vy),
        cz = Math.round(vz);
      for (let iz = Math.max(1, cz - radius); iz <= Math.min(depth - 2, cz + radius); iz++) {
        for (let iy = Math.max(1, cy - radius); iy <= Math.min(height - 2, cy + radius); iy++) {
          for (let ix = Math.max(1, cx - radius); ix <= Math.min(width - 2, cx + radius); ix++) {
            const distance = ((ix - vx) ** 2 + (iy - vy) ** 2 + (iz - vz) ** 2) / (sigma * sigma);
            if (distance > 6) continue;
            const at = ix + iy * width + iz * stride;
            field[at] = Math.max(field[at]!, density * Math.exp(-distance * 0.5));
          }
        }
      }
    }
  }
  const data = new Uint8Array(field.length);
  for (let z = 1; z < depth - 1; z++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = x + y * width + z * stride;
        if (field[i]! < 0.004) continue;
        const coarse = valueNoise3((x / width) * 16, (y / height) * 18, (z / depth) * 12);
        const fine = valueNoise3((x / width) * 42 + 7, (y / height) * 45, (z / depth) * 27);
        const gaps = Math.max(0, Math.min(1, (coarse * 0.7 + fine * 0.3 - 0.3) * 3.6));
        data[i] = Math.min(255, Math.round(field[i]! * gaps * 380));
      }
    }
  }
  return { data, width, height, depth };
}
