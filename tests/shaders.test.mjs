import assert from "node:assert/strict";
import { realpathSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import loader from "../packages/toolkit/src/shaders/loader.cjs";
import { preprocessShader } from "../packages/toolkit/src/shaders/preprocess.cjs";

function compile(source, snippets) {
  return preprocessShader(source, {
    id: "entry.glsl",
    resolve(name) {
      if (!Object.hasOwn(snippets, name)) throw new Error(`Missing ${name}`);
      return { id: name, source: snippets[name] };
    },
  });
}

test("nested shader includes deduplicate diamonds and restore source locations", () => {
  const output = compile(
    "#version 300 es\n#include <horizon/a>\n#include <horizon/b>\nvoid main() {}",
    {
      "horizon/a": "#include <horizon/shared>\nfloat a;",
      "horizon/b": "#include <horizon/shared>\nfloat b;",
      "horizon/shared": "float shared;",
    },
  );
  assert.ok(output.startsWith("#version 300 es\n"));
  assert.equal(output.match(/float shared;/g).length, 1);
  assert.match(output, /#line 1 2\nfloat shared;\n#line 1 1/);
  assert.match(output, /#line 3 0\n\nvoid main/);
  assert.match(output, /shader source 2: horizon\/shared/);
});

test("shader diagnostics reject cycles, missing helpers and ambiguous conditional includes", () => {
  assert.throws(
    () =>
      compile("#include <horizon/a>", {
        "horizon/a": "#include <horizon/b>",
        "horizon/b": "#include <horizon/a>",
      }),
    /cycle: entry.glsl -> horizon\/a -> horizon\/b -> horizon\/a/,
  );
  assert.throws(() => compile("\n#include <horizon/missing>", {}), /entry.glsl:2: Missing/);
  assert.throws(
    () => compile("#if FLAG\n#include <horizon/a>\n#endif", {}),
    /must be unconditional/,
  );
  assert.throws(
    () => compile("#include <horizon/a>", { "horizon/a": "#version 300 es" }),
    /#version belongs/,
  );
  assert.throws(() => compile("#include <horizon/../bad>", {}), /Invalid shader include/);
});

test("commented includes and Three.js chunks are preserved without resolution", () => {
  const source =
    "// #include <horizon/missing>\n/*\n#include <horizon/missing>\n*/\n#include <common>";
  assert.ok(compile(source, {}).startsWith(source));
});

function load(file) {
  const dependencies = new Set();
  const output = loader.call(
    {
      resourcePath: file,
      rootContext: process.cwd(),
      addDependency(file) {
        dependencies.add(file);
      },
      cacheable() {},
    },
    readFileSync(file, "utf8"),
  );
  return { source: JSON.parse(output.slice("export default ".length, -1)), dependencies };
}

test("loader tracks nested relative files, rebuilds changed dependencies and exports escaped text", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "horizon-shaders-"));
  try {
    const entry = path.join(dir, "entry.glsl"),
      child = path.join(dir, "child.glsl");
    writeFileSync(entry, '#include "./child.glsl"\n#include "./child.glsl"');
    writeFileSync(child, '#include <horizon/fresnel>\n// "quoted" \\ text\nfloat before;');
    const first = load(entry);
    assert.ok(first.dependencies.has(realpathSync(child)));
    assert.ok([...first.dependencies].some((file) => file.endsWith("/fresnel.glsl")));
    assert.equal(first.source.match(/float fresnelRim/g).length, 1);
    assert.match(first.source, /float before;/);
    writeFileSync(child, "float after;");
    assert.match(load(entry).source, /float after;/);
    writeFileSync(child, '#include "./entry.glsl"');
    assert.throws(() => load(entry), /include cycle/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("block comments surrounding include directives remain balanced", () => {
  const output = compile("/* before\n*/ #include <horizon/a> /* after\nend */\nvoid main() {}", {
    "horizon/a": "float helper;",
  });
  const visible = output.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(visible, /float helper;/);
  assert.match(visible, /void main/);
  assert.doesNotMatch(visible, /before|after|end/);
});
