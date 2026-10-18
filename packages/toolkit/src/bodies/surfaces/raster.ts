/**
 * Raster infrastructure for the painted maps: the surface point, noise and
 * colour helpers, row-by-row rasterising and polygon coverage.
 */
import { fbm3, smoothstep as smooth, wrapSigned } from "../../math/index";
import { RAD_PER_DEG } from "../../science/constants";

export type Rgb = readonly [number, number, number];
export type Painter = (p: Point) => Rgb;

/** Radians per degree, for painters; the science kit's constant. */
export const RAD = RAD_PER_DEG;

/**
 * The surface point being painted; one object reused for every texel.
 * `detail` adds noise octaves on large maps, so a close-up gains real fine
 * structure instead of magnified blur.
 */
export type Point = {
  lon: number;
  lat: number;
  x: number;
  y: number;
  z: number;
  cosLat: number;
  detail: number;
};

/**
 * Fractal noise at a surface point, 0..1. `along` is the frequency around the
 * equator and `across` the frequency pole to pole; across > along streaks it
 * east–west like the giants' zonal winds.
 */
export function fbm(p: Point, along: number, across = along, octaves = 4, seed = 0) {
  return fbmAt(p.x, p.y, p.z, along, across, octaves + p.detail, seed);
}
export function fbmAt(
  px: number,
  py: number,
  pz: number,
  along: number,
  across: number,
  octaves: number,
  seed: number,
) {
  return fbm3(px * along + seed * 7.1, py * across + seed * 3.3, pz * along, octaves);
}

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const scale = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];
/** Shortest signed longitude difference, degrees. */
export const dLon = (a: number, b: number) => wrapSigned(a - b, 360);
/** Elliptical distance from a feature centre in degrees, 1 at its edge. */
export function spot(p: Point, cLon: number, cLat: number, rLon: number, rLat: number) {
  const dy = (p.lat - cLat) / rLat;
  /* Far outside in latitude: every caller has faded out by three radii. */
  if (dy > 3 || dy < -3) return 3;
  const dx = (dLon(p.lon, cLon) * p.cosLat) / (rLon * Math.cos(cLat * RAD));
  return Math.sqrt(dx * dx + dy * dy);
}

/** Latitude bands: [north edge, colour] from the north pole down; each holds to the next edge. */
export type Band = readonly [number, Rgb];
export function banded(bands: readonly Band[], lat: number, soft: number): Rgb {
  let rgb = bands[0]![1];
  for (let i = 1; i < bands.length; i += 1) {
    const [edge, colour] = bands[i]!;
    /* Edges run north to south, so once above an edge's blend, the rest are south of us. */
    if (lat > edge + soft) break;
    rgb = lat < edge - soft ? colour : mix(rgb, colour, smooth(edge + soft, edge - soft, lat));
  }
  return rgb;
}

/** Extra noise octaves for a map width: none up to 511 px, one per doubling beyond. */
export const detailFor = (w: number) => Math.max(0, Math.floor(Math.log2(w / 256)));

/**
 * A map painted a few rows at a time, so a large close-up map can fill in
 * across frames without stalling one. `southFirst` writes rows in GL order
 * (v = 0 at the south pole), ready for a DataTexture.
 */
export type SurfaceJob = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Paints up to `rows` more rows; true once the map is complete. */
  step: (rows: number) => boolean;
};

export function rasterJob(w: number, h: number, paint: Painter, southFirst = false): SurfaceJob {
  const data = new Uint8ClampedArray(w * h * 4);
  const cosLon = new Float64Array(w);
  const sinLon = new Float64Array(w);
  for (let x = 0; x < w; x += 1) {
    cosLon[x] = Math.cos(((x + 0.5) / w) * 2 * Math.PI);
    sinLon[x] = Math.sin(((x + 0.5) / w) * 2 * Math.PI);
  }
  const p: Point = { lon: 0, lat: 0, x: 0, y: 0, z: 0, cosLat: 1, detail: detailFor(w) };
  let y = 0;
  return {
    width: w,
    height: h,
    data,
    step(rows) {
      const end = Math.min(h, y + rows);
      for (; y < end; y += 1) {
        p.lat = 90 - ((y + 0.5) / h) * 180;
        p.cosLat = Math.cos(p.lat * RAD);
        p.y = Math.sin(p.lat * RAD);
        const row = (southFirst ? h - 1 - y : y) * w;
        for (let x = 0; x < w; x += 1) {
          p.lon = ((x + 0.5) / w) * 360;
          p.x = p.cosLat * cosLon[x]!;
          p.z = p.cosLat * sinLon[x]!;
          const rgb = paint(p);
          const i = (row + x) * 4;
          data[i] = rgb[0];
          data[i + 1] = rgb[1];
          data[i + 2] = rgb[2];
          data[i + 3] = 255;
        }
      }
      return y >= h;
    },
  };
}

export function raster(w: number, h: number, paint: Painter) {
  const job = rasterJob(w, h, paint);
  job.step(h);
  return job.data;
}

export type Polygon = readonly (readonly [lon: number, lat: number])[];

/**
 * Coverage (0..1) of polygons on a w × h equirectangular grid, by scanlines
 * with horizontal anti-aliasing and two sub-rows. Longitudes may run past
 * ±180; they wrap.
 */
export function coverage(polygons: readonly Polygon[], w: number, h: number) {
  const out = new Float32Array(w * h);
  const rows = 2;
  const xs: number[] = [];
  for (let y = 0; y < h; y += 1) {
    for (let sub = 0; sub < rows; sub += 1) {
      const lat = 90 - ((y + (sub + 0.5) / rows) / h) * 180;
      for (const poly of polygons) {
        xs.length = 0;
        for (let i = 0; i < poly.length; i += 1) {
          const [x0, y0] = poly[i]!;
          const [x1, y1] = poly[(i + 1) % poly.length]!;
          if (y0 > lat === y1 > lat) continue;
          xs.push(x0 + ((lat - y0) / (y1 - y0)) * (x1 - x0));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const a = (xs[k]! / 360) * w;
          const b = (xs[k + 1]! / 360) * w;
          for (let px = Math.floor(a); px < Math.ceil(b); px += 1) {
            const covered = Math.min(b, px + 1) - Math.max(a, px);
            if (covered <= 0) continue;
            const col = ((px % w) + w) % w;
            const cell = y * w + col;
            out[cell] = (out[cell] ?? 0) + covered / rows;
          }
        }
      }
    }
  }
  for (let i = 0; i < out.length; i += 1) out[i] = Math.min(1, out[i]!);
  return out;
}

/** Bilinear lookup into a coarse w × h coverage grid by longitude and latitude, degrees. */
export function soft(grid: Float32Array, w: number, h: number) {
  return (lon: number, lat: number) => {
    const fx = ((((lon / 360) * w - 0.5) % w) + w) % w;
    const fy = Math.min(h - 1, Math.max(0, ((90 - lat) / 180) * h - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = (x0 + 1) % w;
    const y1 = Math.min(h - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const top = grid[y0 * w + x0]! + (grid[y0 * w + x1]! - grid[y0 * w + x0]!) * tx;
    const bottom = grid[y1 * w + x0]! + (grid[y1 * w + x1]! - grid[y1 * w + x0]!) * tx;
    return top + (bottom - top) * ty;
  };
}

/** Polygons written as "lon,lat lon,lat …" strings, so the coastline data stays compact. */
export function polygons(rings: readonly string[]): Polygon[] {
  return rings.map((ring) =>
    ring.split(" ").map((pair) => {
      const [lon, lat] = pair.split(",").map(Number);
      return [lon!, lat!] as const;
    }),
  );
}

/** Ridged noise: 1 on a thin crest, falling to 0 across a band `width` wide. */
export const ridge = (v: number, width: number) => smooth(width, 0, Math.abs(v - 0.5));
