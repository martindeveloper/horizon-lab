/**
 * Refresh the published COSMOS-Web convergence snapshot.
 * node scripts/fetch-dark-universe.mjs [--cache /tmp/horizon-dark-universe] [--output /tmp/review]
 * Scientific FITS data, not an illustration. Exact zero is exterior padding,
 * preserved as null. No WCS is supplied: never invent RA/Dec or place it in 3D.
 * Review the pinned URL, units and mask convention when updating the release.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { readFitsHeader } from "./lib/fits.mjs";
import { fetchCached } from "./lib/net.mjs";
import { root, roundEven, sha256, writeJson } from "./lib/scientific-data.mjs";

const URL =
  "https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41550-025-02763-9/MediaObjects/41550_2025_2763_MOESM4_ESM.fits";

export function readMap(raw) {
  const { header: h, offset } = readFitsHeader(raw);
  assert.equal(h.BITPIX, -32);
  assert.equal(h.NAXIS, 2);
  assert.equal(h.BSCALE ?? 1, 1);
  assert.equal(h.BZERO ?? 0, 0);
  const width = h.NAXIS1,
    height = h.NAXIS2;
  assert(raw.length >= offset + width * height * 4, "Truncated convergence map");
  const values = Array.from({ length: width * height }, (_, i) => {
    const value = raw.readFloatBE(offset + i * 4);
    assert(Number.isFinite(value), "Non-finite convergence sample");
    return value === 0 ? null : roundEven(value * 1e6);
  });
  return { width, height, scale: 1e-6, values };
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      cache: { type: "string", default: "/tmp/horizon-dark-universe" },
      output: { type: "string", default: root },
    },
  });
  const raw = readFileSync(
    await fetchCached(URL, args.cache, { verify: (file) => readMap(readFileSync(file)) }),
  );
  const data = readMap(raw);
  const { width, height, values } = data;
  const snapshotSha256 = writeJson(
    join(args.output, "public/data/deep-field/cosmos-web.json"),
    data,
  );
  const valid = values.filter((v) => v !== null);
  const manifest = {
    reviewed: "2026-10-22",
    publication: "published",
    referenceUrl: "https://doi.org/10.1038/s41550-025-02763-9",
    dataUrl: URL,
    sha256: sha256(raw),
    snapshotSha256,
    width,
    height,
    validPixels: valid.length,
    min: valid.reduce((a, b) => Math.min(a, b), Infinity) * 1e-6,
    max: valid.reduce((a, b) => Math.max(a, b), -Infinity) * 1e-6,
    quantity: "JWST E-mode convergence kappa; projected total mass, not dark matter alone",
    processing: "Original grid; zero exterior masked; quantized to 1e-6; no WCS supplied",
  };
  writeJson(join(args.output, "src/space/cosmos/model/data/cosmos-web-source.json"), manifest);
  console.log(`Imported ${width} x ${height}; ${valid.length} unmasked samples`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
