/**
 * Refresh Deep Field's pinned observational data with Node's standard library.
 * node scripts/fetch-cosmic-data.mjs [--cache /tmp/horizon-cosmic-data] [--output /tmp/review]
 * Network access is confined to this manual importer; builds use committed JSON.
 * Review versioned URLs/publication states, schemas, units and hashes together.
 * Never silently advance an arXiv version. DESI is a reproducible sparse sample,
 * NOT volume complete or a footprint mask. HTTP ranges avoid a 9 GB download.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";

import { fitsColumns, fitsValue, readFitsHeader } from "./lib/fits.mjs";
import { root, roundDecimal, sha256, writeJson } from "./lib/scientific-data.mjs";

const REVIEWED = "2026-10-22";
const SOURCES = {
  cf4: [
    "https://cdsarc.cds.unistra.fr/ftp/J/ApJ/944/94/table3.dat.gz",
    "published",
    "Tully et al. 2023; CDS table 3",
  ],
  classix: [
    "https://cdsarc.cds.unistra.fr/ftp/J/A+A/695/A59/clusters.dat",
    "published",
    "Böhringer et al. 2025; CDS clusters.dat",
  ],
  basins: ["https://arxiv.org/html/2409.17261v1", "published", "Valade et al. 2024; Table 1"],
  vela: [
    "https://arxiv.org/html/2603.09339v2",
    "accepted",
    "Hollinger et al. 2026; accepted by A&A 2026-06-22; Table 2",
  ],
  voids: [
    "https://arxiv.org/html/2606.13538v1",
    "preprint",
    "Hollinger & Courtois 2026; Tables A.1 and A.2",
  ],
  sloan: [
    "https://arxiv.org/html/2606.04578v1",
    "preprint",
    "Pomarède et al. 2026; interpretation of the Valade et al. reconstruction",
  ],
  south: [
    "https://arxiv.org/html/2007.04414v1",
    "published",
    "Pomarède et al. 2020; South Pole peak, section III",
  ],
  desi: [
    "https://data.desi.lbl.gov/public/dr1/spectro/redux/iron/zcatalog/v1/zpix-main-bright.fits",
    "published",
    "DESI DR1, iron zcatalog v1 (2026-07-10)",
  ],
};

/** Pinned arXiv tables only. Keep nested MathML text; reject unknown entities/schema changes. */
export function parseTables(html) {
  const entities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00a0",
    times: "×",
    middot: "·",
  };
  const decode = (text) =>
    text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
      if (entity.startsWith("#"))
        return String.fromCodePoint(
          entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)),
        );
      assert(
        Object.hasOwn(entities, entity),
        `Unknown HTML entity &${entity}; review source table`,
      );
      return entities[entity];
    });
  const tables = [];
  let table = null,
    row = null,
    cell = null;
  const tokens = html.match(/<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])*>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (!token.startsWith("<")) {
      if (cell !== null) cell += decode(token);
      continue;
    }
    const tag = /^<(\/?)([a-z][\w:-]*)\b/i.exec(token);
    if (!tag) continue;
    const end = tag[1] === "/",
      name = tag[2].toLowerCase();
    if (!end) {
      if (name === "table") {
        assert(table === null, "Nested source table unsupported");
        table = [];
      }
      if (name === "tr") row = [];
      if (name === "td" || name === "th") cell = "";
    } else {
      if ((name === "td" || name === "th") && cell !== null) {
        row?.push(cell.trim().replace(/\s+/g, " "));
        cell = null;
      }
      if (name === "tr" && row !== null) {
        table?.push(row);
        row = null;
      }
      if (name === "table" && table !== null) {
        tables.push(table);
        table = null;
      }
    }
  }
  assert(table === null, "Unterminated source table");
  return tables;
}

const numbers = (text) => (text.match(/[-+]?\d+(?:\.\d+)?/g) ?? []).map(Number);
function numeric(text) {
  assert(text.trim() && Number.isFinite(Number(text)), `Invalid source number ${text}`);
  return Number(text);
}
function tableOf(tables, rows) {
  const matches = tables.filter((t) => t.length === rows);
  assert.equal(matches.length, 1, `Expected one ${rows}-row source table`);
  return matches[0];
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      cache: { type: "string", default: "/tmp/horizon-cosmic-data" },
      output: { type: "string", default: root },
    },
  });
  mkdirSync(args.cache, { recursive: true });
  const output = join(args.output, "src/space/cosmos/model/data");
  async function get(key, range) {
    const url = SOURCES[key][0];
    const path = join(
      args.cache,
      sha256(url).slice(0, 16) + (range ? `-${range[0]}-${range[1]}` : ""),
    );
    if (existsSync(path)) {
      const data = readFileSync(path);
      if (range) assert.equal(data.length, range[1] - range[0] + 1, "Truncated cached FITS range");
      return data;
    }
    let data;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await fetch(url, {
          headers: range ? { Range: `bytes=${range[0]}-${range[1]}` } : {},
          signal: AbortSignal.timeout(60_000),
        });
        assert(response.ok, `HTTP ${response.status}: ${url}`);
        if (range) {
          assert.equal(response.status, 206, "Server did not honour FITS range");
          assert(
            response.headers.get("content-range")?.startsWith(`bytes ${range[0]}-${range[1]}/`),
            "Unexpected FITS range",
          );
        }
        data = Buffer.from(await response.arrayBuffer());
        if (range) assert.equal(data.length, range[1] - range[0] + 1, "Truncated FITS range");
        break;
      } catch (error) {
        if (attempt === 4 || error.code === "ERR_ASSERTION") throw error;
        await setTimeout(1000 * 2 ** attempt);
      }
    }
    writeFileSync(`${path}.part`, data);
    renameSync(`${path}.part`, path);
    return data;
  }
  const raw = {};
  for (const key of Object.keys(SOURCES)) if (key !== "desi") raw[key] = await get(key);
  const tables = Object.fromEntries(
    ["basins", "vela", "voids"].map((key) => [key, parseTables(raw[key].toString())]),
  );
  const cf4 = gunzipSync(raw.cf4)
    .toString()
    .trimEnd()
    .split(/\r?\n/)
    .map((line) => [
      numeric(line.slice(0, 7)),
      numeric(line.slice(34, 42)),
      numeric(line.slice(43, 51)),
      numeric(line.slice(28, 33)),
      numeric(line.slice(8, 14)),
      line.slice(22, 27).trim() ? numeric(line.slice(22, 27)) : null,
    ]);
  assert.equal(cf4.length, 38053);
  const classix = raw.classix
    .toString()
    .trimEnd()
    .split(/\r?\n/)
    .map((line) => {
      // Actual CDS layout differs by one byte from the ReadMe; fields are unambiguous.
      const fields = line.trim().split(/\s+/);
      assert.equal(fields.length, 7);
      return [fields[0], ...fields.slice(1, 5).map(numeric)];
    });
  assert.equal(classix.length, 185);
  assert.equal(classix.filter((r) => r[1] === 1).length, 68);
  const basins = tableOf(tables.basins, 20)
    .slice(3)
    .map((r) => ({
      name: r[0],
      probability: numeric(r[1]),
      sg: r.slice(2, 5).map((v) => numbers(v)[0]),
      sigma: r.slice(2, 5).map((v) => numbers(v)[1]),
      volume: numeric(r[8]) * 1e6,
    }));
  const voids = tableOf(tables.voids, 39)
    .slice(2)
    .map((r) => {
      const [v, robustV] = numbers(r[7]),
        [radius, robustRadius] = numbers(r[8]);
      return {
        id: numeric(r[0]),
        sg: numbers(r[6]),
        radius,
        robustRadius,
        volume: v * 1000,
        robustVolume: robustV * 1000,
      };
    });
  const knots = tableOf(tables.voids, 44)
    .slice(2)
    .map((r) => {
      const [v, robustV] = numbers(r[7]);
      return {
        id: numeric(r[0]),
        name: r[1],
        sg: numbers(r[6]),
        volume: v * 1000,
        robustVolume: robustV * 1000,
        mass: numbers(r[8])[0] * 1e15,
      };
    });
  // Use Cartesian columns, not the inconsistent declinations in Table 1.
  const vr = tables.vela.flat().find((r) => r[0] === "Vela");
  assert(vr, "Missing Vela row");
  const vela = {
    sg: numbers(vr[2]).slice(0, 3),
    mass: numbers(vr[3])[0] * 1e16,
    volume: numbers(vr[4])[0] * 1e5,
  };
  for (const entry of [...basins, ...voids, ...knots, vela]) {
    assert.equal(entry.sg.length, 3);
    assert(
      entry.sg.every(Number.isFinite) && Number.isFinite(entry.volume),
      "Invalid reconstruction row",
    );
  }

  const header = await get("desi", [0, 57599]);
  const primary = readFitsHeader(header);
  assert.equal(primary.header.NAXIS, 0);
  const { header: h, offset: start } = readFitsHeader(header, primary.offset);
  assert.equal(h.EXTNAME, "ZCATALOG");
  const columns = fitsColumns(h),
    stride = h.NAXIS1;
  for (const name of [
    "TARGETID",
    "TARGET_RA",
    "TARGET_DEC",
    "Z",
    "ZWARN",
    "SPECTYPE",
    "DELTACHI2",
    "COADD_FIBERSTATUS",
    "ZCAT_PRIMARY",
    "HEALPIX",
  ])
    assert(columns[name], `Missing column ${name}`);
  const blocks = 128,
    rowsPerBlock = 256,
    desi = [],
    seen = new Set(),
    digest = createHash("sha256").update(header);
  const starts = Array.from({ length: blocks }, (_, i) =>
    Math.floor((i * (h.NAXIS2 - rowsPerBlock)) / (blocks - 1)),
  );
  // Three downloads at a time, always decode and hash in deterministic block order.
  for (let block = 0; block < blocks; block += 3) {
    const batch = await Promise.all(
      starts.slice(block, block + 3).map((first) => {
        const lo = start + first * stride;
        return get("desi", [lo, lo + rowsPerBlock * stride - 1]);
      }),
    );
    for (const data of batch) {
      digest.update(data);
      for (let n = 0; n < rowsPerBlock; n++) {
        const row = data.subarray(n * stride, (n + 1) * stride);
        const value = (key) => fitsValue(row, columns[key]);
        if (
          !value("ZCAT_PRIMARY") ||
          value("SPECTYPE") !== "GALAXY" ||
          value("ZWARN") !== 0n ||
          value("COADD_FIBERSTATUS") !== 0 ||
          value("DELTACHI2") < 40
        )
          continue;
        const z = value("Z"),
          tid = String(value("TARGETID"));
        if (!(0.1 < z && z <= 0.4) || seen.has(tid)) continue;
        seen.add(tid);
        desi.push([
          tid,
          roundDecimal(value("TARGET_RA"), 6),
          roundDecimal(value("TARGET_DEC"), 6),
          roundDecimal(z, 7),
          value("HEALPIX"),
        ]);
      }
    }
  }
  assert(desi.length > 500);
  const rangeHash = digest.digest("hex");
  const meta = Object.fromEntries(
    Object.entries(SOURCES).map(([key, [url, publication, version]]) => [
      key,
      {
        url,
        publication,
        version,
        reviewed: REVIEWED,
        sha256: raw[key] ? sha256(raw[key]) : rangeHash,
        referenceUrl: url.replace("/html/", "/abs/"),
      },
    ]),
  );
  meta.cf4.referenceUrl = "https://cdsarc.cds.unistra.fr/ftp/J/ApJ/944/94/ReadMe";
  meta.classix.referenceUrl = "https://cdsarc.cds.unistra.fr/ftp/J/A+A/695/A59/ReadMe";
  meta.desi.referenceUrl = "https://data.desi.lbl.gov/doc/releases/dr1/";
  meta.cf4.rows = cf4.length;
  meta.classix.rows = classix.length;
  Object.assign(meta.desi, {
    selection:
      "128 uniformly spaced 256-row blocks; unique primary GALAXY; ZWARN=0; COADD_FIBERSTATUS=0; DELTACHI2>=40; 0.1<z<=0.4",
    rowsExamined: blocks * rowsPerBlock,
    catalogueRows: h.NAXIS2,
    sampleRows: desi.length,
  });
  const products = {
    cf4: {
      columns: ["pgc", "raDeg", "decDeg", "czCmbKms", "distanceModulus", "modulusError"],
      rows: cf4,
    },
    classix: { columns: ["name", "structureId", "raDeg", "decDeg", "z"], rows: classix },
    desi: { columns: ["targetId", "raDeg", "decDeg", "z", "healpix"], rows: desi },
    reconstructions: {
      coordinateUnit: "h^-1 Mpc",
      volumeUnit: "h^-3 Mpc^3",
      basins,
      voids,
      knots,
      vela,
    },
    sources: meta,
  };
  for (const [name, product] of Object.entries(products))
    writeJson(join(output, `${name}.json`), product);
  console.log(
    `Imported ${cf4.length} CF4 groups, ${classix.length} CLASSIX clusters, ${desi.length} sampled DESI galaxies, ${basins.length} basins, ${voids.length} voids and ${knots.length} knots.`,
  );
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
