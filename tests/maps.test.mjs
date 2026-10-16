import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
/**
 * The measured surface maps shipped in public/textures/orrery: every tier
 * exists at its size, stays inside its download budget and keeps the body's
 * albedo.
 */
import test from "node:test";

import sharp from "sharp";

import { MAPS, tierFile as tierAt } from "@horizon/toolkit/bodies";
import { GEOMETRIC_ALBEDO } from "@horizon/toolkit/bodies/surfaces";

import { MAP_BASE } from "../src/features/orrery/lib/graphics/map-loader.ts";

const tierFile = (id, tier) => tierAt(MAP_BASE, id, tier);
const publicFile = (url) => new URL(`../public${url}`, import.meta.url);
const linear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

test("every tier exists at its declared size, inside its budget", async () => {
  let far = 0;
  for (const [id, map] of Object.entries(MAPS)) {
    for (const tier of ["far", "near", "nearLight"]) {
      const url = tierFile(id, tier);
      const file = publicFile(url);
      assert.ok(existsSync(file), `${id} ${tier}: ${url}`);
      const { width, height } = await sharp(file.pathname).metadata();
      assert.equal(width, map.widths[tier], `${id} ${tier} width`);
      assert.equal(height, width / 2, `${id} ${tier} is 2:1`);
      const bytes = statSync(file).size;
      if (tier === "far") far += bytes;
      // Close-up maps load one at a time, on demand; phones get the lighter tier.
      const budget = tier === "far" ? 200e3 : tier === "nearLight" ? 600e3 : 2.2e6;
      assert.ok(bytes <= budget, `${id} ${tier} is ${bytes} bytes`);
    }
    assert.ok(map.widths.nearLight <= map.widths.near && map.widths.far <= map.widths.nearLight);
  }
  assert.ok(far <= 600e3, `all far maps together are ${far} bytes`);
});

test("measured maps keep each body's geometric albedo", async () => {
  for (const id of Object.keys(MAPS)) {
    const { data, info } = await sharp(publicFile(tierFile(id, "far")).pathname)
      .resize(256, 128, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    let total = 0;
    for (let y = 0; y < info.height; y += 1) {
      const weight = Math.cos(((90 - ((y + 0.5) / info.height) * 180) * Math.PI) / 180);
      for (let x = 0; x < info.width; x += 1) {
        const i = (y * info.width + x) * info.channels;
        sum +=
          (0.2126 * linear(data[i]) + 0.7152 * linear(data[i + 1]) + 0.0722 * linear(data[i + 2])) *
          weight;
        total += weight;
      }
    }
    const ratio = sum / total / GEOMETRIC_ALBEDO[id];
    // Earth sits lowest: the shader adds its limb haze and ocean glint, which a map lacks.
    assert.ok(ratio > 0.7 && ratio < 1.6, `${id}: luminance / albedo = ${ratio}`);
  }
});
