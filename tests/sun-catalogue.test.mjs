import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSTANTS,
  ELECTRON_VOLT_J,
  UNITS,
  convertFigure,
  formatFigure,
} from "@horizon/toolkit/science";

import { factSources, proseArgs, proseFacts } from "../src/lib/facts.ts";
import { SOURCES } from "../src/lib/sources.ts";
import { NAMED_STARS } from "../src/space/stellar.ts";
import { PROSE_FIGURES, SUN_CATALOGUE, sunFacts } from "../src/space/sun/catalogue.ts";
import {
  SUN_EQUATIONS,
  differentialRotation,
  goesClass,
  wolfNumberLaw,
} from "../src/space/sun/equations.ts";
import { fusionEnergy, PP_MASS_FRACTION } from "../src/space/sun/model/fusion.ts";
import { surfaceRateDegPerDay } from "../src/space/sun/model/rotation.ts";

const STATUSES = new Set(["verified", "derived", "teaching-choice", "flag"]);

test("every Sun fact has a known source, a unit of the kit, a status and a finite value within its range", () => {
  const facts = sunFacts();
  assert.ok(facts.length > 50);
  const plain = new Set(["count", "percent", "ratio"]);
  for (const { path, fact } of facts) {
    for (const source of factSources(fact)) assert.ok(SOURCES[source], `${path}: source ${source}`);
    assert.ok(fact.unit in UNITS || plain.has(fact.unit), `${path}: unit ${fact.unit}`);
    assert.ok(!fact.show || fact.show in UNITS, `${path}: shown in ${fact.show}`);
    assert.ok(STATUSES.has(fact.status), `${path}: status ${fact.status}`);
    assert.ok(fact.value !== undefined || fact.range, `${path}: a value or a span`);
    for (const value of [fact.value, ...(fact.range ?? [])])
      if (value !== undefined) assert.ok(Number.isFinite(value), `${path}: ${value}`);
    if (fact.range) {
      assert.ok(fact.range[0] < fact.range[1], `${path}: range order`);
      if (fact.value !== undefined)
        assert.ok(
          fact.range[0] <= fact.value && fact.value <= fact.range[1],
          `${path}: value in range`,
        );
    }
    if (fact.show)
      assert.ok(Number.isFinite(convertFigure(fact.value ?? fact.range[0], fact.unit, fact.show)));
  }
});

test("the model's derived figures land within the literature's ranges", () => {
  const { layers, activity, star } = SUN_CATALOGUE;
  const within = (fact, low, high) => {
    const value = fact.value ?? Math.sqrt(fact.range[0] * fact.range[1]);
    assert.ok(value >= low && value <= high, `${value} outside ${low}–${high}`);
  };
  within(layers.interior.coreRadius, 0.2, 0.3);
  within(layers.interior.centralTemperature, 1.5e7, 1.6e7);
  within(layers.interior.centralDensity, 140, 160);
  within(layers.interior.photonWalk, 3e12, 1e13);
  within(layers.photosphere.thickness, 300, 500);
  within(layers.photosphere.density, 1e-7, 4e-7);
  within(activity.sunspot.field, 0.2, 0.35);
  within(layers.chromosphere.thickness, 1_000, 3_000);
  within(layers.chromosphere.halpha, 656.2, 656.4);
  within(activity.field.meanField, 1e-4, 1e-3);
  within(activity.cycle.period, 10, 12);
  within(activity.cycle.maunderLength, 69, 71);
  within(activity.cycle.maunderGroups, 0, 2);
  within(activity.cycle.modernMaximumNumber, 80, 200);
  within(star.body.ppMassFraction, 0.7, 0.75);
  within(star.body.massLoss, 4e9, 4.5e9);
  within(star.body.meanDensity, 1.3, 1.5);
  within(star.body.surfaceGravity, 270, 280);
  within(star.rotation.carringtonPeriod, 25.3 * 86_400, 25.45 * 86_400);
});

test("measured figures are the shared catalogue's own objects, never copies", () => {
  assert.equal(SUN_CATALOGUE.star.body.radius, NAMED_STARS.sun.radius);
  assert.equal(SUN_CATALOGUE.star.body.teff, NAMED_STARS.sun.teff);
  assert.equal(SUN_CATALOGUE.star.rotation.equatorPeriod, NAMED_STARS.sun.rotation);
  assert.equal(SUN_CATALOGUE.activity.field.spotField, SUN_CATALOGUE.activity.sunspot.field);
});

test("every prose figure prints in both languages, with its plural category beside it", () => {
  const facts = proseFacts(PROSE_FIGURES);
  for (const locale of ["en", "cs"]) {
    const args = proseArgs(PROSE_FIGURES, locale);
    for (const name of Object.keys(PROSE_FIGURES)) {
      assert.ok(typeof args[name] === "string" && args[name].length > 0, `${locale} ${name}`);
      assert.ok(
        ["zero", "one", "two", "few", "many", "other"].includes(args[`${name}Plural`]),
        `${locale} ${name} plural`,
      );
      assert.ok(facts[name], `${name} has a fact`);
    }
  }
  const en = proseArgs(PROSE_FIGURES, "en");
  assert.equal(en.coreTemperatureMK, "15.7");
  assert.equal(en.centralDensity, "154");
  assert.equal(en.photosphereThicknessKm, "300–500");
  assert.equal(en.halphaNm, "656.3");
  assert.equal(
    proseArgs(PROSE_FIGURES, "cs").granuleKm,
    formatFigure("cs", SUN_CATALOGUE.layers.photosphere.granuleSize).text,
  );
  assert.equal(
    formatFigure("en", SUN_CATALOGUE.layers.interior.photonWalk, { in: "kyr", digits: 2 }).text,
    "190",
  );
});

test("the equations compute with the model's own functions", () => {
  assert.ok(Object.keys(SUN_EQUATIONS).length >= 12);
  assert.equal(SUN_EQUATIONS["loop-temperature"].compute({ B: 0.02, L: 0.3 }), 1e6);
  for (const [id, equation] of Object.entries(SUN_EQUATIONS)) {
    assert.equal(equation.id, id);
    assert.ok(equation.toString().length > 0 && equation.toLatex().length > 0);
  }
  assert.equal(differentialRotation.compute({ phi: 30 }), surfaceRateDegPerDay(Math.PI / 6));
  assert.ok(Math.abs(differentialRotation.compute({ phi: 0 }) - 14.713) < 1e-12);
  assert.equal(wolfNumberLaw.compute({ k: 1, g: 2, s: 5 }), 25);
  assert.ok(Math.abs(goesClass.compute({ k: 4, n: 1.5 }) - 1.5e-4) < 1e-15);
  assert.ok(
    Math.abs(
      SUN_EQUATIONS["pp-chain-energy"].compute({ m: 1 }) / (PP_MASS_FRACTION * 299_792_458 ** 2) -
        1,
    ) < 1e-12,
  );
  assert.ok(Math.abs(SUN_EQUATIONS["mass-loss-rate"].compute({ L: 3.828e26 }) - 4.26e9) < 1e7);
  assert.ok(
    Math.abs(SUN_EQUATIONS["alfven-speed"].compute({ B: 0.01, rho: 1e-12 }) - 8.92e6) < 2e4,
    "10 mT in 10⁻¹² kg/m³: ~9,000 km/s",
  );
  assert.ok(
    SUN_EQUATIONS["reconnection-energy"].compute({ B: 0.01, V: 1e24 }) > 1e25,
    "total uniform-field energy, not the free energy available to a flare",
  );
  assert.ok(SUN_EQUATIONS["photon-diffusion-time"].compute({ ell: 1e12 }) > 0);
  assert.equal(SUN_EQUATIONS["hydrostatic-equilibrium"].compute({ rho: 2, g: 10 }), -20);
});

// NIST neutral isotope masses imply Q = 26.73097 MeV, including annihilation and neutrinos.
// A natural-abundance hydrogen atomic weight instead gives about 27.38 MeV.
test("pp-chain mass defect agrees with the isotope Q value, not terrestrial atomic weights", () => {
  const qMeV = fusionEnergy(4 * CONSTANTS.hydrogen1AtomicMass.value) / ELECTRON_VOLT_J / 1e6;
  assert.ok(Math.abs(qMeV - 26.73097) < 0.00001, `${qMeV} MeV`);
  assert.ok(Math.abs(PP_MASS_FRACTION - 0.007118516) < 1e-9);
});
