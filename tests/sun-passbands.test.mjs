import assert from "node:assert/strict";
import test from "node:test";

import { SOLAR_GOLD, cssHex } from "@horizon/toolkit/scene";
import { SOLAR_TEFF_K, hexToLinear } from "@horizon/toolkit/science";

import {
  BAUMBACH_POWERS,
  CORONA,
  coronaBrightness,
  eCorona,
  fCorona,
  kCorona,
  whiteLightCorona,
  windSpeed,
} from "../src/space/sun/model/corona.ts";
import { TEMPERATURES } from "../src/space/sun/model/parameters.ts";
import {
  AIA_NM,
  AIA_PEAKS_K,
  HALPHA_NM,
  MAGNETOGRAM_POSITIVE,
  MAGNETOGRAM_SATURATION_T,
  PASSBANDS,
  PASSBAND_IDS,
  magnetogramColor,
  rampColor,
  response,
} from "../src/space/sun/model/passbands.ts";

const EXPECTED_IDS = [
  "white",
  "halpha",
  "he304",
  "fe171",
  "fe193",
  "fe211",
  "fe335",
  "fe94",
  "fe131",
  "eclipse",
  "magnetogram",
];
/** Lemen et al. 2012, Table 1: each band's primary ion and log T, and the second ion it sees. */
const LEMEN = {
  he304: { nm: 30.4, ion: "He II", logT: 4.7, second: ["Si XI", 6.2] },
  fe171: { nm: 17.1, ion: "Fe IX", logT: 5.8 },
  fe193: { nm: 19.3, ion: "Fe XII", logT: 6.2, second: ["Fe XXIV", 7.3] },
  fe211: { nm: 21.1, ion: "Fe XIV", logT: 6.3 },
  fe335: { nm: 33.5, ion: "Fe XVI", logT: 6.4 },
  fe94: { nm: 9.4, ion: "Fe XVIII", logT: 6.8, second: ["Fe X", 6.05] },
  fe131: { nm: 13.1, ion: "Fe VIII", logT: 5.6, second: ["Fe XXI", 7.05] },
};

test("every band of the contract exists, with a valid ramp in linear light and layer weights", () => {
  assert.deepEqual([...PASSBAND_IDS].sort(), [...EXPECTED_IDS].sort());
  for (const id of PASSBAND_IDS) {
    const band = PASSBANDS[id];
    assert.equal(band.id, id);
    assert.ok(band.ramp.length >= 3 && band.ramp.length <= 16, `${id}: ${band.ramp.length} stops`);
    for (const stop of band.ramp)
      for (const channel of stop) assert.ok(channel >= 0 && channel <= 1, `${id} ramp in 0–1`);
    if (!band.magnetogram) {
      const first = band.ramp[0];
      const last = band.ramp.at(-1);
      assert.ok(first[0] + first[1] + first[2] < 0.05, `${id} starts dark`);
      assert.ok(last[0] + last[1] + last[2] > 2.5, `${id} ends near white`);
      for (let i = 1; i < band.ramp.length; i++) {
        const sum = (stop) => stop[0] + stop[1] + stop[2];
        assert.ok(
          sum(band.ramp[i]) >= sum(band.ramp[i - 1]) - 1e-9,
          `${id} brightens monotonically`,
        );
      }
    }
    const weights = Object.values(band.weights);
    assert.ok(weights.every((w) => w >= 0 && w <= 1));
    assert.ok(Math.max(...weights) === 1, `${id} has a main layer`);
    if (band.peaks.length) {
      assert.equal(band.peakK, band.peaks[0].kelvin);
      assert.ok(band.widthDex > 0);
      for (const p of band.peaks) assert.ok(p.below > 0 && p.above > 0 && p.weight > 0 && p.ion);
    }
  }
  assert.equal(PASSBANDS.eclipse.occultDisc, true);
  assert.equal(PASSBANDS.magnetogram.magnetogram, true);
  assert.equal(PASSBAND_IDS.filter((id) => PASSBANDS[id].occultDisc).length, 1);
});

test("the AIA bands answer the ions Lemen et al. name at their temperatures, with the second ion each band sees", () => {
  for (const [id, expected] of Object.entries(LEMEN)) {
    const peaks = AIA_PEAKS_K[id];
    assert.equal(AIA_NM[id], expected.nm);
    assert.equal(peaks[0].ion, expected.ion, id);
    assert.equal(peaks[0].logT, expected.logT, id);
    assert.ok(Math.abs(Math.log10(peaks[0].kelvin) - expected.logT) < 1e-12);
    assert.equal(peaks[0].weight, 1);
    if (expected.second) {
      assert.equal(peaks[1].ion, expected.second[0], id);
      assert.equal(peaks[1].logT, expected.second[1], id);
      assert.ok(peaks[1].weight > 0 && peaks[1].weight < 1, `${id}'s second ion answers less`);
    } else assert.equal(peaks.length, 1, id);
    /* Broad, asymmetric peaks: FWHM 0.3–0.5 dex, the hot side wider or equal. */
    for (const p of peaks) {
      const fwhm = 2.355 * ((p.below + p.above) / 2);
      assert.ok(fwhm >= 0.2 && fwhm <= 0.6, `${id} ${p.ion}: FWHM ${fwhm} dex`);
      assert.ok(p.above >= p.below, `${id} ${p.ion} falls slower to the hot side`);
    }
  }
});

test("every line band answers at each stated peak and is dark far from all of them", () => {
  const lineBands = [...Object.keys(LEMEN), "halpha"];
  for (const id of lineBands) {
    const { peaks } = PASSBANDS[id];
    for (const p of peaks) {
      const at = response(id, p.kelvin);
      assert.ok(at >= Math.min(1, p.weight) - 1e-6, `${id} at ${p.ion}: ${at}`);
      assert.ok(
        response(id, p.kelvin * 1.3) < at + 1e-9 || p.weight < 1,
        `${id} falls past ${p.ion}`,
      );
    }
    assert.ok(Math.abs(response(id, peaks[0].kelvin) - 1) < 1e-9, `${id} peaks at 1`);
    for (let logT = 3.5; logT <= 8; logT += 0.05) {
      const far = peaks.every((p) => Math.abs(logT - p.logT) > 0.6);
      if (far) assert.ok(response(id, 10 ** logT) < 0.05, `${id} dark at log T ${logT.toFixed(2)}`);
    }
  }
  assert.ok(
    response("fe193", 10 ** 7.3) > 0.25 && response("fe193", 10 ** 7.3) < 0.6,
    "193 sees flares, dimly",
  );
  assert.ok(response("fe94", 10 ** 6.05) > 0.4, "94 sees the quiet corona through Fe X");
  assert.ok(
    response("fe94", 10 ** 6.8) > response("fe171", 10 ** 6.8) * 10,
    "flare plasma shows in 94, not 171",
  );
  assert.ok(response("fe171", 10 ** 5.8) > response("fe94", 10 ** 5.8) * 10);
  assert.ok(
    response("fe131", 10 ** 5.6) > 0.99 && response("fe131", 10 ** 7.05) > 0.45,
    "131 has two peaks",
  );
  assert.ok(
    response("he304", 10 ** 6.2) > 0.1 && response("he304", 10 ** 6.2) < 0.25,
    "304's Si XI",
  );
  assert.ok(
    response("fe211", 10 ** 6.3) > response("fe211", 10 ** 5.8) * 10,
    "211 is hotter than 171",
  );
  assert.ok(response("fe335", 10 ** 6.4) > response("fe335", 10 ** 6.0) * 3);
});

test("white light is Planck's law and shows the photosphere alone; Hα the chromosphere; the eclipse every temperature; the magnetogram none", () => {
  assert.ok(Math.abs(response("white", SOLAR_TEFF_K) - 1) < 1e-9);
  assert.ok(
    response("white", TEMPERATURES.spot) > 0.08 && response("white", TEMPERATURES.spot) < 0.2,
    "an umbra is dark, not black",
  );
  assert.ok(response("white", 3_000) < response("white", TEMPERATURES.spot));
  assert.equal(response("white", 1e4), 1, "optically thick hotter gas is no brighter than full");
  assert.deepEqual(PASSBANDS.white.weights, {
    photosphere: 1,
    chromosphere: 0,
    transition: 0,
    corona: 0,
    flare: 0,
  });
  assert.ok(response("halpha", TEMPERATURES.prominence) > 0.99);
  assert.ok(response("halpha", TEMPERATURES.chromosphere) > 0.3, "the chromosphere glows in Hα");
  assert.ok(
    response("halpha", SOLAR_TEFF_K) < 0.2 && response("halpha", TEMPERATURES.quietCorona) < 1e-6,
  );
  assert.equal(PASSBANDS.halpha.weights.chromosphere, 1);
  assert.equal(PASSBANDS.halpha.weights.corona, 0);
  for (const kelvin of [1e4, 1e6, 1e7]) assert.equal(response("eclipse", kelvin), 1);
  assert.equal(PASSBANDS.eclipse.weights.corona, 1);
  assert.equal(PASSBANDS.eclipse.weights.photosphere, 0);
  assert.equal(response("magnetogram", 1e6), 0);
  assert.equal(response("fe171", 0), 0);
  assert.equal(response("white", 0), 0);
  assert.ok(Math.abs(HALPHA_NM - 656.28) < 0.01, `Hα at ${HALPHA_NM} nm`);
});

test("the layers each band shows follow its ions", () => {
  const { he304, fe171, fe193, fe211, fe335, fe94, fe131 } = PASSBANDS;
  assert.equal(he304.weights.transition, 1);
  assert.ok(
    he304.weights.chromosphere > 0 && he304.weights.corona > 0 && he304.weights.flare === 0,
  );
  assert.equal(fe171.weights.corona, 1);
  assert.ok(fe171.weights.photosphere === 0 && fe171.weights.flare === 0);
  assert.ok(fe193.weights.corona === 1 && fe193.weights.flare > 0, "Fe XXIV in flares");
  assert.ok(fe211.weights.corona === 1 && fe335.weights.corona === 1);
  assert.ok(
    fe94.weights.flare === 1 && fe94.weights.corona > 0,
    "Fe XVIII in flares, Fe X in the quiet corona",
  );
  assert.ok(
    fe131.weights.flare === 1 && fe131.weights.transition > 0,
    "Fe XXI in flares, Fe VIII in the transition region",
  );
  for (const id of ["he304", "fe171", "fe193", "fe211", "fe335", "fe94", "fe131"])
    assert.equal(PASSBANDS[id].weights.photosphere, 0, `${id}: the EUV photosphere is dark`);
  /* The drawn temperatures sit where the layers really are. */
  assert.equal(TEMPERATURES.photosphere, SOLAR_TEFF_K);
  assert.ok(TEMPERATURES.spot < TEMPERATURES.photosphere);
  assert.ok(
    TEMPERATURES.prominence < TEMPERATURES.chromosphere &&
      TEMPERATURES.chromosphere < TEMPERATURES.transition,
  );
  assert.ok(
    TEMPERATURES.transition < TEMPERATURES.coronalHole &&
      TEMPERATURES.coronalHole <= TEMPERATURES.quietCorona,
  );
  assert.ok(
    TEMPERATURES.quietCorona < TEMPERATURES.activeRegion &&
      TEMPERATURES.activeRegion < TEMPERATURES.flare,
  );
  assert.ok(TEMPERATURES.flare >= 1e7 && TEMPERATURES.flare <= 2e7);
});

test("colours come off the AIA tables and the magnetogram runs grey to gold and blue", () => {
  const dark = rampColor("fe171", 0);
  const bright = rampColor("fe171", 1);
  assert.ok(dark[0] + dark[1] + dark[2] < bright[0] + bright[1] + bright[2]);
  const mid = (id) => rampColor(id, 0.5);
  assert.ok(mid("fe171")[0] > mid("fe171")[2] && mid("fe171")[0] > mid("fe171")[1], "171 is gold");
  assert.ok(mid("he304")[0] > mid("he304")[1] && mid("he304")[2] === 0, "304 is red");
  assert.ok(mid("fe94")[1] > mid("fe94")[0] && mid("fe94")[1] > mid("fe94")[2], "94 is green");
  assert.ok(mid("fe131")[1] > mid("fe131")[0] && mid("fe131")[2] > mid("fe131")[0], "131 is teal");
  assert.ok(
    mid("fe211")[0] > mid("fe211")[1] && mid("fe211")[2] > mid("fe211")[1],
    "211 is purple",
  );
  assert.ok(mid("fe335")[2] > mid("fe335")[0], "335 is blue");
  assert.ok(mid("fe193")[0] > mid("fe193")[2], "193 is bronze");
  /* The lab's gold for field out of the Sun, as the theme has it. */
  const gold = hexToLinear(cssHex(SOLAR_GOLD));
  MAGNETOGRAM_POSITIVE.forEach((c, i) => assert.ok(Math.abs(c - gold[i]) < 1e-9, "the lab's gold"));
  const positive = magnetogramColor(MAGNETOGRAM_SATURATION_T);
  const negative = magnetogramColor(-MAGNETOGRAM_SATURATION_T);
  const none = magnetogramColor(0);
  assert.ok(positive[0] > positive[2], "gold out of the Sun");
  assert.ok(negative[2] > negative[0], "blue into it");
  assert.ok(
    Math.abs(none[0] - none[1]) < 1e-9 && Math.abs(none[1] - none[2]) < 1e-9,
    "grey at zero",
  );
  /* It saturates softly: past a few times its scale, the pole's full colour. */
  const full = magnetogramColor(10);
  full.forEach((c, i) => assert.ok(Math.abs(c - MAGNETOGRAM_POSITIVE[i]) < 1e-9, "saturates"));
  assert.ok(positive[0] < full[0], "not yet full at its scale");
});

test("the corona's light falls off as Baumbach's fit and the wind is slow over the belt, fast from the holes", () => {
  /* Baumbach fitted the whole white-light corona; the model reads its flat term as the dust's. */
  assert.ok(Math.abs(whiteLightCorona(1) - (0.0532 + 1.425 + 2.565)) < 1e-9);
  assert.ok(Math.abs(kCorona(1) - (1.425 + 2.565)) < 1e-9);
  assert.ok(Math.abs(fCorona(1) - 0.0532) < 1e-9);
  assert.deepEqual(CORONA.k, [0.0532, 1.425, 2.565]);
  assert.deepEqual(BAUMBACH_POWERS, [2.5, 7, 17]);
  assert.ok(
    CORONA.eScaleHeight > 0.1 && CORONA.eScaleHeight < 0.2,
    `scale height ${CORONA.eScaleHeight} R`,
  );
  for (const r of [1.2, 1.5, 2, 3, 5]) assert.ok(kCorona(r) < kCorona(r - 0.1), `K falls at ${r}`);
  assert.ok(fCorona(2.5) > kCorona(2.5), "the dust takes over beyond about two radii");
  assert.ok(fCorona(1.5) < kCorona(1.5), "the electrons' light leads near the limb");
  assert.ok(eCorona(1) === 1 && eCorona(1.3) < 0.1, "the green line hugs the limb");
  assert.ok(coronaBrightness(1.5, 0) > coronaBrightness(1.5, 1), "a streamer outshines a hole");
  assert.equal(windSpeed(0), 400);
  assert.equal(windSpeed(Math.PI / 2), 750);
  assert.equal(windSpeed(-Math.PI / 2), 750);
  assert.ok(windSpeed(0.6, 0) === 750 && windSpeed(0.6, 0.5) === 400, "the belt widens at maximum");
});
