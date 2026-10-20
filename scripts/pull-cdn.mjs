/**
 * Mirrors the published measured maps from the CDN into cdn/ + `MAPS_KEY`, so the map
 * tests can check what the orrery serves. Files already present are kept.
 *
 *   npm run cdn:pull
 */
import path from "node:path";

import { MAPS, tierFile } from "@horizon/toolkit/bodies";
import { keysOf } from "@horizon/toolkit/records";

import { MAPS_KEY, assetUrl } from "../src/lib/assets.ts";
import { fetchCached } from "./lib/net.mjs";

const root = new URL("../cdn/", import.meta.url);
const keys = new Set(
  keysOf(MAPS).flatMap((id) =>
    ["far", "nearLight", "near"].map((tier) => tierFile(MAPS_KEY, id, tier)),
  ),
);
for (const key of keys)
  if (key) await fetchCached(assetUrl(key), path.dirname(new URL(`.${key}`, root).pathname));
console.log(`${keys.size} maps in ${new URL(`.${MAPS_KEY}/`, root).pathname}`);
