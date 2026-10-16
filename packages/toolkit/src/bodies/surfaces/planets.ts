/** The Sun, the terrestrial planets and the named small bodies. */
import { smoothstep as smooth } from "../../math/index";
import { RAD, fbm, mix, scale, spot, type Painter } from "./raster";

/** The photosphere: supergranulation and faint faculae, grey (the shader colours it). */
export const sun: Painter = (p) => {
  const v = 0.86 + (fbm(p, 18, 18, 3, 18) - 0.5) * 0.22;
  return [v * 255, v * 255, v * 255];
};

/** Mercury: grey-brown regolith (MESSENGER MDIS colour), bright rayed craters. */
export const mercury: Painter = (p) => {
  const n = fbm(p, 5, 5, 4, 3);
  const craters = fbm(p, 11, 11, 3, 4);
  let v = 0.84 + (n - 0.5) * 0.5 - smooth(0.6, 0.75, craters) * 0.16;
  /* Bright rayed craters: Hokusai (57.8° N, 16.8° E) and Kuiper (11.4° S, 328.6° E). */
  v += smooth(3, 0.4, spot(p, 16.8, 57.8, 3, 3)) * 0.35;
  v += smooth(2.5, 0.4, spot(p, 328.6, -11.4, 2.5, 2.5)) * 0.3;
  /* Caloris basin's brighter, smoother floor (31° N, 162° E). */
  v += smooth(1.1, 0.6, spot(p, 162, 31, 16, 16)) * 0.1;
  return scale([144, 136, 126], v);
};

/** Venus: the cloud deck in visible light, pale yellowish white with faint banding. */
export const venus: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 3, 10, 4, 5);
  const band = Math.sin(lat * RAD * 9 + n * 4) * 0.025;
  return scale([248, 238, 212], 0.97 + band + (n - 0.5) * 0.05);
};

/** Classical Mars albedo features: [east lon, lat, half-width, half-height, strength]. */
const MARS_DARK = [
  [69, 9, 9, 15, 1], // Syrtis Major
  [0, -3, 16, 4, 0.8], // Sinus Meridiani
  [25, -8, 22, 5, 0.75], // Sinus Sabaeus
  [320, -25, 26, 10, 0.75], // Mare Erythraeum
  [330, 47, 18, 10, 0.85], // Mare Acidalium
  [110, -15, 18, 8, 0.7], // Mare Tyrrhenum
  [145, -22, 26, 8, 0.75], // Mare Cimmerium
  [205, -30, 24, 7, 0.65], // Mare Sirenum
  [270, -27, 8, 5, 0.6], // Solis Lacus
  [310, -10, 10, 8, 0.6], // Margaritifer Terra
  [100, 45, 18, 8, 0.4], // Utopia
  [0, -62, 180, 7, 0.35], // Mare Australe
] as const;
const MARS_BRIGHT = [
  [70, -42, 18, 13], // Hellas
  [317, -50, 10, 8], // Argyre
  [20, 22, 28, 14], // Arabia Terra
  [147, 25, 16, 12], // Elysium
  [240, 10, 30, 18], // Tharsis and Amazonis
] as const;
/** Mars: butterscotch dust and darker basaltic plains (Hubble true colour), residual polar caps. */
export const mars: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 6, 6, 3, 6);
  let dark = 0;
  for (let i = 0; i < MARS_DARK.length; i += 1) {
    const f = MARS_DARK[i]!;
    const d = spot(p, f[0], f[1], f[2] * 1.3, f[3] * 1.3);
    if (d < 2.2) dark = Math.max(dark, smooth(1.3, 0.6, d + (n - 0.5) * 1.4) * f[4]);
  }
  let bright = 0;
  for (let i = 0; i < MARS_BRIGHT.length; i += 1) {
    const f = MARS_BRIGHT[i]!;
    bright = Math.max(bright, smooth(1.1, 0.5, spot(p, f[0], f[1], f[2], f[3])));
  }
  let rgb = mix([214, 154, 106], [232, 176, 126], bright * 0.8);
  rgb = mix(rgb, [124, 88, 64], dark * 0.8);
  rgb = scale(rgb, 0.78 + (n - 0.5) * 0.16);
  /* North residual cap reaches ~80° N; the smaller south cap sits off the pole. */
  const cap = Math.max(
    smooth(77, 82, lat + (n - 0.5) * 4),
    smooth(1.2, 0.8, spot(p, 315, -87, 6, 4)),
  );
  return mix(rgb, [244, 238, 230], cap);
};

/** Pluto (New Horizons): bright Sputnik Planitia, dark red Cthulhu, pale Lowell Regio. */
export const pluto: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 7, 7, 4, 7);
  let rgb = scale([232, 196, 156], 0.94 + (n - 0.5) * 0.25);
  rgb = mix(rgb, [214, 204, 186], smooth(50, 64, lat));
  const cthulhu = smooth(1.1, 0.6, spot(p, 90, -5, 62, 18) + (n - 0.5) * 0.9);
  rgb = mix(rgb, [96, 50, 36], cthulhu * 0.92);
  const heart = Math.max(
    smooth(1.05, 0.75, spot(p, 178, 22, 18, 23)),
    smooth(1.1, 0.5, spot(p, 215, 2, 24, 20) + (n - 0.5) * 0.6) * 0.75,
  );
  return mix(rgb, [246, 240, 230], heart);
};

/** Sedna: one of the reddest bodies known, moderately bright (Pál et al. 2012). */
export const sedna: Painter = (p) =>
  scale([228, 140, 100], 0.96 + (fbm(p, 5, 5, 3, 8) - 0.5) * 0.2);

/** Halley's nucleus: albedo 0.04, as dark as soot (Giotto). */
export const halley: Painter = (p) => scale([66, 61, 56], 0.92 + (fbm(p, 6, 6, 3, 9) - 0.5) * 0.4);
