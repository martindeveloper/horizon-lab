/** Build the Sun only: node --import tsx scripts/build-sun-map.mjs [source-cache].
 * Offline, reproducible preprocessing of NASA's HMIIF browse images; no live feed.
 * See public/textures/orrery/CREDITS.md for limitations and source attribution.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import { MAPS, mapFile } from "@horizon/toolkit/bodies";

import { SUN_MAP_QUIET_INTENSITY } from "../src/features/orrery/lib/model/parameters.ts";
import {
  HMI_SOURCES,
  projectSolarPoint,
  sampleBilinear,
  smooth,
  solarObserver,
  solarSurface,
} from "./lib/sun-map.mjs";

const cache = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), "horizon-sun-maps"));
const encode = (v) =>
  Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.min(1, v) ** (1 / 2.4) - 0.055));

async function sourceImage(source) {
  await mkdir(cache, { recursive: true });
  const file = path.join(cache, path.basename(source.url));
  let bytes;
  try {
    bytes = await readFile(file);
  } catch {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`${source.url}: HTTP ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== source.sha256)
      throw new Error(`Changed HMI source: ${source.url}`);
    await writeFile(file, bytes);
  }
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256)
    throw new Error(`Corrupt HMI source cache: ${file}`);
  const { data, info } = await sharp(bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== 4096 || info.height !== 4096 || info.channels !== 3)
    throw new Error(`Unexpected HMI image: ${file}`);
  const w = info.width;
  // Locate the bright disc in central rows/columns, excluding the caption and off-limb black.
  const edges = (vertical) => {
    const found = [];
    for (let j = w / 2 - 16; j <= w / 2 + 16; j += 4) {
      let first = -1,
        last = -1;
      for (let i = 0; i < w; i += 1) {
        if (data[(vertical ? i * w + j : j * w + i) * 3] > 40) {
          if (first < 0) first = i;
          last = i;
        }
      }
      found.push([first, last]);
    }
    return [
      found.reduce((s, e) => s + e[0], 0) / found.length,
      found.reduce((s, e) => s + e[1], 0) / found.length,
    ];
  };
  const [left, right] = edges(false),
    [top, bottom] = edges(true);
  const cx = (left + right) / 2,
    cy = (top + bottom) / 2;
  const radius = (right - left + bottom - top) / 4;
  if (radius < 1800 || radius > 1950) throw new Error(`Invalid solar disc radius: ${radius}`);
  const gray = new Float32Array(w * w);
  // Remove the quicklook colour palette. This is display contrast, not calibrated radiance.
  for (let i = 0; i < gray.length; i += 1)
    gray[i] = (0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]) / 255;
  // Robust radial quiet-Sun profile removes any residual display shading without erasing spots.
  const bins = Array.from({ length: 128 }, () => []);
  for (let y = 0; y < w; y += 4)
    for (let x = 0; x < w; x += 4) {
      const r = Math.hypot(x - cx, y - cy) / radius;
      if (r < 0.98) bins[Math.floor(r * 128)].push(gray[y * w + x]);
    }
  const profile = bins.map((values) => {
    values.sort((a, b) => a - b);
    return values.length ? values[Math.floor(values.length / 2)] : 1;
  });
  const observer = solarObserver(new Date(source.date));
  console.log(
    `${source.date}: disc centre ${cx.toFixed(2)}, ${cy.toFixed(2)}; radius ${radius.toFixed(2)}`,
  );
  return { gray, w, cx, cy, radius, profile, observer };
}

export async function buildSunMap(width) {
  // Sequential decode bounds peak memory while preserving deterministic source ordering.
  const sources = [];
  for (const source of HMI_SOURCES) sources.push(await sourceImage(source));
  const height = width / 2;
  const rgb = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const lat = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const lon = ((x + 0.5) / width) * Math.PI * 2;
      const point = solarSurface(lon, lat);
      let sum = 0,
        weight = 0;
      for (const source of sources) {
        const p = projectSolarPoint(point, source.observer);
        // Suppress foreshortened limb detail; never sample a hidden hemisphere.
        if (!p || p.mu < 0.25) continue;
        const r = Math.hypot(p.x, p.y);
        const sample = sampleBilinear(
          source.gray,
          source.w,
          source.cx + p.x * source.radius,
          source.cy - p.y * source.radius,
        );
        const quiet = source.profile[Math.min(124, Math.floor(r * 128))];
        const k = p.mu ** 8 * smooth(0.25, 0.5, p.mu);
        sum += (sample / quiet) * k;
        weight += k;
      }
      // Unreliable polar coverage fades to quiet photosphere, with no invented spots.
      const coverage = 1 - smooth(65, 82, (Math.abs(lat) * 180) / Math.PI);
      const relative = weight > 1e-12 ? 1 + (sum / weight - 1) * coverage : 1;
      const value = Math.max(0, Math.min(1, SUN_MAP_QUIET_INTENSITY * relative));
      const i = (y * width + x) * 3;
      rgb[i] = rgb[i + 1] = rgb[i + 2] = value;
    }
  }
  return { w: width, h: height, rgb };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const map = MAPS.sun;
  const img = await buildSunMap(map.widths.near);
  const bytes = Buffer.alloc(img.rgb.length);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = encode(img.rgb[i]);
  for (const tier of ["far", "nearLight", "near"]) {
    const w = map.widths[tier];
    const file = new URL(`../public${mapFile("/textures/orrery", "sun", tier)}`, import.meta.url);
    const info = await sharp(bytes, { raw: { width: img.w, height: img.h, channels: 3 } })
      .resize(w, w / 2)
      .webp({ quality: tier === "far" ? 84 : 85, effort: 6 })
      .toFile(file.pathname);
    console.log(`${file.pathname}: ${info.size} bytes`);
  }
}
