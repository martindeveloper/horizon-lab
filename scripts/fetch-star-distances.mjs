/**
 * Fetches a distance for every star of the shared bright-star catalogue from SIMBAD and writes
 * src/features/voyage/lib/model/star-distances.json: parsecs keyed by the catalogue name, from the trigonometric
 * parallax SIMBAD holds for the star (Gaia DR3 where it has one, else Hipparcos, van Leeuwen
 * 2007), so a sky can show parallax as a ship covers light-years. Each star is found by a cone
 * search around its catalogue position (3′), taking the brightest object there with a
 * parallax, so multiple systems resolve to their primary. Run by hand when the catalogue
 * changes:
 *
 *   node --import tsx scripts/fetch-star-distances.mjs
 */
import { writeFile } from "node:fs/promises";

import { STARS } from "../src/space/star-catalogue.ts";
import { fetchText } from "./lib/net.mjs";

const TAP = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync";
const OUT = new URL("../src/features/voyage/lib/model/star-distances.json", import.meta.url);
/** Search radius, degrees (3′: the catalogue is good to about an arcminute). */
const RADIUS = 0.05;
/** How many stars are queried at once. */
const CONCURRENCY = 4;

async function query(adql) {
  const params = new URLSearchParams({
    request: "doQuery",
    lang: "adql",
    format: "json",
    query: adql,
  });
  const body = await fetchText(`${TAP}?${params}`);
  return JSON.parse(body).data;
}

/** The brightest object with a parallax within the radius: [main_id, plx (mas), error, bibcode, V]. */
async function lookup([name, raHours, dec, mag]) {
  const ra = (raHours * 15).toFixed(5);
  const rows = await query(
    `SELECT TOP 3 b.main_id, b.plx_value, b.plx_err, b.plx_bibcode, f.V AS vmag
     FROM basic b JOIN allfluxes f ON f.oidref = b.oid
     WHERE CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', ${ra}, ${dec.toFixed(5)}, ${RADIUS})) = 1
       AND b.plx_value IS NOT NULL AND f.V IS NOT NULL AND f.V < ${(mag + 1.5).toFixed(2)}
     ORDER BY vmag`,
  );
  let row = rows.find(([, plx]) => plx > 0);
  if (!row) {
    // A multiple system whose combined entry has no V: its components share the distance,
    // and the nearest object in the cone is the system, not a background star.
    const components = await query(
      `SELECT TOP 1 main_id, plx_value, plx_err, plx_bibcode
       FROM basic
       WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra}, ${dec.toFixed(5)}, ${RADIUS})) = 1
         AND plx_value > 0
       ORDER BY plx_value DESC`,
    );
    row = components[0];
  }
  if (!row) {
    console.warn(`${name}: no parallax within ${RADIUS * 60}′`);
    return null;
  }
  return { name, id: row[0], plx: row[1], error: row[2], bibcode: row[3], V: row[4] };
}

/** Three significant figures: enough for a sky, and it keeps the file small. */
const significant = (value, digits = 3) => Number(value.toPrecision(digits));

const results = [];
const queue = [...STARS];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let star = queue.shift(); star; star = queue.shift()) results.push(await lookup(star));
  }),
);
const found = results.filter(Boolean);
const stars = {};
const references = {};
for (const [name] of STARS) {
  const hit = found.find((row) => row.name === name);
  if (!hit) continue;
  stars[name] = significant(1000 / hit.plx);
  const key = hit.bibcode || "unreferenced";
  references[key] = (references[key] ?? 0) + 1;
}

const data = {
  source:
    "SIMBAD (CDS) TAP, basic.plx_value: the trigonometric parallax SIMBAD adopts for each star (Gaia DR3 where available, else Hipparcos, van Leeuwen 2007), 1000 / parallax (mas)",
  epoch: "Positions matched at J2000; parallaxes as catalogued by the cited reference",
  fetched: new Date().toISOString().slice(0, 10),
  unit: "pc",
  references,
  stars,
};
await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.warn(`Wrote ${OUT.pathname}: ${Object.keys(stars).length} of ${STARS.length} stars`);
