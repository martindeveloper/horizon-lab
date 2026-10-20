/** The major moons, from spacecraft maps. */
import { smoothstep as smooth } from "../../math/index";
import { RAD, fbm, mix, ridge, scale, spot, type Painter } from "./raster";

/* Moon maps put longitude 0 at the sub-planet point; west longitudes from the
   literature are written as east, 360 − W. */

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
