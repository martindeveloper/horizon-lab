/**
 * Builds the orrery's measured surface maps (`MAPS` in packages/toolkit/src/bodies/maps.ts)
 * from the original NASA, USGS and Hubble OPAL data, and writes WebP tiers to the
 * local CDN mirror, cdn/ + `MAPS_KEY`. Not part of `next build`: run it when a
 * source or a tier changes, bump that body's `version` in `MAPS`, and upload its new
 * folder (scripts/README.md).
 *
 *   node --import tsx scripts/build-planet-maps.mjs [cache-dir]
 *
 * Sources (~2 GB, mostly two USGS GeoTIFFs) are downloaded once into the cache
 * directory (default: the system temp folder). Every map is converted to the
 * scene's convention (east longitude 0° at the left, north up, parametric
 * latitude on the oblate giants). Gaps in the data (night sides, Saturn's
 * equator behind its rings, Pluto's unimaged south) are filled from the painted
 * maps with a soft seam. Hubble filter sets do not share a colour balance, so
 * each OPAL map keeps its structure and colour variations while its disc-mean
 * colour is set to the painted model's, which follows published true-colour
 * work (Irwin et al. 2024 for Uranus and Neptune). Mercury, Ceres and Pluto mosaics
 * give brightness; their colour follows true-colour images.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { FIGURES, MAPS, mapFile } from "@horizon/toolkit/bodies";
import { GEOMETRIC_ALBEDO, surfaceMap } from "@horizon/toolkit/bodies/surfaces";
import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

import { MAPS_KEY } from "../src/lib/assets.ts";
import { buildSunMap } from "./build-sun-map.mjs";
import { SRGB_TO_LINEAR as LUT, encodeSrgb as encode } from "./lib/colour.mjs";
import { MOON_MAP_SOURCES, moonSourceX } from "./lib/moon-maps.mjs";
import { fetchCached as download } from "./lib/net.mjs";

sharp.cache(false);
const root = new URL("../", import.meta.url);
const cache = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), "horizon-planet-maps"));
const fetchCached = (url) => download(url, cache);
const outDir = new URL(`cdn${MAPS_KEY}/`, root);

const OPAL = DOWNLOAD_URLS.opal;
const opalFile = (cycle, planet, rotation, filter) =>
  `${OPAL}/cycle${cycle}/${planet}/hlsp_opal_hst_wfc3-uvis_${planet}-${rotation}_${filter}_v1_globalmap.fits`;
/**
 * OPAL red, green and blue filters with the README's I/F scale factors.
 * `flip`: Uranus maps run east longitude right to left. `erode`: degrees cut
 * from the edge of the data, where filters disagree near the limb.
 */
const OPAL_SETS = {
  jupiter: {
    files: ["f631n", "f502n", "f467m"].map((f) => opalFile(32, "jupiter", "2025a", f)),
    scale: [0.00383, 0.00386, 0.00376],
    erode: 2,
  },
  saturn: {
    files: ["f631n", "f502n", "f467m"].map((f) => opalFile(32, "saturn", "2025a", f)),
    scale: [0.00362, 0.00285, 0.00507],
    erode: 2,
  },
  uranus: {
    files: ["f657n", "f547m", "f467m"].map((f) => opalFile(33, "uranus", "2025a", f)),
    scale: [0.0044, 0.00266, 0.00317],
    erode: 12,
    flip: true,
  },
  neptune: {
    files: ["f657n", "f547m", "f467m"].map((f) => opalFile(32, "neptune", "2025b", f)),
    scale: [0.00413, 0.00257, 0.00496],
    erode: 18,
  },
};
const USGS = DOWNLOAD_URLS.usgsMosaics;
const SOURCES = {
  earth: DOWNLOAD_URLS.earthTopography,
  clouds: DOWNLOAD_URLS.earthClouds,
  mars: `${USGS}/Mars_Viking_ClrMosaic_global_925m.tif`,
  mercury: `${USGS}/Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif`,
  pluto: `${USGS}/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif`,
  ceres: `${USGS}/Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif`,
};

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A map in progress: linear RGB, w × h, north row first. */
const image = (w, h) => ({ w, h, rgb: new Float32Array(w * h * 3) });
const rowWeight = (y, h) => Math.cos(((90 - ((y + 0.5) / h) * 180) * Math.PI) / 180);

/** The painted map at the same size, linear: the fill and the colour reference. */
function painted(id, w, h) {
  const px = surfaceMap(id, w, h);
  const out = image(w, h);
  for (let i = 0; i < w * h; i += 1)
    for (let c = 0; c < 3; c += 1) out.rgb[i * 3 + c] = LUT[px[i * 4 + c]];
  return out;
}

/** Area-weighted mean colour of `img` where `mask` > 0.5 (whole map without a mask). */
function meanColour(img, mask) {
  const sum = [0, 0, 0];
  let total = 0;
  for (let y = 0; y < img.h; y += 1) {
    const wgt = rowWeight(y, img.h);
    for (let x = 0; x < img.w; x += 1) {
      const i = y * img.w + x;
      if (mask && mask[i] < 0.5) continue;
      for (let c = 0; c < 3; c += 1) sum[c] += img.rgb[i * 3 + c] * wgt;
      total += wgt;
    }
  }
  return sum.map((s) => s / total);
}

/** Scales each channel so the data's mean over the mask matches the reference's. */
function anchor(img, mask, reference) {
  const have = meanColour(img, mask ?? undefined);
  const want = meanColour(reference, mask ?? undefined);
  for (let i = 0; i < img.w * img.h; i += 1)
    for (let c = 0; c < 3; c += 1) img.rgb[i * 3 + c] *= want[c] / have[c];
}

/** Separable box filter (min or mean), wrapping in longitude. */
function filter(src, w, h, radius, op) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const pass = (from, to, horizontal) => {
    for (let a = 0; a < (horizontal ? h : w); a += 1)
      for (let b = 0; b < (horizontal ? w : h); b += 1) {
        let acc = op === "min" ? Infinity : 0;
        for (let k = -radius; k <= radius; k += 1) {
          const bb = horizontal ? (((b + k) % w) + w) % w : Math.min(h - 1, Math.max(0, b + k));
          const v = horizontal ? from[a * w + bb] : from[bb * w + a];
          acc = op === "min" ? Math.min(acc, v) : acc + v;
        }
        to[horizontal ? a * w + b : b * w + a] = op === "min" ? acc : acc / (2 * radius + 1);
      }
  };
  pass(src, tmp, true);
  pass(tmp, out, false);
  return out;
}

/** Valid data → a soft 0..1 mask: cut `erode` px off the edge, then feather over `soft` px. */
function softMask(valid, w, h, erode, soft) {
  const cut = erode > 0 ? filter(valid, w, h, erode, "min") : valid;
  return soft > 0 ? filter(cut, w, h, soft, "mean") : cut;
}

/** Blends the data over the painted map where the mask says it is good. */
function fill(img, mask, reference) {
  for (let i = 0; i < img.w * img.h; i += 1) {
    const m = Math.min(1, Math.max(0, mask[i] * 1.2 - 0.1));
    for (let c = 0; c < 3; c += 1)
      img.rgb[i * 3 + c] =
        reference.rgb[i * 3 + c] + (img.rgb[i * 3 + c] - reference.rgb[i * 3 + c]) * m;
  }
}

function readFits(buf) {
  let off = 0;
  const header = {};
  for (;;) {
    const card = buf.toString("latin1", off, off + 80);
    off += 80;
    const key = card.slice(0, 8).trim();
    if (key === "END") break;
    header[key] = card.slice(10).split("/")[0].replace(/'/g, "").trim();
  }
  if (header.BITPIX !== "-32") throw new Error(`Unexpected BITPIX ${header.BITPIX}`);
  off = Math.ceil(off / 2880) * 2880;
  const w = Number(header.NAXIS1);
  const h = Number(header.NAXIS2);
  const data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) data[i] = buf.readFloatBE(off + i * 4);
  return { w, h, data };
}

/** An OPAL map: three filters as linear RGB, planetographic rows resampled to parametric latitude. */
async function opal(id, width) {
  const set = OPAL_SETS[id];
  const bands = [];
  for (const [i, url] of set.files.entries()) {
    const band = readFits(await readFile(await fetchCached(url)));
    for (let j = 0; j < band.data.length; j += 1) band.data[j] *= set.scale[i];
    bands.push(band);
  }
  const { w: sw, h: sh } = bands[0];
  const h = width / 2;
  const img = image(width, h);
  const valid = new Float32Array(width * h);
  const ratio = FIGURES[id].equatorialKm / FIGURES[id].polarKm;
  for (let y = 0; y < h; y += 1) {
    const beta = ((90 - ((y + 0.5) / h) * 180) * Math.PI) / 180;
    const graphic = (Math.atan(Math.tan(beta) * ratio) * 180) / Math.PI;
    const sy = Math.min(sh - 1, Math.max(0, ((90 - graphic) / 180) * sh - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = sy - y0;
    for (let x = 0; x < width; x += 1) {
      const lon = ((x + 0.5) / width) * 360;
      const sx = ((set.flip ? 360 - lon : lon) / 360) * sw - 0.5;
      const x0 = ((Math.floor(sx) % sw) + sw) % sw;
      const x1 = (x0 + 1) % sw;
      const tx = sx - Math.floor(sx);
      let ok = 1;
      for (let c = 0; c < 3; c += 1) {
        const d = bands[c].data;
        const corners = [d[y0 * sw + x0], d[y0 * sw + x1], d[y1 * sw + x0], d[y1 * sw + x1]];
        if (corners.some((v) => !(v > 0))) ok = 0;
        const top = corners[0] + (corners[1] - corners[0]) * tx;
        const bottom = corners[2] + (corners[3] - corners[2]) * tx;
        img.rgb[(y * width + x) * 3 + c] = top + (bottom - top) * ty;
      }
      valid[y * width + x] = ok;
    }
  }
  const cut = Math.round((set.erode / 360) * width);
  const mask = softMask(valid, width, h, cut, Math.max(2, Math.round(cut * 0.6)));
  const reference = painted(id, width, h);
  anchor(img, mask, reference);
  fill(img, mask, reference);
  return img;
}

/** A large raster, resized with sharp, rolled so 0° east sits at the left edge. */
async function raster(file, width, channels, centredOnZero) {
  const h = width / 2;
  const { data, info } = await sharp(file, { limitInputPixels: false, unlimited: true })
    .resize(width, h, { fit: "fill", kernel: "lanczos3" })
    .toColourspace(channels === 1 ? "b-w" : "srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const shift = centredOnZero ? width / 2 : 0;
  const out = new Float32Array(width * h * channels);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < width; x += 1)
      for (let c = 0; c < channels; c += 1)
        out[(y * width + x) * channels + c] =
          data[(y * width + ((x + shift) % width)) * info.channels + c] / 255;
  return out;
}

/**
 * Earth: October Blue Marble ground under the Blue Marble clouds, plus the
 * atmosphere's blue haze (Rayleigh path radiance, ~0.12 reflectance at
 * 450 nm for an optical depth of ~0.24) that a surface map lacks.
 */
async function earth(width) {
  const ground = await raster(await fetchCached(SOURCES.earth), width, 3, true);
  const clouds = await raster(await fetchCached(SOURCES.clouds), width, 1, true);
  const img = image(width, width / 2);
  const HAZE = [0.03, 0.055, 0.12];
  for (let i = 0; i < img.w * img.h; i += 1) {
    const a = clouds[i];
    for (let c = 0; c < 3; c += 1)
      img.rgb[i * 3 + c] =
        (LUT[Math.round(ground[i * 3 + c] * 255)] + HAZE[c]) * (1 - a) + 0.92 * a;
  }
  return img;
}

/**
 * Mars: the Viking mosaic synthesises green from red and violet filters and
 * runs orange, so its mean colour is set to the Hubble true-colour one.
 */
async function mars(width) {
  const px = await raster(await fetchCached(SOURCES.mars), width, 3, true);
  const img = image(width, width / 2);
  for (let i = 0; i < px.length; i += 1) img.rgb[i] = LUT[Math.round(px[i] * 255)];
  anchor(img, null, painted("mars", width, width / 2));
  return img;
}

/**
 * A monochrome mosaic's brightness in a colour: each pixel takes `colour(l)`
 * scaled to its brightness, then the mean is matched to the painted map. Zero
 * pixels are unimaged and filled from the painted map.
 */
async function brightness(id, file, width, colour, centredOnZero) {
  const lum = await raster(file, width, 1, centredOnZero);
  const h = width / 2;
  const img = image(width, h);
  const valid = new Float32Array(width * h);
  for (let i = 0; i < width * h; i += 1) {
    const l = LUT[Math.round(lum[i] * 255)];
    valid[i] = lum[i] > 1 / 255 ? 1 : 0;
    const tint = colour(l);
    const k = l / Math.max(1e-6, luminance(...tint));
    for (let c = 0; c < 3; c += 1) img.rgb[i * 3 + c] = tint[c] * k;
  }
  const reference = painted(id, width, h);
  const mask = softMask(valid, width, h, 2, Math.max(2, Math.round(width / 512)));
  anchor(img, mask, reference);
  fill(img, mask, reference);
  return img;
}

/** Mercury: MDIS brightness in the planet's grey-brown (MESSENGER true colour). */
async function mercury(width) {
  const file = await fetchCached(SOURCES.mercury);
  return brightness("mercury", file, width, () => [0.19, 0.17, 0.15], true);
}

/**
 * Ceres: Dawn's survey-orbit clear-filter mosaic in the body's near-neutral, faintly warm grey
 * (Dawn colour, Nathues et al. 2015). The raster's left edge is 0° east (Occator's faculae land
 * at 239° E); its unlit south pole is zero and painted.
 */
async function ceres(width) {
  const file = await fetchCached(SOURCES.ceres);
  return brightness("ceres", file, width, () => [0.1, 0.094, 0.088], false);
}

/** Pluto: dark terrain is tholin red-brown, bright terrain nitrogen-ice cream (New Horizons MVIC). */
async function pluto(width) {
  /* The USGS Pluto mosaic starts at 0° east on its left edge. */
  const file = await fetchCached(SOURCES.pluto);
  const tint = (l) => {
    const t = Math.min(1, Math.max(0, (l - 0.05) / 0.5));
    return [0.11 + (0.86 - 0.11) * t, 0.035 + (0.78 - 0.035) * t, 0.02 + (0.66 - 0.02) * t];
  };
  return brightness("pluto", file, width, tint, false);
}

/**
 * The brightest mean a bounded response reaches with detail left: Enceladus (albedo 1.0)
 * would otherwise saturate to a blank white disc.
 */
const WHITEST = 0.85;

/**
 * Restores albedo contrast a mosaic evened out between its images: its own large-scale
 * brightness (2° box blur) is raised to `power`, keeping the boundary where the data puts it
 * and the detail inside. Iapetus's Cassini Regio is ~1.8× darker than the ice in the
 * mosaic but ~10× in reality (ln 10 / ln 1.8 ≈ 3.9).
 */
function stretch(img, power) {
  const { w, h } = img;
  const lum = Float32Array.from({ length: w * h }, (_, i) =>
    luminance(img.rgb[i * 3], img.rgb[i * 3 + 1], img.rgb[i * 3 + 2]),
  );
  const broad = filter(lum, w, h, Math.max(1, Math.round(w / 180)), "mean");
  const mean = broad.reduce((a, b) => a + b, 0) / broad.length;
  for (let i = 0; i < w * h; i += 1) {
    const k = (Math.max(1e-4, broad[i]) / mean) ** (power - 1);
    for (let c = 0; c < 3; c += 1) img.rgb[i * 3 + c] *= k;
  }
}

/** Spacecraft moon mosaics: preserve geography, never invent terrain in gaps.
 * RGB products include non-visible filters: muted colour is illustrative, not
 * calibrated true colour. Grayscale products stay grayscale. A bounded response
 * matches the scene's albedo scale while retaining bright terrain detail.
 */
async function observedMoon(id, width) {
  const source = MOON_MAP_SOURCES[id];
  const download = await fetchCached(source.file);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(download)) hash.update(chunk);
  if (hash.digest("hex") !== source.sha256) throw new Error(`${id}: source checksum mismatch`);
  /* An archive's one map, unpacked beside it. */
  const file = source.entry ? path.join(cache, path.basename(source.entry)) : download;
  if (source.entry && !existsSync(file))
    execFileSync("unzip", ["-o", "-j", download, source.entry, "-d", cache]);
  const px = await raster(file, width, 3, false);
  const img = image(width, width / 2);
  const valid = new Float32Array(width * img.h);
  for (let y = 0; y < img.h; y += 1) {
    const lat = 90 - ((y + 0.5) / img.h) * 180;
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const si = (y * width + moonSourceX(x, width, source.centered)) * 3;
      const rgb = [0, 1, 2].map((c) => LUT[Math.round(px[si + c] * 255)]);
      const l = luminance(...rgb);
      valid[i] = l > 0.001 && !(id === "europa" && lat < -83) ? 1 : 0;
      for (let c = 0; c < 3; c += 1) img.rgb[i * 3 + c] = l + (rgb[c] - l) * source.saturation;
    }
  }
  if (source.contrast) stretch(img, source.contrast);
  const mask = softMask(valid, width, img.h, 2, 3);
  const mean = meanColour(img, mask);
  // A bounded photographic response preserves bright terrain instead of clipping
  // it when these contrast-stretched mosaics are put on the scene's albedo scale.
  let low = 0;
  let high = 1000;
  for (let step = 0; step < 24; step += 1) {
    const gain = (low + high) / 2;
    let sum = 0;
    let weight = 0;
    for (let y = 0; y < img.h; y += 1) {
      const w = rowWeight(y, img.h);
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (mask[i] < 0.5) continue;
        sum += luminance(...[0, 1, 2].map((c) => 1 - Math.exp(-img.rgb[i * 3 + c] * gain))) * w;
        weight += w;
      }
    }
    if (sum / weight < Math.min(GEOMETRIC_ALBEDO[id], WHITEST)) low = gain;
    else high = gain;
  }
  const gain = (low + high) / 2;
  const reference = image(width, img.h);
  for (let i = 0; i < img.rgb.length; i += 1) {
    img.rgb[i] = 1 - Math.exp(-img.rgb[i] * gain);
    reference.rgb[i] = 1 - Math.exp(-mean[i % 3] * gain);
  }
  fill(img, mask, reference);
  return img;
}

/** The far tier's mean colour as written (sRGB hex, averaged in linear light): its `MAPS` entry's `mean`. */
async function shippedMean(file) {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .resize(256, 128, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const img = image(256, 128);
  for (let i = 0; i < 256 * 128; i += 1)
    for (let c = 0; c < 3; c += 1) img.rgb[i * 3 + c] = LUT[data[i * info.channels + c]];
  return `#${meanColour(img)
    .map((v) => encode(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

const BUILDERS = {
  ...Object.fromEntries(
    Object.keys(MOON_MAP_SOURCES).map((id) => [id, (w) => observedMoon(id, w)]),
  ),
  sun: buildSunMap,
  mercury,
  earth,
  mars,
  ceres,
  pluto,
  jupiter: (w) => opal("jupiter", w),
  saturn: (w) => opal("saturn", w),
  uranus: (w) => opal("uranus", w),
  neptune: (w) => opal("neptune", w),
};

const only = process.argv.slice(3);
for (const [id, map] of Object.entries(MAPS)) {
  if (only.length && !only.includes(id)) continue;
  const width = Math.max(...Object.values(map.widths));
  console.log(`${id}: building ${width} × ${width / 2}`);
  const img = await BUILDERS[id](width);
  const bytes = Buffer.alloc(img.w * img.h * 3);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = encode(img.rgb[i]);
  const written = new Set();
  mkdirSync(new URL(`${path.dirname(mapFile(".", id, "far"))}/`, outDir), { recursive: true });
  for (const tier of ["far", "nearLight", "near"]) {
    const w = map.widths[tier];
    if (written.has(w)) continue;
    written.add(w);
    const file = new URL(mapFile(".", id, tier), outDir);
    const info = await sharp(bytes, { raw: { width: img.w, height: img.h, channels: 3 } })
      .resize(w, w / 2, { fit: "fill", kernel: "lanczos3" })
      .webp({
        quality: tier === "far" ? 84 : id === "sun" ? 85 : 78,
        effort: 6,
        smartSubsample: id !== "sun",
      })
      .toFile(file.pathname);
    console.log(
      `  ${path.basename(file.pathname)} ${w} × ${w / 2}, ${(info.size / 1024).toFixed(0)} KB`,
    );
  }
  console.log(`  mean ${await shippedMean(new URL(mapFile(".", id, "far"), outDir).pathname)}`);
}
