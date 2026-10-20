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

/** A tier's file under `base`, the app's URL or directory for the maps (no trailing slash). */
export const mapFile = (base: string, id: BodyId, tier: MapTier) => `${base}/${id}-${tier}.webp`;

const OPAL_CREDIT = "NASA, ESA, A.A. Simon, M.H. Wong (OPAL, Hubble programme GO13937)";
const OPAL_URL = "https://archive.stsci.edu/hlsp/opal";

export const MAPS: Partial<Record<BodyId, MeasuredMap>> = {
  moon: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#63615f",
    source: "LRO/LROC CGI Moon Kit (2025), laser-albedo polar fill",
    credit: "NASA’s Scientific Visualization Studio; NASA/LRO/LROC, Arizona State University",
    licence: "Public domain",
    url: "https://svs.gsfc.nasa.gov/4720/",
  },
  io: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#d7cfc2",
    source: "Galileo SSI / Voyager merged mosaic, muted enhanced colour; interpolated poles",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/io_galileo_ssi_global_color_merge_mosaic_1km",
  },
  europa: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#d6d6d6",
    source: "Voyager / Galileo SSI mosaic, monochrome; plain south-polar fill",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m",
  },
  ganymede: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#b1afaa",
    source: "Voyager / Galileo SSI mosaic, muted multispectral colour; monochrome poles",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km",
  },
  callisto: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#818181",
    source: "Voyager / Galileo SSI mosaic, monochrome",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km",
  },
  triton: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#e4e5df",
    source: "Voyager 2 mosaic, muted synthetic colour; plain unobserved-area fill",
    credit: "NASA/JPL; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m",
  },
  /* Never more than a few pixels across: one small tier. */
  phobos: {
    widths: { far: 512, near: 512, nearLight: 512 },
    mean: "#4b4b4b",
    source: "Viking Orbiter mosaic with Mars Express, MGS and MRO images (DLR control), monochrome",
    credit: "NASA/JPL; Philip Stooke, University of Western Ontario; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m",
  },
  deimos: {
    widths: { far: 512, near: 512, nearLight: 512 },
    mean: "#4a4a4a",
    source: "Viking Orbiter mosaic with MRO HiRISE detail, monochrome",
    credit:
      "NASA/JPL; Philip Stooke, University of Western Ontario (with C. Jongkind, M. Arntz); P. Thomas, Cornell; PDS Small Bodies Node",
    licence: "Public domain",
    url: "https://sbn.psi.edu/pds/resource/stookemaps.html",
  },
  mimas: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#cacaca",
    source: "Cassini ISS final atlas mosaic (DLR, 2017), monochrome",
    credit: "NASA/JPL/Space Science Institute; DLR (T. Roatsch et al. 2018); USGS Astrogeology",
    licence: "Public domain",
    url: "https://www.usgs.gov/publications/final-mimas-and-enceladus-atlases-derived-cassini-iss-images",
  },
  enceladus: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#ededed",
    source: "Cassini ISS global mosaic, monochrome",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/enceladus_cassini_global_mosaic_110m",
  },
  tethys: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#e6e6e6",
    source: "Cassini ISS global mosaic, monochrome",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m",
  },
  dione: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#d8d8d8",
    source: "Cassini ISS and Voyager global mosaic, monochrome",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/dione_cassini_voyager_global_mosaic_154m",
  },
  rhea: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#dadada",
    source: "Cassini ISS and Voyager global mosaic, monochrome",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/rhea_cassini_voyager_global_mosaic_417m",
  },
  iapetus: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#999999",
    source:
      "Cassini ISS and Voyager global mosaic, monochrome; Cassini Regio's albedo contrast restored",
    credit: "NASA/JPL/Space Science Institute; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/iapetus_cassini_voyager_global_mosaic_803m",
  },
  charon: {
    widths: { far: 1024, near: 1024, nearLight: 1024 },
    mean: "#adadad",
    source: "New Horizons LORRI / MVIC mosaic, monochrome; plain unobserved-area fill",
    credit: "NASA, JHU APL, SwRI, Lunar and Planetary Institute; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m",
  },
  sun: {
    widths: { far: 1024, near: 8192, nearLight: 2048 },
    mean: "#e8e8e8",
    source:
      "SDO/HMI flattened continuum intensity, 1–22 May 2024; representative rotation mosaic, quiet polar fill",
    credit: "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.",
    licence: "Public domain",
    url: "https://sdo.gsfc.nasa.gov/data/",
  },
  mercury: {
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    mean: "#756f67",
    source: "MESSENGER MDIS 3-colour global mosaic (2011–2015), brightness only",
    credit: "NASA, JHU APL, Carnegie Institution of Washington; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m",
  },
  earth: {
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    mean: "#9297a4",
    source: "Blue Marble Next Generation, October, with the Blue Marble cloud layer",
    credit: "NASA Earth Observatory (Reto Stöckli)",
    licence: "Public domain",
    url: "https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/",
  },
  mars: {
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    mean: "#a27653",
    source: "Viking Orbiter global colour mosaic, 925 m per pixel",
    credit: "NASA, USGS Astrogeology Science Center",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m",
  },
  jupiter: {
    widths: { far: 1024, near: 3600, nearLight: 2048 },
    mean: "#ccbaa7",
    source: "Hubble OPAL global map, 11 December 2025",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  saturn: {
    widths: { far: 1024, near: 1800, nearLight: 1800 },
    mean: "#d3c099",
    source: "Hubble OPAL global map, 29 August 2025",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  uranus: {
    widths: { far: 720, near: 720, nearLight: 720 },
    mean: "#b0d0d2",
    source: "Hubble OPAL global map, 23 October 2025 (southern hemisphere in darkness, painted)",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  neptune: {
    widths: { far: 720, near: 720, nearLight: 720 },
    mean: "#a1c4d7",
    source: "Hubble OPAL global map, 24 August 2025 (far north in darkness, painted)",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  pluto: {
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    mean: "#ceb394",
    source:
      "New Horizons LORRI and MVIC global mosaic (2015), brightness only; unimaged areas painted",
    credit: "NASA, JHU APL, SwRI, Lunar and Planetary Institute; USGS Astrogeology",
    licence: "Public domain",
    url: "https://www.usgs.gov/media/images/pluto-global-mosaic-new-horizons-july-2017",
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
