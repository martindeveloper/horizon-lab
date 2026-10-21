/** Reproduce the shipped atmosphere subset from the corrected CDS table; no network at build time. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const input = process.argv[2];
if (!input)
  throw new Error("Usage: node scripts/import-giants-limb-grid.mjs tableeq5.dat [--check]");
const source = await readFile(input);
assert.equal(
  createHash("sha256").update(source).digest("hex"),
  "f352ec50f0ec8214a78d17f4729b394e36a4b46a36f139325f08c91b79f83b24",
  "Expected the corrected 2011-06-17 CDS tableeq5.dat; review a changed source before importing",
);
const selected = new Map();
for (const line of source.toString("utf8").trim().split(/\r?\n/)) {
  const [g, T, Z, xi, a1, a2, a3, a4, band, method, model] = line.trim().split(/\s+/);
  if (+Z !== 0 || +xi !== 2 || method !== "L" || !["R", "V", "B"].includes(band)) continue;
  if (model !== "ATLAS" && !(model === "PHOENIX" && +T < 3500)) continue;
  const key = `${model}:${T}:${g}`;
  if (!selected.has(key)) selected.set(key, [model, +T, +g, null, null, null]);
  const row = selected.get(key);
  const channel = 3 + ["R", "V", "B"].indexOf(band);
  assert.equal(row[channel], null, `Duplicate passband for ${key}`);
  row[channel] = [a1, a2, a3, a4].map(Number);
}
const rows = [...selected.values()].sort(
  (a, b) => a[0].localeCompare(b[0]) || a[1] - b[1] || a[2] - b[2],
);
assert.equal(rows.length, 508);
assert.ok(rows.every((row) => row.slice(3).every((channel) => channel?.every(Number.isFinite))));
const output = new URL("../src/features/giants/lib/model/limb-grid.json", import.meta.url);
const current = JSON.parse(await readFile(output, "utf8"));
if (process.argv.includes("--check")) {
  assert.deepEqual(rows, current.rows);
  console.log(`Verified ${rows.length} atmosphere models against the CDS source.`);
} else {
  await writeFile(output, `${JSON.stringify({ ...current, rows }, null, 2)}\n`);
  console.log(`Imported ${rows.length} atmosphere models; run Oxfmt on limb-grid.json.`);
}
