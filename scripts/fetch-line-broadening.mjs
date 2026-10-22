/**
 * Fetches Barklem, Piskunov & O'Mara's (2000) cross-sections for the broadening of metal lines
 * by collisions with neutral hydrogen (the ABO theory: Anstee, Barklem & O'Mara) from CDS, and
 * writes src/features/spectroscopy/lib/model/broadening.json: for each of the lab's lines the
 * table covers, the full width per hydrogen atom at 10,000 K and its temperature exponent,
 * γ = γ₁₀₀₀₀ (T / 10⁴ K)^((1 − α)/2) n_H. Run by hand after scripts/fetch-atomic-data.mjs:
 *
 *   node scripts/fetch-line-broadening.mjs
 *
 * A lab line takes the table's line of the same species nearest its wavelength, within 0.05 nm
 * (the lab merges closer fine-structure components) and with the same lower level (0.02 eV).
 */
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

const URL_TABLE = DOWNLOAD_URLS.lineBroadening;
const LINES = new URL("../src/features/spectroscopy/lib/model/atomic-data.json", import.meta.url);
const OUT = new URL("../src/features/spectroscopy/lib/model/broadening.json", import.meta.url);
const ATOMIC_NUMBER = { He: 2, Li: 3, Na: 11, Mg: 12, K: 19, Ca: 20, Fe: 26 };
const ROMAN = ["I", "II", "III"];

const res = await fetch(URL_TABLE);
if (!res.ok) throw new Error(`Barklem et al. table: HTTP ${res.status}`);
const rows = gunzipSync(Buffer.from(await res.arrayBuffer()))
  .toString("latin1")
  .split("\n")
  .filter((row) => row.trim())
  .map((row) => {
    /* Byte columns from the catalogue's ReadMe. */
    const field = (from, to) => Number.parseFloat(row.slice(from - 1, to));
    const entry = {
      spec: field(1, 5),
      nm: field(7, 16) / 10,
      lower: field(28, 34),
      logGamma: field(105, 110),
      exponent: field(112, 116),
    };
    if (Object.values(entry).some((v) => !Number.isFinite(v)))
      throw new Error(`Malformed row: ${row}`);
    return entry;
  });

const { lines } = JSON.parse(await readFile(LINES, "utf8"));
const out = [];
for (const [species, nm, , lower] of lines) {
  const [symbol, stage] = species.split(" ");
  const z = ATOMIC_NUMBER[symbol];
  if (!z) continue;
  const spec = z + ROMAN.indexOf(stage) * 0.01;
  let best;
  for (const row of rows) {
    if (Math.abs(row.spec - spec) > 1e-3 || Math.abs(row.nm - nm) > 0.05) continue;
    /* Ions' rows were computed directly and give no level energies (−1). */
    if (row.lower >= 0 && Math.abs(row.lower - lower) > 0.02) continue;
    if (!best || Math.abs(row.nm - nm) < Math.abs(best.nm - nm)) best = row;
  }
  if (best) out.push([species, nm, best.logGamma, best.exponent]);
}

await writeFile(
  OUT,
  `${JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), lines: out })}\n`,
);
console.log(`${out.length} of ${lines.length} lines → ${OUT.pathname}`);
