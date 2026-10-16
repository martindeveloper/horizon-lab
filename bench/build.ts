import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rolldown, type Plugin } from "rolldown";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));

type LoaderContext = {
  rootContext: string;
  resourcePath: string;
  addDependency(file: string): void;
  cacheable(): void;
};
const require = createRequire(import.meta.url);
const shaderLoader: (
  this: LoaderContext,
  source: string,
) => string = require("@horizon/toolkit/shaders/loader");

export type BenchTargetEntry = { id: string; entry: string };

/** Every `src/features/<slug>/bench.ts` is a target named after its feature. */
export function discoverTargets(root = ROOT): BenchTargetEntry[] {
  const features = path.join(root, "src/features");
  return readdirSync(features, { withFileTypes: true })
    .filter((dir) => dir.isDirectory() && existsSync(path.join(features, dir.name, "bench.ts")))
    .map((dir) => ({ id: dir.name, entry: path.join(features, dir.name, "bench.ts") }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** GLSL through the application's own loader, so includes resolve exactly as in `next build`. */
const glsl: Plugin = {
  name: "horizon-glsl",
  load(id) {
    if (!id.endsWith(".glsl")) return null;
    const code = shaderLoader.call(
      {
        rootContext: ROOT,
        resourcePath: id,
        addDependency: (file) => this.addWatchFile(file),
        cacheable() {},
      },
      readFileSync(id, "utf8"),
    );
    return { code, moduleType: "js" };
  },
};

const ENTRY = "horizon-bench-entry";

/** The generated entry: the toolkit runtime plus a lazy loader per target. */
function entry(targets: BenchTargetEntry[]): Plugin {
  const registry = targets
    .map(
      ({ id, entry: file }) =>
        `  ${JSON.stringify(id)}: () => import(${JSON.stringify(file)}).then((m) => m.benchTarget),`,
    )
    .join("\n");
  return {
    name: "horizon-bench-entry",
    resolveId: (id) => (id === ENTRY ? `\0${ENTRY}` : null),
    load: (id) =>
      id === `\0${ENTRY}`
        ? `import { installBenchRuntime } from "@horizon/toolkit/bench";\ninstallBenchRuntime({\n${registry}\n});\n`
        : null,
  };
}

/** One browser script, bundled by Rolldown: no splitting, targets load lazily within it. */
export async function buildBenchBundle(targets = discoverTargets()) {
  const bundle = await rolldown({
    input: ENTRY,
    cwd: ROOT,
    platform: "browser",
    tsconfig: path.join(ROOT, "tsconfig.json"),
    transform: { target: "es2022", define: { "process.env.NODE_ENV": '"production"' } },
    logLevel: "silent",
    plugins: [entry(targets), glsl],
  });
  try {
    const { output } = await bundle.generate({
      format: "iife",
      codeSplitting: false,
      comments: { legal: false },
    });
    return output[0].code;
  } finally {
    await bundle.close();
  }
}
