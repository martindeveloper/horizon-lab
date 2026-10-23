import { CREDIT_URLS, MAP_SOURCE_URLS } from "../urls";
/**
 * Measured surface maps: what each body's texture is built from, who made the
 * data and under which licence. The app owns where the WebP tiers are served
 * from and passes that base in. Bodies without an entry keep their painted map
 * (`@horizon/toolkit/bodies/surfaces`): Venus (featureless cloud
 * tops), Titan (haze), Sedna and Halley.
 *
 * All maps are equirectangular in the scene's convention: east longitude 0°
 * at the left edge, north at the top, and parametric latitude on the oblate
 * giants so features land where the spheroid puts them.
 */
import type { BodyId } from "./figures";

export type MapTier = "far" | "near" | "nearLight";

export type MeasuredMap = {
  /** The map's own folder version: published files are never overwritten, so a rebuild bumps it. */
  version: number;
  /** Pixel widths per tier (height is half). `far` serves globes on the map; the `near` ones only a close-up. */
  widths: Record<MapTier, number>;
  /**
   * The far tier's area-weighted mean colour (sRGB hex, averaged in linear light): what a host
   * shows while the map streams in, so the swap is a fade rather than a change of colour.
   */
  mean: string;
  /** What the map shows and when it was observed. */
  source: string;
  credit: string;
  licence: "Public domain" | "CC BY 4.0";
  url: string;
};

/**
 * A tier's file under `base`, the app's URL or directory for the maps (no trailing slash):
 * `<base>/<body>/v<version>/<body>-<tier>.webp`. Throws for a body without a map.
 */
export function mapFile(base: string, id: BodyId, tier: MapTier) {
  const map = MAPS[id];
  if (!map) throw new Error(`${id} has no measured map`);
  return `${base}/${id}/v${map.version}/${id}-${tier}.webp`;
}

const OPAL_CREDIT = "NASA, ESA, A.A. Simon, M.H. Wong (OPAL, Hubble programme GO13937)";
const OPAL_URL = CREDIT_URLS.opal;

export const MAPS: Partial<Record<BodyId, MeasuredMap>> = {
  moon: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#63615f",
    source: "LRO/LROC CGI Moon Kit (2025), laser-albedo polar fill",
    credit: "NASA’s Scientific Visualization Studio; NASA/LRO/LROC, Arizona State University",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.moon,
  },
  io: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#d7cfc2",
    source: "Galileo SSI / Voyager merged mosaic, muted enhanced colour; interpolated poles",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.io,
  },
  europa: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#d6d6d6",
    source: "Voyager / Galileo SSI mosaic, monochrome; plain south-polar fill",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.europa,
  },
  ganymede: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#b1afaa",
    source: "Voyager / Galileo SSI mosaic, muted multispectral colour; monochrome poles",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.ganymede,
  },
  callisto: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#818181",
    source: "Voyager / Galileo SSI mosaic, monochrome",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.callisto,
  },
  triton: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#e4e5df",
    source: "Voyager 2 mosaic, muted synthetic colour; plain unobserved-area fill",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.triton,
  },
  /* Never more than a few pixels across: one small tier. */
  phobos: {
    version: 1,
    widths: { far: 512, near: 512, nearLight: 512 },
    mean: "#4b4b4b",
    source: "Viking Orbiter mosaic with Mars Express, MGS and MRO images (DLR control), monochrome",
    credit: "NASA/JPL; Philip Stooke, University of Western Ontario; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.phobos,
  },
  deimos: {
    version: 1,
    widths: { far: 512, near: 512, nearLight: 512 },
    mean: "#4a4a4a",
    source: "Viking Orbiter mosaic with MRO HiRISE detail, monochrome",
    credit:
      "NASA/JPL; Philip Stooke, University of Western Ontario (with C. Jongkind, M. Arntz); P. Thomas, Cornell; PDS Small Bodies Node",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.deimos,
  },
  mimas: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#cacaca",
    source: "Cassini ISS final atlas mosaic (DLR, 2017), monochrome",
    credit: "NASA/JPL/Space Science Institute; DLR (T. Roatsch et al. 2018); USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.mimas,
  },
  enceladus: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#ededed",
    source: "Cassini ISS global mosaic, monochrome",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.enceladus,
  },
  tethys: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#e6e6e6",
    source: "Cassini ISS global mosaic, monochrome",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.tethys,
  },
  dione: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#d8d8d8",
    source: "Cassini ISS and Voyager global mosaic, monochrome",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.dione,
  },
  rhea: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#dadada",
    source: "Cassini ISS and Voyager global mosaic, monochrome",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.rhea,
  },
  iapetus: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#999999",
    source:
      "Cassini ISS and Voyager global mosaic, monochrome; Cassini Regio's albedo contrast restored",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.iapetus,
  },
  charon: {
    version: 1,
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#adadad",
    source: "New Horizons LORRI / MVIC mosaic, monochrome; plain unobserved-area fill",
    credit: "NASA, JHU APL, SwRI, Lunar and Planetary Institute; USGS Astrogeology",
    licence: "Public domain",
    url: MAP_SOURCE_URLS.charon,
  },
  sun: {
    version: 2,
    widths: { far: 1024, near: 8192, nearLight: 2048 },
    mean: "#e8e8e8",
    source:
      "SDO/HMI flattened continuum intensity, 1–22 May 2024; representative rotation mosaic, each frame fading out towards its limb, quiet polar fill",
    credit: "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.",
    licence: "Public domain",
    url: CREDIT_URLS.sdoHmi,
  },
  mercury: {
    version: 1,
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    mean: "#756f67",
    source: "MESSENGER MDIS 3-colour global mosaic (2011–2015), brightness only",
    credit: "NASA, JHU APL, Carnegie Institution of Washington; USGS Astrogeology",
    licence: "Public domain",
    url: CREDIT_URLS.messenger,
  },
  earth: {
    version: 1,
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    mean: "#9297a4",
    source: "Blue Marble Next Generation, October, with the Blue Marble cloud layer",
    credit: "NASA Earth Observatory (Reto Stöckli)",
    licence: "Public domain",
    url: CREDIT_URLS.blueMarble,
  },
  mars: {
    version: 1,
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    mean: "#a27653",
    source: "Viking Orbiter global colour mosaic, 925 m per pixel",
    credit: "NASA, USGS Astrogeology Science Center",
    licence: "Public domain",
    url: CREDIT_URLS.viking,
  },
  jupiter: {
    version: 1,
    widths: { far: 1024, near: 3600, nearLight: 2048 },
    mean: "#ccbaa7",
    source: "Hubble OPAL global map, 11 December 2025",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  saturn: {
    version: 1,
    widths: { far: 1024, near: 1800, nearLight: 1800 },
    mean: "#d3c099",
    source: "Hubble OPAL global map, 29 August 2025",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  uranus: {
    version: 1,
    widths: { far: 720, near: 720, nearLight: 720 },
    mean: "#b0d0d2",
    source: "Hubble OPAL global map, 23 October 2025 (southern hemisphere in darkness, painted)",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  neptune: {
    version: 1,
    widths: { far: 720, near: 720, nearLight: 720 },
    mean: "#a1c4d7",
    source: "Hubble OPAL global map, 24 August 2025 (far north in darkness, painted)",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  pluto: {
    version: 1,
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    mean: "#ceb394",
    source:
      "New Horizons LORRI and MVIC global mosaic (2015), brightness only; unimaged areas painted",
    credit: "NASA, JHU APL, SwRI, Lunar and Planetary Institute; USGS Astrogeology",
    licence: "Public domain",
    url: CREDIT_URLS.newHorizons,
  },
};

/** Tiers that are distinct files; equal widths share the smaller tier's file. */
export function tierFile(base: string, id: BodyId, tier: MapTier) {
  const map = MAPS[id];
  if (!map) return null;
  const w = map.widths[tier];
  const first = (["far", "nearLight", "near"] as const).find((t) => map.widths[t] === w)!;
  return mapFile(base, id, first);
}
