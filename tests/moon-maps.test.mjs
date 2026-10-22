import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { rolldown } from "rolldown";
import { Texture } from "three";

import { MAPS } from "@horizon/toolkit/bodies";

import { MOON_MAP_SOURCES, moonSourceX } from "../scripts/lib/moon-maps.mjs";

test("moon rasters align eastward longitudes without mirroring west-labelled catalogues", () => {
  for (const id of ["moon", "io", "triton", "charon"]) {
    const src = MOON_MAP_SOURCES[id];
    // A -180..180 raster: 0 E is in its centre; 90 E follows it.
    assert.equal(moonSourceX(0, 360, src.centered), 180);
    assert.equal(moonSourceX(90, 360, src.centered), 270);
    assert.equal(moonSourceX(270, 360, src.centered), 90);
  }
  for (const id of ["europa", "ganymede", "callisto"])
    assert.equal(moonSourceX(90, 360, MOON_MAP_SOURCES[id].centered), 90);
  for (const [id, src] of Object.entries(MOON_MAP_SOURCES)) {
    assert.match(src.sha256, /^[0-9a-f]{64}$/);
    assert.ok(MAPS[id]);
  }
});

/** Builds `looks.ts` for Node and runs `fn(createLooks)` with a minimal canvas stub. */
async function withLooks(fn) {
  const bundle = await rolldown({
    input: fileURLToPath(new URL("../src/space/solar-system/graphics/looks.ts", import.meta.url)),
    platform: "node",
    plugins: [
      {
        name: "node-material-test",
        resolveId(id) {
          if (id === "three") return { id: import.meta.resolve("three"), external: true };
        },
        load(id) {
          if (id.endsWith(".glsl"))
            return `export default ${JSON.stringify(readFileSync(id, "utf8"))}`;
        },
      },
    ],
  });
  const original = globalThis.document;
  try {
    const { output } = await bundle.generate({ format: "esm" });
    const { createLooks } = await import(
      `data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`
    );
    // Minimal pixel-storage stub; no real canvas, browser or WebGL context.
    globalThis.document = {
      createElement() {
        return {
          getContext() {
            return {
              createImageData(w, h) {
                return { data: new Uint8ClampedArray(w * h * 4) };
              },
              putImageData() {},
              createRadialGradient() {
                return { addColorStop() {} };
              },
              fillRect() {},
            };
          },
        };
      },
    };
    await fn(createLooks);
  } finally {
    globalThis.document = original;
    await bundle.close();
  }
}

const disposals = (texture) => {
  const count = { n: 0 };
  texture.addEventListener("dispose", () => count.n++);
  return count;
};

test("moon textures survive loading before material creation and dispose exactly once", async () => {
  await withLooks((createLooks) => {
    let looks = createLooks(true);
    try {
      const early = new Texture();
      const earlyDisposed = disposals(early);
      looks.setMeasured("moon", early);
      assert.equal(earlyDisposed.n, 0);
      assert.equal(looks.moon("moon").uniforms.map.value, early);
      const replacement = new Texture();
      const replacementDisposed = disposals(replacement);
      looks.setMeasured("moon", replacement);
      assert.equal(earlyDisposed.n, 1);
      assert.equal(looks.moon("moon").uniforms.map.value, replacement);
      const lateMaterial = looks.moon("io");
      const late = new Texture();
      looks.setMeasured("io", late);
      assert.equal(lateMaterial.uniforms.map.value, late);
      looks.dispose();
      looks = undefined;
      assert.equal(earlyDisposed.n, 1);
      assert.equal(replacementDisposed.n, 1);
    } finally {
      looks?.dispose();
    }
  });
});

test("streamed maps: bodies wait in their map's mean colour and fade each map in", async () => {
  await withLooks((createLooks) => {
    const looks = createLooks(true, true);
    try {
      const mars = looks.planets.mars.uniforms;
      const placeholder = mars.map.value;
      // A single white texel tinted with the far map's mean colour: no painted map yet.
      assert.equal(placeholder.image.width, 1);
      assert.equal(`#${mars.mapTint.value.getHexString()}`, MAPS.mars.mean);

      const far = new Texture();
      const farDisposed = disposals(far);
      looks.setMeasured("mars", far);
      assert.equal(mars.map.value, far);
      assert.equal(mars.fade.value, 0, "the map fades in");
      assert.equal(mars.prior.value, placeholder);
      assert.equal(`#${mars.priorTint.value.getHexString()}`, MAPS.mars.mean);
      assert.equal(looks.step(0.3), true, "still fading");
      assert.equal(looks.step(0.4), false, "faded in");
      assert.equal(mars.fade.value, 1);

      // A close-up's detailed map fades in over the far map, and fades back out when given back.
      const detail = new Texture();
      const detailDisposed = disposals(detail);
      looks.hold("mars", detail);
      assert.equal(mars.map.value, detail);
      assert.equal(mars.prior.value, far);
      // A far map replaced mid-fade is never drawn after it is disposed.
      const newer = new Texture();
      looks.setMeasured("mars", newer);
      assert.equal(farDisposed.n, 1);
      assert.notEqual(mars.prior.value, far);
      assert.equal(mars.map.value, detail, "the close-up keeps its surface");
      looks.release("mars", detail);
      assert.equal(mars.map.value, newer);
      assert.equal(mars.prior.value, detail, "the far map fades in over the detailed one");
      assert.equal(detailDisposed.n, 0, "kept while the fade draws it");
      assert.equal(looks.step(0.7), false);
      assert.equal(mars.fade.value, 1);
      assert.equal(detailDisposed.n, 1, "disposed once the fade is done");

      // Given back mid-fade, the detailed map is no longer drawn: disposed at once.
      const brief = new Texture();
      const briefDisposed = disposals(brief);
      looks.hold("mars", brief);
      looks.release("mars", brief);
      assert.equal(briefDisposed.n, 1);
      assert.equal(mars.map.value, newer);
      looks.step(0.7);

      // Released for the memory budget: back to the placeholder, at once.
      const newerDisposed = disposals(newer);
      looks.clearMeasured("mars");
      assert.equal(mars.map.value.image.width, 1);
      assert.equal(mars.fade.value, 1);
      assert.equal(newerDisposed.n, 1);

      // A map that cannot load leaves its body painted.
      const jupiter = looks.planets.jupiter.uniforms;
      looks.setFailed("jupiter");
      assert.ok(jupiter.map.value.image.width > 1, "painted map");
      assert.equal(jupiter.mapTint.value.getHexString(), "ffffff");
      // Bodies without a measured map are painted from the start.
      assert.ok(looks.named.sedna.uniforms.map.value.image.width > 1);
    } finally {
      looks.dispose();
    }
  });
});
