import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Node module hook: `.glsl` imports load through the toolkit's shader loader,
 * exactly as the bundlers load them, so modules that import shaders run in tests.
 */
const loader = createRequire(import.meta.url)("../packages/toolkit/src/shaders/loader.cjs");
const root = fileURLToPath(new URL("../", import.meta.url));

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !url.endsWith(".glsl")) return nextLoad(url, context);
  const file = fileURLToPath(url);
  const source = loader.call(
    { resourcePath: file, rootContext: root, addDependency() {}, cacheable() {} },
    await readFile(file, "utf8"),
  );
  return { format: "module", source, shortCircuit: true };
}
