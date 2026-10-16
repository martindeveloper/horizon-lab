import { readFileSync, writeFileSync } from "node:fs";

import { SHADER_HEADERS } from "./shader-headers.mjs";

/** Writes each lab's GLSL parameter header; `--check` fails when one is stale. */
const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const stale = [];
for (const { path, contents } of SHADER_HEADERS) {
  const url = new URL(path, root);
  let current = null;
  try {
    current = readFileSync(url, "utf8");
  } catch {}
  if (current === contents) continue;
  if (check) stale.push(path);
  else writeFileSync(url, contents);
}
if (stale.length) {
  console.error(`Stale shader headers (run npm run shaders:generate):\n  ${stale.join("\n  ")}`);
  process.exit(1);
}
console.log(check ? "Shader headers are current." : "Generated shader headers.");
