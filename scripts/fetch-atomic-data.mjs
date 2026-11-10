/**
 * Fetches the atomic data Stellar Spectra computes with from the NIST Atomic Spectra Database
 * and writes src/features/spectroscopy/lib/model/atomic-data.json: for every species, its
 * ionization energy and partition function, and the lines it absorbs between 380 and 770 nm
 * (air wavelengths) that are strong enough to show at its typical temperature. Run by hand when
 * NIST revises its tables:
 *
 *   node scripts/fetch-atomic-data.mjs
 *
 * Partition functions sum g e^(−E/kT) over every catalogued level more than 1 eV below the
 * ionization limit (a crude stand-in for pressure ionization), on a temperature grid.
 * Oscillator strengths come from NIST's transition probabilities: gf = g_k A λ² ε₀ mₑ c / (2π e²).
 */
import { writeFile } from "node:fs/promises";

import { DOWNLOAD_URLS } from "@horizon/toolkit/urls";

import { fetchText } from "./lib/net.mjs";

const OUT = new URL("../src/features/spectroscopy/lib/model/atomic-data.json", import.meta.url);
const ASD = DOWNLOAD_URLS.nistAsd;
const RANGE = [380, 770];
/** Temperatures the partition functions are tabulated at, K. */
const GRID = [
  1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000, 9000, 10000, 12000, 14000,
  16000, 18000, 20000, 25000, 30000, 35000, 40000,
];
const KB_EV = 8.617333262e-5;
/** ε₀ mₑ c / (2π e²), s m⁻² (CODATA 2022): gf = g_k A λ² × this. */
const GF_PER_GA_LAMBDA2 =
  (8.8541878188e-12 * 9.1093837139e-31 * 299792458) / (2 * Math.PI * 1.602176634e-19 ** 2);

/**
 * The species the lab models. `lines` keeps a line whose strength index log gf − θ E_low, at
 * the species' typical temperature (θ = 5040 / T), is within `depth` dex of its strongest
 * line's; `totals` takes NIST's summed multiplets (hydrogenic spectra also list their
 * fine-structure components). Other species keep every component.
 */
const SPECIES = {
  "H I": { lines: { T: 10000, depth: 2.6 }, totals: true },
  "He I": { lines: { T: 20000, depth: 1.8 } },
  "He II": { lines: { T: 35000, depth: 1.5 } },
  "Li I": { lines: { T: 3000, depth: 0.6 } },
  "Na I": { lines: { T: 5000, depth: 2.8 } },
  "K I": { lines: { T: 3000, depth: 0.6 } },
  "Mg I": { lines: { T: 5000, depth: 2.8 } },
  "Mg II": { lines: { T: 9000, depth: 2 } },
  "Ca I": { lines: { T: 4500, depth: 2.8 } },
  "Ca II": { lines: { T: 8000, depth: 1.2 } },
  "Fe I": { lines: { T: 5000, depth: 2.7 } },
  "Fe II": { lines: { T: 9000, depth: 2 } },
  "Mg III": {},
  "Ca III": {},
  "Fe III": {},
};

const text = (url) =>
  fetchText(url, {
    reject: (body) => body.startsWith("<!DOCTYPE") && "NIST returned an error page",
  });

/** A tab-separated NIST table as rows of named, unquoted cells. */
function table(tsv) {
  const [head, ...rows] = tsv.trim().split("\n");
  const cols = head.split("\t");
  return rows.map((row) => {
    const cells = row.split("\t").map((c) => c.replace(/^"|"$/g, "").trim());
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
}
const number = (s) => Number.parseFloat(String(s).replace(/[[\]()"?+]/g, ""));

async function levels(species) {
  const params = new URLSearchParams({
    de: "0",
    spectrum: species,
    submit: "Retrieve Data",
    units: "1",
    format: "3",
    output: "0",
    page_size: "15",
    multiplet_ordered: "0",
    conf_out: "on",
    term_out: "on",
    level_out: "on",
    unc_out: "1",
    j_out: "on",
    g_out: "on",
    lande_out: "on",
    perc_out: "on",
    biblio: "on",
    temp: "",
  });
  const rows = table(await text(`${ASD}/energy1.pl?${params}`));
  const limit = rows.find((r) => r.Term === "Limit");
  if (!limit) throw new Error(`${species}: no ionization limit`);
  const chi = number(limit["Level (eV)"]);
  /* H I also lists each shell summed over its levels (configuration "2", g = 2n², no term or
     J): a row without a J is such a sum, and its levels are already counted. */
  const states = rows
    .filter((r) => r.Term !== "Limit" && r.g !== "" && r.J !== "")
    .map((r) => ({ g: number(r.g), E: number(r["Level (eV)"]) }))
    .filter(({ g, E }) => Number.isFinite(g) && Number.isFinite(E) && E < chi - 1);
  const partition = GRID.map((T) => {
    const U = states.reduce((sum, { g, E }) => sum + g * Math.exp(-E / (KB_EV * T)), 0);
    return Number(U.toPrecision(5));
  });
  return { ionization: Number(chi.toFixed(4)), partition };
}

async function lines(species, { T, depth }, totals) {
  const params = new URLSearchParams({
    spectra: species,
    limits_type: "0",
    low_w: String(RANGE[0] - 1),
    upp_w: String(RANGE[1] + 1),
    unit: "1",
    submit: "Retrieve Data",
    de: "0",
    format: "3",
    line_out: "0",
    en_unit: "1",
    output: "0",
    bibrefs: "1",
    page_size: "15",
    show_obs_wl: "1",
    show_calc_wl: "1",
    unc_out: "1",
    order_out: "0",
    max_low_enrg: "",
    show_av: "2",
    max_upp_enrg: "",
    tsb_value: "0",
    min_str: "",
    A_out: "0",
    intens_out: "on",
    max_str: "",
    allowed_out: "1",
    forbid_out: "1",
    min_accur: "",
    min_intens: "",
    conf_out: "on",
    term_out: "on",
    enrg_out: "on",
    J_out: "on",
    g_out: "on",
  });
  const theta = 5040 / T;
  const rows = table(await text(`${ASD}/lines1.pl?${params}`))
    .filter((r) => !totals || r.term_i === "")
    .map((r) => {
      const air = number(r["obs_wl_air(nm)"]) || number(r["ritz_wl_air(nm)"]);
      const A = number(r["Aki(s^-1)"]);
      const gk = number(r.g_k);
      const gf = gk * A * (air * 1.000277e-9) ** 2 * GF_PER_GA_LAMBDA2;
      return {
        air,
        gf,
        El: number(r["Ei(eV)"]),
        Eu: number(r["Ek(eV)"]),
        lower: [r.conf_i, r.term_i, r.J_i],
        upper: [r.conf_k, r.term_k, r.J_k],
        acc: r.Acc,
      };
    })
    .filter((l) => l.air >= RANGE[0] && l.air <= RANGE[1] && l.gf > 0 && Number.isFinite(l.El))
    .sort((a, b) => a.air - b.air);

  /*
   * Fine-structure components stay separate lines: at R = 100,000 some are resolved (Li I's
   * 0.015 nm doublet), and each saturates on its own. Only components NIST lists at the same
   * wavelength (within 0.002 nm, a third of the finest resolution element) from one lower
   * level are summed, as are hydrogen's (`totals`): its Stark and thermal widths exceed their
   * spacing, and its Stark model is for whole lines.
   */
  const merged = [];
  for (const line of rows) {
    const last = merged.at(-1);
    if (last && line.air - last.air < 0.002 && Math.abs(line.El - last.El) < 0.05) {
      const gf = last.gf + line.gf;
      const strongest = line.gf > last.strongest ? line : last;
      merged[merged.length - 1] = {
        ...strongest,
        air: (last.air * last.gf + line.air * line.gf) / gf,
        El: (last.El * last.gf + line.El * line.gf) / gf,
        Eu: (last.Eu * last.gf + line.Eu * line.gf) / gf,
        gf,
        strongest: Math.max(last.strongest, line.gf),
      };
    } else merged.push({ ...line, strongest: line.gf });
  }
  const index = (l) => Math.log10(l.gf) - theta * l.El;
  const strongest = Math.max(...merged.map(index));
  return merged
    .filter((l) => index(l) >= strongest - depth)
    .map((l) => [
      species,
      Number(l.air.toFixed(4)),
      Number(Math.log10(l.gf).toFixed(3)),
      Number(l.El.toFixed(4)),
      Number(l.Eu.toFixed(4)),
      l.lower.join("|"),
      l.upper.join("|"),
      l.acc,
    ]);
}

const data = {
  retrieved: new Date().toISOString().slice(0, 10),
  grid: GRID,
  species: {},
  lines: [],
};
for (const [species, config] of Object.entries(SPECIES)) {
  data.species[species] = await levels(species);
  if (config.lines) data.lines.push(...(await lines(species, config.lines, config.totals)));
  console.log(species, data.lines.filter((l) => l[0] === species).length);
}
data.lines.sort((a, b) => a[1] - b[1]);
await writeFile(OUT, `${JSON.stringify(data)}\n`);
console.log(`${data.lines.length} lines → ${OUT.pathname}`);
