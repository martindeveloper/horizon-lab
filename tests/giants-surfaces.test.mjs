import assert from "node:assert/strict";
import test from "node:test";

import { SOLAR_TEFF_K, blackbodyColor, decodeSrgb } from "@horizon/toolkit/science";

import { stellarTables } from "../src/features/giants/lib/graphics/stellar-tables.ts";
import { discTints } from "../src/features/giants/lib/graphics/tints.ts";
import {
  atmosphereProfile,
  continuumTable,
  limbCoefficients,
  limbIntensity,
  stellarContinuum,
} from "../src/features/giants/lib/model/atmosphere.ts";
import { RUNG_FACTS, drawn, radiusMetres } from "../src/features/giants/lib/model/catalogue.ts";
import { inspectCamera } from "../src/features/giants/lib/model/inspection.ts";
import {
  bodyAt,
  cameraAt,
  createLadder,
  placeBody,
} from "../src/features/giants/lib/model/ladder.ts";
import { LOOKS } from "../src/features/giants/lib/model/looks.ts";
import {
  elrTemperature,
  rocheOmega,
  rocheRadius,
  rotatingTemperatures,
} from "../src/features/giants/lib/model/rotation.ts";
import { RUNG_IDS, rungIndex } from "../src/features/giants/lib/model/rungs.ts";
import { surfaceDetail } from "../src/features/giants/lib/model/surface-detail.ts";
import {
  MAX_DISCS,
  PROFILE_SAMPLES,
  SPECTRUM_SAMPLES,
  SPECTRUM_MIN_K,
  SPECTRUM_MAX_K,
} from "../src/features/giants/lib/parameters.ts";
import { useGiants } from "../src/features/giants/lib/store.ts";

const near = (a, b, tolerance = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test("ELR temperatures satisfy the published analytic pole/equator limits and Roche potential", () => {
  for (const omega of [0, 0.01, 0.3, 0.7, 0.95, 0.99]) {
    const w2 = omega ** 2;
    const polar = 1 / (1 + w2 / 2);
    near(rocheOmega(polar), omega);
    // ELR (2011), equation 32, independent of the iterative latitude solution.
    const ratio =
      Math.sqrt(2 / (2 + w2)) * (1 - w2) ** (1 / 12) * Math.exp((-(4 / 3) * w2) / (2 + w2) ** 3);
    near(elrTemperature(omega, Math.PI / 2) / elrTemperature(omega, 0), ratio);
    let before = Infinity;
    for (let j = 0; j <= 100; j++) {
      const theta = (Math.PI * j) / 200;
      const r = rocheRadius(omega, theta);
      near(1 / r + (w2 * r * r * Math.sin(theta) ** 2) / 2, 1 + w2 / 2);
      const temperature = elrTemperature(omega, theta);
      assert.ok(Number.isFinite(temperature) && temperature > 0);
      assert.ok(temperature <= before + 1e-8, "temperature decreases from pole to equator");
      near(elrTemperature(omega, Math.PI - theta), temperature, 1e-7);
      before = temperature;
    }
  }
  assert.throws(() => rocheOmega(0.6), RangeError);
  assert.throws(() => rocheRadius(1, 0), RangeError);
});

test("rotator profiles conserve adopted luminosity on the drawn spheroid and match Vega's temperature scale", () => {
  for (const id of ["vega", "achernar"]) {
    const facts = RUNG_FACTS[id];
    const a = drawn(facts.radius);
    const ratio = drawn(facts.polar) / a;
    const look = LOOKS[rungIndex(id)];
    const temperatures = look.temperatures;
    let integral = 0;
    const count = 8192;
    for (let j = 0; j < count; j++) {
      const y = (j + 0.5) / count;
      const p = y * (temperatures.length - 1);
      const k = Math.floor(p);
      const T = temperatures[k] + (temperatures[k + 1] - temperatures[k]) * (p - k);
      integral += ((T / SOLAR_TEFF_K) ** 4 * Math.sqrt(ratio ** 2 * (1 - y ** 2) + y ** 2)) / count;
    }
    near(a * a * integral, drawn(facts.luminosity), 0.0002);
    assert.ok(look.poleK > look.equatorK);
    near((look.tilt * 180) / Math.PI, id === "vega" ? 83.8 : 29.4);
  }
  const vega = LOOKS[rungIndex("vega")];
  assert.ok(Math.abs(vega.equatorK - 8910) < 100);
  assert.ok(Math.abs(vega.poleK - 10070) < 150);
  for (const T of rotatingTemperatures(1, 1, 1)) near(T, SOLAR_TEFF_K);
});

test("atmosphere profiles retain published coefficients, disk flux and wavelength-dependent darkening", () => {
  // Claret & Bloemen corrected tableeq5: ATLAS, 5750 K, log g=4.5, [M/H]=0, xi=2.
  const coefficients = limbCoefficients(5750, 4.5);
  assert.deepEqual(coefficients[1], [0.4482, 0.2143, 0.3961, -0.2625]);
  assert.ok(
    limbIntensity(coefficients[2], 0.1) < limbIntensity(coefficients[0], 0.1),
    "blue darkens more than red",
  );
  for (const c of coefficients) {
    near(limbIntensity(c, 1), 1);
    let flux = 0;
    for (let j = 0; j < 10000; j++) {
      const mu = (j + 0.5) / 10000;
      flux += (2 * mu * limbIntensity(c, mu)) / 10000;
    }
    near(flux, 1 - c.reduce((sum, a, k) => sum + (a * (k + 1)) / (k + 5), 0), 1e-7);
  }
  const a = limbCoefficients(5500, 4);
  const b = limbCoefficients(5750, 4);
  const middle = limbCoefficients(5625, 4);
  middle.forEach((c, channel) => c.forEach((v, j) => near(v, (a[channel][j] + b[channel][j]) / 2)));
  // Out-of-grid giants clamp, and no ordinary-star coefficients are applied to remnants.
  assert.deepEqual(limbCoefficients(3200, -0.5), limbCoefficients(3500, 0));
  const fallback = atmosphereProfile(25000, null);
  near(fallback[0], 0.4, 1e-7);
  near(fallback[(PROFILE_SAMPLES - 1) * 4], 1);
  for (const T of [2500, 3000, 4000, 5772, 10000, 25000, 46000])
    for (const g of [-1, 0, 2, 4.5, 6]) {
      const profile = atmosphereProfile(T, g);
      for (let j = 0; j < profile.length; j++)
        assert.ok(
          Number.isFinite(profile[j]) && (j % 4 === 3 || (profile[j] >= 0 && profile[j] <= 1)),
        );
    }
});

test("the continuum texture preserves spectral colours and relative light between texels", () => {
  const table = continuumTable();
  let previous = -Infinity;
  for (let j = 0; j < SPECTRUM_SAMPLES; j++) {
    const logY = table[j * 4 + 3];
    assert.ok(logY > previous, "visible radiance grows with temperature");
    previous = logY;
  }
  for (const T of [1500, 3000, 5772, 10070, 46000, 90000]) {
    const at =
      (Math.log(T / SPECTRUM_MIN_K) / Math.log(SPECTRUM_MAX_K / SPECTRUM_MIN_K)) *
      (SPECTRUM_SAMPLES - 1);
    const k = Math.floor(at);
    const actual = Array.from(
      { length: 4 },
      (_, c) => table[k * 4 + c] + (table[(k + 1) * 4 + c] - table[k * 4 + c]) * (at - k),
    );
    const expected = stellarContinuum(T);
    actual.forEach((v, c) => near(v, expected[c], 0.0006));
    const rgb = blackbodyColor(T).map(decodeSrgb);
    const peak = Math.max(...actual.slice(0, 3));
    rgb.forEach((v, c) => near(Math.max(0, actual[c]) / peak, v, 0.001));
  }
});

test("stellar textures follow disc ownership, avoid repeated uploads, and release resources", () => {
  const tables = stellarTables(LOOKS);
  const tints = discTints(LOOKS);
  try {
    const texture = tables.uniforms.uProfiles.value;
    for (const id of ["sun", "vega", "achernar", "sirius-b", "proxima"]) {
      const index = rungIndex(id);
      tables.assign(0, index);
      tints.assign(0, index);
      const version = texture.version;
      tables.assign(0, index);
      assert.equal(texture.version, version, "unchanged owner does not upload again");
      near(texture.image.data[3], LOOKS[index].equatorK, 1e-6);
      near(texture.image.data[(PROFILE_SAMPLES - 1) * 4 + 3], LOOKS[index].poleK, 1e-6);
      const reference = stellarContinuum((LOOKS[index].equatorK + LOOKS[index].poleK) / 2);
      near(tints.uniform.value.image.data[3], reference[3], 1e-6);
    }
    assert.equal(texture.image.data.length, MAX_DISCS * PROFILE_SAMPLES * 4);
  } finally {
    let disposed = 0;
    for (const { value } of Object.values(tables.uniforms))
      value.addEventListener("dispose", () => disposed++);
    tables.dispose();
    tints.dispose();
    assert.equal(disposed, 2);
  }
});

test("only the focus owner receives fine surface work, including stars without magnetic weather", () => {
  const index = rungIndex("rigel");
  assert.equal(LOOKS[index].activity, "none");
  for (const quality of ["economy", "standard", "cinema", "max"]) {
    const full = RUNG_IDS.map((_, i) => surfaceDetail(i, { star: index, level: 1 }, quality));
    assert.equal(full.filter((budget) => budget > 0).length, 1);
    assert.ok(full[index] > 0);
    assert.equal(surfaceDetail(index, { star: index, level: 0 }, quality), 0);
    assert.ok(surfaceDetail(index, { star: index, level: 0.5 }, quality) < full[index]);
  }
  assert.ok(
    surfaceDetail(index, { star: index, level: 1 }, "cinema") >
      surfaceDetail(index, { star: index, level: 1 }, "standard"),
  );
  assert.ok(
    surfaceDetail(index, { star: index, level: 1 }, "standard") >
      surfaceDetail(index, { star: index, level: 1 }, "economy"),
  );
});

test("inspection magnifies physical sizes about the focus, keeping picking and the ruler consistent", () => {
  const stage = { width: 1200, height: 800 };
  const ladder = createLadder(RUNG_IDS.map(radiusMetres));
  const focus = rungIndex("sun");
  const originalCamera = cameraAt(ladder, focus, stage);
  const original = placeBody(ladder, originalCamera, stage, focus);
  for (const zoom of [1, 4, 16]) {
    const camera = inspectCamera(cameraAt(ladder, focus, stage), ladder, focus, stage, zoom);
    const body = placeBody(ladder, camera, stage, focus);
    near(body.x, original.x);
    near(body.y, original.y);
    near(body.radius, original.radius * zoom);
    near(camera.scale * body.radius, radiusMetres("sun").radius);
    assert.equal(bodyAt(ladder, focus, stage, body.x, body.y, 0, camera), focus);
  }
  const api = useGiants.getState();
  api.setSurfaceZoom(16);
  api.go(focus + 1);
  assert.equal(useGiants.getState().surfaceZoom, 1, "a flight restores the full view");
  api.setSurfaceZoom(4);
  api.resetView();
  assert.equal(useGiants.getState().surfaceZoom, 1);
});
