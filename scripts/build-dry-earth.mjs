/**
 * Builds Afterglow's dry Earth: a model of the surface once the brightening Sun has taken the
 * oceans (the moist and runaway greenhouse; Kasting et al. 1993, Kopparapu et al. 2013), drawn
 * from NASA's cloud-free Blue Marble Next Generation relief. Not a measurement: the land keeps
 * its measured shape and relief, the ocean basins are emptied to bare seabed shaded by their
 * measured depth (pale shelves of salt and sediment, dark abyssal clay), vegetation gives way
 * to bare soil, the ice sheets to the rock beneath, and there are no clouds. No haze is painted
 * in: the scene draws the thin air that stays with its own atmosphere shell. Writes WebP tiers beside the measured
 * maps, cdn/ + `MAPS_KEY` + `/earth-dry/v<version>/`; upload that folder with the maps
 * (scripts/README.md).
 *
 *   node --import tsx scripts/build-dry-earth.mjs [cache-dir]
 *
 * The source (2.5 MB) is downloaded once into the cache directory (default: the system temp
 * folder).
 */
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

import { DRY_EARTH_MAP } from "../src/features/afterglow/lib/graphics/dry-earth.ts";
import { MAPS_KEY } from "../src/lib/assets.ts";
import { SRGB_TO_LINEAR as LUT, encodeSrgb as encode } from "./lib/colour.mjs";
import { fetchCached } from "./lib/net.mjs";
import { raster } from "./lib/raster.mjs";

sharp.cache(false);
const root = new URL("../", import.meta.url);
const cache = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), "horizon-planet-maps"));
const outDir = new URL(`cdn${MAPS_KEY}/${DRY_EARTH_MAP.folder}/v${DRY_EARTH_MAP.version}/`, root);

/** The width the surface is worked at: the largest tier. */
const WIDTH = Math.max(...Object.values(DRY_EARTH_MAP.widths));

/* Colours in linear light. */
/** Abyssal seabed: brown-grey pelagic clay, where the relief runs darkest (the deep basins). */
const ABYSS = [0.11, 0.085, 0.065];
/** Shelves and shallows: pale sediment and the salt the evaporating seas leave behind. */
const SHELF = [0.5, 0.44, 0.34];
/** Bare soil where plants grew: the hue of the Sahara's sand, about three times as bright as the leaves it replaces. */
const SOIL = [0.55, 0.33, 0.15];
const SOIL_LIFT = 3;
/** The rock under the ice sheets: grey-brown, shaded by the ice's relief. */
const BEDROCK = [0.2, 0.165, 0.13];

/**
 * The source's water: its bathymetry is shaded in blues, so a texel is sea where blue leads red
 * and green by these margins (linear), with a soft band either side so coasts stay clean.
 */
const SEA_BLUE_OVER_RED = [0.02, 0.06];
const SEA_BLUE_OVER_GREEN = [-0.01, 0.03];
/** Ice: every channel at least this bright (linear), softly. */
const ICE_FLOOR = [0.35, 0.5];
/** The ice sheets' luminance (linear) the bedrock under them is shaded against: their relief, carried over. */
const ICE_LUMINANCE = 0.8;
/** The water's brightness range in the source, deep to shallow (linear luminance): the relief. */
const SEA_RELIEF = [0.004, 0.12];
/** Vegetation: green over red as a share of both, to full cover at the second figure. */
const GREEN = [0.02, 0.2];

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

/** The source in linear light, at the working width, 0° east on the left. */
const source = async () =>
  raster(
    await fetchCached(DOWNLOAD_URLS.earthTopographyLight, cache),
    WIDTH,
    3,
    true,
    (byte) => LUT[byte],
  );

/** The dry surface, linear RGB. */
function dry(rgb) {
  const out = new Float32Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];
    const lum = luminance(r, g, b);
    const sea = smoothstep(...SEA_BLUE_OVER_RED, b - r) * smoothstep(...SEA_BLUE_OVER_GREEN, b - g);
    const ice = smoothstep(...ICE_FLOOR, Math.min(r, g, b)) * (1 - sea);
    const relief = Math.sqrt(smoothstep(...SEA_RELIEF, lum));
    const green = smoothstep(...GREEN, (g - r) / Math.max(g + r, 1e-6));
    const soil = Math.min(1, (lum / luminance(...SOIL)) * SOIL_LIFT);
    for (let c = 0; c < 3; c += 1) {
      const seabed = mix(ABYSS[c], SHELF[c], relief);
      const land = mix(rgb[i + c], SOIL[c] * soil, green);
      const ground = mix(land, BEDROCK[c] * (lum / ICE_LUMINANCE), ice);
      out[i + c] = mix(ground, seabed, sea);
    }
  }
  return out;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const surface = dry(await source());
  const bytes = Buffer.alloc(surface.length);
  for (let i = 0; i < surface.length; i += 1) bytes[i] = encode(surface[i]);
  for (const [tier, w] of Object.entries(DRY_EARTH_MAP.widths)) {
    const file = new URL(`${DRY_EARTH_MAP.folder}-${tier}.webp`, outDir);
    const info = await sharp(bytes, { raw: { width: WIDTH, height: WIDTH / 2, channels: 3 } })
      .resize(w, w / 2, { fit: "fill", kernel: "lanczos3" })
      .webp({ quality: tier === "far" ? 84 : 78, effort: 6, smartSubsample: true })
      .toFile(file.pathname);
    console.log(
      `  ${path.basename(file.pathname)} ${w} × ${w / 2}, ${(info.size / 1024).toFixed(0)} KB`,
    );
  }
}

await main();
