import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("production shaders are expanded and the preprocessor is absent from client bundles", () => {
  const root = ".next/static/chunks";
  const chunks = readdirSync(root, { recursive: true })
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(path.join(root, file), "utf8"))
    .join("\n");
  assert.match(chunks, /float seededHash3/);
  assert.match(chunks, /float fresnelRim/);
  assert.match(chunks, /shader source/);
  assert.doesNotMatch(chunks, /#include <horizon\//);
  assert.doesNotMatch(
    chunks,
    /Shader include cycle|Shader include depth exceeded|Missing shader snippet/,
  );
});
