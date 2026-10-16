import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { compareRgba, differenceMap, type ImageDifference } from "@horizon/toolkit/bench";

/** Writes a PNG data URL as is (grab thumbnails) and returns the file path. */
export function writeDataUrl(file: string, dataUrl: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
  return file;
}

/**
 * Writes a captured frame as lossless WebP: about half the size of the
 * browser's PNG and pixel-exact, so baseline comparisons stay valid.
 */
export async function writeLossless(file: string, dataUrl: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  await sharp(png).webp({ lossless: true, effort: 0 }).toFile(file);
  return file;
}

async function decode(file: string) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Compares two PNGs and writes a heat map of their difference next to `heatmap`.
 * Returns null when either file is missing, "size" when dimensions differ.
 */
export async function compareImages(
  current: string,
  baseline: string,
  heatmap: string,
): Promise<ImageDifference | "size" | null> {
  if (!existsSync(current) || !existsSync(baseline)) return null;
  const [a, b] = await Promise.all([decode(current), decode(baseline)]);
  if (a.width !== b.width || a.height !== b.height) return "size";
  const difference = compareRgba(a.data, b.data);
  if (difference.changed > 0) {
    mkdirSync(path.dirname(heatmap), { recursive: true });
    await sharp(Buffer.from(differenceMap(a.data, b.data)), {
      raw: { width: a.width, height: a.height, channels: 4 },
    })
      .webp({ lossless: true, effort: 0 })
      .toFile(heatmap);
  }
  return difference;
}
