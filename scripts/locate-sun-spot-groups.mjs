/** node --import tsx scripts/locate-sun-spot-groups.mjs
 * Finds the spot groups in the Sun Lab's published photograph (the same near tier the close-up
 * stencil is cut from) and matches each NOAA/SWPC region (`regions-2024-05.json`) to the group
 * nearest its report, writing src/space/sun/model/spot-groups-2024-05.json: every group's centre,
 * reach and spot area as photographed, and its NOAA number where one matches. The reports place a
 * group at 00:00 UT of a disc; the mosaic may show it from another disc, a few degrees away, so
 * the model seeds each group where the photograph has it. Requires the CDN mirror (npm run
 * cdn:pull); offline, no network.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { MAPS, mapFile } from "@horizon/toolkit/bodies";

import { MAPS_KEY } from "../src/lib/assets.ts";
import { SUN_MAP_QUIET_INTENSITY } from "../src/space/solar-system/model/parameters.ts";
import REPORTS from "../src/space/sun/model/regions-2024-05.json" with { type: "json" };
import { SRGB_TO_LINEAR } from "./lib/colour.mjs";
import { spotComponents } from "./lib/sun-spot-stencil.mjs";

const OUT = new URL("../src/space/sun/model/spot-groups-2024-05.json", import.meta.url);
const DEG = Math.PI / 180;
/** Spots whose nearest edges are closer than this, degrees, belong to one group. */
const GROUP_GAP_DEG = 1.5;
/** A report is matched to the nearest group whose centre lies within this, degrees. */
const MATCH_DEG = 8;
/** Groups smaller than this, millionths of a hemisphere, are left out. */
const MIN_AREA_MSH = 3;

const sourceFile = mapFile(MAPS_KEY, "sun", "near");
const source = await readFile(new URL(`../cdn${sourceFile}`, import.meta.url));
const sourceSha256 = createHash("sha256").update(source).digest("hex");
// The stencil's pin: the groups and the close-up stencil come from the same photograph.
if (sourceSha256 !== "51a3fd1763a7c9f080bcf9945537bdae3c08d1793509e155c28fadffaca4bc00")
  throw new Error("The published Sun photograph changed; review the groups before relocating");
const { data, info } = await sharp(source)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height } = info;
const intensity = Float32Array.from(
  { length: width * height },
  (_, i) => SRGB_TO_LINEAR[data[i * info.channels]] / SUN_MAP_QUIET_INTENSITY,
);
const { mask } = spotComponents(intensity, width, height);

/** A pixel's centre: Carrington longitude (u, east increasing) and latitude (v from the south), radians. */
const lonOf = (x) => ((x + 0.5) / width) * 2 * Math.PI;
const latOf = (y) => (0.5 - (y + 0.5) / height) * Math.PI;
const unit = (lat, lon) => [
  Math.cos(lat) * Math.cos(lon),
  Math.sin(lat),
  Math.cos(lat) * Math.sin(lon),
];
const angle = (a, b) =>
  Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
/** A pixel's solid angle, steradians. */
const pixelArea = (y) => ((2 * Math.PI) / width) * (Math.PI / height) * Math.cos(latOf(y));

/* The spots: the stencil's masked pixels, joined across their 4-neighbours, longitude wrapping. */
const label = new Int32Array(width * height).fill(-1);
const spots = [];
const queue = new Int32Array(width * height);
for (let i = 0; i < mask.length; i++) {
  if (!mask[i] || label[i] >= 0) continue;
  const id = spots.length;
  let head = 0;
  let tail = 1;
  queue[0] = i;
  label[i] = id;
  const pixels = [];
  while (head < tail) {
    const p = queue[head++];
    pixels.push(p);
    const x = p % width;
    for (const n of [
      p + (x === 0 ? width - 1 : -1),
      p + (x === width - 1 ? 1 - width : 1),
      p - width,
      p + width,
    ])
      if (n >= 0 && n < mask.length && mask[n] && label[n] < 0) {
        label[n] = id;
        queue[tail++] = n;
      }
  }
  spots.push(pixels);
}

/** A set of pixels' area-weighted centre, the farthest pixel from it (radians) and its area (sr). */
function measure(pixels) {
  const sum = [0, 0, 0];
  let area = 0;
  for (const p of pixels) {
    const y = Math.floor(p / width);
    const w = pixelArea(y);
    const v = unit(latOf(y), lonOf(p % width));
    sum[0] += v[0] * w;
    sum[1] += v[1] * w;
    sum[2] += v[2] * w;
    area += w;
  }
  const n = Math.hypot(...sum);
  const centre = sum.map((c) => c / n);
  let reach = 0;
  for (const p of pixels)
    reach = Math.max(reach, angle(centre, unit(latOf(Math.floor(p / width)), lonOf(p % width))));
  /* Half a pixel's diagonal past the farthest centre: the spot's edge. */
  return { centre, reach: reach + Math.PI / height, area };
}

/* Groups: spots joined while their nearest edges stand within GROUP_GAP_DEG (single linkage). */
const measured = spots.map(measure);
const parent = measured.map((_, i) => i);
const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
for (let a = 0; a < measured.length; a++)
  for (let b = a + 1; b < measured.length; b++) {
    const gap =
      angle(measured[a].centre, measured[b].centre) - measured[a].reach - measured[b].reach;
    if (gap < GROUP_GAP_DEG * DEG) parent[root(a)] = root(b);
  }
const members = new Map();
measured.forEach((_, i) => members.set(root(i), [...(members.get(root(i)) ?? []), i]));
const groups = [...members.values()]
  .map((ids) => ({ spots: ids.length, ...measure(ids.flatMap((i) => spots[i])) }))
  .map((group) => ({ ...group, areaMsh: (group.area / (2 * Math.PI)) * 1e6 }))
  .filter((group) => group.areaMsh >= MIN_AREA_MSH)
  .sort((a, b) => b.areaMsh - a.areaMsh);

/* Each report to the nearest free group within MATCH_DEG, closest pairs first. */
const pairs = [];
for (const report of REPORTS.regions) {
  const at = unit(report.lat * DEG, report.carringtonLon * DEG);
  groups.forEach((group, g) => {
    const distance = angle(at, group.centre);
    if (distance < MATCH_DEG * DEG) pairs.push({ number: report.number, g, distance });
  });
}
pairs.sort((a, b) => a.distance - b.distance);
const numberOf = new Map();
const matched = new Set();
for (const { number, g, distance } of pairs) {
  if (numberOf.has(g) || matched.has(number)) continue;
  numberOf.set(g, { number, offsetDeg: distance / DEG });
  matched.add(number);
}

const round = (value, digits) => Number(value.toFixed(digits));
const out = {
  source: `The Sun Lab's photograph (${MAPS.sun.source}), near tier, sha256 ${sourceSha256}`,
  method: `the close-up stencil's spot mask (penumbra and umbra), spots joined into groups while their edges stand within ${GROUP_GAP_DEG}°; each SWPC report matched to the nearest group centre within ${MATCH_DEG}°`,
  sourceFile,
  groups: groups.map((group, g) => ({
    number: numberOf.get(g)?.number ?? null,
    lat: round(Math.asin(group.centre[1]) / DEG, 3),
    carringtonLon: round(
      (((Math.atan2(group.centre[2], group.centre[0]) / DEG) % 360) + 360) % 360,
      3,
    ),
    reachDeg: round(group.reach / DEG, 3),
    areaMsh: round(group.areaMsh, 1),
    spots: group.spots,
    reportOffsetDeg: numberOf.has(g) ? round(numberOf.get(g).offsetDeg, 2) : null,
  })),
};
await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`);
const unmatched = REPORTS.regions.filter((r) => !matched.has(r.number)).map((r) => r.number);
const unmatchedNote = unmatched.length ? `; unmatched: ${unmatched.join(", ")}` : "";
console.log(
  `${groups.length} groups from ${spots.length} spots; ${matched.size} reports matched${unmatchedNote}`,
);
for (const group of out.groups.slice(0, 30))
  console.log(
    `${String(group.number ?? "—").padStart(5)}  ${String(group.areaMsh).padStart(7)} MSH  reach ${group.reachDeg}°  ` +
      `lat ${group.lat}  CarrLon ${group.carringtonLon}  spots ${group.spots}  offset ${group.reportOffsetDeg ?? "—"}°`,
  );
