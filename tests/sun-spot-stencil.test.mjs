import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import sharp from "sharp";

import { SRGB_TO_LINEAR } from "../scripts/lib/colour.mjs";
import {
  buildSpotAtlas,
  contourDistance,
  spotComponents,
  STENCIL,
} from "../scripts/lib/sun-spot-stencil.mjs";
import { SUN_MAP_QUIET_INTENSITY } from "../src/space/solar-system/model/parameters.ts";

const metadata = JSON.parse(
  readFileSync(
    new URL("../src/features/sun/lib/graphics/spot-stencil.generated.json", import.meta.url),
  ),
);

test("photographic segmentation preserves irregular groups, light bridges and seam-crossing pores", () => {
  const w = 128,
    h = 64;
  const photo = new Float32Array(w * h).fill(1);
  for (let y = 10; y < 30; y++)
    for (let x = 15; x < 42; x++) {
      if (x < 28 || y > 19) photo[y * w + x] = 0.65;
    }
  for (let y = 15; y < 23; y++) for (let x = 20; x < 23; x++) photo[y * w + x] = 1;
  for (let y = 40; y < 45; y++) {
    photo[y * w] = 0.7;
    photo[y * w + w - 1] = 0.85;
    photo[y * w + 65] = 0.85; // Unseeded quiet texture is not a spot.
  }
  const { mask, count } = spotComponents(photo, w, h);
  assert.equal(count, 2, "one irregular group and one group across the longitude seam");
  assert.equal(mask[18 * w + 21], 0, "a light bridge stays bright");
  assert.equal(mask[12 * w + 35], 0, "the missing corner is not replaced by an ellipse");
  assert.equal(mask[25 * w + 35], 1);
  assert.equal(mask[42 * w + w - 1], 1, "a component grows across the seam");
  assert.equal(mask[42 * w + 65], 0);
});

test("distance masks preserve fractional contour positions and have finite empty/full fields", () => {
  const w = 24,
    h = 12;
  const image = Float32Array.from({ length: w * h }, (_, i) => 0.5 + 0.03 * ((i % w) - 10.25));
  const field = contourDistance(image, w, h, 0.5);
  const row = 5 * w;
  const zero = 10 + -field[row + 10] / (field[row + 11] - field[row + 10]);
  assert.ok(Math.abs(zero - 10.25) < 1e-5, "the contour is not rounded to a source pixel");
  for (let x = 0; x < w; x++) assert.equal(field[row + x] < 0, x < 10.25);
  for (const value of [0, 1]) {
    const empty = contourDistance(new Float32Array(w * h).fill(value), w, h, 0.5);
    assert.ok(empty.every(Number.isFinite));
    assert.ok(empty.every((d) => (value === 0 ? d < 0 : d > 0)));
  }
});

test("sparse atlas preserves source intensity and contours across padded tile edges", () => {
  const w = 128,
    h = 64;
  const image = new Float32Array(w * h).fill(1);
  // Deliberately straddles a tile boundary and contains a hole, a core and a small pore.
  for (let y = 20; y < 45; y++)
    for (let x = 53; x < 76; x++)
      image[y * w + x] = x > 58 && x < 70 && y > 25 && y < 38 ? 0.2 : 0.7;
  for (let y = 29; y < 34; y++) image[y * w + 63] = 1;
  for (let y = 10; y < 13; y++) image[y * w + 2] = 0.65;
  const result = buildSpotAtlas(image, w, h, SUN_MAP_QUIET_INTENSITY);
  const stride = STENCIL.tile + 2 * STENCIL.gutter;
  const stored = (tx, ty, x, y) => {
    const page = (ty * result.columns + tx) * 3;
    const ax = result.pages[page] - 1,
      ay = result.pages[page + 1] - 1;
    assert.ok(ax >= 0 && ay >= 0);
    const at =
      ((ay * stride + y + STENCIL.gutter) * result.atlasWidth + ax * stride + x + STENCIL.gutter) *
      3;
    return result.atlas.subarray(at, at + 3);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const data = stored(Math.floor(x / 64), 0, x % 64, y);
      assert.ok(
        Math.abs(data[0] / 255 - image[y * w + x] * SUN_MAP_QUIET_INTENSITY) <= 0.5 / 255 + 1e-7,
      );
      assert.equal(data[1] < 128, image[y * w + x] < STENCIL.penumbraThreshold);
      assert.equal(data[2] < 128, image[y * w + x] < STENCIL.umbraThreshold);
    }
  for (let y = 0; y < h; y++)
    for (const x of [62, 63, 64, 65])
      assert.deepEqual(
        stored(0, 0, x, y),
        stored(1, 0, x - 64, y),
        "neighbouring tiles include identical filtering gutters",
      );
});

test("shipped stencil retains the photograph's dark cores at the original coordinates", async (t) => {
  const mirrored = (key) => new URL(`../cdn${key}`, import.meta.url);
  const file = mirrored(metadata.sourceFile);
  if (![file, mirrored(metadata.atlasFile), mirrored(metadata.pagesFile)].every(existsSync))
    return t.skip("no CDN mirror: run npm run cdn:pull");
  const bytes = readFileSync(file);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), metadata.sourceSha256);
  const read = (path) => sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [photo, atlas, pages] = await Promise.all([
    read(bytes),
    read(mirrored(metadata.atlasFile).pathname),
    read(mirrored(metadata.pagesFile).pathname),
  ]);
  assert.equal(atlas.info.width, metadata.atlasWidth);
  assert.equal(atlas.info.height, metadata.atlasHeight);
  assert.equal(pages.info.width, metadata.width / metadata.tile);
  assert.equal(pages.info.height, metadata.height / metadata.tile);
  let cores = 0;
  for (let y = 0; y < metadata.height; y++)
    for (let x = 0; x < metadata.width; x++) {
      const intensity =
        SRGB_TO_LINEAR[photo.data[(y * metadata.width + x) * photo.info.channels]] /
        SUN_MAP_QUIET_INTENSITY;
      if (intensity >= 0.4) continue;
      cores++;
      const p =
        (Math.floor(y / metadata.tile) * pages.info.width + Math.floor(x / metadata.tile)) *
        pages.info.channels;
      const ax = pages.data[p] - 1,
        ay = pages.data[p + 1] - 1;
      assert.ok(ax >= 0 && ay >= 0, `a photographed core at ${x}, ${y} has a stencil tile`);
      const stride = metadata.tile + 2 * metadata.gutter;
      const i =
        ((ay * stride + metadata.gutter + (y % metadata.tile)) * metadata.atlasWidth +
          ax * stride +
          metadata.gutter +
          (x % metadata.tile)) *
        atlas.info.channels;
      assert.ok(atlas.data[i + 1] < 128 && atlas.data[i + 2] < 128);
      assert.ok(Math.abs(atlas.data[i] / (255 * SUN_MAP_QUIET_INTENSITY) - intensity) < 0.003);
    }
  assert.ok(cores > 1000, "the full mosaic's cores were checked, not one representative pair");
});
