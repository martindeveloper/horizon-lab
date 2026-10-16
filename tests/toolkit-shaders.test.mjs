import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { assembleShader } from "../packages/toolkit/src/shaders/assemble.ts";

test("shader snippets resolve explicitly without feature uniforms or unresolved includes", () => {
  const root = new URL("../packages/toolkit/src/shaders/", import.meta.url);
  const snippets = Object.fromEntries(
    ["math", "noise", "temperature", "stars", "tonemap"].map((name) => [
      name,
      readFileSync(new URL(`${name}.glsl`, root), "utf8"),
    ]),
  );
  // The lab's generated parameter header resolves like any other quoted include.
  const parameters = readFileSync(
    new URL("../src/features/black-hole/lib/parameters.generated.glsl", import.meta.url),
    "utf8",
  );
  for (const value of Object.values(snippets)) assert.doesNotMatch(value, /\bu[A-Z]\w*\b/);
  const source = readFileSync(
    new URL("../src/features/black-hole/lib/black-hole.frag.glsl", import.meta.url),
    "utf8",
  );
  const compiled = assembleShader(source, {
    ...snippets,
    "./parameters.generated.glsl": parameters,
  });
  assert.doesNotMatch(compiled, /#include <horizon\//);
  assert.equal((compiled.match(/float hash21\(/g) ?? []).length, 1);
  assert.throws(() => assembleShader("#include <horizon/missing>", {}), /Missing shader snippet/);
});
