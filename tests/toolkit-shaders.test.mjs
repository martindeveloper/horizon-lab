import assert from "node:assert/strict";
import test from "node:test";

import { assembleShader } from "../packages/toolkit/src/shaders/assemble.ts";

test("in-memory shader adapter resolves Horizon and relative snippet keys", () => {
  const compiled = assembleShader(
    '#include <horizon/helper>\n#include "./parameters.glsl"\nvoid main() {}',
    { helper: "float helper() { return 1.0; }", "./parameters.glsl": "#define SCALE 2.0" },
  );
  assert.match(compiled, /float helper\(\)/);
  assert.match(compiled, /#define SCALE 2\.0/);
  assert.doesNotMatch(compiled, /#include/);
  assert.throws(() => assembleShader("#include <horizon/missing>", {}), /Missing shader snippet/);
});
