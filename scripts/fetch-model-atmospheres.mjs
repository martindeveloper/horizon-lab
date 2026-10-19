/**
 * Fetches Castelli & Kurucz's (2003) ATLAS9 model atmospheres (solar abundances, new ODFs,
 * microturbulence 2 km/s) and writes src/features/spectroscopy/lib/model/atmospheres.json: for
 * each model, the temperature, gas and electron pressure and mass column above each Rosseland
 * optical depth from 10⁻⁴ to 10^1.5, in steps of 0.25 dex. Stellar Spectra integrates its stars'
 * light through these layers. Run by hand:
 *
 *   node scripts/fetch-model-atmospheres.mjs
 *
 * Kept: every model at log g = 4.0 (the main sequence, near enough, from 3500 to 30 000 K)
 * and the grid models nearest the lab's named stars.
 */
import { writeFile } from "node:fs/promises";

const URL_GRID = "http://kurucz.harvard.edu/grids/gridp00odfnew/ap00k2odfnew.dat";
const OUT = new URL("../src/features/spectroscopy/lib/model/atmospheres.json", import.meta.url);
/** log₁₀ τ_Ross the layers are read at. */
const DEPTHS = Array.from({ length: 23 }, (_, i) => -4 + i * 0.25);
const BOLTZMANN_CGS = 1.380649e-16;
/** The named stars' effective temperature and surface gravity (log g, cgs). */
const STARS = {
  alnitak: [29500, 3.25],
  rigel: [12000, 1.75],
  vega: [9550, 3.95],
  procyon: [6530, 4.0],
  sun: [5772, 4.44],
  arcturus: [4286, 1.66],
  aldebaran: [3900, 1.1],
};

const res = await fetch(URL_GRID);
if (!res.ok) throw new Error(`ATLAS9 grid: HTTP ${res.status}`);
const models = (await res.text())
  .split(/^TEFF/m)
  .slice(1)
  .map((block) => {
    const [teff, , logg] = block.trim().split(/\s+/);
    const deck = block.split(/READ DECK6 \d+ RHOX.*\n/)[1]?.split(/\nPRADK/)[0];
    if (!deck) throw new Error(`Model ${teff}/${logg}: no deck`);
    const rows = deck
      .trim()
      .split("\n")
      .map((line) => line.trim().split(/\s+/).slice(0, 5).map(Number));
    /* τ_Ross = ∫ κ_Ross dm, the first layer taken as optically thin above it. */
    let tau = rows[0][0] * rows[0][4];
    const layers = rows.map(([rhox, T, P, xne, kappa], i) => {
      if (i > 0) {
        const [prevRhox, , , , prevKappa] = rows[i - 1];
        tau += ((kappa + prevKappa) / 2) * (rhox - prevRhox);
      }
      return { logTau: Math.log10(tau), rhox, T, P, Pe: xne * BOLTZMANN_CGS * T };
    });
    return { teff: Number(teff), logg: Number(logg), layers };
  });

/**
 * A layer's T (K), log Pe and log P_gas (Pa) and log mass column (kg m⁻²) at log τ_Ross,
 * interpolated.
 */
function at(model, logTau) {
  const { layers } = model;
  const i = layers.findIndex((l) => l.logTau >= logTau);
  if (i <= 0) throw new Error(`Model ${model.teff}/${model.logg} does not reach log τ ${logTau}`);
  const a = layers[i - 1];
  const b = layers[i];
  const t = (logTau - a.logTau) / (b.logTau - a.logTau);
  const lerp = (x, y) => x + t * (y - x);
  return [
    Math.round(lerp(a.T, b.T)),
    Number(lerp(Math.log10(a.Pe / 10), Math.log10(b.Pe / 10)).toFixed(3)),
    Number(lerp(Math.log10(a.P / 10), Math.log10(b.P / 10)).toFixed(3)),
    Number(lerp(Math.log10(a.rhox * 10), Math.log10(b.rhox * 10)).toFixed(4)),
  ];
}

const summary = (model) => ({
  teff: model.teff,
  logg: model.logg,
  layers: DEPTHS.map((d) => at(model, d)),
});

const nearest = ([teff, logg]) =>
  models.reduce((best, m) => {
    const score = (x) => Math.abs(Math.log(x.teff / teff)) * 20 + Math.abs(x.logg - logg);
    return score(m) < score(best) ? m : best;
  });

const data = {
  source: "Castelli & Kurucz (2003), ATLAS9 grid ap00k2odfnew",
  depths: DEPTHS,
  sequence: models.filter((m) => m.logg === 4 && m.teff <= 30000).map(summary),
  stars: Object.fromEntries(
    Object.entries(STARS).map(([id, star]) => [id, summary(nearest(star))]),
  ),
};
await writeFile(OUT, `${JSON.stringify(data)}\n`);
for (const [id, s] of Object.entries(data.stars)) console.log(id, s.teff, s.logg, s.layers);
console.log(`${data.sequence.length} main-sequence models → ${OUT.pathname}`);
