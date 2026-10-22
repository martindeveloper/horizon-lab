/**
 * The Milky Way's painted maps and the grains sampled from them, as plain arrays: no three.js
 * and no DOM, so `band.worker.ts` paints them off the main thread (`createMilkyWay` draws
 * them) and Node tests can call them. Deterministic: the same request paints the same sky.
 */
import { lcg, valueNoise2 } from "@horizon/toolkit/math";

/** The maps' size in texels: galactic longitude across, latitude down. */
export const BAND_WIDTH = 512;
export const BAND_HEIGHT = 256;

/** The eras drawn: today's disk alone, or both for a host that blends toward the early one. */
export type SkyEras = "today" | "both";

type Vec3 = readonly [number, number, number];

/** The galactic frame's axes in the host's frame (`GALACTIC_CENTRE`, `_EAST`, `_POLE`). */
export type GalacticAxes = { centre: Vec3; east: Vec3; pole: Vec3 };

/** One era's map: RGBA texels, and the density the grains are drawn by, with its peak. */
export type BandMap = { rgba: Uint8ClampedArray<ArrayBuffer>; density: Float32Array; peak: number };

/** Points on the unit sphere: positions, colours and sizes in pixels. */
export type Grains = { position: Float32Array; color: Float32Array; size: Float32Array };

export type SkyRequest = {
  eras: SkyEras;
  grains: number;
  axes: GalacticAxes;
  /** The maps of `eras` from an earlier sky, kept by the caller: only the grains are sampled. */
  maps?: readonly BandMap[];
};

/**
 * A painted sky: each era's map (today's, then the early one's) and the clouds sampled from
 * them, today's grains and haze first, then the early disk's.
 */
export type PaintedSky = { maps: BandMap[]; clouds: Grains[] };

/** Periodic in longitude so the map has no seam. */
function fbm(l: number, b: number, scale: number) {
  const a = l * Math.PI * 2;
  const x = Math.cos(a) * scale + 7.3;
  const y = Math.sin(a) * scale + 3.1;
  const z = b * scale * 2;
  return (
    valueNoise2(x + z, y) * 0.5 +
    valueNoise2(x * 2.1 + z * 2, y * 2.1 + 5) * 0.3 +
    valueNoise2(x * 4.3, y * 4.3 + z * 4) * 0.2
  );
}

/**
 * Brightness of the band at galactic longitude u∈[0,1) (0 = centre) and latitude
 * v∈[0,1] (0.5 = plane). Today: a thin disk with the bulge toward the centre,
 * the Great Rift and the Coalsack as dust. Early: a thicker, smoother, bluer
 * disk without the dust lane, as the thick-disk era would have looked.
 */
function bandMap(mode: "today" | "early"): BandMap {
  const W = BAND_WIDTH;
  const H = BAND_HEIGHT;
  const data = new Uint8ClampedArray(W * H * 4);
  const density = new Float32Array(W * H);
  for (let y = 0; y < H; y += 1) {
    const b = (y / H - 0.5) * 180;
    for (let x = 0; x < W; x += 1) {
      const u = x / W;
      const lDeg = u * 360;
      const toCentre = Math.min(lDeg, 360 - lDeg);
      const clumps = fbm(u, y / H, mode === "today" ? 14 : 4);
      let value: number;
      let r: number;
      let gg: number;
      let bb: number;
      if (mode === "today") {
        const sigma = 5.5 + 7 * Math.exp(-toCentre / 60);
        const disk =
          Math.exp(-(b * b) / (2 * sigma * sigma)) * (0.55 + 0.45 * Math.exp(-toCentre / 110));
        const bulge =
          Math.exp(-((toCentre / 14) ** 2 + ((b + 1) / 9) ** 2)) * 0.9 +
          Math.exp(-((toCentre / 30) ** 2 + (b / 18) ** 2)) * 0.35;
        const riftL = lDeg < 90 || lDeg > 300;
        const riftCentre = lDeg < 90 ? 1.2 + lDeg * 0.02 : -1.5;
        const rift = riftL
          ? Math.exp(-(((b - riftCentre) / 2.2) ** 2)) *
            (0.55 + 0.45 * fbm(u + 0.3, y / H, 14)) *
            0.8
          : 0;
        const coalsack = Math.exp(-(((lDeg - 303) / 3.5) ** 2) - ((b + 1.2) / 3) ** 2) * 0.9;
        value = (disk + bulge) * (0.3 + 1.0 * clumps) * (1 - 0.8 * Math.min(1, rift + coalsack));
        const warm = Math.min(1, bulge * 1.4);
        r = 0.86 + 0.1 * warm;
        gg = 0.86;
        bb = 0.92 - 0.16 * warm;
      } else {
        const sigma = 16 + 10 * Math.exp(-toCentre / 60);
        const disk =
          Math.exp(-(b * b) / (2 * sigma * sigma)) * (0.5 + 0.5 * Math.exp(-toCentre / 120));
        const bulge = Math.exp(-((toCentre / 24) ** 2 + (b / 16) ** 2)) * 0.55;
        value = (disk + bulge) * (0.72 + 0.5 * clumps) * 1.05;
        r = 0.7 + 0.2 * bulge;
        gg = 0.78;
        bb = 0.95 - 0.15 * bulge;
      }
      const i = (y * W + x) * 4;
      const a = Math.min(1, value);
      density[y * W + x] = a * Math.cos((b * Math.PI) / 180);
      data[i] = Math.round(r * 255);
      data[i + 1] = Math.round(gg * 255);
      data[i + 2] = Math.round(bb * 255);
      data[i + 3] = Math.round(a * 255);
    }
  }
  let peak = 0;
  for (const d of density) if (d > peak) peak = d;
  return { rgba: data, density, peak };
}

/**
 * Stars drawn from the map by rejection sampling, so the unresolved glow and
 * the resolved grains follow the same bulge, rift and dust. Positions are in
 * today's galactic frame; the group they sit in turns with the epoch.
 */
function sampleGrains(
  { rgba: data, density, peak }: BandMap,
  { centre, east, pole }: GalacticAxes,
  count: number,
  seed: number,
  sizeScale = 1,
  brightness = 1,
): Grains {
  const W = BAND_WIDTH;
  const H = BAND_HEIGHT;
  const rnd = lcg(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  let n = 0;
  while (n < count) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * H);
    const d = density[y * W + x]!;
    if (rnd() * peak > d) continue;
    const l = ((x + rnd()) / W) * Math.PI * 2;
    const b = ((y + rnd()) / H - 0.5) * Math.PI;
    /* The direction from the centre, east and pole components, summed in that order. */
    const toCentre = Math.cos(l) * Math.cos(b);
    const toEast = Math.sin(l) * Math.cos(b);
    const toPole = Math.sin(b);
    for (let k = 0; k < 3; k += 1)
      pos[n * 3 + k] = centre[k]! * toCentre + east[k]! * toEast + pole[k]! * toPole;
    const i = (y * W + x) * 4;
    const bright = (0.5 + rnd() * rnd() * 1.2) * brightness;
    col[n * 3] = (data[i]! / 255) * bright;
    col[n * 3 + 1] = (data[i + 1]! / 255) * bright;
    col[n * 3 + 2] = (data[i + 2]! / 255) * bright;
    size[n] = (1.0 + rnd() * rnd() * 1.5) * sizeScale;
    n += 1;
  }
  return { position: pos, color: col, size };
}

/** The maps of `eras`: today's, then the early disk's. */
export function bandMaps(eras: SkyEras): BandMap[] {
  return eras === "today" ? [bandMap("today")] : [bandMap("today"), bandMap("early")];
}

/**
 * Paints the sky a request asks for: the maps of its eras (painted, or as the request keeps
 * them), and from each map its resolved grains plus a clumpy unresolved haze of large soft
 * points, `grains` of today's.
 */
export function paintSky({ eras, grains: n, axes, maps: kept }: SkyRequest): PaintedSky {
  const maps = kept ? [...kept] : bandMaps(eras);
  const today = maps[0]!;
  const clouds = [
    sampleGrains(today, axes, n, 17),
    sampleGrains(today, axes, Math.round(n * 0.35), 31, 7, 0.3),
  ];
  if (eras === "today") return { maps, clouds };
  const early = maps[1]!;
  clouds.push(
    sampleGrains(early, axes, Math.round(n * 0.6), 23),
    sampleGrains(early, axes, Math.round(n * 0.24), 37, 9, 0.26),
  );
  return { maps, clouds };
}
