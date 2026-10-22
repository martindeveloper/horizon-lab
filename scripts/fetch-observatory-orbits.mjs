/**
 * Fetches the great observatories' orbits for the shared solar system
 * (src/space/solar-system/model/observatory-orbits.json): Hubble's and Chandra's latest
 * CelesTrak element sets (mean elements of the SGP4 theory, equator of date), and Webb's JPL
 * Horizons trajectory about the Sun–Earth L2 point, as-flown and then predicted to the end of
 * its file, every `STEP_DAYS`. Webb is stored in the frame that turns with Earth round the Sun
 * (x away from the Sun, z to ecliptic north, km), where its halo orbit holds still; the scene
 * turns it back with Earth. Run by hand when the elements go stale (Hubble's drift by minutes
 * along its orbit within days) or Webb's prediction is refit:
 *
 *   node scripts/fetch-observatory-orbits.mjs
 */
import { writeFile } from "node:fs/promises";

import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

const OUT = new URL("../src/space/solar-system/model/observatory-orbits.json", import.meta.url);

/** NORAD catalogue numbers. */
const SATELLITES = { hubble: 20580, chandra: 25867 };
/** Horizons id; from after Webb settled about L2 to the end of Horizons' prediction. */
const WEBB = { id: "-170", start: "2022-02-01", stop: "2031-10-15" };
const STEP_DAYS = 4;
/** Webb's track is kept to this many km. */
const KM = 100;

async function elements(norad) {
  const res = await fetch(`${DOWNLOAD_URLS.celestrakGp}?CATNR=${norad}&FORMAT=json`);
  if (!res.ok) throw new Error(`CelesTrak ${norad}: HTTP ${res.status}`);
  const [gp] = await res.json();
  if (!gp) throw new Error(`CelesTrak ${norad}: no element set`);
  return {
    norad,
    /* CelesTrak writes UTC without a zone. */
    epoch: `${gp.EPOCH}Z`,
    revsPerDay: gp.MEAN_MOTION,
    /* Half the mean motion's rate of change, rev/day²: drag lowering and speeding the orbit. */
    halfDecay: gp.MEAN_MOTION_DOT,
    e: gp.ECCENTRICITY,
    i: gp.INCLINATION,
    node: gp.RA_OF_ASC_NODE,
    omega: gp.ARG_OF_PERICENTER,
    M: gp.MEAN_ANOMALY,
  };
}

/** Geocentric positions of `id`, ecliptic J2000, km, one row a step. */
async function vectors(id) {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${id}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@399'",
    START_TIME: `'${WEBB.start}'`,
    STOP_TIME: `'${WEBB.stop}'`,
    STEP_SIZE: `'${STEP_DAYS}d'`,
    REF_PLANE: "'ECLIPTIC'",
    OUT_UNITS: "'KM-S'",
    VEC_TABLE: "'1'",
    CSV_FORMAT: "'YES'",
  });
  const res = await fetch(`${DOWNLOAD_URLS.horizons}?${params}`);
  if (!res.ok) throw new Error(`Horizons ${id}: HTTP ${res.status}`);
  const { result } = await res.json();
  const body = result.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!body) throw new Error(`Horizons ${id}: no ephemeris\n${result.slice(0, 2000)}`);
  return body
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((s) => s.trim()))
    .map(([jd, , x, y, z]) => ({ jd: Number(jd), at: [Number(x), Number(y), Number(z)] }));
}

const webb = await vectors(WEBB.id);
const sun = await vectors("10");
if (webb.length !== sun.length || webb.some((row, i) => row.jd !== sun[i].jd))
  throw new Error("Webb's and the Sun's samples differ");
const round = (km) => Math.round(km / KM) * KM;
const track = webb.flatMap(({ at }, i) => {
  /* Away from the Sun in the ecliptic, then 90° on along Earth's motion, then north. */
  const [sx, sy] = sun[i].at;
  const r = Math.hypot(sx, sy);
  const [ux, uy] = [-sx / r, -sy / r];
  return [round(at[0] * ux + at[1] * uy), round(-at[0] * uy + at[1] * ux), round(at[2])];
});

const data = {
  source:
    "CelesTrak GP element sets (Hubble 20580, Chandra 25867); JPL Horizons, JWST (-170) and the Sun, geocentric, ecliptic of J2000",
  fetched: new Date().toISOString().slice(0, 10),
  satellites: Object.fromEntries(
    await Promise.all(
      Object.entries(SATELLITES).map(async ([id, norad]) => [id, await elements(norad)]),
    ),
  ),
  webb: { start: WEBB.start, stepDays: STEP_DAYS, km: track },
};
await writeFile(OUT, `${JSON.stringify(data)}\n`);
console.log(`Wrote ${OUT.pathname}: Webb ${webb.length} samples`);
