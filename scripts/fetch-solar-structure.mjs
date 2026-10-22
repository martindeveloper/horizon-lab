/**
 * Fetches Model S, the standard solar model of Christensen-Dalsgaard et al. 1996 (Science 272,
 * 1286), from its author's Aarhus page (the FGONG table `fgong.l5bi.d.15c`; the Internet
 * Archive's copy when that page is unreachable) and writes src/space/sun/model/structure.json:
 * the run of temperature, density, pressure, luminosity, hydrogen mass fraction and opacity
 * with radius, resampled from the model's 2,482 mesh points to 120 radii, denser towards the
 * surface where the gradients steepen, in SI. Run by hand when the resampling changes:
 *
 *   node --import tsx scripts/fetch-solar-structure.mjs
 */
import { writeFile } from "node:fs/promises";

import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

import { fetchText } from "./lib/net.mjs";

const OUT = new URL("../src/space/sun/model/structure.json", import.meta.url);
/** Radii kept: evenly through the interior, then log-spaced in depth below the photosphere. */
const INTERIOR_STEPS = 72;
const INTERIOR_TOP = 0.9;
const SURFACE_STEPS = 48;
const SHALLOWEST_DEPTH = 1e-4;
/** Significant figures kept: the model is quoted to about this. */
const DIGITS = 5;
/** FGONG columns (1-based in the format's description): r, T, P, ρ, X, L_r, κ. */
const COLUMN = { r: 1, T: 3, P: 4, rho: 5, X: 6, L: 7, kappa: 8 };
/** Fixed-width FGONG numbers. */
const FIELD_WIDTH = 16;

async function fetchModel() {
  try {
    return { text: await fetchText(DOWNLOAD_URLS.modelS), url: DOWNLOAD_URLS.modelS };
  } catch (error) {
    console.warn(`${error.message}; reading the Internet Archive's copy`);
    return { text: await fetchText(DOWNLOAD_URLS.modelSArchive), url: DOWNLOAD_URLS.modelSArchive };
  }
}

/** The FGONG file: four title lines, counts, global constants, then each mesh point's variables. */
function parseFgong(text) {
  const lines = text.split(/\r?\n/);
  const [points, constants, variables] = lines[4].trim().split(/\s+/).map(Number);
  const numbers = [];
  for (const line of lines.slice(5)) {
    for (let at = 0; at < line.length; at += FIELD_WIDTH) {
      const field = line.slice(at, at + FIELD_WIDTH).trim();
      if (field) numbers.push(Number(field.replace("D", "E")));
    }
  }
  if (numbers.length !== constants + points * variables)
    throw new Error(
      `FGONG: expected ${constants + points * variables} numbers, read ${numbers.length}`,
    );
  const globals = numbers.slice(0, constants);
  const rows = [];
  for (let i = 0; i < points; i++)
    rows.push(numbers.slice(constants + i * variables, constants + (i + 1) * variables));
  return { title: lines.slice(0, 4).map((line) => line.trim()), globals, rows };
}

const significant = (value) => Number(value.toPrecision(DIGITS));

/** Linear interpolation of a column over x, in the log of positive quantities where asked. */
function sampler(points, column, logarithmic) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => (logarithmic ? Math.log(p[column]) : p[column]));
  return (x) => {
    let hi = xs.findIndex((value) => value >= x);
    if (hi <= 0) hi = hi === 0 ? 1 : xs.length - 1;
    const lo = hi - 1;
    const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
    const y = ys[lo] + (ys[hi] - ys[lo]) * t;
    return logarithmic ? Math.exp(y) : y;
  };
}

const { text, url } = await fetchModel();
const { title, globals, rows } = parseFgong(text);
const [massG, radiusCm, luminosityErgS] = globals;

/* Centre to photosphere (the FGONG mesh runs the other way), in r/R, SI and L/L_model. */
const points = rows
  .map((row) => ({
    x: row[COLUMN.r - 1] / radiusCm,
    T: row[COLUMN.T - 1],
    P: row[COLUMN.P - 1] * 0.1,
    rho: row[COLUMN.rho - 1] * 1e3,
    X: row[COLUMN.X - 1],
    L: row[COLUMN.L - 1] / luminosityErgS,
    kappa: row[COLUMN.kappa - 1] * 0.1,
  }))
  .filter((p) => p.x <= 1)
  .reverse();

const grid = [];
for (let i = 0; i <= INTERIOR_STEPS; i++) grid.push((INTERIOR_TOP * i) / INTERIOR_STEPS);
/* From just under the join (the top of the even grid) to the shallowest depth. */
for (let i = SURFACE_STEPS - 2; i >= 0; i--) {
  const depth =
    SHALLOWEST_DEPTH * ((1 - INTERIOR_TOP) / SHALLOWEST_DEPTH) ** (i / (SURFACE_STEPS - 1));
  grid.push(1 - depth);
}
grid.push(1);

const T = sampler(points, "T", true);
const P = sampler(points, "P", true);
const rho = sampler(points, "rho", true);
const kappa = sampler(points, "kappa", true);
const X = sampler(points, "X", false);
const L = sampler(points, "L", false);
const table = grid.map((x) => [
  significant(x),
  significant(T(x)),
  significant(rho(x)),
  significant(P(x)),
  significant(Math.min(1, Math.max(0, L(x)))),
  significant(X(x)),
  significant(kappa(x)),
]);

const data = {
  source: `Model S (Christensen-Dalsgaard et al. 1996), FGONG table ${title[0]}: ${title[1]}`,
  reference: "Christensen-Dalsgaard et al. 1996, Science 272, 1286",
  url,
  fetched: new Date().toISOString().slice(0, 10),
  note: `The model's ${rows.length} mesh points resampled at ${table.length} radii, log-linear in T, ρ, P and κ, linear in L and X; the 1996 file (l5bi.d.15c) as its author distributes it`,
  model: {
    massKg: significant(massG * 1e-3),
    radiusM: significant(radiusCm * 1e-2),
    luminosityW: significant(luminosityErgS * 1e-7),
  },
  units: {
    x: "r/R",
    T: "K",
    rho: "kg/m³",
    P: "Pa",
    L: "L/L_model",
    X: "mass fraction",
    kappa: "m²/kg",
  },
  columns: ["x", "T", "rho", "P", "L", "X", "kappa"],
  rows: table,
};
await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.warn(`Wrote ${OUT.pathname}: ${table.length} radii from ${rows.length} mesh points`);
