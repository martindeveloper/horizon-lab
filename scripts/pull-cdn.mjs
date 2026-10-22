/**
 * Mirrors the published measured maps, the Sun's spot stencil and spacecraft models from the CDN
 * into cdn/ (`MAPS_KEY`, `MODELS_KEY`), so the tests can check what the scenes serve. Files already present are kept.
 *
 *   npm run cdn:pull
 */
import path from "node:path";

import { MAPS, tierFile } from "@horizon/toolkit/bodies";
import { keysOf } from "@horizon/toolkit/records";

import stencil from "../src/features/sun/lib/graphics/spot-stencil.generated.json" with { type: "json" };
import { MAPS_KEY, assetUrl } from "../src/lib/assets.ts";
import { MODELS_KEY, SPACECRAFT_IDS, spacecraftFile } from "../src/space/spacecraft/models.ts";
import { fetchCached } from "./lib/net.mjs";

const root = new URL("../cdn/", import.meta.url);
const keys = new Set([
  ...keysOf(MAPS).flatMap((id) =>
    ["far", "nearLight", "near"].map((tier) => tierFile(MAPS_KEY, id, tier)),
  ),
  stencil.atlasFile,
  stencil.pagesFile,
]);
for (const key of keys)
  if (key) await fetchCached(assetUrl(key), path.dirname(new URL(`.${key}`, root).pathname));
console.log(`${keys.size} maps in ${new URL(`.${MAPS_KEY}/`, root).pathname}`);
for (const id of SPACECRAFT_IDS) {
  const key = spacecraftFile(MODELS_KEY, id);
  await fetchCached(assetUrl(key), path.dirname(new URL(`.${key}`, root).pathname));
}
console.log(`${SPACECRAFT_IDS.length} models in ${new URL(`.${MODELS_KEY}/`, root).pathname}`);
