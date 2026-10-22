import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseTables } from "../scripts/fetch-cosmic-data.mjs";
import { readMap } from "../scripts/fetch-dark-universe.mjs";
import {
  actPixel,
  binActRows,
  encodeCmb,
  galacticToIcrs,
  healpixNested,
  projectCmb,
} from "../scripts/lib/cmb-data.mjs";
import { fitsColumns, fitsValue, readFitsHeader } from "../scripts/lib/fits.mjs";
import { roundDecimal, roundEven } from "../scripts/lib/scientific-data.mjs";

const reference = JSON.parse(
  readFileSync(new URL("./fixtures/cmb-import-reference.json", import.meta.url)),
);
function header(cards) {
  return Buffer.from(
    [...cards, "END"]
      .map((card) => card.padEnd(80))
      .join("")
      .padEnd(2880),
    "ascii",
  );
}

// Independent Astropy/HEALPix/WCS samples, retained from the Python→Node migration.
// These cover polar/equatorial faces, longitude wrap and both sides of the z=2/3 seam.
test("native CMB coordinates match independent HEALPix and ICRS/CAR reference samples", () => {
  for (const s of reference.samples) {
    assert.equal(healpixNested(s.l, s.b), s.nested512, `HEALPix at ${s.l},${s.b}`);
    const [ra, dec] = galacticToIcrs(s.l, s.b);
    const delta = ((ra - s.ra + 540) % 360) - 180;
    assert(Math.abs(delta) < 1e-10 && Math.abs(dec - s.dec) < 1e-10);
    assert.deepEqual(actPixel(s.l, s.b, reference.actHeader), s.actPixel);
  }
  assert.throws(() => healpixNested(0, 0, 3));
  assert.throws(() => healpixNested(0, 91));
});

test("FITS parses quoted slashes, apostrophes, exponents and rejects incomplete headers", () => {
  const raw = header([
    "SIMPLE  =                    T",
    "BUNIT   = 'K / pixel' / a comment",
    "OBJECT  = 'O''Brien'",
    "BZERO   =             -1.28D+02",
  ]);
  assert.deepEqual(readFitsHeader(raw), {
    header: { SIMPLE: true, BUNIT: "K / pixel", OBJECT: "O'Brien", BZERO: -128 },
    offset: 2880,
  });
  assert.throws(() => readFitsHeader(raw.subarray(0, 320)), /missing END/);
});

test("FITS table decoding preserves 64-bit identifiers and rejects changed/scaled schemas", () => {
  const h = {
    XTENSION: "BINTABLE",
    TFIELDS: 3,
    NAXIS1: 24,
    TTYPE1: "ID",
    TFORM1: "K",
    TTYPE2: "Z",
    TFORM2: "D",
    TTYPE3: "TYPE",
    TFORM3: "8A",
  };
  const columns = fitsColumns(h),
    row = Buffer.alloc(24, 32);
  row.writeBigInt64BE(9007199254740993n);
  row.writeDoubleBE(0.25, 8);
  row.write("GALAXY", 16);
  assert.equal(String(fitsValue(row, columns.ID)), "9007199254740993");
  assert.equal(fitsValue(row, columns.Z), 0.25);
  assert.equal(fitsValue(row, columns.TYPE), "GALAXY");
  assert.throws(() => fitsColumns({ ...h, TFORM1: "X" }), /Unsupported/);
  assert.throws(() => fitsColumns({ ...h, TSCAL1: 0 }), /Scaled/);
  assert.throws(() => fitsColumns({ ...h, NAXIS1: 25 }), /row size/);
});

test("COSMOS-Web keeps finite signed samples, masks zero padding and rejects truncated data", () => {
  const raw = Buffer.concat([
    header([
      "BITPIX  =                  -32",
      "NAXIS   =                    2",
      "NAXIS1  =                    2",
      "NAXIS2  =                    2",
    ]),
    Buffer.alloc(16),
  ]);
  [0, -0, 0.03125, -0.0625].forEach((value, i) => raw.writeFloatBE(value, 2880 + i * 4));
  assert.deepEqual(readMap(raw), {
    width: 2,
    height: 2,
    scale: 1e-6,
    values: [null, null, 31250, -62500],
  });
  assert.throws(() => readMap(raw.subarray(0, raw.length - 1)), /Truncated/);
  raw.writeFloatBE(-1e-8, 2880);
  assert.equal(readMap(raw).values[0], 0, "Nonzero signal rounded to zero is still observed");
  raw.writeFloatBE(NaN, 2880);
  assert.throws(() => readMap(raw), /Non-finite/);
});

test("arXiv table extraction retains MathML and decodes entities without interpreting their text as markup", () => {
  const tables = parseTables(
    "<table><tr><th>Name</th><th>Position</th></tr><tr><td>A &amp; B &lt; 3</td><td><math><mi>x</mi><mo>±</mo><mn>2</mn></math> &#x2212;1&nbsp;&times; 10</td></tr></table>",
  );
  assert.deepEqual(tables, [
    [
      ["Name", "Position"],
      ["A & B < 3", "x±2 −1 × 10"],
    ],
  ]);
  assert.throws(
    () => parseTables("<table><tr><td>&newentity;</td></tr></table>"),
    /Unknown HTML entity/,
  );
  assert.throws(() => parseTables("<table><tr><td>1</td></tr>"), /Unterminated/);
});

test("native ACT bins reject either adjacent mask row, inpainting, nonfinite signal and the final image edge", () => {
  const h = { NAXIS1: 12, NAXIS2: 12, CRPIX2: 6.5, CDELT2: 0.5 };
  const signal = Buffer.alloc(12 * 6 * 4),
    footprint = Buffer.alloc(12 * 7 * 4),
    inpaint = Buffer.alloc(12 * 7, 128);
  for (let i = 0; i < 12 * 6; i++) signal.writeFloatBE(10 + Math.floor(i / 12), i * 4);
  for (let i = 0; i < 12 * 7; i++) footprint.writeFloatBE(0.99, i * 4);
  const result = binActRows(signal, footprint, inpaint, h, 0);
  assert.deepEqual([...result.good], [1, 1]);
  assert(result.mean[0] > 12.5 && result.mean[0] < 12.51, "cosine-weighted row average");
  // The seventh row contributes only via the WCS half-row offset, not via signal.
  inpaint[6 * 12] = 129;
  assert.deepEqual([...binActRows(signal, footprint, inpaint, h, 0).good], [0, 1]);
  inpaint[6 * 12] = 128;
  footprint.writeFloatBE(0, 6 * 12 * 4);
  assert.deepEqual([...binActRows(signal, footprint, inpaint, h, 0).good], [0, 1]);
  footprint.writeFloatBE(1, 6 * 12 * 4);
  signal.writeFloatBE(NaN, 6 * 4);
  assert.deepEqual([...binActRows(signal, footprint, inpaint, h, 0).good], [1, 0]);
  assert.deepEqual([...binActRows(signal, footprint, inpaint.subarray(0, 72), h, 6).good], [0, 0]);
  inpaint[0] = 0;
  assert.throws(() => binActRows(signal, footprint, inpaint, h, 0), /inpaint flag/);
});

test("CMB reprojection requires all four subpixels and never encodes missing coverage as observed zero", () => {
  const projected = projectCmb((l, b) => [42, !(l <= 22.5 && b > 45)], 4);
  assert.deepEqual([...projected.temperature], Array(8).fill(42));
  assert.equal(projected.valid[0], 0);
  assert.equal(projected.valid[1], 1);
  const rgba = encodeCmb(projected.temperature, projected.valid);
  assert.deepEqual([...rgba.subarray(0, 4)], [128, 0, 0, 255]);
  assert.equal(rgba[6], 255);
  assert.equal(rgba[7], 255);
  assert.throws(() => encodeCmb(new Float32Array([4000]), new Uint8Array([1])), /clip/);
  assert.throws(() => encodeCmb(new Float32Array([NaN]), new Uint8Array([1])), /clip/);
});

test("scientific quantization retains ties-to-even, float32 division and exact decimal rounding", () => {
  assert.deepEqual([0.5, 1.5, 2.5, -0.5, -1.5, -2.5].map(roundEven), [0, 2, 2, 0, -2, -2]);
  assert.equal(roundDecimal(2.675, 2), 2.67);
  assert.equal(roundDecimal(1.125, 2), 1.12);
  assert.equal(roundDecimal(-1.125, 2), -1.12);
  assert.equal(roundDecimal(123.456789123, 6), 123.456789);
  const rgba = encodeCmb(
    new Float32Array([0.05, 0.15, 0.25, -0.05, -0.15, -0.25]),
    new Uint8Array(6).fill(1),
  );
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => rgba[i * 4] * 256 + rgba[i * 4 + 1] - 32768),
    [0, 2, 2, 0, -2, -2],
  );
});
