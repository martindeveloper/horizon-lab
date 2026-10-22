/**
 * Fetches the sunspot record and writes src/space/sun/model/sunspots.json: the yearly mean
 * total sunspot number since 1700 (WDC-SILSO, Royal Observatory of Belgium, version 2.0) and
 * the yearly sunspot group number since 1610 as Svalgaard & Schatten 2016 reconstructed it
 * (the "backbone" series SILSO distributes), which alone reaches back through the Maunder
 * minimum. Run by hand once a year, when SILSO closes another year:
 *
 *   node --import tsx scripts/fetch-sunspots.mjs
 */
import { writeFile } from "node:fs/promises";

import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

import { fetchText } from "./lib/net.mjs";

const OUT = new URL("../src/space/sun/model/sunspots.json", import.meta.url);

/** Whitespace-separated numbers per line; blank lines dropped. */
const rowsOf = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/).map(Number));

const [sunspotText, groupText] = await Promise.all([
  fetchText(DOWNLOAD_URLS.silsoYearly),
  fetchText(DOWNLOAD_URLS.silsoGroupBackbone),
]);

/* SILSO yearly: decimal year (mid-year), mean, standard deviation (−1 unknown), observations (−1 unknown), definitive flag. */
const sunspots = rowsOf(sunspotText).map(([year, mean, deviation, observations, definitive]) => [
  Math.floor(year),
  mean,
  deviation < 0 ? null : deviation,
  observations < 0 ? null : observations,
  definitive === 1,
]);
/* Backbone yearly: decimal year, group number, its uncertainty. */
const groups = rowsOf(groupText).map(([year, number, sigma]) => [Math.floor(year), number, sigma]);

const data = {
  source:
    "WDC-SILSO, Royal Observatory of Belgium, Brussels: yearly mean total sunspot number V2.0; SILSO's copy of the Svalgaard & Schatten 2016 backbone group number",
  reference:
    "Clette & Lefèvre 2016, Sol. Phys. 291, 2629 (sunspot number v2.0); Svalgaard & Schatten 2016, Sol. Phys. 291, 2653 (group number)",
  urls: [DOWNLOAD_URLS.silsoYearly, DOWNLOAD_URLS.silsoGroupBackbone],
  fetched: new Date().toISOString().slice(0, 10),
  sunspots: {
    columns: ["year", "number", "deviation", "observations", "definitive"],
    rows: sunspots,
  },
  groups: { columns: ["year", "number", "sigma"], rows: groups },
};
await writeFile(OUT, `${JSON.stringify(data)}\n`);
console.warn(
  `Wrote ${OUT.pathname}: ${sunspots.length} years of sunspot numbers (${sunspots[0][0]}–${sunspots.at(-1)[0]}), ${groups.length} of group numbers (${groups[0][0]}–${groups.at(-1)[0]})`,
);
