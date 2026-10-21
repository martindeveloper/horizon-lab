import assert from "node:assert/strict";
import test from "node:test";

import {
  airToVacuum,
  CLASSICAL_ELECTRON_RADIUS_M,
  dopplerFactor,
  HC_EV_NM,
  planckRadiance,
} from "@horizon/toolkit/science";

import {
  mainSequencePhotosphere,
  starPhotosphere,
} from "../src/features/spectroscopy/lib/model/atmospheres.ts";
import {
  ELEMENTS,
  LINES,
  ionizationEnergy,
  lineNear,
  measureLine,
  partitionFunction,
} from "../src/features/spectroscopy/lib/model/atoms.ts";
import {
  continuumOf,
  continuumWavelength,
  totalOpacity,
} from "../src/features/spectroscopy/lib/model/continuum.ts";
import {
  boltzmannLaw,
  dopplerWidth,
  rydbergFormula,
  sahaEquation,
  slabTransfer,
} from "../src/features/spectroscopy/lib/model/equations.ts";
import {
  ease,
  moveDuration,
  poseBetween,
} from "../src/features/spectroscopy/lib/model/guide-motion.ts";
import {
  ionizationFractions,
  levelShare,
} from "../src/features/spectroscopy/lib/model/populations.ts";
import { lineProfile, lineShape, shapeAt } from "../src/features/spectroscopy/lib/model/profile.ts";
import {
  drawDeck,
  grade,
  mysteryAnswer,
  observationFor,
  spectralClass,
  verdict,
} from "../src/features/spectroscopy/lib/model/scenes.ts";
import {
  absorbedWidth,
  curveOfGrowth,
  depthAt,
  formedLines,
  reportLine,
  slabIntensity,
  synthesize,
} from "../src/features/spectroscopy/lib/model/spectrum.ts";
import { BAND_HEADS } from "../src/features/spectroscopy/lib/model/telluric.ts";
import { voigt } from "../src/features/spectroscopy/lib/model/voigt.ts";
import { SPECTROSCOPY_PATH } from "../src/features/spectroscopy/manifest.ts";
import {
  pathForView,
  resolveView,
  viewFromPath,
  viewRouteParams,
} from "../src/features/spectroscopy/routing.ts";

const near = (actual, expected, tolerance, label = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} ${actual} is not within ${tolerance} of ${expected}`,
  );

const BENCH = {
  view: "kirchhoff",
  star: "sun",
  sequenceTemperature: 9500,
  velocity: 0,
  air: false,
  resolution: 20_000,
  bench: { lamp: 3000, gas: 2000, column: 18, elements: ["Na"] },
  mystery: { kind: "flame", temperature: 2200, elements: ["Na"] },
};
const bench = (patch) => observationFor({ ...BENCH, bench: { ...BENCH.bench, ...patch } });
const star = (photosphere, extra = {}) => ({
  kind: "star",
  photosphere,
  microturbulence: 2,
  velocity: 0,
  airmass: 0,
  resolution: 100_000,
  ...extra,
});
const width = (species, nm, obs) => reportLine(lineNear(species, nm), obs).equivalentWidth;

test("Saha and Boltzmann reproduce the textbook hydrogen curves (Pₑ = 20 Pa)", () => {
  // Carroll & Ostlie §8.1: half ionized near 9600 K, n = 2 most populated near 9900 K.
  let half = 0;
  for (let T = 5000; T < 20_000 && !half; T += 10)
    if (ionizationFractions("H", T, 20)[0] < 0.5) half = T;
  near(half, 9600, 150, "50 % ionized");
  let peak = 0;
  let best = 0;
  for (let T = 5000; T < 25_000; T += 10) {
    const share = levelShare("H", 0, 8, 10.1988, T, 20);
    if (share > best) [best, peak] = [share, T];
  }
  near(peak, 9900, 200, "n = 2 peak");
  // Stages always add up; a cool gas is neutral, a hot one ionized.
  for (const T of [3000, 8000, 30_000])
    near(
      ionizationFractions("Fe", T, 10).reduce((a, b) => a + b, 0),
      1,
      1e-12,
    );
  assert.ok(ionizationFractions("Na", 2000, 10)[0] > 0.99);
  assert.ok(ionizationFractions("Ca", 6000, 10)[1] > 0.9, "a Sun-like layer holds Ca II");
  // Partition functions from NIST's levels: Fe I near 28 at 5000 K, hydrogen its ground state.
  near(partitionFunction("Fe I", 5000), 28, 3);
  near(partitionFunction("H I", 5000), 2, 1e-6);
});

test("the Voigt function meets its exact limits and keeps its area", () => {
  for (const v of [0, 0.7, 1.5, 3]) near(voigt(0, v), Math.exp(-v * v), 1e-4);
  near(voigt(1, 0), 0.4275836, 1e-5, "e·erfc(1)");
  near(voigt(0.01, 40) / (0.01 / (Math.sqrt(Math.PI) * 1600)), 1, 0.01, "Lorentz wing");
  let area = 0;
  for (let v = -300; v <= 300; v += 0.002) area += voigt(0.05, v) * 0.002;
  near(area, Math.sqrt(Math.PI), 2e-3);
});

test("a thin line's width counts its atoms: W = π rₑ λ² N f", () => {
  const line = lineNear("Na I", 588.995);
  const gas = {
    temperature: 2000,
    electronPressure: 10,
    gasPressure: 1e4,
    microturbulence: 0,
    columns: { Na: 1e9 },
  };
  const profile = lineProfile(line, gas);
  // Σ n f over the column, from the same populations, against the weak-line limit.
  const tau = profile.peak * Math.sqrt(Math.PI) * profile.doppler * 1e-9;
  const expected = tau;
  const actual = absorbedWidth(profile) * 1e-9;
  near(actual / expected, 1, 2e-3);
  near(CLASSICAL_ELECTRON_RADIUS_M, 2.8179403205e-15, 1e-24);
});

test("Kirchhoff's laws come out of one slab: dark, bright, reversed and vanishing lines", () => {
  const at = (obs, nm) => {
    const s = synthesize(obs, 585, 595, 2001);
    const i = s.wavelengths.findIndex((w) => w >= nm);
    return { flux: s.flux[i], continuum: s.continuum[i], off: s.flux[50] };
  };
  const dark = at(bench({ lamp: 3000, gas: 2000 }), 588.995);
  assert.ok(dark.flux < 0.8 * dark.continuum, "absorption against a hotter lamp");
  const bright = at(bench({ lamp: 0, gas: 2000 }), 588.995);
  assert.ok(bright.flux > 0 && bright.off < bright.flux * 1e-3, "emission against the dark");
  const reversed = at(bench({ lamp: 1600, gas: 2500 }), 588.995);
  assert.ok(reversed.flux > 1.5 * reversed.continuum, "emission over a cooler lamp");
  const even = at(bench({ lamp: 2000, gas: 2000 }), 588.995);
  near(even.flux / even.continuum, 1, 1e-5, "no line at one temperature");
  // Hydrogen needs heat: no Balmer lines in a flame, a clear series in a 10,000 K gas.
  assert.ok(
    reportLine(lineNear("H I", 656.279), bench({ elements: ["H"], column: 24 })).tau < 1e-10,
  );
  const hot = synthesize(
    bench({ lamp: 20_000, gas: 10_000, column: 24.5, elements: ["H"] }),
    380,
    770,
    3000,
  );
  for (const nm of [656.279, 486.135, 434.047]) assert.ok(depthAt(hot, nm) > 0.2, `Balmer ${nm}`);
});

test("the curve of growth rises as N, flattens, then grows as √N", () => {
  const slopes = (curve) =>
    curve.slice(0, -1).map((p, i) => (curve[i + 1][1] - p[1]) / (curve[i + 1][0] - p[0]));
  // On the bench a thin sodium vapour starts on the linear part.
  near(slopes(curveOfGrowth(lineNear("Na I", 588.995), bench({ column: 17 })))[0], 1, 0.02, "weak");
  // In the Sun an iron line runs from nearly linear through the flat part into the wings.
  const sun = star(starPhotosphere("sun"), { microturbulence: 1 });
  const iron = slopes(curveOfGrowth(lineNear("Fe I", 526.954), sun));
  assert.ok(iron[0] > 0.7, "rising");
  assert.ok(Math.min(...iron) < 0.3, "flat");
  near(iron.at(-1), 0.5, 0.03, "damped");
  for (let i = 1; i < iron.length; i++)
    assert.ok(Math.abs(iron[i] - iron[i - 1]) < 0.15, "a smooth curve");
});

test("the continuum is H⁻ in the Sun and hydrogen in a B star, on the models' own depth scale", () => {
  const visible = continuumWavelength(500);
  const layerNear = (photosphere, logTau) =>
    photosphere.layers.findIndex((l) => l.logTau >= logTau);
  const parts = (layer) => continuumOf(layer)(visible);
  const share = (p, ...keys) => keys.reduce((sum, k) => sum + p[k], 0) / totalOpacity(p);
  // Through the Sun's line-forming layers κ(500 nm) stays close to ATLAS9's Rosseland mean,
  // Δτ_Ross / Δm, which the model worked out independently.
  const sun = starPhotosphere("sun");
  for (let i = layerNear(sun, -3); i <= layerNear(sun, 0.5); i++) {
    const [a, b] = [sun.layers[i - 1], sun.layers[i]];
    const rosseland = (10 ** b.logTau - 10 ** a.logTau) / (b.column - a.column);
    near(totalOpacity(parts(b)) / rosseland, 1, 0.25, `log τ = ${b.logTau}`);
  }
  const photosphere = sun.layers[layerNear(sun, 0)];
  assert.ok(share(parts(photosphere), "hMinusBoundFree", "hMinusFreeFree") > 0.9, "H⁻ in the Sun");
  const hot = mainSequencePhotosphere(20_000);
  const deep = parts(hot.layers[layerNear(hot, 0)]);
  assert.ok(share(deep, "hMinusBoundFree", "hMinusFreeFree") < 0.01, "no H⁻ in a B star");
  assert.ok(share(deep, "hydrogenBoundFree", "hydrogenFreeFree") > 0.8, "hydrogen in a B star");
});

test("the model Sun's lines come within a factor of two of the measured ones", () => {
  const sun = star(starPhotosphere("sun"), { microturbulence: 1 });
  // Solar equivalent widths in pm (Moore, Minnaert & Houtgast 1966).
  for (const [species, nm, measured] of [
    ["Na I", 588.995, 75.2],
    ["Mg I", 518.36, 158.4],
    ["H I", 656.279, 402],
    ["Ca II", 393.366, 2025],
    ["Ca I", 422.673, 147.6],
    ["Na I", 568.82, 12.1],
    ["Fe I", 438.354, 100.8],
    ["Fe I", 526.954, 47.8],
  ]) {
    const ratio = (width(species, nm, sun) * 1e3) / measured;
    assert.ok(ratio > 0.5 && ratio < 2, `${species} ${nm}: ${ratio.toFixed(2)}× measured`);
  }
});

test("down the main sequence, hydrogen peaks near A0 and helium appears only in hot stars", () => {
  const ms = (T) => star(mainSequencePhotosphere(T));
  let peak = 0;
  let best = 0;
  for (const T of [6000, 7000, 8000, 9000, 9500, 10_000, 11_000, 12_000, 14_000, 17_000]) {
    const w = width("H I", 486.135, ms(T));
    if (w > best) [best, peak] = [w, T];
  }
  assert.ok(peak >= 8500 && peak <= 11_000, `Hβ strongest at ${peak} K`);
  assert.ok(width("He I", 447.15, ms(7000)) < 5e-4, "no He I in an F star");
  assert.ok(width("He I", 447.15, ms(20_000)) > 1e-2, "He I in a B star");
  assert.ok(width("Ca II", 393.366, ms(5000)) > 10 * width("Ca II", 393.366, ms(15_000)));
  assert.ok(width("Ca I", 422.673, ms(4000)) > 10 * width("Ca I", 422.673, ms(8000)));
});

test("a star's lines shift with its velocity; Earth's oxygen bands stay put", () => {
  near(BAND_HEADS.A, 759.4, 0.15, "A band head");
  near(BAND_HEADS.B, 686.75, 0.2, "B band head");
  const moving = star(starPhotosphere("sun"), { velocity: 300, airmass: 1, resolution: 20_000 });
  const s = synthesize(moving, 650, 770, 6000);
  const shifted = 656.279 * dopplerFactor(300);
  assert.ok(depthAt(s, shifted) > depthAt(s, 656.279) + 0.2, "Hα moved by λv/c");
  assert.ok(depthAt(s, BAND_HEADS.A + 0.4) > 0.3, "the A band is where it always is");
  const space = synthesize({ ...moving, airmass: 0 }, 650, 770, 6000);
  assert.ok(depthAt(space, BAND_HEADS.A + 0.4) < 0.05, "and gone above the air");
});

test("the printed equations compute from the same physics as the spectra", () => {
  const T = 6000;
  const Pe = 10;
  const na = lineNear("Na I", 588.995);
  const conditions = {
    temperature: T,
    electronPressure: Pe,
    gasPressure: 1e4,
    microturbulence: 1.5,
  };
  const A = ELEMENTS.Na.atomicWeight;
  assert.equal(
    dopplerWidth.compute({ lambda: na.wavelength, T, A, xi: 1.5 }),
    lineShape(na, conditions).doppler,
    "Doppler width",
  );
  const [neutral, ionized] = ionizationFractions("Na", T, Pe);
  const U = partitionFunction("Na II", T) / partitionFunction("Na I", T);
  const chi = ionizationEnergy("Na I");
  near(sahaEquation.compute({ U, chi, T, Pe }) / (ionized / neutral), 1, 1e-9, "Saha");
  const level = levelShare("Na", 0, 2, 2.1, T, Pe) / neutral;
  near(boltzmannLaw.compute({ g: 2, dE: 2.1, T }) / partitionFunction("Na I", T) / level, 1, 1e-12);
  const B = planckRadiance(589, 2000);
  assert.equal(
    slabTransfer.compute({ I0: 3e12, tau: 0.7, lambda: 589, T: 2000 }),
    slabIntensity(3e12, B, 0.7),
  );
  near(slabTransfer.compute({ I0: 0, tau: 50, lambda: 589, T: 2000 }) / B, 1, 1e-12, "thick: B");
  near(slabTransfer.compute({ I0: 5, tau: 0, lambda: 589, T: 2000 }), 5, 1e-12, "thin: I₀");
});

test("hydrogen's lines follow Rydberg's formula to within fine structure", () => {
  for (const [n, nm] of [
    [3, 656.279],
    [4, 486.135],
    [5, 434.047],
  ]) {
    const vacuum = rydbergFormula.compute({ n1: 2, n2: n });
    near(vacuum / 1.000277 - lineNear("H I", nm).wavelength, 0, 0.02, `n = ${n}`);
  }
});

/** A seeded generator (mulberry32), so a test deals the same deck every run. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("mystery decks are dealt at random: different kinds, one on the bench, stars always moving", () => {
  const decks = [1, 2, 3, 4, 5, 6].map((seed) => drawDeck(seeded(seed)));
  const orders = new Set(decks.map((deck) => deck.map((m) => m.kind).join()));
  assert.ok(orders.size > 1, "the order changes from deal to deal");
  for (const deck of decks) {
    assert.equal(deck.length, 5);
    assert.ok(
      deck.some((m) => m.kind === "flame" || m.kind === "cell"),
      "one on the bench",
    );
    const classes = deck.map((m) => (m.kind === "dwarf" ? spectralClass(m.teff) : m.kind));
    assert.equal(new Set(classes).size, deck.length, "no kind twice");
    for (const m of deck) {
      if (m.kind === "dwarf" || m.kind === "giant") assert.ok(Math.abs(m.velocity) >= 8, m.kind);
      else assert.ok(m.elements.length >= 1);
    }
  }
  assert.equal(spectralClass(5772), "G");
  assert.equal(spectralClass(9550), "A");
  assert.equal(spectralClass(3500), "M");
});

test("a mystery's answer is what its spectrum shows, and grading weighs both halves", () => {
  const flame = { kind: "flame", temperature: 2200, elements: ["Li", "Na", "K"] };
  assert.deepEqual([...mysteryAnswer(flame, 20_000, 0).clear].sort(), ["K", "Li", "Na"]);
  const cell = { kind: "cell", lamp: 6000, temperature: 1800, elements: ["Ca"] };
  assert.deepEqual([...mysteryAnswer(cell, 20_000, 0).clear], ["Ca"]);
  const hot = { kind: "dwarf", teff: 17_000, velocity: -25 };
  assert.ok(mysteryAnswer(hot, 20_000, 1).clear.has("He"));
  for (const m of [
    { kind: "dwarf", teff: 6750, velocity: 42 },
    { kind: "giant", star: "arcturus", velocity: -63 },
  ]) {
    const { clear, faint } = mysteryAnswer(m, 20_000, 1);
    assert.ok(clear.size > 0 && !clear.has("He") && !faint.has("He"), m.kind);
  }
  // A blurred spectrum hides weak lines: what counts follows the visitor's resolving power.
  const dwarf = { kind: "dwarf", teff: 6750, velocity: 42 };
  assert.ok(mysteryAnswer(dwarf, 500, 0).clear.size < mysteryAnswer(dwarf, 100_000, 0).clear.size);
  // Faint lines count when found, cost nothing when missed; absent ones are wrong when marked.
  const answer = { clear: new Set(["H", "Mg"]), faint: new Set(["K"]) };
  assert.equal(verdict(answer, "H", false), "missed");
  assert.equal(verdict(answer, "K", false), null);
  assert.equal(verdict(answer, "K", true), "found");
  assert.equal(verdict(answer, "He", true), "unseen");
  assert.equal(grade(dwarf, answer, ["H", "Mg"], 45).outcome, "solved");
  assert.equal(grade(dwarf, answer, ["H", "Mg", "K"], 33).outcome, "solved", "within 10 km/s");
  assert.equal(grade(dwarf, answer, ["H", "Mg", "He"], 42).outcome, "close", "one too many");
  assert.equal(grade(dwarf, answer, ["H", "Mg"], -42).outcome, "close", "wrong way");
  assert.equal(grade(dwarf, answer, ["He"], 0).outcome, "missed");
  const scored = grade(dwarf, answer, ["H", "He"], 0);
  assert.deepEqual([scored.found, scored.total, scored.unseen], [1, 2, 1]);
});

test("mystery cases keep each answer while another is open, and a new deal starts clean", async () => {
  const { useSpectroscopy } = await import("../src/features/spectroscopy/lib/store.ts");
  const api = useSpectroscopy.getState;
  api().setView("mystery");
  assert.equal(api().mystery, api().deck[0]);
  api().toggleCompare("H");
  assert.equal(api().measure, "H", "a newly marked element is the one measured");
  api().setVelocity(30);
  api().setCase(1);
  assert.deepEqual([api().compare, api().velocity], [[], 0]);
  api().setCase(0);
  assert.deepEqual([api().compare, api().velocity], [["H"], 30]);
  api().check();
  assert.ok(api().results[0] && api().result === api().results[0]);
  api().showAnswer();
  const { clear } = api().result.answer;
  assert.ok(
    [...clear].every((e) => api().compare.includes(e)),
    "the markers show the answer",
  );
  api().setCase(1);
  assert.equal(api().result, null);
  api().shuffleCases();
  assert.deepEqual([api().results.length, api().caseIndex, api().compare], [0, 0, []]);
  api().setView("sun");
});

test("a dense bench gas keeps its line: wings wider than the wavelength stay on the grid", () => {
  // At log N = 26 sodium's damping wings reach past λ = 0; D₂ must stay saturated, not vanish.
  const depths = [20, 23, 24, 26].map((column) =>
    depthAt(synthesize(bench({ column }), 585, 593, 400), 588.995),
  );
  for (const depth of depths) near(depth, depths[0], 0.01, "saturated at every column");
  assert.ok(depths[0] > 0.9);
});

test("hydrogen's Holtsmark wings keep the line's area, so its oscillator strength holds", () => {
  const conditions = {
    temperature: 9500,
    electronPressure: 100,
    gasPressure: 1e4,
    microturbulence: 2,
  };
  const shape = lineShape(lineNear("H I", 486.135), conditions);
  assert.ok(shape.holtsmark !== undefined);
  // ∫ shape dv over a sinh-spaced grid out to 10⁵ Doppler widths, against √π for any Voigt.
  const top = Math.asinh(1e5);
  const n = 40_000;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const u = -top + (2 * top * i) / n;
    const weight = i === 0 || i === n ? 0.5 : 1;
    sum += weight * shapeAt(shape, Math.sinh(u)) * Math.cosh(u);
  }
  near((sum * (2 * top)) / n / Math.sqrt(Math.PI), 1, 0.01, "area / √π");
});

test("fine structure stays resolved, energies come from vacuum wavelengths", () => {
  // Lithium's resonance doublet is 0.015 nm apart: two lines, which R = 100,000 separates.
  const lithium = LINES.filter(
    (l) => l.species === "Li I" && Math.abs(l.wavelength - 670.78) < 0.05,
  );
  assert.equal(lithium.length, 2);
  // Na D₂ at 588.995 nm in air is 589.158 nm in vacuum: 2.1044 eV, the levels' separation.
  const d2 = lineNear("Na I", 588.995);
  near(d2.vacuum, 589.158, 0.002);
  near(HC_EV_NM / d2.vacuum, d2.upper - d2.lower, 2e-4);
});

test("a star returns surface flux: an isothermal atmosphere gives πB(T)", () => {
  const sun = starPhotosphere("sun");
  const isothermal = { ...sun, layers: sun.layers.map((l) => ({ ...l, temperature: 6000 })) };
  const spectrum = synthesize(star(isothermal, { resolution: 20_000 }), 500, 501, 5);
  const middle = spectrum.wavelengths[2];
  near(spectrum.continuum[2] / (Math.PI * planckRadiance(airToVacuum(middle), 6000)), 1, 1e-3);
});

test("a velocity is measured on the line the spectrum shows: Ca I in the Sun, Ca II in a B star", () => {
  const sun = formedLines(star(starPhotosphere("sun"), { airmass: 0 }));
  const hot = formedLines(star(mainSequencePhotosphere(17_000)));
  assert.equal(measureLine("Ca", sun).species, "Ca I");
  assert.equal(measureLine("Ca", hot).species, "Ca II");
  assert.equal(measureLine("Mg", hot).species, "Mg II");
});

test("every line is unique and inside the visible range", () => {
  assert.equal(new Set(LINES.map((l) => l.id)).size, LINES.length);
  for (const line of LINES) {
    assert.ok(line.wavelength >= 380 && line.wavelength <= 770, line.id);
    assert.ok(line.upper > line.lower, line.id);
  }
});

test("views route by slug; the Sun opens the lab", () => {
  assert.equal(resolveView(undefined), "sun");
  assert.equal(pathForView("sun"), SPECTROSCOPY_PATH);
  assert.equal(resolveView("nonsense"), null);
  for (const { view } of viewRouteParams()) {
    assert.notEqual(view, "sun");
    assert.equal(viewFromPath(`${SPECTROSCOPY_PATH}/${view}`), view);
    assert.equal(viewFromPath(`/cs${SPECTROSCOPY_PATH}/${view}`), view);
  }
});

test("the store zooms within the visible range and the guide gives the visitor's settings back", async () => {
  const { useSpectroscopy, MIN_SPAN } = await import("../src/features/spectroscopy/lib/store.ts");
  const api = useSpectroscopy.getState;
  api().setRange([500, 500.01]);
  near(api().range[1] - api().range[0], MIN_SPAN, 1e-9);
  api().setRange([300, 900]);
  assert.deepEqual(api().range, [380, 770]);
  api().setStar("aldebaran");
  assert.equal(api().velocity, 54.4, "a star arrives at its measured radial velocity");
  api().patchBench({ column: 21, gas: 99_999 });
  assert.equal(api().bench.gas, 12_000, "the bench clamps its gas temperature");
  const before = { view: api().view, bench: api().bench, compare: api().compare };
  const { TOUR } = await import("../src/features/spectroscopy/lib/model/tour.ts");
  api().startGuide();
  api().goGuide(TOUR.findIndex((step) => step.id === "hydrogen"));
  assert.equal(api().bench.elements[0], "H");
  api().endGuide();
  assert.deepEqual({ view: api().view, bench: api().bench, compare: api().compare }, before);
});

test("the guide glides between steps: zooms stay in range, a lamp switched off sweeps through the gas's temperature", () => {
  const from = {
    range: [380, 770],
    velocity: 0,
    lamp: 5800,
    gas: 2000,
    column: 12,
    sequenceTemperature: 9500,
  };
  const to = {
    range: [583, 596],
    velocity: 300,
    lamp: 0,
    gas: 2000,
    column: 18,
    sequenceTemperature: 9500,
  };
  assert.deepEqual(poseBetween(from, to, 0), { ...from, range: [380, 770] });
  assert.deepEqual(poseBetween(from, to, 1), to);
  near(ease(0.5), 0.5, 1e-12);
  assert.ok(ease(0.1) < 0.1 && ease(0.9) > 0.9, "gentle start and landing");
  const lamps = [];
  for (let t = 0; t <= 1; t += 0.05) {
    const pose = poseBetween(from, to, ease(t));
    assert.ok(
      pose.range[0] >= 380 - 1e-9 && pose.range[1] <= 770 + 1e-9,
      "inside the visible range",
    );
    lamps.push(pose.lamp);
  }
  // On its way out the lamp passes below the 2000 K gas, so the lines turn bright before it goes off.
  assert.ok(lamps.some((k) => k > 0 && k < 2000));
  assert.equal(moveDuration(from, from), 0, "nothing to move, nothing to wait for");
  assert.ok(moveDuration(from, to) > 1000);
});

test("a guide step switches its elements at once and opens its line only on landing", async () => {
  const { useSpectroscopy } = await import("../src/features/spectroscopy/lib/store.ts");
  const { TOUR } = await import("../src/features/spectroscopy/lib/model/tour.ts");
  const api = useSpectroscopy.getState;
  api().startGuide();
  api().goGuide(TOUR.findIndex((step) => step.id === "absorption"));
  assert.deepEqual(api().bench.elements, ["Na"]);
  assert.equal(api().selection, null, "the card waits for the motion");
  assert.equal(api().guideLanded, false);
  api().landGuide();
  assert.equal(api().guideLanded, true);
  assert.equal(api().selection, "na1-588.995");
  assert.deepEqual(api().range, [583, 596]);
  assert.equal(api().bench.column, 18);
  api().endGuide();
  assert.equal(api().guideTarget, null);
});

test("the spectrum's canvases: standard keeps today's scale, economy and 2× move it within bounds", async () => {
  const { canvasScale, drawingGamut, qualityScale } =
    await import("../src/features/spectroscopy/lib/quality.ts");
  assert.equal(canvasScale(3, "standard", "off"), 2);
  assert.equal(canvasScale(1.5, "standard", "off"), 1.5);
  assert.equal(canvasScale(3, "economy", "off"), 1);
  assert.equal(canvasScale(3, "cinema", "off"), 3);
  assert.equal(canvasScale(5, "max", "off"), 4);
  assert.equal(canvasScale(1, "standard", "supersample"), 2, "2× doubles the pixels");
  assert.equal(canvasScale(3, "cinema", "supersample"), 4, "never past 4");
  assert.equal(canvasScale(0, "standard", "off"), 1, "an unknown ratio counts as 1");
  /* The spectrum's sampling follows the quality alone: 2× must not reshape its lines. */
  assert.equal(qualityScale(1, "standard"), canvasScale(1, "standard", "off"));
  /* Wide colour only where the screen shows P3; elsewhere the spectrum stays sRGB. */
  assert.equal(drawingGamut(true, true), "p3");
  assert.equal(drawingGamut(true, false), "srgb");
  assert.equal(drawingGamut(false, true), "srgb");
});

test("the Glow switch: the ribbon's halo spreads strong emission alone, and repaints the scene", async () => {
  const { ribbonHalo } =
    await import("../src/features/spectroscopy/components/spectrum-view/ribbon.ts");
  const { sameScene } = await import("../src/features/spectroscopy/lib/scene/paint.ts");
  const n = 200;
  const wavelengths = Float64Array.from({ length: n }, (_, i) => 500 + i * 0.5);
  const continuum = new Float64Array(n).fill(1);
  const flux = new Float64Array(continuum);
  flux[50] = 3; /* a strong emission line */
  flux[120] = 1.15; /* a weak one */
  flux[150] = 0.2; /* an absorption line */
  const spectrum = { wavelengths, flux, continuum, peak: 3 };
  const halo = ribbonHalo(spectrum, 6, "srgb");
  assert.ok(halo, "there is light to spread");
  const at = (i) => halo[i * 3] + halo[i * 3 + 1] + halo[i * 3 + 2];
  assert.ok(at(50) > 0 && at(53) > 0 && at(47) > 0, "the strong line glows and spreads");
  assert.ok(at(53) < at(50), "softly");
  assert.equal(at(120), 0, "a weak line gets no halo");
  assert.equal(at(150), 0, "an absorption line stays crisp");
  assert.equal(at(100), 0, "the continuum between them is untouched");
  assert.equal(ribbonHalo(spectrum, 0, "srgb"), null, "no radius, no halo");
  assert.equal(
    ribbonHalo({ ...spectrum, flux: continuum }, 6, "srgb"),
    null,
    "no emission, no halo",
  );
  /* The still scene repaints when the switch changes, and only then. */
  const inputs = {
    kind: "slab",
    glowing: true,
    glow: null,
    starColor: null,
    teff: null,
    lampColor: null,
    strong: [],
    range: [380, 780],
    labels: { source: "", gas: "", air: null, spectrograph: "" },
    gamut: "srgb",
    halo: false,
  };
  assert.ok(sameScene(inputs, { ...inputs, strong: [{ centre: 500, tau: 1 }] }));
  assert.ok(!sameScene(inputs, { ...inputs, halo: true }));
});
