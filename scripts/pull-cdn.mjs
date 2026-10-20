/**
 * Mirrors the published measured maps from the CDN into cdn/ + `MAPS_KEY`, so the map
 * tests can check what the orrery serves. Files already present are kept.
 *
 *   npm run cdn:pull
 */
import { MAPS, tierFile } from "@horizon/toolkit/bodies";
import { keysOf } from "@horizon/toolkit/records";

import { MAPS_KEY, assetUrl } from "../src/lib/assets.ts";
import { fetchCached } from "./lib/net.mjs";

const dir = new URL(`../cdn${MAPS_KEY}/`, import.meta.url).pathname;
const keys = new Set(
  keysOf(MAPS).flatMap((id) =>
    ["far", "nearLight", "near"].map((tier) => tierFile(MAPS_KEY, id, tier)),
  ),
);
for (const key of keys) if (key) await fetchCached(assetUrl(key), dir);
console.log(`${keys.size} maps in ${dir}`);
