import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { parse } from "@shaderfrog/glsl-parser";
import { preprocess } from "@shaderfrog/glsl-parser/preprocessor";

import loader from "../packages/toolkit/src/shaders/loader.cjs";

/**
 * Offline check of every application shader, the way three.js compiles a
 * ShaderMaterial for WebGL 2: includes expanded by our loader, three.js's
 * prefix (built-in uniforms and attributes, GLSL 1 → 3 aliases), macros
 * resolved, then parsed with undeclared names and functions as errors. It
 * catches syntax errors and missing defines before a browser does; it is not
 * a type checker, so the browser still has the last word.
 */

const common = [
  "precision highp float;",
  "precision highp int;",
  "uniform mat4 viewMatrix;",
  "uniform vec3 cameraPosition;",
  "uniform bool isOrthographic;",
  "",
].join("\n");
const VERTEX_PREFIX = [
  common,
  "uniform mat4 modelMatrix;",
  "uniform mat4 modelViewMatrix;",
  "uniform mat4 projectionMatrix;",
  "uniform mat3 normalMatrix;",
  "in vec3 position;",
  "in vec3 normal;",
  "in vec2 uv;",
  "in vec3 color;",
  "in mat4 instanceMatrix;",
  "in vec3 instanceColor;",
  "#define attribute in",
  "#define varying out",
  "#define texture2D texture",
  "",
].join("\n");
const FRAGMENT_PREFIX = [
  common,
  "#define varying in",
  "out highp vec4 pc_fragColor;",
  "#define gl_FragColor pc_fragColor",
  "#define texture2D texture",
  // three.js declares the output colour-space encoder for every non-raw ShaderMaterial.
  "vec4 linearToOutputTexel( vec4 value ) { return value; }",
  "",
].join("\n");
/**
 * Flags three.js sets for the materials that use them (instanced rocks), and
 * the orrery's ring-shadow variant of the planet shader, so both branches parse.
 */
const THREE_FLAGS = { USE_INSTANCING: "", USE_INSTANCING_COLOR: "", RING_SHADOW: "" };

function expand(file) {
  const output = loader.call(
    { resourcePath: file, rootContext: process.cwd(), addDependency() {}, cacheable() {} },
    readFileSync(file, "utf8"),
  );
  // #line directives only restore error locations; the parser does not take them.
  return JSON.parse(output.slice("export default ".length, -1)).replace(/^\s*#\s*line\b.*$/gm, "");
}

function validate(source, stage) {
  const prefix = stage === "vertex" ? VERTEX_PREFIX : FRAGMENT_PREFIX;
  const expanded = preprocess(prefix + source, { defines: THREE_FLAGS });
  parse(expanded, { stage, failOnWarn: true, quiet: true });
}

const shaders = ["src/features", "packages/toolkit/src/shaders"].flatMap((dir) =>
  readdirSync(dir, { recursive: true })
    .filter((file) => /\.(vert|frag)\.glsl$/.test(file))
    .map((file) => path.join(dir, file)),
);

test("every application shader preprocesses and parses as three.js compiles it", () => {
  assert.ok(shaders.length > 0, `found ${shaders.length} shaders`);
  for (const file of shaders) {
    const stage = file.includes(".vert.") ? "vertex" : "fragment";
    assert.doesNotThrow(() => validate(expand(path.resolve(file)), stage), file);
  }
});

test("shader variants parse with the defines their passes compile them with", () => {
  const variants = shaders
    .filter((file) => readFileSync(file, "utf8").includes("#include <horizon/supersample>"))
    .map((file) => [file, "#define HORIZON_PASS 1"]);
  const post = (name) => shaders.find((file) => file.endsWith(`/${name}`));
  variants.push(
    [post("composite.frag.glsl"), "#define HORIZON_FXAA 1\n#define HORIZON_BLOOM 1"],
    [post("composite.frag.glsl"), "#define HORIZON_BLOOM 1"],
    [post("composite.frag.glsl"), "#define HORIZON_LENS 1"],
    [
      post("composite.frag.glsl"),
      "#define HORIZON_FXAA 1\n#define HORIZON_BLOOM 1\n#define HORIZON_LENS 1",
    ],
    [post("bloom-down.frag.glsl"), "#define HORIZON_BLOOM_PREFILTER 1"],
    [post("lens-spike.frag.glsl"), "#define HORIZON_LENS_ARMS 3\n#define HORIZON_LENS_TAPS 6"],
    [post("black-hole-resolve.frag.glsl"), "#define HORIZON_LENS 1"],
  );
  assert.ok(variants.length > 3);
  for (const [file, define] of variants)
    assert.doesNotThrow(
      () =>
        validate(
          `${define}
${expand(path.resolve(file))}`,
          "fragment",
        ),
      `${file} ${define}`,
    );
});

test("the validator rejects what a GPU compiler would", () => {
  assert.throws(
    () => validate("void main() { float x = MISSING_DEFINE; }", "fragment"),
    /undefined/,
  );
  assert.throws(
    () => validate("void main() { float x = missing(1.0); }", "fragment"),
    /undeclared/,
  );
  assert.throws(() => validate("void main() { float x = 1.0 }", "fragment"));
  assert.doesNotThrow(() =>
    validate("void main() { gl_FragColor = vec4(PI2); }".replace("PI2", "1.0"), "fragment"),
  );
});
