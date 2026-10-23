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
  ariel,
  callisto,
  charon,
  deimos,
  dione,
  enceladus,
  europa,
  ganymede,
  iapetus,
  io,
  mimas,
  miranda,
  moon,
  oberon,
  phobos,
  rhea,
  tethys,
  titan,
  titania,
  triton,
  umbriel,
} from "./moons";
import {
  ceres,
  eris,
  halley,
  haumea,
  makemake,
  mars,
  mercury,
  pluto,
  sedna,
  sun,
  venus,
} from "./planets";
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
 * Charon from New Horizons (Buratti et al. 2017), Sedna from Pál et al. 2012, Ceres from
 * Li et al. 2006, Haumea from Ortiz et al. 2017, Makemake from Ortiz et al. 2012 and Eris
 * from Sicardy et al. 2011.
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
  ceres: 0.09,
  pluto: 0.52,
  haumea: 0.51,
  makemake: 0.77,
  eris: 0.96,
  sedna: 0.32,
  halley: 0.04,
  moon: 0.12,
  phobos: 0.071,
  deimos: 0.068,
  io: 0.63,
  europa: 0.67,
  ganymede: 0.43,
  callisto: 0.22,
  mimas: 0.6,
  enceladus: 1,
  tethys: 0.8,
  dione: 0.7,
  rhea: 0.7,
  titan: 0.22,
  /** NSSDC's 0.05 for Cassini Regio over ~40 % of the surface and 0.5 for the rest. */
  iapetus: 0.32,
  miranda: 0.32,
  ariel: 0.39,
  umbriel: 0.21,
  titania: 0.27,
  oberon: 0.23,
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
  ceres,
  pluto,
  haumea,
  makemake,
  eris,
  sedna,
  halley,
  moon,
  phobos,
  deimos,
  io,
  europa,
  ganymede,
  callisto,
  mimas,
  enceladus,
  tethys,
  dione,
  rhea,
  titan,
  iapetus,
  miranda,
  ariel,
  umbriel,
  titania,
  oberon,
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
