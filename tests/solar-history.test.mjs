import assert from "node:assert/strict";
import test from "node:test";

import { FIGURES, moonById } from "@horizon/toolkit/bodies";

import { SOLAR_CATALOGUE } from "../src/space/solar-system/model/catalogue.ts";
import {
  MOON_DISTANCE,
  MOON_FORMED,
  ROCHE_LIMIT_KM,
  moonDistanceKm,
  moonDistanceRatio,
  moonExists,
  saturnRingsFormed,
} from "../src/space/solar-system/model/history.ts";
import { SATURN_RINGS_AGE } from "../src/space/solar-system/model/parameters.ts";

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test("Saturn's rings come in across their dated window and are whole since", () => {
  const [young, old] = SATURN_RINGS_AGE;
  assert.equal(saturnRingsFormed(old + 1e8), 0, "none before the window");
  assert.equal(saturnRingsFormed(old), 0);
  assert.equal(saturnRingsFormed(young), 1);
  assert.equal(saturnRingsFormed(0), 1, "whole today");
  const mid = saturnRingsFormed((young + old) / 2);
  assert.ok(mid > 0.4 && mid < 0.6, `half way at the window's middle: ${mid}`);
  let last = 0;
  for (let k = 0; k <= 20; k += 1) {
    const value = saturnRingsFormed(old - (k / 20) * (old - young));
    assert.ok(value >= last, "the rings only grow toward today");
    last = value;
  }
});

test("the Moon starts just outside the Roche limit and recedes through the tidal records to today", () => {
  const today = moonById("moon").aKm;
  /* The fluid Roche limit for the Moon about Earth is about 2.9 Earth radii. */
  near(ROCHE_LIMIT_KM / FIGURES.earth.meanKm, 2.9, 0.05, "Roche limit in Earth radii");
  assert.ok(!moonExists(MOON_FORMED + 1) && moonExists(MOON_FORMED));
  assert.equal(moonDistanceKm(MOON_FORMED + 1), null);
  assert.equal(moonDistanceRatio(MOON_FORMED + 1), 0);
  near(moonDistanceKm(MOON_FORMED), ROCHE_LIMIT_KM, 1e-6, "at the impact");
  /* Each record is met at its date. */
  for (const [name, record] of Object.entries(MOON_DISTANCE))
    near(moonDistanceKm(record.age.value), record.distance.value, 1e-6, name);
  near(moonDistanceKm(0), today, 1e-6, "today");
  near(moonDistanceRatio(0), 1, 1e-9, "today over today");
  near(moonDistanceRatio(3.22e9), 0.7, 1e-9, "Moodies share");
  /* Only ever outward. */
  let last = 0;
  for (let k = 0; k <= 1000; k += 1) {
    const km = moonDistanceKm(MOON_FORMED * (1 - k / 1000));
    assert.ok(km >= last, `recedes at step ${k}`);
    last = km;
  }
  /* The constant-torque bridge is fast while the Moon is close: most of the way out within the first few hundred million years. */
  assert.ok(moonDistanceRatio(MOON_FORMED - 3e8) > 0.5, "half way out within 300 Myr");
  assert.equal(SOLAR_CATALOGUE.moonDistance.joffre.distance.value, 321_800);
});
