import assert from "node:assert/strict";
import test from "node:test";

import { LIGHT_YEAR_KM } from "@horizon/toolkit/science";

import {
  FAR_ANCHOR_IDS,
  anchorAt,
  anchorNameKey,
  anchorRadius,
  createAnchorCache,
  isBodyAnchor,
  isFlyable,
} from "../src/features/voyage/lib/model/anchors.ts";
import {
  MAX_SCALE_FACTOR,
  cmbKelvin,
  lookbackYears,
  scaleFactorAt,
} from "../src/features/voyage/lib/model/comoving.ts";
import { EVENT_HORIZON_LY } from "../src/space/cosmos/model/cosmos.ts";

const YEAR_S = 365.25 * 86_400;
const ly = (v) => Math.hypot(...v) / LIGHT_YEAR_KM;

test("the far places sit at their published distances from the Sun", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const at = (id) => anchorAt(id, now, 1, [0, 0, 0]);
  assert.ok(Math.abs(ly(at("alphaCen")) - 4.34) < 0.05, `${ly(at("alphaCen"))} ly`);
  assert.ok(Math.abs(ly(at("galacticCentre")) / 1000 - 27) < 1.5, `${ly(at("galacticCentre"))} ly`);
  assert.ok(Math.abs(ly(at("andromeda")) / 1e6 - 2.5) < 0.05);
  assert.ok(Math.abs(ly(at("edge")) - EVENT_HORIZON_LY) < 1e-6 * EVENT_HORIZON_LY);
  for (const id of FAR_ANCHOR_IDS) {
    assert.ok(at(id).every(Number.isFinite), id);
    assert.ok(anchorRadius(id) > 0, id);
    assert.equal(isBodyAnchor(id), false);
    assert.match(anchorNameKey(id), /^(names|anchors)\./);
  }
  /* The probes on their JPL tracks, the nearest star, the Magellanic Clouds. */
  const au = (v) => Math.hypot(...v) / 149_597_870.7;
  assert.ok(au(at("voyager1")) > 165 && au(at("voyager1")) < 175, `${au(at("voyager1"))} au`);
  assert.ok(Math.abs(ly(at("proxima")) - 4.25) < 0.05, `${ly(at("proxima"))} ly`);
  assert.ok(Math.abs(ly(at("lmc")) / 1000 - 163) < 8, `${ly(at("lmc"))} ly`);
  assert.equal(isBodyAnchor("moon"), true);
  assert.equal(anchorNameKey("moon"), "names.moon");
});

test("the expansion runs with Earth's clock: a is 1 today and grows, the background cools", () => {
  /* Continuous through today: no step as the clocks start. */
  assert.ok(Math.abs(scaleFactorAt(0) - 1) < 1e-9);
  assert.ok(Math.abs(scaleFactorAt(1) - 1) < 1e-9);
  assert.ok(Math.abs(cmbKelvin(scaleFactorAt(0)) - 2.7255) < 1e-6);
  const gyr = 1e9 * YEAR_S;
  /* In a billion years the universe is about 7 % larger (H₀ ≈ 67 km/s/Mpc, a bit of acceleration). */
  const a1 = scaleFactorAt(gyr);
  assert.ok(a1 > 1.06 && a1 < 1.08, `${a1}`);
  assert.ok(cmbKelvin(a1) < 2.7255 / 1.06);
  /* The far past is smaller, never negative. */
  assert.ok(scaleFactorAt(-10 * gyr) > 0 && scaleFactorAt(-10 * gyr) < 0.4);
  /* A Voyager trip across the cosmic map runs Earth's clock past 10¹⁴ years: a holds, finite. */
  for (const years of [1e11, 1e14, 1e20]) {
    const a = scaleFactorAt(years * YEAR_S);
    assert.ok(Number.isFinite(a) && a <= MAX_SCALE_FACTOR && a > a1, `${a} at ${years} years`);
  }
});

test("the expansion carries what lies beyond the Local Group, and leaves what is bound", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const a = 2;
  const ratio = (id) =>
    Math.hypot(...anchorAt(id, now, a, [0, 0, 0])) / Math.hypot(...anchorAt(id, now, 1, [0, 0, 0]));
  for (const id of ["virgoCluster", "edge"]) assert.ok(Math.abs(ratio(id) - a) < 1e-12, id);
  for (const id of ["moon", "alphaCen", "galacticCentre", "lmc", "smc", "andromeda", "triangulum"])
    assert.ok(Math.abs(ratio(id) - 1) < 1e-12, id);
  /* The engine's cache reads the scale the clock set, and places a moon as anchorAt does. */
  let scale = 1;
  const cached = createAnchorCache(() => scale);
  for (const id of ["moon", "virgoCluster"]) {
    scale = a;
    assert.deepEqual(cached(id, now, [0, 0, 0]), anchorAt(id, now, a, [0, 0, 0]), id);
    scale = 1;
    assert.deepEqual(cached(id, now, [0, 0, 0]), anchorAt(id, now, 1, [0, 0, 0]), id);
  }
});

test("the edge stands on the event horizon: no drive reaches it, every other place can be flown to", () => {
  /* The event horizon, integrated from the same cosmology: 16.6 billion light-years. */
  assert.ok(Math.abs(EVENT_HORIZON_LY / 1e9 - 16.6) < 0.1, `${EVENT_HORIZON_LY}`);
  assert.equal(isFlyable("edge"), false);
  for (const id of FAR_ANCHOR_IDS) if (id !== "edge") assert.equal(isFlyable(id), true, id);
});

test("light's age: the distance nearby, less than the distance across the expanding map", () => {
  assert.ok(Math.abs(lookbackYears(2.5e6 * LIGHT_YEAR_KM) - 2.5e6) < 1);
  /* A billion light-years comoving left about 0.95 billion years ago; ten, about 8. */
  const gyr = lookbackYears(1e9 * LIGHT_YEAR_KM) / 1e9;
  assert.ok(gyr > 0.9 && gyr < 1, `${gyr}`);
  const far = lookbackYears(1e10 * LIGHT_YEAR_KM) / 1e9;
  assert.ok(far > 7 && far < 9, `${far}`);
  assert.ok(
    lookbackYears(EVENT_HORIZON_LY * LIGHT_YEAR_KM) <
      lookbackYears(2 * EVENT_HORIZON_LY * LIGHT_YEAR_KM),
  );
});
