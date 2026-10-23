/** The Sun, the terrestrial planets, the dwarf planets and the named small bodies. */
import { smoothstep as smooth } from "../../math/index";
import { RAD, dLon, fbm, fbmAt, mix, ridge, scale, spot, type Painter } from "./raster";

/** Neutral loading/offline fallback. The measured HMI mosaic supplies the Sun's detail. */
export const sun: Painter = () => [231, 231, 231];

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

/**
 * Venus: the cloud deck in visible light (Mariner 10, Pioneer Venus, MESSENGER,
 * Akatsuki; Titov et al. 2018, SSRv 214, 126). Westward 4-day super-rotation
 * and poleward Hadley flow shear the near-UV/blue absorber into a horizontal
 * Y (ψ) wave, swept-back chevrons, dark subpolar collars (~56°) and bright,
 * absorber-depleted polar hoods (>64°). In human-eye wavelengths the absorber's
 * long-wave wing dims blue more than red, giving subtle cream-to-ochre contrast.
 */
export const venus: Painter = (p) => {
  const { lon, lat } = p;
  const a = Math.abs(lat);
  const shear = (lat / 36) ** 2;
  const c = Math.cos(shear * 0.85);
  const s = Math.sin(shear * 0.85);
  const sx = p.x * c - p.z * s;
  const sz = p.x * s + p.z * c;
  const streaks = fbmAt(sx, p.y, sz, 2.5, 14, 4 + p.detail, 5);
  const ripples = fbmAt(sx, p.y, sz, 9, 24, 3 + p.detail, 18);
  const cells = fbm(p, 14, 16, 3, 19) * smooth(32, 8, a);
  /* Planetary-scale Y (ψ) wave: Kelvin stem on the equator, Rossby arms to ±50°. */
  const phase = (lon - 40) * RAD + shear * 1.9 + (streaks - 0.5) * 0.8;
  const arms = (0.5 + 0.5 * Math.cos(phase)) * smooth(4, 18, a) * smooth(56, 38, a);
  const stem = (0.5 + 0.5 * Math.cos((lon - 155) * RAD)) * smooth(22, 4, a);
  const yWave = Math.max(arms, stem * 0.85);
  /* Dark subpolar collar (~50–62°) and bright sulfuric-acid polar hoods (>64°). */
  const collar = Math.exp(-(((a - 56) / 7.5) ** 2));
  const hood = smooth(61, 74, a + (streaks - 0.5) * 4);
  const absorber =
    (yWave * 0.48 + collar * 0.42 + (streaks - 0.35) * 0.25 + (ripples - 0.5) * 0.14) *
    (1 - hood * 0.85);
  const rgb = mix([250, 243, 222], [236, 219, 178], Math.min(1, Math.max(0, absorber)));
  const v = 0.99 + hood * 0.025 + (streaks - 0.5) * 0.03 + (cells - 0.5) * 0.02;
  return scale(rgb, v);
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

/**
 * Sedna's longitudinally balanced ancient basins: [east lon, lat, half-width, half-height, frost].
 * Distributed across all four quadrants so the disc-integrated rotational light curve stays
 * within Δm ≈ 0.02 mag (Gaudi et al. 2005, ApJ 629, L49).
 */
const SEDNA_BASINS = [
  [44, 18, 22, 18, 0.95],
  [136, -20, 22, 18, 0.95],
  [224, 16, 22, 18, 0.95],
  [316, -18, 22, 18, 0.95],
] as const;
/**
 * Sedna: ultra-red organic tholin mantle with CH₄/N₂ volatile frost in low basins
 * and high-latitude cold traps (Barucci et al. 2005; Emery et al. 2007; Pál et al. 2012).
 */
export const sedna: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 8, 8, 4, 8);
  const mottle = fbm(p, 14, 14, 4, 41);
  const rims = ridge(fbm(p, 10, 10, 3, 42), 0.035);
  let basin = 0;
  let rim = 0;
  for (let i = 0; i < SEDNA_BASINS.length; i += 1) {
    const b = SEDNA_BASINS[i]!;
    const d = spot(p, b[0], b[1], b[2], b[3]) + (n - 0.5) * 0.35;
    if (d < 1.8) {
      basin = Math.max(basin, smooth(0.85, 0.25, d) * b[4]);
      rim = Math.max(rim, smooth(0.28, 0, Math.abs(d - 0.95)) * b[4]);
    }
  }
  const tholin = smooth(0.45, 0.72, n * 0.65 + mottle * 0.35) * (1 - basin * 0.7);
  const polarFrost = smooth(54, 76, Math.abs(lat) + (n - 0.5) * 10) * 0.55;
  const frost = Math.min(1, basin * 0.65 + polarFrost + rims * 0.22);
  let rgb = mix([226, 136, 96], [182, 92, 58], tholin * 0.75);
  rgb = mix(rgb, [196, 106, 70], rim * 0.45);
  rgb = mix(rgb, [246, 188, 148], frost * 0.75);
  return scale(rgb, 0.96 + (mottle - 0.5) * 0.14);
};

/**
 * Ceres (Dawn FC; Nathues et al. 2015, Nature 528, 237): dark carbonaceous regolith (albedo
 * 0.09) with the bright carbonate faculae on Occator's floor (19.8° N, 239.3° E), young
 * rayed Haulani (5.8° N, 10.8° E) and the lone bright cone of Ahuna Mons (10.5° S, 316° E).
 */
export const ceres: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 60);
  const craters = smooth(0.62, 0.72, fbm(p, 16, 16, 2, 61));
  let rgb = scale([100, 94, 88], 0.94 + (n - 0.5) * 0.28);
  rgb = mix(rgb, [132, 126, 120], craters * 0.5);
  const occator = spot(p, 239.3, 19.8, 5.6, 5.6);
  rgb = mix(rgb, [88, 84, 80], smooth(1.1, 0.7, occator) * 0.4);
  const cerealia = smooth(2.2, 0.3, spot(p, 239.3, 19.8, 0.7, 0.7));
  const vinalia = smooth(1.8, 0.4, spot(p, 241.6, 19.9, 0.6, 0.5)) * 0.7;
  rgb = mix(rgb, [238, 236, 232], Math.max(cerealia, vinalia));
  rgb = mix(rgb, [160, 154, 148], smooth(2.4, 0.5, spot(p, 10.8, 5.8, 2, 2)) * 0.6);
  return mix(rgb, [176, 170, 164], smooth(1.6, 0.3, spot(p, 316, -10.5, 1, 1)) * 0.7);
};

/**
 * Haumea (Pinilla-Alonso et al. 2009; Lacerda, Jewitt & Peixinho 2008, AJ 135, 1749):
 * crystalline water ice over the whole surface, neutral and bright (albedo 0.51), with
 * the Dark Red Spot, a redder, darker province on one side that drives its light curve.
 */
export const haumea: Painter = (p) => {
  const n = fbm(p, 6, 6, 4, 62);
  const grain = fbm(p, 14, 14, 3, 63);
  let rgb = scale([206, 209, 214], 0.97 + (n - 0.5) * 0.12);
  const red = smooth(1.3, 0.5, spot(p, 180, 0, 50, 36) + (n - 0.5) * 0.5);
  rgb = mix(rgb, [172, 154, 142], red * 0.8);
  return scale(rgb, 0.98 + (grain - 0.5) * 0.06);
};

/**
 * Makemake (Brown et al. 2007, AJ 133, 284; Ortiz et al. 2012): methane frost over reddened
 * organics, bright (albedo 0.77) but red, mottled by a darker terrain the occultation and
 * thermal data ask for.
 */
export const makemake: Painter = (p) => {
  const n = fbm(p, 7, 7, 4, 64);
  const mottle = fbm(p, 12, 12, 3, 65);
  const dark = smooth(0.42, 0.7, n * 0.6 + mottle * 0.4);
  let rgb = mix([248, 224, 194], [226, 190, 152], dark * 0.5);
  rgb = mix(rgb, [250, 230, 204], smooth(0.62, 0.78, mottle) * 0.35);
  return scale(rgb, 0.97 + (n - 0.5) * 0.1);
};

/**
 * Eris (Sicardy et al. 2011; Alvarez-Candal et al. 2011, A&A 532, A130): a near-perfect
 * mirror of fresh methane and nitrogen frost (albedo 0.96), almost featureless, with a light
 * curve under a hundredth of a magnitude.
 */
export const eris: Painter = (p) => {
  const n = fbm(p, 6, 6, 3, 66);
  const grain = fbm(p, 16, 16, 2, 67);
  const rgb = mix([247, 246, 243], [238, 236, 232], smooth(0.4, 0.7, n) * 0.5);
  return scale(rgb, 0.99 + (grain - 0.5) * 0.03);
};

/**
 * Halley's nucleus: coal-black refractory CHON/silicate crust (albedo 0.04),
 * bilobate saddle waist, mapped Giotto HMC topography (Crater, Mountain, Chain,
 * Ducktail) and localized active outgassing vents covering ~10–15 % of the
 * surface (Keller et al. 1986, 1987, A&A 187, 807; Stooke & Abergel 1991).
 */
export const halley: Painter = (p) => {
  const n = fbm(p, 5, 5, 4, 9);
  const rough = fbm(p, 13, 13, 4, 50);
  const scarps = ridge(fbm(p, 7, 7, 3, 51), 0.032);
  /* Central saddle/waist depression between the two lobes. */
  const waist =
    Math.exp(-(((dLon(p.lon, 255) * p.cosLat) / 28) ** 2)) * 0.45 +
    Math.exp(-(((dLon(p.lon, 75) * p.cosLat) / 32) ** 2)) * 0.35;
  /* Giotto HMC features: sunward Crater (348° E, 6° N), Mountain (18° E, −6° S),
     northern Chain (2° E, 24° N) and southern Ducktail terrace (185° E, −22° S). */
  const craterD = spot(p, 348, 6, 16, 14) + (n - 0.5) * 0.25;
  const craterFloor = smooth(0.85, 0.25, craterD);
  const craterRim = smooth(0.28, 0, Math.abs(craterD - 0.95));
  const hills = Math.max(
    smooth(1, 0.25, spot(p, 18, -6, 10, 8)),
    smooth(1.1, 0.35, spot(p, 2, 24, 24, 7)) * 0.75,
    smooth(1.1, 0.4, spot(p, 185, -22, 18, 13)) * 0.65,
  );
  /* Discrete active jet vents (~10 % of surface) exposing dusty sublimating ice. */
  const vents = Math.max(
    smooth(1.05, 0.25, spot(p, 335, 26, 18, 14) + (rough - 0.5) * 0.3),
    smooth(1.05, 0.25, spot(p, 356, 2, 16, 13) + (rough - 0.5) * 0.3) * 0.95,
    smooth(1.05, 0.25, spot(p, 28, -12, 17, 14) + (rough - 0.5) * 0.3) * 0.9,
  );
  let rgb = scale(
    [63, 58, 53],
    0.9 + (n - 0.5) * 0.24 + (rough - 0.5) * 0.18 - waist * 0.14 - craterFloor * 0.12,
  );
  rgb = mix(rgb, [82, 76, 70], Math.min(1, craterRim * 0.55 + hills * 0.5 + scarps * 0.35));
  return mix(rgb, [128, 134, 142], vents * 0.85);
};
