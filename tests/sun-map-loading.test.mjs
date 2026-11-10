import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LinearFilter, NearestFilter, NoColorSpace, SRGBColorSpace } from "three";

import { MAPS, tierFile } from "@horizon/toolkit/bodies";
import { DisposalScope } from "@horizon/toolkit/rendering";

import { createSunMap } from "../src/features/sun/lib/scene/sun-map.ts";
import { assetUrl } from "../src/lib/assets.ts";
import { MAP_BASE } from "../src/space/solar-system/graphics/maps.ts";

const stencil = JSON.parse(
  readFileSync(
    new URL("../src/features/sun/lib/graphics/spot-stencil.generated.json", import.meta.url),
  ),
);
const atlasUrl = assetUrl(stencil.atlasFile);
const pagesUrl = assetUrl(stencil.pagesFile);
const settle = async () => {
  // Flush fetch, blob decoding and each resource owner's promise callbacks.
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
};

test("Sun maps publish paired linear masks, retain the photograph on failure, and release decoded images", async (t) => {
  for (const failure of [null, "pages", "dimensions"]) {
    const scope = new DisposalScope();
    const bitmaps = [];
    const shown = [];
    const stencils = [];
    t.mock.method(globalThis, "fetch", async (url) => {
      const missing = failure === "pages" && url === pagesUrl;
      return new Response(String(url), { status: missing ? 404 : 200 });
    });
    const previous = globalThis.createImageBitmap;
    globalThis.createImageBitmap = async (blob, options) => {
      assert.equal(options.premultiplyAlpha, "none");
      assert.equal(options.colorSpaceConversion, "none");
      assert.equal(options.imageOrientation, "flipY");
      const url = await blob.text();
      const atlas = url === atlasUrl;
      const pages = url === pagesUrl;
      const bitmap = {
        width: atlas ? stencil.atlasWidth : pages ? stencil.width / stencil.tile : 1024,
        height: atlas ? stencil.atlasHeight : pages ? stencil.height / stencil.tile : 512,
        closed: 0,
        close() {
          this.closed++;
        },
      };
      if (failure === "dimensions" && atlas) bitmap.width++;
      bitmaps.push(bitmap);
      return bitmap;
    };
    try {
      const maps = createSunMap(scope, {
        tier: () => "far",
        onLoad: (texture) => shown.push(texture),
        onStencil: (atlas, pages) => stencils.push([atlas, pages]),
        wake() {},
      });
      maps.update();
      const close = 1e-6;
      assert.equal(maps.sharpening(close), true, "a close view waits for the streaming detail");
      assert.equal(maps.sharpening(1), false, "a distant view misses nothing");
      await settle();
      assert.equal(maps.sharpening(close), false, "the wait ends whether loads succeed or fail");
      assert.equal(shown.length, 1, "the photograph survives either stencil failure");
      assert.equal(shown[0].colorSpace, SRGBColorSpace);
      if (failure) {
        assert.equal(
          stencils.length,
          0,
          "a partial or mismatched stencil never reaches the shader",
        );
      } else {
        assert.equal(stencils.length, 1);
        const [atlas, pages] = stencils[0];
        for (const texture of [atlas, pages]) {
          assert.equal(texture.colorSpace, NoColorSpace, "mask channels are never gamma-decoded");
          assert.equal(texture.generateMipmaps, false, "atlas neighbours must not bleed together");
        }
        assert.equal(atlas.magFilter, LinearFilter);
        assert.equal(pages.magFilter, NearestFilter, "page indices are not interpolated");
      }
      maps.update();
      await settle();
      assert.equal(shown.length, 1);
    } finally {
      scope.dispose();
      t.mock.restoreAll();
      if (previous === undefined) delete globalThis.createImageBitmap;
      else globalThis.createImageBitmap = previous;
    }
    assert.ok(
      bitmaps.every((b) => b.closed === 1),
      "success and failure paths each close their bitmaps exactly once",
    );
  }
});

test("a Sun map tier that fails is asked for once, and the other tier still loads", async (t) => {
  const files = { far: tierFile(MAP_BASE, "sun", "far"), near: tierFile(MAP_BASE, "sun", "near") };
  const other = { far: "near", near: "far" };
  for (const failing of ["far", "near"]) {
    const scope = new DisposalScope();
    const asked = { far: 0, near: 0 };
    const shown = [];
    t.mock.method(globalThis, "fetch", async (url) => {
      const tier = Object.keys(files).find((key) => files[key] === url);
      if (tier) asked[tier]++;
      return new Response(String(url), { status: tier === failing ? 503 : 200 });
    });
    const previous = globalThis.createImageBitmap;
    globalThis.createImageBitmap = async () => ({ width: 1024, height: 512, close() {} });
    try {
      const maps = createSunMap(scope, {
        tier: () => "near",
        onLoad: (texture, width, finest) => shown.push({ width, finest }),
        onStencil() {},
        wake() {},
      });
      // Each frame asks again for whatever is still missing.
      for (let frame = 0; frame < 6; frame++) {
        maps.update();
        await settle();
      }
      assert.deepEqual(asked, { far: 1, near: 1 }, `${failing} failed: no request is repeated`);
      assert.deepEqual(
        shown,
        [{ width: MAPS.sun.widths[other[failing]], finest: failing === "far" }],
        `${failing} failed: the ${other[failing]} tier is drawn`,
      );
      assert.equal(maps.sharpening(1e-6), false, "nothing is awaited once every tier is settled");
    } finally {
      scope.dispose();
      t.mock.restoreAll();
      if (previous === undefined) delete globalThis.createImageBitmap;
      else globalThis.createImageBitmap = previous;
    }
  }
});
