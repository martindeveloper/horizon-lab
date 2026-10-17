/**
 * Measured surface maps: what each body's texture is built from, who made the
 * data and under which licence. The app owns where the WebP tiers are served
 * from and passes that base in. Bodies without an entry keep their painted map
 * (`@horizon/toolkit/bodies/surfaces`): Venus (featureless cloud
 * tops), Sedna, Halley and the moons.
 *
 * All maps are equirectangular in the scene's convention: east longitude 0°
 * at the left edge, north at the top, and parametric latitude on the oblate
 * giants so features land where the spheroid puts them.
 */
import type { BodyId } from "./figures";

export type MapTier = "far" | "near" | "nearLight";

export type MeasuredMap = {
  /** Pixel widths per tier (height is half). `far` loads after the first frame; the `near` ones only for a close-up. */
  widths: Record<MapTier, number>;
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
  sun: {
    widths: { far: 1024, near: 8192, nearLight: 2048 },
    source:
      "SDO/HMI flattened continuum intensity, 1–22 May 2024; representative rotation mosaic, quiet polar fill",
    credit: "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.",
    licence: "Public domain",
    url: "https://sdo.gsfc.nasa.gov/data/",
  },
  mercury: {
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    source: "MESSENGER MDIS 3-colour global mosaic (2011–2015), brightness only",
    credit: "NASA, JHU APL, Carnegie Institution of Washington; USGS Astrogeology",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m",
  },
  earth: {
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    source: "Blue Marble Next Generation, October, with the Blue Marble cloud layer",
    credit: "NASA Earth Observatory (Reto Stöckli)",
    licence: "Public domain",
    url: "https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/",
  },
  mars: {
    widths: { far: 1024, near: 4096, nearLight: 2048 },
    source: "Viking Orbiter global colour mosaic, 925 m per pixel",
    credit: "NASA, USGS Astrogeology Science Center",
    licence: "Public domain",
    url: "https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m",
  },
  jupiter: {
    widths: { far: 1024, near: 3600, nearLight: 2048 },
    source: "Hubble OPAL global map, 11 December 2025",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  saturn: {
    widths: { far: 1024, near: 1800, nearLight: 1800 },
    source: "Hubble OPAL global map, 29 August 2025",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  uranus: {
    widths: { far: 720, near: 720, nearLight: 720 },
    source: "Hubble OPAL global map, 23 October 2025 (southern hemisphere in darkness, painted)",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  neptune: {
    widths: { far: 720, near: 720, nearLight: 720 },
    source: "Hubble OPAL global map, 24 August 2025 (far north in darkness, painted)",
    credit: OPAL_CREDIT,
    licence: "CC BY 4.0",
    url: OPAL_URL,
  },
  pluto: {
    widths: { far: 1024, near: 4096, nearLight: 2048 },
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
