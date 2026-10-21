import assert from "node:assert/strict";
import test from "node:test";

/** Voyage's far places and the expansion its clocks run through, against published figures. */
import { LIGHT_YEAR_KM } from "@horizon/toolkit/science";

import {
  FAR_ANCHOR_IDS,
  anchorAt,
  anchorNameKey,
  anchorRadius,
  isBodyAnchor,
} from "../src/features/voyage/lib/model/anchors.ts";
import {
  EDGE_LY,
  cmbKelvinAt,
  lookbackYears,
  scaleFactorAt,
} from "../src/features/voyage/lib/model/comoving.ts";

const YEAR_S = 365.25 * 86_400;
const ly = (v) => Math.hypot(...v) / LIGHT_YEAR_KM;

test("the far places sit at their published distances from the Sun", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const at = (id) => anchorAt(id, now, [0, 0, 0]);
  assert.ok(Math.abs(ly(at("alphaCen")) - 4.34) < 0.05, `${ly(at("alphaCen"))} ly`);
  assert.ok(Math.abs(ly(at("galacticCentre")) / 1000 - 27) < 1.5, `${ly(at("galacticCentre"))} ly`);
  assert.ok(Math.abs(ly(at("andromeda")) / 1e6 - 2.5) < 0.05);
  assert.ok(Math.abs(ly(at("edge")) - EDGE_LY) < 1e-6 * EDGE_LY);
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
  assert.ok(Math.abs(cmbKelvinAt(0) - 2.7255) < 1e-6);
  /* The event horizon, integrated from the same cosmology: 16.6 billion light-years. */
  assert.ok(Math.abs(EDGE_LY / 1e9 - 16.6) < 0.1, `${EDGE_LY}`);
  const gyr = 1e9 * YEAR_S;
  /* In a billion years the universe is about 7 % larger (H₀ ≈ 67 km/s/Mpc, a bit of acceleration). */
  const a1 = scaleFactorAt(gyr);
  assert.ok(a1 > 1.06 && a1 < 1.08, `${a1}`);
  assert.ok(cmbKelvinAt(gyr) < 2.7255 / 1.06);
  /* The far past is smaller, never negative. */
  assert.ok(scaleFactorAt(-10 * gyr) > 0 && scaleFactorAt(-10 * gyr) < 0.4);
});

test("light's age: the distance nearby, less than the distance across the expanding map", () => {
  assert.ok(Math.abs(lookbackYears(2.5e6 * LIGHT_YEAR_KM) - 2.5e6) < 1);
  /* A billion light-years comoving left about 0.95 billion years ago; ten, about 8. */
  const gyr = lookbackYears(1e9 * LIGHT_YEAR_KM) / 1e9;
  assert.ok(gyr > 0.9 && gyr < 1, `${gyr}`);
  const far = lookbackYears(1e10 * LIGHT_YEAR_KM) / 1e9;
  assert.ok(far > 7 && far < 9, `${far}`);
  assert.ok(lookbackYears(EDGE_LY * LIGHT_YEAR_KM) < lookbackYears(2 * EDGE_LY * LIGHT_YEAR_KM));
});
