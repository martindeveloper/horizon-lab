/** The major moons, from spacecraft maps. */
import { smoothstep as smooth } from "../../math/index";
import { RAD, fbm, mix, ridge, scale, spot, type Painter, type Point } from "./raster";

/* Moon maps put longitude 0 at the sub-planet point; west longitudes from the
   literature are written as east, 360 − W. The trailing hemisphere is centred on 90° E,
   the leading one on 270° E. */

/** Lunar maria: [east lon, lat, half-width, half-height, depth] (USGS lunar nomenclature). */
const MARIA = [
  [344.4, 32.8, 17, 14, 1], // Imbrium
  [17.5, 28, 10, 9, 1], // Serenitatis
  [31.4, 8.5, 13, 10, 1], // Tranquillitatis
  [59.1, 17, 8, 6, 1], // Crisium
  [51.3, -7.8, 8, 11, 0.9], // Fecunditatis
  [35.5, -15.2, 5, 5, 0.85], // Nectaris
  [302.6, 18, 20, 28, 0.95], // Oceanus Procellarum
  [343.4, -21.3, 10, 8, 0.85], // Nubium
  [321.4, -24.4, 6, 6, 0.9], // Humorum
  [337, -10, 7, 6, 0.7], // Cognitum
  [1.4, 56, 40, 4.5, 0.8], // Frigoris
  [86.5, 13.3, 4, 4, 0.6], // Marginis
  [87, -1.7, 5, 5, 0.6], // Smythii
  [147.9, 27.3, 4, 4, 0.8], // Moscoviense, the far side's one
] as const;
/** The Moon: grey highlands, basaltic maria on the near side, Tycho's bright halo. */
export const moon: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 19);
  let mare = 0;
  for (let i = 0; i < MARIA.length; i += 1) {
    const m = MARIA[i]!;
    const d = spot(p, m[0], m[1], m[2], m[3]);
    if (d < 2) mare = Math.max(mare, smooth(1.15, 0.75, d + (n - 0.5) * 0.8) * m[4]);
  }
  let v = 0.88 + (n - 0.5) * 0.3 - smooth(0.6, 0.72, fbm(p, 14, 14, 3, 20)) * 0.12;
  /* South Pole–Aitken basin, faintly darker (53° S, 191° E). */
  v -= smooth(1.2, 0.6, spot(p, 191, -53, 30, 22)) * 0.1;
  /* Tycho (348.8° E, 43.3° S), Copernicus and Aristarchus. */
  v += smooth(3, 0.3, spot(p, 348.8, -43.3, 3, 3)) * 0.3;
  v += smooth(2, 0.3, spot(p, 339.9, 9.6, 2, 2)) * 0.2;
  v += smooth(1.4, 0.3, spot(p, 312.5, 23.7, 1.5, 1.5)) * 0.35;
  return mix(scale([124, 119, 111], v), scale([68, 66, 64], 0.95 + (n - 0.5) * 0.3), mare * 0.9);
};

/** Io: sulfur yellows and whites (Galileo SSI), redder poles, dark volcanic centres. */
export const io: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 6, 6, 4, 21);
  const patch = fbm(p, 4, 4, 3, 22);
  let rgb = mix([240, 228, 160], [232, 236, 222], smooth(0.55, 0.7, patch));
  rgb = mix(rgb, [222, 170, 100], smooth(0.5, 0.35, patch) * 0.6);
  rgb = mix(rgb, [178, 136, 102], smooth(40, 70, Math.abs(lat) + (n - 0.5) * 20) * 0.6);
  /* Pele's red plume deposit, a ~1,200 km ring (18.7° S, 255.3° W). */
  const pele = spot(p, 104.7, -18.7, 19, 19);
  rgb = mix(rgb, [196, 92, 56], smooth(0.35, 0, Math.abs(pele - 0.85)) * 0.7);
  /* Dark paterae: Loki, Pele's vent, Prometheus, and scattered smaller ones. */
  const dark = Math.max(
    smooth(1, 0.4, spot(p, 51, 13, 5, 3.5)),
    smooth(1, 0.3, spot(p, 104.7, -18.7, 2, 2)),
    smooth(1, 0.3, spot(p, 207, -1.5, 2, 2)),
    smooth(0.8, 0.86, fbm(p, 16, 16, 2, 23)),
  );
  return mix(scale(rgb, 1 + (n - 0.5) * 0.1), [58, 48, 40], dark * 0.85);
};

/** Europa: bright water ice crossed by ruddy lineae; the trailing hemisphere is darker. */
export const europa: Painter = (p) => {
  const n = fbm(p, 5, 5, 4, 24);
  const lines = Math.max(
    ridge(fbm(p, 7, 7, 3, 25), 0.02),
    ridge(fbm(p, 11, 11, 2, 26), 0.015) * 0.7,
  );
  /* Sulfur from Io's torus darkens the trailing side, centred on 90° E (270° W). */
  const trailing = Math.max(0, p.cosLat * Math.sin((p.lon * Math.PI) / 180));
  let rgb = scale([240, 234, 222], 0.98 + (n - 0.5) * 0.12);
  rgb = mix(rgb, [196, 172, 140], trailing * 0.55);
  rgb = mix(rgb, [176, 132, 100], lines * 0.75);
  return mix(rgb, [160, 120, 92], smooth(0.62, 0.72, fbm(p, 9, 9, 3, 27)) * trailing * 0.6);
};

/** Ganymede's dark regiones: [east lon, lat, half-width, half-height]. */
const REGIONES = [
  [215, 35, 30, 22], // Galileo
  [185, -10, 24, 26], // Marius
  [330, 38, 16, 12], // Perrine
  [0, -22, 16, 12], // Nicholson
  [35, 20, 12, 12], // Barnard
] as const;
/** Ganymede: old dark terrain, bright grooved terrain, frosty polar caps (Galileo SSI). */
export const ganymede: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 28);
  let dark = 0;
  for (let i = 0; i < REGIONES.length; i += 1) {
    const r = REGIONES[i]!;
    dark = Math.max(dark, smooth(1.15, 0.7, spot(p, r[0], r[1], r[2], r[3]) + (n - 0.5) * 1.2));
  }
  dark = Math.max(dark, smooth(0.6, 0.68, fbm(p, 8, 8, 3, 29)) * 0.7);
  let rgb = scale([206, 198, 186], 0.94 + (n - 0.5) * 0.2);
  rgb = mix(rgb, [112, 100, 86], dark * 0.85);
  return mix(rgb, [226, 228, 230], smooth(42, 60, Math.abs(p.lat) + (n - 0.5) * 16) * 0.7);
};

/**
 * Phobos (Viking, Mars Express HRSC, MRO HiRISE): dark reddish regolith, the 9 km Stickney
 * crater (1° S, 49° W) ringed by bluer, brighter ejecta, and the parallel grooves that cross
 * most of the moon but spare the trailing side around 90° E.
 */
export const phobos: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 38);
  let rgb = scale([92, 82, 73], 0.94 + (n - 0.5) * 0.3);
  const stickney = spot(p, 311, -1, 23, 23);
  rgb = mix(rgb, [105, 101, 98], smooth(1.8, 0.9, stickney) * 0.7);
  rgb = mix(rgb, [62, 57, 53], smooth(1, 0.75, stickney) * 0.8);
  const trailing = Math.max(0, p.cosLat * Math.cos((p.lon - 90) * RAD));
  const grooves = ridge(fbm(p, 1.5, 18, 2, 39), 0.03) * (1 - smooth(0.4, 0.8, trailing));
  rgb = mix(rgb, [59, 53, 50], grooves * 0.6);
  return mix(rgb, [117, 110, 103], smooth(0.66, 0.74, fbm(p, 16, 16, 2, 40)) * 0.5);
};

/**
 * Deimos (Viking, HiRISE): smoother than Phobos, its craters filled with regolith, the rims of
 * Voltaire (22° N, 3.5° W) and Swift (12.5° N, 1.5° W) and downslope streaks a little brighter.
 */
export const deimos: Painter = (p) => {
  const n = fbm(p, 4, 4, 4, 41);
  let rgb = scale([89, 79, 69], 0.96 + (n - 0.5) * 0.2);
  for (const [lon, lat, r] of [
    [356.5, 22, 9],
    [358.5, 12.5, 5],
  ] as const) {
    const d = spot(p, lon, lat, r, r);
    rgb = mix(rgb, [108, 102, 93], smooth(0.35, 0, Math.abs(d - 1)) * 0.6);
  }
  const streaks = smooth(0.62, 0.7, fbm(p, 3, 14, 2, 42));
  return mix(rgb, [105, 97, 87], streaks * 0.4);
};

/** A unit vector in the painters' frame (Point's x, y, z). */
function unit(lon: number, lat: number) {
  const c = Math.cos(lat * RAD);
  return [c * Math.cos(lon * RAD), Math.sin(lat * RAD), c * Math.sin(lon * RAD)] as const;
}

/**
 * A canyon along the great circle through (lon, lat) heading `azimuth` degrees east of
 * north, `reach` degrees each way: 1 on its line, fading to 0 by `width` degrees off it.
 */
function chasma(lon: number, lat: number, azimuth: number, reach: number, width: number) {
  const [cx, cy, cz] = unit(lon, lat);
  const sinLat = Math.sin(lat * RAD);
  const north = [-sinLat * Math.cos(lon * RAD), Math.cos(lat * RAD), -sinLat * Math.sin(lon * RAD)];
  const east = [-Math.sin(lon * RAD), 0, Math.cos(lon * RAD)];
  const ca = Math.cos(azimuth * RAD);
  const sa = Math.sin(azimuth * RAD);
  const tx = ca * north[0]! + sa * east[0]!;
  const ty = ca * north[1]! + sa * east[1]!;
  const tz = ca * north[2]! + sa * east[2]!;
  /* The circle's pole, c × t. */
  const nx = cy * tz - cz * ty;
  const ny = cz * tx - cx * tz;
  const nz = cx * ty - cy * tx;
  return (p: Point) => {
    const off = Math.abs(Math.asin(p.x * nx + p.y * ny + p.z * nz)) / RAD;
    if (off > width) return 0;
    const along = Math.atan2(p.x * tx + p.y * ty + p.z * tz, p.x * cx + p.y * cy + p.z * cz);
    return smooth(width, 0, off) * smooth(reach, reach - 8, Math.abs(along / RAD));
  };
}

/** How much of a moon's trailing hemisphere a point is on, 0..1 (its apex at 90° E). */
const trailing = (p: Point) => Math.max(0, p.cosLat * Math.cos((p.lon - 90) * RAD));

/**
 * Mimas (Voyager, Cassini ISS): grey ice saturated with craters, and Herschel, 139 km across
 * (1.4° S, 111.8° W) with its central peak, near the leading hemisphere's centre.
 */
export const mimas: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 43);
  let rgb = scale([226, 224, 220], 0.97 + (n - 0.5) * 0.16);
  rgb = mix(rgb, [174, 172, 168], smooth(0.6, 0.7, fbm(p, 14, 14, 2, 44)) * 0.55);
  const herschel = spot(p, 248.2, -1.4, 20, 20);
  rgb = mix(rgb, [180, 178, 174], smooth(1.05, 0.8, herschel) * 0.4);
  rgb = mix(rgb, [238, 237, 234], smooth(0.18, 0, Math.abs(herschel - 1)) * 0.7);
  return mix(rgb, [230, 229, 226], smooth(0.22, 0.06, herschel));
};

/** Enceladus's tiger stripes: four sulci ~35 km apart, ~130 km long, about the south pole. */
const STRIPES = [-12, -4, 4, 12] as const;
/**
 * Enceladus (Cassini ISS; Porco et al. 2006): fresh, nearly white ice, older cratered plains
 * a shade greyer, and the bluer south polar terrain inside ~55° S, crossed by the four
 * parallel tiger stripes (Alexandria, Cairo, Baghdad and Damascus Sulci) that vent its plumes.
 */
export const enceladus: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 45);
  let rgb = scale([250, 251, 252], 0.99 + (n - 0.5) * 0.03);
  const plains = smooth(0.62, 0.72, fbm(p, 10, 10, 2, 46)) * smooth(-40, -10, p.lat);
  rgb = mix(rgb, [232, 232, 230], plains * 0.6);
  const colat = 90 + p.lat;
  rgb = mix(rgb, [238, 246, 252], smooth(38, 32, colat + (n - 0.5) * 6));
  if (colat > 24) return rgb;
  /* The stripes in a polar plane, degrees from the pole, turned 45° to the Saturn meridian. */
  const x = colat * Math.cos((p.lon - 45) * RAD);
  const y = colat * Math.sin((p.lon - 45) * RAD) + (fbm(p, 8, 8, 2, 47) - 0.5) * 2;
  let stripe = 0;
  for (const at of STRIPES) stripe = Math.max(stripe, smooth(1.4, 0, Math.abs(y - at)));
  return mix(rgb, [188, 200, 206], stripe * smooth(17, 13, Math.abs(x)) * 0.8);
};

const ITHACA = chasma(332, 0, 15, 135, 5.4);
/**
 * Tethys (Voyager, Cassini ISS; Schenk et al. 2011): bright ice; Odysseus, 445 km across
 * (32.8° N, 128.9° W), a flattened basin on the leading side; Ithaca Chasma, a 100 km-wide
 * graben three-quarters of the way round a near-polar circle whose pole lies ~20° from
 * Odysseus; a faintly darker, bluish band across the leading hemisphere's equator.
 */
export const tethys: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 48);
  let rgb = scale([250, 249, 246], 0.98 + (n - 0.5) * 0.08);
  rgb = mix(rgb, [214, 214, 212], smooth(0.62, 0.72, fbm(p, 12, 12, 2, 49)) * 0.45);
  const lens = smooth(1.2, 0.3, spot(p, 270, 0, 75, 20) + (n - 0.5) * 0.4);
  rgb = mix(rgb, [210, 216, 224], lens * 0.5);
  rgb = mix(rgb, [226, 222, 214], trailing(p) * 0.3);
  const odysseus = spot(p, 231.1, 32.8, 24, 24);
  rgb = mix(rgb, [222, 222, 220], smooth(1, 0.7, odysseus) * 0.5);
  rgb = mix(rgb, [250, 250, 248], smooth(0.15, 0, Math.abs(odysseus - 1)) * 0.6);
  const ithaca = ITHACA(p);
  return mix(rgb, [196, 194, 190], ithaca * (0.55 + ridge(fbm(p, 6, 30, 2, 50), 0.1) * 0.35));
};

/**
 * Dione (Voyager, Cassini ISS): a bright, cratered leading hemisphere; the darker trailing
 * side crossed by the bright wispy fractures of Padua, Eurotas and Palatine Chasmata,
 * between ~40° N and 60° S and 260–350° W.
 */
export const dione: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 51);
  let rgb = scale([246, 244, 240], 0.97 + (n - 0.5) * 0.12);
  rgb = mix(rgb, [204, 202, 198], smooth(0.62, 0.72, fbm(p, 12, 12, 2, 52)) * 0.5);
  const wispy = smooth(1.1, 0.7, spot(p, 55, -10, 50, 50));
  rgb = mix(rgb, [176, 174, 170], Math.max(trailing(p), wispy) * 0.55);
  const wisps = Math.max(ridge(fbm(p, 3, 7, 3, 53), 0.025), ridge(fbm(p, 5, 9, 2, 54), 0.02));
  return mix(rgb, [244, 244, 242], wisps * wispy * 0.85);
};

/**
 * Rhea (Voyager, Cassini ISS): bright, heavily cratered ice; wispy fractures on the darker
 * trailing hemisphere; Inktomi (14.1° S, 112.1° W), a young 47 km crater whose bright rays
 * reach across much of the leading side.
 */
export const rhea: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 55);
  let rgb = scale([242, 240, 236], 0.97 + (n - 0.5) * 0.14);
  rgb = mix(rgb, [198, 196, 192], smooth(0.6, 0.7, fbm(p, 14, 14, 2, 56)) * 0.55);
  const back = trailing(p);
  rgb = mix(rgb, [182, 180, 176], back * 0.5);
  const wisps = ridge(fbm(p, 4, 8, 3, 57), 0.022);
  rgb = mix(rgb, [240, 240, 238], wisps * smooth(0.4, 0.8, back) * 0.8);
  /* Spot distances stop at 3 radii, so the rays take a spot of their own. */
  const reach = spot(p, 247.9, -14.1, 32, 32);
  if (reach >= 1) return rgb;
  rgb = mix(rgb, [250, 250, 248], smooth(1, 0.3, reach) * 0.6);
  const rays = smooth(0.46, 0.56, fbm(p, 12, 12, 2, 58)) * smooth(1, 0.1, reach);
  const crater = smooth(2.5, 0.8, spot(p, 247.9, -14.1, 1.8, 1.8));
  return mix(rgb, [255, 255, 254], Math.max(crater, rays));
};

/**
 * Iapetus (Cassini ISS; Porco et al. 2005): Cassini Regio, the reddish-black leading
 * hemisphere (p ≈ 0.05) centred on its apex at 90° W and reaching ~40° N and S, against
 * bright trailing ice and poles (~0.5), with a diffuse, spotty boundary between them.
 */
export const iapetus: Painter = (p) => {
  const n = fbm(p, 5, 5, 4, 59);
  const d = spot(p, 270, 0, 105, 46);
  const dark = smooth(1.08, 0.85, d + (n - 0.5) * 0.45 + (fbm(p, 16, 16, 2, 60) - 0.5) * 0.3);
  const ice = scale([204, 196, 182], 0.97 + (n - 0.5) * 0.1);
  return mix(ice, scale([66, 46, 34], 0.92 + (n - 0.5) * 0.3), dark);
};

/* Voyager 2 saw only the Uranian moons' southern hemispheres. The maps' north follows the
   orbits' angular momentum, which is the IAU south there, so latitudes from the literature
   flip sign and east longitudes become 360 − E; the map's south stays plain fill. */
const seen = (p: Point) => smooth(-25, 0, p.lat);

/** Miranda's coronae: [east lon, lat, radius] in map coordinates. */
const CORONAE = [
  [286.3, 29.1, 39], // Arden, 29.1° S 73.7° E, 318 km
  [102.9, 24.8, 39], // Elsinore, 24.8° S 257.1° E, 323 km
  [34.3, 66.9, 28], // Inverness, 66.9° S 325.7° E, 234 km
] as const;
/**
 * Miranda (Voyager 2): grey, cratered rolling terrain broken by three coronae of banded
 * ridges and grooves: Arden on the leading side, Elsinore on the trailing side and
 * Inverness, with its bright chevron, near the south pole.
 */
export const miranda: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 61);
  let rgb = scale([168, 166, 162], 0.98 + (n - 0.5) * 0.12);
  const view = seen(p);
  if (view === 0) return rgb;
  rgb = mix(rgb, [138, 136, 133], smooth(0.62, 0.72, fbm(p, 12, 12, 2, 62)) * view * 0.5);
  /* Each corona: a mottled core inside a belt of parallel bright and dark ridges. */
  for (const [lon, lat, r] of CORONAE) {
    const d = spot(p, lon, lat, r * 1.25, r * 0.8) + (fbm(p, 5, 5, 2, 75) - 0.5) * 0.3;
    if (d > 1.1) continue;
    const bands = 0.5 + 0.5 * Math.sin(d * 22);
    const belt = smooth(0.45, 0.6, d) * smooth(1.05, 0.9, d);
    rgb = mix(rgb, [150, 148, 145], smooth(1.05, 0.9, d) * view * 0.5);
    rgb = mix(rgb, mix([112, 110, 107], [214, 212, 208], bands), belt * view * 0.85);
  }
  const chevron = spot(p, 34.3, 66.9, 12, 6);
  return mix(rgb, [222, 220, 216], smooth(0.9, 0.4, chevron) * view * 0.7);
};

/**
 * Ariel (Voyager 2): the brightest and youngest Uranian surface: grey ice cut by a network
 * of fault canyons (chasmata) with smooth floors, and fresh bright craters.
 */
export const ariel: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 63);
  let rgb = scale([180, 179, 176], 0.98 + (n - 0.5) * 0.12);
  const view = seen(p);
  if (view === 0) return rgb;
  const canyons = Math.max(ridge(fbm(p, 4, 4, 3, 64), 0.025), ridge(fbm(p, 7, 7, 2, 65), 0.018));
  rgb = mix(rgb, [138, 137, 134], canyons * view * 0.6);
  return mix(rgb, [232, 231, 228], smooth(0.7, 0.78, fbm(p, 16, 16, 2, 66)) * view * 0.7);
};

/**
 * Umbriel (Voyager 2): the darkest Uranian moon, uniformly old and cratered, with Wunda
 * (7.9° S, 273.6° E), 131 km across, its floor ringed by bright material.
 */
export const umbriel: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 67);
  let rgb = scale([134, 133, 131], 0.98 + (n - 0.5) * 0.12);
  const view = seen(p);
  if (view === 0) return rgb;
  rgb = mix(rgb, [112, 111, 109], smooth(0.62, 0.72, fbm(p, 12, 12, 2, 68)) * view * 0.5);
  const wunda = spot(p, 86.4, 7.9, 6.4, 6.4);
  return mix(rgb, [218, 214, 206], smooth(0.3, 0.05, Math.abs(wunda - 0.6)) * view);
};

const MESSINA = chasma(25, 33.3, 130, 54, 2.2);
/**
 * Titania (Voyager 2): grey ice, cratered and cut by long fault canyons, Messina Chasmata
 * (33.3° S, 335° E) the longest at ~1,500 km; Gertrude (15.8° S, 287.1° E), 326 km across;
 * bright-rayed young craters.
 */
export const titania: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 69);
  let rgb = scale([156, 152, 148], 0.98 + (n - 0.5) * 0.12);
  const view = seen(p);
  if (view === 0) return rgb;
  rgb = mix(rgb, [128, 125, 122], smooth(0.62, 0.72, fbm(p, 12, 12, 2, 70)) * view * 0.5);
  rgb = mix(rgb, [116, 113, 110], MESSINA(p) * view * 0.7);
  const gertrude = spot(p, 72.9, 15.8, 11.8, 11.8);
  rgb = mix(rgb, [176, 172, 168], smooth(0.2, 0, Math.abs(gertrude - 1)) * view * 0.6);
  return mix(rgb, [216, 214, 210], smooth(0.72, 0.8, fbm(p, 16, 16, 2, 71)) * view * 0.7);
};

/**
 * Oberon (Voyager 2): slightly reddish grey, old and heavily cratered; dark-floored craters
 * such as Hamlet (46.1° S, 44.4° E), 206 km across, and bright ray systems.
 */
export const oberon: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 72);
  let rgb = scale([144, 138, 132], 0.98 + (n - 0.5) * 0.12);
  const view = seen(p);
  if (view === 0) return rgb;
  rgb = mix(rgb, [84, 80, 76], smooth(0.68, 0.74, fbm(p, 14, 14, 2, 73)) * view * 0.7);
  rgb = mix(rgb, [70, 66, 62], smooth(1, 0.6, spot(p, 315.6, 46.1, 7.8, 7.8)) * view * 0.85);
  return mix(rgb, [208, 204, 198], smooth(0.72, 0.8, fbm(p, 16, 16, 2, 74)) * view * 0.6);
};

/** Callisto: dark, saturated with bright craters; Valhalla's ringed basin. */
export const callisto: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 30);
  const craters = smooth(0.66, 0.74, fbm(p, 18, 18, 2, 31));
  let rgb = scale([136, 121, 103], 0.94 + (n - 0.5) * 0.3);
  rgb = mix(rgb, [222, 218, 210], craters * 0.8);
  /* Valhalla (18° N, 57° W): a bright centre and rings out to ~1,900 km. */
  const d = spot(p, 303, 18, 45, 45);
  rgb = mix(
    rgb,
    [204, 196, 184],
    smooth(0.25, 0.08, d) + smooth(0.2, 0, Math.abs(Math.sin(d * 25))) * smooth(1, 0.6, d) * 0.25,
  );
  return mix(rgb, [208, 202, 194], smooth(1, 0.3, spot(p, 220, 32, 3, 3)));
};

/**
 * Titan: visible-light photochemical tholin haze (Voyager 1/2, Cassini ISS;
 * Smith et al. 1981; Porco et al. 2005; Lorenz et al. 2004; Roman et al. 2009).
 * Super-rotating stratospheric winds smooth out longitudinal detail while Hadley
 * circulation creates the north–south hemispheric albedo dichotomy, a faint
 * equatorial transition band and the dark north-polar hood and vortex collar.
 */
export const titan: Painter = (p) => {
  const { lat } = p;
  const zonal = fbm(p, 1.2, 18, 3, 32);
  const bands = Math.sin(lat * RAD * 11 + zonal * 1.6) * 0.014;
  /* Seasonal north–south hemispheric dichotomy across the equator. */
  const north = smooth(-18, 18, lat + (zonal - 0.5) * 3);
  let rgb = mix([186, 136, 76], [162, 114, 63], north);
  /* Subtle bright equatorial boundary band and dark north-polar hood/collar (>50° N). */
  const eqBand = Math.exp(-((lat / 6.5) ** 2)) * 0.04;
  const hood = smooth(46, 66, lat + (zonal - 0.5) * 2.5);
  rgb = mix(rgb, [132, 92, 51], hood * 0.65);
  /* High-altitude polar vortex condensate haze (>70° N and faint south vortex). */
  const vortex = smooth(68, 84, lat) * 0.35 + smooth(-66, -82, lat) * 0.22;
  rgb = mix(rgb, [146, 108, 68], vortex);
  return scale(rgb, 0.99 + eqBand + bands + (zonal - 0.5) * 0.025);
};

/**
 * Triton (Voyager 2): the pinkish south polar cap streaked by geyser plumes,
 * greyer cantaloupe terrain beyond it. Painted with the cap north, since the
 * map's north is the orbit's angular momentum, which is Triton's IAU south.
 */
export const triton: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 6, 6, 4, 33);
  const cap = smooth(-5, 15, lat + (n - 0.5) * 18);
  let rgb = mix(scale([224, 222, 214], 0.95 + (n - 0.5) * 0.2), [246, 232, 224], cap);
  const plumes =
    smooth(0.7, 0.78, fbm(p, 4, 30, 2, 34)) * smooth(10, 30, lat) * smooth(70, 50, lat);
  rgb = mix(rgb, [150, 136, 124], plumes * 0.7);
  return mix(rgb, [184, 186, 176], smooth(0.62, 0.7, fbm(p, 14, 14, 2, 35)) * (1 - cap) * 0.6);
};

/** Charon (New Horizons): neutral grey ice, the red-brown Mordor Macula at the north pole. */
export const charon: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 6, 6, 4, 36);
  let rgb = scale([186, 182, 176], 0.93 + (n - 0.5) * 0.25);
  /* Serenity and Mandjet Chasmata: a belt of canyons north of the equator. */
  rgb = mix(
    rgb,
    [132, 128, 122],
    ridge(fbm(p, 6, 20, 2, 37), 0.03) * smooth(30, 10, Math.abs(lat - 10)),
  );
  return mix(rgb, [112, 72, 54], smooth(62, 76, lat + (n - 0.5) * 8) * 0.85);
};
