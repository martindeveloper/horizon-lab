import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { glslDefines, glslFloat, glslInt } from "@horizon/toolkit/shaders/defines";

import { SHADER_HEADERS } from "../scripts/shader-headers.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
test("GLSL literals are valid floats, ints and vectors", () => {
  assert.equal(glslFloat(15800), "15800.0");
  assert.equal(glslFloat(1.68), "1.68");
  assert.equal(glslFloat(2 * Math.PI), "6.283185307");
  assert.equal(glslFloat(1e-7), "1.0e-7");
  assert.equal(glslFloat(-0.5), "-0.5");
  assert.deepEqual(glslDefines({ STEPS: glslInt(180), TINT: [1, 0.5, 0] }), {
    STEPS: "180",
    TINT: "vec3(1.0, 0.5, 0.0)",
  });
  assert.throws(() => glslFloat(Number.NaN), RangeError);
  assert.throws(() => glslInt(1.5), RangeError);
  assert.throws(() => glslDefines({ lowercase: 1 }), TypeError);
  assert.throws(() => glslDefines({ V: [1] }), RangeError);
});

test("generated shader headers match their TypeScript parameters", () => {
  for (const { path, defines } of SHADER_HEADERS) {
    const actual = Object.fromEntries(
      [...read(path).matchAll(/^#define[ \t]+(\w+)[ \t]+([^\n]+)$/gm)].map(([, name, value]) => [
        name,
        value.trim(),
      ]),
    );
    for (const [name, value] of Object.entries(defines))
      assert.equal(actual[name], value, `${path}: ${name} differs from the CPU parameter`);
  }
});
