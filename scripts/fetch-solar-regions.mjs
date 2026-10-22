/**
 * Fetches the NOAA/SWPC Solar Region Summaries for the dates of the HMI discs the Sun's map is
 * built from (`scripts/lib/sun-map.mjs`, 1–22 May 2024) and writes
 * src/space/sun/model/regions-2024-05.json: every sunspot region as the mosaic shows it, from
 * the report of the disc on which it stood nearest the central meridian (where the mosaic
 * sampled it): NOAA number, heliographic latitude, Stonyhurst longitude (west positive),
 * Carrington longitude, area (millionths of a hemisphere), McIntosh and Hale classes, and the
 * Carrington longitude of the central meridian on each date. Run by hand if the map's discs change:
 *
 *   node --import tsx scripts/fetch-solar-regions.mjs
 */
import { writeFile } from "node:fs/promises";

import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

import { fetchText } from "./lib/net.mjs";
import { HMI_SOURCES } from "./lib/sun-map.mjs";

const OUT = new URL("../src/space/sun/model/regions-2024-05.json", import.meta.url);
/** The mosaic samples a disc to μ ≥ 0.25: about 75° from its centre. */
const MAX_FROM_CENTRE_DEG = (Math.acos(0.25) * 180) / Math.PI;

/** The SRS of a date holds locations valid at that date's 00:00 UT (its header says "Valid at <previous day>/2400Z"). */
const reportUrl = (date) => {
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${DOWNLOAD_URLS.swpcRegionSummaries}/${y}/${m}/${y}${m}${d}SRS.txt`;
};

/** "S17W48" → latitude −17, Stonyhurst longitude +48 (west positive). */
function parseLocation(text) {
  const m = /^([NS])(\d\d)([EW])(\d\d)$/.exec(text);
  if (!m) throw new Error(`SRS: location ${text}`);
  const lat = (m[1] === "N" ? 1 : -1) * Number(m[2]);
  const lon = (m[3] === "W" ? 1 : -1) * Number(m[4]);
  return { lat, lon };
}

/** Section I of a report: regions with sunspots. */
function parseRegions(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("I.  Regions with Sunspots"));
  const rows = [];
  for (let i = start + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("IA.") || line.startsWith("II.")) break;
    if (line.startsWith("None")) break;
    const [nmbr, location, lo, area, z, ll, nn, mag] = line.split(/\s+/);
    const { lat, lon } = parseLocation(location);
    rows.push({
      number: 10_000 + Number(nmbr),
      lat,
      stonyhurstLon: lon,
      carringtonLon: Number(lo),
      areaMsh: Number(area),
      mcintosh: z,
      extentDeg: Number(ll),
      spots: Number(nn),
      hale: mag,
    });
  }
  return rows;
}

const dates = HMI_SOURCES.map((source) => source.date);
const reports = [];
for (const date of dates) {
  const text = await fetchText(reportUrl(date));
  const regions = parseRegions(text);
  /* The central meridian's Carrington longitude: every row gives it as Lo − W. */
  const l0 =
    regions.reduce(
      (sum, r) => sum + ((((r.carringtonLon - r.stonyhurstLon) % 360) + 360) % 360),
      0,
    ) / regions.length;
  reports.push({ date, centralMeridianCarringtonLon: Number(l0.toFixed(1)), regions });
  console.warn(`${date}: ${regions.length} regions, L0 = ${l0.toFixed(1)}°`);
}

/* Each region as the disc nearest its central-meridian passage shows it. */
const best = new Map();
for (const report of reports)
  for (const region of report.regions) {
    const distance = Math.abs(region.stonyhurstLon);
    if (distance > MAX_FROM_CENTRE_DEG) continue;
    const current = best.get(region.number);
    if (!current || distance < Math.abs(current.stonyhurstLon))
      best.set(region.number, { ...region, date: report.date });
  }
const regions = [...best.values()].sort((a, b) => a.number - b.number);

const data = {
  source:
    "NOAA/SWPC Joint USAF/NOAA Solar Region Summary (SRS), archived by NOAA NCEI: regions with sunspots at 00:00 UT of each HMI disc the map is built from",
  reference: "NOAA Space Weather Prediction Center, Solar Region Summary; NCEI archive",
  urls: dates.map(reportUrl),
  fetched: new Date().toISOString().slice(0, 10),
  note: `Each region from the disc on which it stood nearest the central meridian, within ${MAX_FROM_CENTRE_DEG.toFixed(0)}° of it; numbers are the full NOAA numbers; longitudes in degrees, Stonyhurst west positive; areas in millionths of a hemisphere`,
  reports: reports.map(({ date, centralMeridianCarringtonLon }) => ({
    date,
    centralMeridianCarringtonLon,
  })),
  regions,
};
await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.warn(`Wrote ${OUT.pathname}: ${regions.length} regions`);
