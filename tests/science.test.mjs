import assert from "node:assert/strict";
import test from "node:test";

import {
  argumentOfPerihelion,
  keplerEquation,
  meanAnomaly,
  perifocalX,
  perifocalY,
  secularElement,
} from "@horizon/toolkit/bodies";
import {
  CONSTANTS,
  convert,
  keplerThirdLaw,
  lightTravelTime,
  meanDensity,
  measure,
  parallaxDistance,
  pressureScaleHeight,
  schwarzschildRadius,
  stefanBoltzmann,
  tangentialVelocity,
} from "@horizon/toolkit/science";

import {
  circularOrbitEnergy,
  circularOrbitMomentum,
  diskRedshift,
  diskTemperature,
  limbDarkening,
  rainClockRate,
} from "../src/features/black-hole/lib/equations.ts";
import {
  advancePlay,
  noteOf,
  sliderToYearsAgo,
  yearsAgoToSlider,
} from "../src/features/orrery/lib/model/timeline.ts";
import {
  galacticHeight,
  galacticRadius,
  galacticWarp,
  spiralArm,
} from "../src/space/galaxy/model/equations.ts";
import { SOLAR_CATALOGUE } from "../src/space/solar-system/model/catalogue.ts";
import {
  galacticAngle,
  gasDisk,
  migrationProgress,
  tracerSemiMajorAxis,
} from "../src/space/solar-system/model/equations.ts";
import { GALACTIC_YEAR, SUN_BIRTH } from "../src/space/solar-system/model/parameters.ts";

const near = (actual, expected, tolerance, label) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label ?? ""} ${actual} is not within ${tolerance} of ${expected}`,
  );

test("physical constants match published values", () => {
  assert.equal(CONSTANTS.speedOfLight.value, 299_792_458);
  assert.equal(CONSTANTS.astronomicalUnit.value, 149_597_870_700);
  assert.equal(CONSTANTS.julianYear.value, 31_557_600);
  near(CONSTANTS.parsec.value, 3.085677581491367e16, 1e3, "pc");
  near(CONSTANTS.lightYear.value, 9.4607304725808e15, 1, "ly");
  assert.equal(CONSTANTS.gravitationalConstant.value, 6.6743e-11);
  assert.equal(CONSTANTS.solarRadius.value, 6.957e8);
  assert.equal(CONSTANTS.solarEffectiveTemperature.value, 5772);
  assert.equal(CONSTANTS.jupiterGravitationalParameter.value, 1.2668653e17);
  for (const [id, constant] of Object.entries(CONSTANTS)) {
    assert.ok(Number.isFinite(constant.value) && constant.value > 0, id);
  }
});

test("units convert within a dimension and refuse to mix dimensions", () => {
  near(convert(1, "pc", "ly"), 3.26156, 1e-5);
  near(convert(1, "pc", "au"), 206_264.806, 1e-3);
  near(convert(1, "arcsec", "rad"), 4.8481368e-6, 1e-12);
  near(convert(180, "deg", "rad"), Math.PI, 1e-15);
  near(convert(1, "Gyr", "yr"), 1e9, 1e-3);
  near(convert(1, "c", "km/s"), 299_792.458, 1e-9);
  assert.throws(() => convert(1, "au", "s"), TypeError);
  assert.throws(() => convert(Number.NaN, "au", "km"), RangeError);
});

test("measures convert, choose a readable unit and print for the UI and LaTeX", () => {
  near(measure(5.2, "au").in("km"), 7.779e8, 1e5);
  assert.equal(measure(3.1e16, "m").best(["km", "au", "ly", "pc"]).unit, "pc");
  assert.equal(measure(1.5e8, "km").best(["km", "au", "ly"]).unit, "au");
  assert.equal(measure(5.37, "au").toString(), "5.37 au");
  assert.equal(measure(5.37, "au").to("ly").toString(), "8.49 × 10⁻⁵ ly");
  assert.equal(measure(5.37, "au").to("ly").toLatex(), "8.49 \\times 10^{-5}\\,\\mathrm{ly}");
  assert.equal(
    measure(4.24, "ly").format({ locale: "cs", symbols: { ly: "sv. r." } }),
    "4,24 sv. r.",
  );
});

test("shared laws reproduce textbook values", () => {
  assert.equal(keplerThirdLaw.compute({ a: 1 }), 1);
  near(keplerThirdLaw.compute({ a: 5.2026 }), 11.87, 0.01, "Jupiter");
  near(keplerThirdLaw.compute({ a: 30.07 }), 164.9, 0.1, "Neptune");
  near(keplerThirdLaw.compute({ a: measure(778.5e6, "km") }), 11.87, 0.01, "measure input");
  near(lightTravelTime.compute({ d: measure(1, "au") }), 499.004784, 1e-6, "1 au of light");
  near(schwarzschildRadius.measure({ M: measure(1, "Msun") }).in("km"), 2.953, 0.001, "Sun Rs");
  near(parallaxDistance.compute({ p: 0.7685 }), 1.3012, 1e-4, "Proxima");
  near(tangentialVelocity.compute({ mu: 1, d: 1 }), 4.74047, 1e-5, "1″/yr at 1 pc");
  assert.equal(stefanBoltzmann.compute({ R: 1, T: 5772 }), 1, "the Sun's own light");
  near(stefanBoltzmann.compute({ R: 2, T: 2886 }), 0.25, 1e-12, "twice as wide, half as hot");
  near(
    pressureScaleHeight.compute({ T: 288, mu: 28.96, g: 9.80665 }) / 1e3,
    8.43,
    0.01,
    "Earth's air",
  );
  near(meanDensity.compute({ M: measure(1, "Msun"), R: measure(1, "Rsun") }), 1409, 1, "the Sun");
  assert.equal(keplerThirdLaw.example({ a: 5.2 }), "a = 5.2 au → P = 11.9 yr");
  assert.equal(keplerThirdLaw.units(), "a [au], P [yr]");
});

test("solar catalogue values agree with physical constants", () => {
  const sun = SOLAR_CATALOGUE.sun.sun;
  near(sun.au.value / 1e6, 149.6, 0.01);
  near(sun.auLightTime.value / 60, 8.317, 0.001);
  assert.equal(sun.radius.value, 695_700);
  near(sun.earthDiameters.value, 109.1, 0.05);
});

test("circular Kerr orbits recover Schwarzschild energy and momentum", () => {
  // a = 0, r = 6 (ISCO): E = √(8/9), L = 2√3.
  near(circularOrbitEnergy.compute({ r: 6, a: 0 }), Math.sqrt(8 / 9), 1e-12, "E at ISCO");
  near(circularOrbitMomentum.compute({ r: 6, a: 0 }), 2 * Math.sqrt(3), 1e-12, "L at ISCO");
  // Far away the orbit is Newtonian: E → 1, L → √r.
  near(circularOrbitEnergy.compute({ r: 1e6, a: 0.5 }), 1, 1e-6);
  near(circularOrbitMomentum.compute({ r: 1e6, a: 0.5 }) / 1e3, 1, 1e-3);
});

test("orrery ephemeris formulas reproduce Meeus and the JPL table", () => {
  // Meeus example 30.a: M = 5°, e = 0.1 → E = 5.554589°.
  const E = keplerEquation.compute({ M: (5 * Math.PI) / 180, e: 0.1 });
  near((E * 180) / Math.PI, 5.554589, 1e-6, "Kepler's equation");
  assert.equal(keplerEquation.compute({ M: 1, e: 0 }), 1);
  assert.equal(argumentOfPerihelion.compute({ varpi: 102.9, node: 0 }), 102.9);
  near(meanAnomaly.compute({ L: 100.46, varpi: 102.94 }), -2.48, 1e-9);
  // Earth's semi-major axis drifts by 0.00000562 au per century.
  near(secularElement.compute({ x0: 1.00000261, rate: 0.00000562, T: 1 }), 1.00000823, 1e-12);
  // Perifocal ellipse: perihelion at E = 0, the minor axis at E = π/2.
  near(perifocalX.compute({ a: 1, e: 0.5, E: 0 }), 0.5, 1e-12);
  near(perifocalY.compute({ a: 1, e: 0.5, E: Math.PI / 2 }), Math.sqrt(0.75), 1e-12);
});

test("orrery migration and galaxy formulas hold their anchors", () => {
  assert.equal(gasDisk.compute({ t: 4.6e9 }), 1);
  assert.equal(gasDisk.compute({ t: 4.5e9 }), 0);
  assert.equal(migrationProgress.compute({ t: 4.6e9 }), 0);
  near(migrationProgress.compute({ t: 4.475e9 }), 0.5, 1e-9);
  assert.equal(migrationProgress.compute({ t: 0 }), 1);
  near(tracerSemiMajorAxis.compute({ a0: 20, a1: 20_000, s: 0.5 }), Math.sqrt(20 * 20_000), 1e-9);
  near(galacticAngle.compute({ t: GALACTIC_YEAR }), 2 * Math.PI, 1e-12, "one lap");
  assert.equal(galacticRadius.compute({ t: 0 }), 27_000);
  near(galacticHeight.compute({ t: 0 }), 68, 1e-9, "today's height");
  near(spiralArm.compute({ R: 6.9, Rk: 6.9 }), 0, 1e-12, "arm crosses the Sun–centre line at R_k");
  near(spiralArm.compute({ R: 6.9 / Math.exp(Math.tan((13 * Math.PI) / 180)), Rk: 6.9 }), 1, 1e-12);
  assert.equal(galacticWarp.compute({ R: 9, beta: 1 }), 0);
  assert.ok(galacticWarp.compute({ R: 15, beta: Math.PI / 2 }) > 0, "warps north");
});

test("orrery timeline gives each formation stage room, a note and a play stop", () => {
  for (const u of [0, 0.05, 0.1, 0.12, 0.15, 0.19, 0.22, 0.25, 0.4, 0.62, 0.8, 1])
    near(yearsAgoToSlider(sliderToYearsAgo(u)), u, 1e-9, `slider ${u}`);
  for (let k = 1; k <= 1000; k += 1)
    assert.ok(sliderToYearsAgo(k / 1000) <= sliderToYearsAgo((k - 1) / 1000), "monotonic");
  // Dust and planetesimals each span several slider steps, not a fraction of one.
  const stretch = (from, to) =>
    yearsAgoToSlider(SUN_BIRTH - to) - yearsAgoToSlider(SUN_BIRTH - from);
  assert.ok(stretch(1e3, 1e5) > 0.04, "dust");
  assert.ok(stretch(1e5, 1e6) > 0.015, "planetesimals");
  const stages = [
    [SUN_BIRTH - 5e3, "dust"],
    [SUN_BIRTH - 3e5, "planetesimals"],
    [SUN_BIRTH - 2.5e6, "gasDisk"],
    [SUN_BIRTH - 1e7, "accretion"],
    [SUN_BIRTH - 3e7, "belt"],
    [SUN_BIRTH - 6e7, "moon"],
    [4.47e9, "clearing"],
    [3.9e9, "bombardment"],
    [1e9, "today"],
  ];
  for (const [yearsAgo, note] of stages) assert.equal(noteOf(yearsAgo), note, `${yearsAgo}`);
  // A long frame in the interstellar era stops at the Sun's birth instead of skipping the disk.
  assert.equal(advancePlay(SUN_BIRTH + 1e6, 1), SUN_BIRTH);
  assert.ok(advancePlay(SUN_BIRTH - 1e4, 1 / 60) > SUN_BIRTH - 1.1e4, "early stages play slowly");
  const notes = new Set(Array.from({ length: 1001 }, (_, k) => noteOf(sliderToYearsAgo(k / 1000))));
  for (const [, note] of stages) assert.ok(notes.has(note), `${note} is reachable on the slider`);
});

test("disk shading conserves flux", () => {
  assert.equal(rainClockRate.compute({ r: 2 }), 0);
  // Flux-weighted mean of I(μ) over the visible hemisphere is 1: ∫₀¹ 2μ I(μ) dμ.
  let integral = 0;
  for (let k = 0; k < 10_000; k += 1) {
    const mu = (k + 0.5) / 10_000;
    integral += 2 * mu * limbDarkening.compute({ mu }) * 1e-4;
  }
  near(integral, 1, 1e-6, "limb darkening normalisation");
  assert.equal(diskTemperature.compute({ flux: 1, scale: 1 }), 15_800);
  // Face-on Schwarzschild ISCO seen from far away: g = 1/uᵗ = √(1 − 3/r).
  near(
    diskRedshift.compute({ ut: 1 / Math.sqrt(0.5), omega: 0, E: 1, L: 0 }),
    Math.sqrt(0.5),
    1e-12,
  );
});
