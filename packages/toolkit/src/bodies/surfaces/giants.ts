/** The giant planets' belts, zones, storms and polar features. */
import { smoothstep as smooth } from "../../math/index";
import { RAD, banded, dLon, fbm, mix, scale, spot, type Band, type Painter } from "./raster";

/**
 * The Great Red Spot, 2017–2024 Hubble OPAL range (Simon et al. 2018, AJ 155,
 * 151; Simon et al. 2024, PSJ 5, 223): about 13° of longitude by 9° of latitude
 * (~15,000 × 11,000 km), centred near 22° S.
 */
export const GREAT_RED_SPOT = { lat: -22, lon: 60, longDeg: 13, tallDeg: 9 } as const;

/** Saturn's north-polar hexagon: a jet near 78° N with ~14,500 km sides (Godfrey 1988; Cassini). */
export const SATURN_HEXAGON = { lat: 78, sideKm: 14_500 } as const;

/**
 * Jupiter's belts and zones (planetographic latitude, Rogers 1995, "The Giant
 * Planet Jupiter"), coloured from Juno and Hubble true-colour images.
 */
const JUPITER_BANDS: readonly Band[] = [
  [90, [158, 160, 166]],
  [50, [214, 204, 188]],
  [36, [200, 178, 152]],
  [31, [194, 160, 128]],
  [24, [244, 236, 220]],
  [18, [186, 134, 98]],
  [7, [240, 224, 194]],
  [-7, [196, 146, 108]],
  [-20, [244, 236, 220]],
  [-27, [200, 164, 132]],
  [-33, [238, 228, 212]],
  [-38, [204, 180, 156]],
  [-44, [204, 196, 184]],
  [-55, [158, 160, 168]],
];
export const jupiter: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 3, 26, 4, 10);
  const wave = (fbm(p, 8, 5, 4, 11) - 0.5) * 4.5;
  let rgb = banded(JUPITER_BANDS, lat + wave, 1.4);
  rgb = scale(rgb, 1 + (n - 0.5) * 0.4 + (fbm(p, 20, 110, 2, 22) - 0.5) * 0.14);
  /* Blue-grey festoons and hot spots on the NEB's southern edge. */
  if (lat > 4 && lat < 9.5) {
    const festoon = smooth(0.62, 0.8, fbm(p, 14, 30, 3, 12)) * smooth(4, 6.5, lat);
    rgb = mix(rgb, [104, 110, 124], festoon * smooth(9.5, 7, lat) * 0.7);
  }
  /* The Great Red Spot and the pale Red Spot Hollow around it. */
  const g = GREAT_RED_SPOT;
  const d = spot(p, g.lon, g.lat, g.longDeg / 2, g.tallDeg / 2);
  rgb = mix(rgb, [240, 230, 214], smooth(1.6, 1.05, d) * 0.7);
  /* The spot's anticyclonic spiral: faint rings that wind with angle about its centre. */
  const swirl = d < 1.1 ? Math.sin(d * 13 + Math.atan2(lat - g.lat, dLon(p.lon, g.lon)) * 2) : 0;
  rgb = mix(rgb, [200, 112, 78], smooth(1.02, 0.55, d + (n - 0.5) * 0.25 + swirl * 0.06));
  /* Oval BA in the South Temperate Belt, pale now. */
  rgb = mix(rgb, [226, 206, 182], smooth(1, 0.5, spot(p, g.lon + 95, -33, 3.6, 2.6)));
  return rgb;
};

/** Saturn's subdued bands (Cassini true colour, planetographic). */
const SATURN_BANDS: readonly Band[] = [
  [90, [176, 152, 112]],
  [74, [214, 194, 152]],
  [56, [202, 176, 134]],
  [50, [224, 204, 162]],
  [42, [204, 178, 136]],
  [36, [230, 212, 170]],
  [28, [212, 186, 140]],
  [19, [238, 222, 182]],
  [-19, [212, 186, 142]],
  [-28, [230, 212, 172]],
  [-36, [206, 180, 140]],
  [-42, [222, 202, 162]],
  [-55, [204, 180, 140]],
  [-75, [180, 156, 120]],
];
/** Hexagon circumradius in degrees of colatitude: side over the polar radius of curvature a²/c. */
const HEX_R = SATURN_HEXAGON.sideKm / ((60_268 * 60_268) / 54_364) / RAD;
export const saturn: Painter = (p) => {
  const { lon, lat } = p;
  const n = fbm(p, 3, 22, 4, 13);
  const wave = (fbm(p, 5, 5, 3, 14) - 0.5) * 1.6;
  let rgb = banded(SATURN_BANDS, lat + wave, 1.6);
  rgb = scale(rgb, 0.95 + (n - 0.5) * 0.14 + (fbm(p, 18, 100, 2, 23) - 0.5) * 0.06);
  if (lat > 60) {
    /* The north-polar hexagon: the distance to the nearest side of a regular hexagon. */
    const rho = 90 - lat;
    const phi = ((((lon % 60) + 60) % 60) - 30) * RAD;
    const side = rho * Math.cos(phi) - HEX_R * Math.cos(Math.PI / 6);
    rgb = mix(rgb, [184, 160, 118], smooth(0.6, -0.4, side) * 0.7);
    rgb = mix(rgb, [140, 120, 88], smooth(0.9, 0, Math.abs(side)) * 0.6);
  }
  /* Polar vortices. */
  return mix(rgb, [110, 92, 68], smooth(2.2, 0.6, Math.min(90 - lat, 90 + lat)));
};

/**
 * Uranus: pale greenish cyan (Irwin et al. 2024, MNRAS 527, 11521), nearly
 * featureless, with the bright north polar cap Hubble has followed since 2014.
 */
export const uranus: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 2, 14, 4, 15);
  let rgb = scale([184, 220, 222], 0.93 + (n - 0.5) * 0.04 + Math.sin(lat * RAD * 6) * 0.012);
  rgb = mix(rgb, [222, 238, 236], smooth(52, 64, lat));
  return mix(rgb, [176, 210, 212], smooth(-30, -50, lat) * 0.5);
};

/**
 * Neptune: the same pale greenish blue, slightly bluer for its thinner haze
 * (Irwin et al. 2024), a darker band near 60° S and sparse methane-ice clouds,
 * which nearly vanished in 2019–2023 (Chavez et al. 2023, Icarus 404).
 */
export const neptune: Painter = (p) => {
  const { lat } = p;
  const n = fbm(p, 2, 16, 4, 16);
  let rgb = scale([170, 206, 226], 0.95 + (n - 0.5) * 0.06);
  rgb = mix(rgb, [138, 170, 204], Math.exp(-(((lat + 60) / 7) ** 2)) * 0.6);
  rgb = mix(rgb, [184, 214, 232], smooth(-74, -82, lat) * 0.5);
  const streak = fbm(p, 4, 40, 3, 17);
  const belt = Math.exp(-(((lat + 30) / 9) ** 2)) + Math.exp(-(((lat - 28) / 6) ** 2)) * 0.6;
  return mix(rgb, [240, 246, 250], smooth(0.66, 0.78, streak) * belt * 0.8);
};
