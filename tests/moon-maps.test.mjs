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

test("moon textures survive loading before material creation and dispose exactly once", async () => {
  const bundle = await rolldown({
    input: fileURLToPath(new URL("../src/features/orrery/lib/graphics/looks.ts", import.meta.url)),
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
  let looks;
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
    looks = createLooks(true);
    const early = new Texture();
    let earlyDisposed = 0;
    early.addEventListener("dispose", () => earlyDisposed++);
    looks.setMeasured("moon", early);
    assert.equal(earlyDisposed, 0);
    assert.equal(looks.moon("moon").uniforms.map.value, early);
    const replacement = new Texture();
    let replacementDisposed = 0;
    replacement.addEventListener("dispose", () => replacementDisposed++);
    looks.setMeasured("moon", replacement);
    assert.equal(earlyDisposed, 1);
    assert.equal(looks.moon("moon").uniforms.map.value, replacement);
    const lateMaterial = looks.moon("io");
    const late = new Texture();
    looks.setMeasured("io", late);
    assert.equal(lateMaterial.uniforms.map.value, late);
    looks.dispose();
    looks = undefined;
    assert.equal(earlyDisposed, 1);
    assert.equal(replacementDisposed, 1);
  } finally {
    looks?.dispose();
    globalThis.document = original;
    await bundle.close();
  }
});
