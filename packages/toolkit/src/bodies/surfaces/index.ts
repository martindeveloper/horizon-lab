/**
 * Surface maps for the Sun, planets, named bodies and moons, painted from published
 * maps and true-colour imagery as small equirectangular RGBA rasters: u is east
 * longitude / 360 from the prime meridian, v runs from the north pole down.
 * Pure functions, so tests can check them without a canvas.
 *
 * Mean brightness follows each body's geometric albedo (NASA planetary fact
 * sheets), with Venus as the brightest map; colours follow true-colour images.
 */
import type { BodyId } from "../figures";
import { earth } from "./earth";
import { jupiter, neptune, saturn, uranus } from "./giants";
import {
  callisto,
  charon,
  deimos,
  europa,
  ganymede,
  io,
  moon,
  phobos,
  titan,
  triton,
} from "./moons";
import { halley, mars, mercury, pluto, sedna, sun, venus } from "./planets";
import { raster, rasterJob, type Painter } from "./raster";

export { GREAT_RED_SPOT, SATURN_HEXAGON } from "./giants";
export { earthLandFraction } from "./earth";
export {
  coverage,
  detailFor,
  mix,
  raster,
  rasterJob,
  scale,
  type Rgb,
  type SurfaceJob,
} from "./raster";

/**
 * Geometric albedo (V), NASA planetary and satellite fact sheets; Pluto and
 * Charon from New Horizons (Buratti et al. 2017), Sedna from Pál et al. 2012.
 */
export const GEOMETRIC_ALBEDO: Partial<Record<BodyId, number>> = {
  mercury: 0.142,
  venus: 0.689,
  earth: 0.434,
  mars: 0.17,
  jupiter: 0.538,
  saturn: 0.499,
  uranus: 0.488,
  neptune: 0.442,
  pluto: 0.52,
  sedna: 0.32,
  halley: 0.04,
  moon: 0.12,
  phobos: 0.071,
  deimos: 0.068,
  io: 0.63,
  europa: 0.67,
  ganymede: 0.43,
  callisto: 0.22,
  titan: 0.22,
  triton: 0.76,
  charon: 0.41,
};

const PAINTERS: Partial<Record<BodyId, Painter>> = {
  sun,
  mercury,
  venus,
  mars,
  jupiter,
  saturn,
  uranus,
  neptune,
  pluto,
  sedna,
  halley,
  moon,
  phobos,
  deimos,
  io,
  europa,
  ganymede,
  callisto,
  titan,
  triton,
  charon,
};

function painterFor(id: BodyId, w: number, h: number) {
  const painter = id === "earth" ? earth(w, h) : PAINTERS[id];
  if (!painter) throw new Error(`No map for ${id}`);
  return painter;
}

/** RGBA pixels of a body's map at w × h, north pole first. */
export function surfaceMap(id: BodyId, w: number, h: number) {
  return raster(w, h, painterFor(id, w, h));
}

/** A body's map to paint incrementally, rows in GL order. */
export function surfaceJob(id: BodyId, w: number, h: number) {
  return rasterJob(w, h, painterFor(id, w, h), true);
}
