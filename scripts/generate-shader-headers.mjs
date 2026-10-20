import { syncGenerated } from "./lib/generated.mjs";
import { SHADER_HEADERS } from "./shader-headers.mjs";

/** Writes each lab's GLSL parameter header; `--check` fails when one is stale. */
const root = new URL("../", import.meta.url);
for (const { path, contents } of SHADER_HEADERS)
  syncGenerated({
    file: new URL(path, root),
    content: contents,
    command: "npm run shaders:generate",
  });
