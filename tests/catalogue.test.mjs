import assert from "node:assert/strict";
import test from "node:test";

import { UNITS } from "@horizon/toolkit/science";

import { holeById } from "../src/features/black-hole/lib/holes/index.ts";
import { catalogueFacts as deepFieldFacts } from "../src/features/deep-field/lib/model/catalogue/index.ts";
import { catalogueFacts as giantsFacts } from "../src/features/giants/lib/model/catalogue.ts";
import { catalogueFacts as orreryFacts } from "../src/features/orrery/lib/model/catalogue/index.ts";
import { factSources } from "../src/lib/facts.ts";
import { SOURCES } from "../src/lib/sources.ts";
import { solarCatalogueFacts } from "../src/space/solar-system/model/catalogue.ts";
import { BLACK_HOLES, ENGINES, NAMED_STARS, stellarCatalogueFacts } from "../src/space/stellar.ts";

for (const [name, facts] of [
  ["Solar System", solarCatalogueFacts],
  ["Stars and black holes", stellarCatalogueFacts],
  ["Orrery", orreryFacts],
  ["Deep Field", deepFieldFacts],
  ["Giants", giantsFacts],
]) {
  test(`${name} quantities have supported units and finite, consistent ranges`, () => {
    const plain = new Set(["count", "percent", "ratio"]);
    for (const { path, fact } of facts()) {
      for (const source of factSources(fact))
        assert.ok(SOURCES[source], `${path}: known source ${source}`);
      assert.ok(fact.unit in UNITS || plain.has(fact.unit), `${path}: unit ${fact.unit}`);
      assert.ok(!fact.show || fact.show in UNITS, `${path}: shown in ${fact.show}`);
      assert.ok(fact.value !== undefined || fact.range, `${path}: a value or a published span`);
      for (const value of [fact.value, ...(fact.range ?? [])])
        if (value !== undefined) assert.ok(Number.isFinite(value), `${path}: ${value}`);
      if (fact.range) {
        const [low, high] = fact.range;
        assert.ok(low < high, `${path}: range order`);
        if (fact.value !== undefined)
          assert.ok(low <= fact.value && fact.value <= high, `${path}: value outside its range`);
      }
    }
  });
}

test("the black-hole lab draws the measured masses of the shared catalogue", () => {
  const catalogued = { stellar: "cygnus-x1" };
  for (const preset of ["stellar", "gaia-bh3", "omega-cen", "gw231123", "sgr-a", "m87", "ton-618"])
    assert.equal(
      holeById(preset).massSolar,
      BLACK_HOLES[catalogued[preset] ?? preset].mass.value,
      preset,
    );
});

/* Where the CNO cycle overtakes the proton–proton chain, and the least mass that burns hydrogen, M☉. */
const CNO_ABOVE_MSUN = 1.3;
const HYDROGEN_BURNING_MSUN = 0.075;
const centre = (fact) => fact.value ?? Math.sqrt(fact.range[0] * fact.range[1]);

test("every star's engine agrees with its mass, and no black hole fuses anything", () => {
  for (const id of Object.keys(BLACK_HOLES))
    assert.ok(["accretion", "dormant"].includes(ENGINES[id].process), id);
  for (const [id, star] of Object.entries(NAMED_STARS)) {
    const { process, sources } = ENGINES[id];
    assert.ok(sources.length > 0, `${id} cites its engine`);
    if (!star.mass || star.mass.unit !== "Msun") continue;
    const mass = centre(star.mass);
    const fusing = !["cooling", "spinDown", "contraction"].includes(process);
    if (mass < HYDROGEN_BURNING_MSUN) assert.ok(!fusing, `${id} is too light to fuse hydrogen`);
    if (process === "ppChain")
      assert.ok(mass < CNO_ABOVE_MSUN, `${id} is light enough for the pp chain`);
    if (process === "cnoCycle")
      assert.ok(mass > CNO_ABOVE_MSUN, `${id} is heavy enough for the CNO cycle`);
  }
});

test("the HR diagram places every star it can, each light true to its radius and temperature", async () => {
  const { HR_POINTS, hrPointsOf } = await import("../src/space/hr-diagram.ts");
  const placed = Object.keys(HR_POINTS);
  /* Neither a pulsar nor a brown dwarf without a catalogued temperature stands on it. */
  assert.ok(!placed.includes("psr-j0030"));
  for (const point of Object.values(HR_POINTS)) {
    /* L = R² (T/T☉)⁴ within the catalogue's spreads: never a factor of two out. */
    const expected = point.radius ** 2 * (point.kelvin / 5772) ** 4;
    assert.ok(Math.abs(Math.log2(point.light / expected)) < 1, point.id);
  }
  /* Spectroscopy's stars all stand on it, so its diagram leaves none out. */
  const { STAR_IDS } = await import("../src/features/spectroscopy/lib/model/stars.ts");
  assert.deepEqual(
    hrPointsOf(STAR_IDS).map((point) => point.id),
    [...STAR_IDS],
  );
});
