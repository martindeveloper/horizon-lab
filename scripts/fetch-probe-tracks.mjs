/**
 * Fetches the five probes leaving the solar system from JPL Horizons and writes their tracks
 * for the shared solar system (src/space/solar-system/model/probe-tracks.json): heliocentric positions
 * in the J2000 ecliptic, au, from just after launch to 2040, monthly through the planetary
 * flybys and twice a year after. Run by hand when the trajectories are refit:
 *
 *   node scripts/fetch-probe-tracks.mjs
 */
import { writeFile } from "node:fs/promises";

import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

const API = DOWNLOAD_URLS.horizons;
const OUT = new URL("../src/space/solar-system/model/probe-tracks.json", import.meta.url);
const END = "2040-01-01";

/** Horizons id, the first sample after launch, and when the monthly steps stop. */
const PROBES = {
  pioneer10: { id: "-23", start: "1972-03-10", fine: "1975-01-01" },
  pioneer11: { id: "-24", start: "1973-04-15", fine: "1981-01-01" },
  voyager1: { id: "-31", start: "1977-09-10", fine: "1982-01-01" },
  voyager2: { id: "-32", start: "1977-08-25", fine: "1991-01-01" },
  newHorizons: { id: "-98", start: "2006-01-25", fine: "2016-01-01" },
};

async function vectors(id, start, stop, step) {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${id}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`,
    REF_PLANE: "'ECLIPTIC'",
    OUT_UNITS: "'AU-D'",
    VEC_TABLE: "'1'",
    CSV_FORMAT: "'YES'",
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`Horizons ${id}: HTTP ${res.status}`);
  const { result } = await res.json();
  const body = result.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!body) throw new Error(`Horizons ${id}: no ephemeris\n${result.slice(0, 2000)}`);
  return body
    .trim()
    .split("\n")
    .map((line) => {
      const [jd, , x, y, z] = line.split(",").map((s) => s.trim());
      return [Number(jd), Number(x), Number(y), Number(z)];
    });
}

/** Julian date to a decimal year (TDB; seconds don't matter at this scale). */
const yearOf = (jd) => 2000 + (jd - 2451545) / 365.25;
const round = (v, digits) => Number(v.toFixed(digits));

const probes = {};
for (const [key, { id, start, fine }] of Object.entries(PROBES)) {
  const rows = [
    ...(await vectors(id, start, fine, "30d")),
    ...(await vectors(id, fine, END, "180d")).slice(1),
  ];
  probes[key] = {
    years: rows.map(([jd]) => round(yearOf(jd), 3)),
    au: rows.flatMap(([, x, y, z]) => [round(x, 3), round(y, 3), round(z, 3)]),
  };
}

const data = {
  source: "JPL Horizons (ssd.jpl.nasa.gov), heliocentric geometric states, ecliptic of J2000",
  fetched: new Date().toISOString().slice(0, 10),
  probes,
};
await writeFile(OUT, `${JSON.stringify(data)}\n`);
console.log(`Wrote ${OUT.pathname}`);
