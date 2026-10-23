import assert from "node:assert/strict";
import test from "node:test";

import { createSunModel, dipoleAt, SEEDED_GROUPS } from "../src/space/sun/frame.ts";
import {
  DAY_S,
  MAX_FIELD_LINES,
  PROMINENCE_SLOTS,
  REGION_SLOTS,
} from "../src/space/sun/model/parameters.ts";

const input = (over = {}) => ({
  time: 120 * DAY_S,
  cyclePhase: 25.4,
  light: "fe171",
  eruptionScrub: null,
  fieldLineCount: 80,
  ...over,
});

test("the surface frame turns prograde with west, where longitude grows, on the right seen from Earth", async () => {
  const { surfacePoint, westAt, northAt, tiltedAxis } =
    await import("../src/space/sun/model/surface.ts");
  const { Vector3 } = await import("three");
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
  /* Seen from +x with +y up, the viewer's right is −z: a larger longitude lies to the right. */
  const ahead = surfacePoint(0, 0.1);
  assert.ok(ahead[2] < 0, "west is to the right");
  /* A prograde turn (+y, right-hand) carries +x toward −z: toward larger longitudes. */
  const carried = new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), 0.1);
  near(carried.z, ahead[2]);
  near(carried.x, ahead[0]);
  /* West is the derivative along longitude; north the derivative along latitude; both unit and tangent. */
  const p = surfacePoint(0.4, 1.1);
  const w = westAt(0.4, 1.1);
  const n = northAt(0.4, 1.1);
  const dp = surfacePoint(0.4, 1.1 + 1e-6).map((v, i) => (v - p[i]) / 1e-6 / Math.cos(0.4));
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(dp[i] - w[i]) < 1e-5, "west is +lon");
  near(w[0] * p[0] + w[1] * p[1] + w[2] * p[2], 0);
  near(n[0] * p[0] + n[1] * p[1] + n[2] * p[2], 0);
  assert.ok(n[1] > 0, "north climbs");
  /* Joy: the leading end of a tilted axis is nearer the equator in both hemispheres. */
  for (const lat of [0.4, -0.4]) {
    const axis = tiltedAxis(lat, 0, 0.2);
    assert.ok(Math.sign(axis[1]) === -Math.sign(lat), `equatorward at ${lat}`);
    assert.ok(axis[0] * westAt(lat, 0)[0] + axis[2] * westAt(lat, 0)[2] > 0.9, "mostly west");
  }
});

test("a model fills one frame and its arrays each call, reading the contract's fields", () => {
  const model = createSunModel(5);
  const first = model.frameAt(input());
  assert.equal(first, model.frame);
  assert.equal(first.regions.length, REGION_SLOTS);
  assert.equal(first.prominences.length, PROMINENCE_SLOTS);
  assert.equal(first.fieldLines.length, 80);
  assert.equal(first.light, "fe171");
  assert.ok(Math.abs(first.cyclePhase - 0.4) < 1e-9);
  assert.ok(Math.abs(first.dipole + Math.cos(Math.PI * 25.4)) < 1e-12);
  assert.ok(first.surfaceTurn >= 0 && first.surfaceTurn < 2 * Math.PI);
  assert.ok(first.wolfNumber >= 0);
  const lines = first.fieldLines.slice();
  const second = model.frameAt(input({ time: 120 * DAY_S + 1, light: "white" }));
  assert.equal(second, first);
  assert.equal(second.light, "white");
  assert.deepEqual(second.fieldLines, lines, "the field was not retraced for a second's drift");
  model.frameAt(input({ fieldLineCount: 30 }));
  assert.equal(first.fieldLines.length, 30);
  model.frameAt(input({ fieldLineCount: 10 * MAX_FIELD_LINES }));
  assert.equal(first.fieldLines.length, MAX_FIELD_LINES, "capped");
  assert.equal(dipoleAt(25), 1, "the north pole was positive at the 2019 minimum");
  assert.equal(dipoleAt(26), -1);
  assert.ok(Math.abs(dipoleAt(25.5)) < 1e-12, "zero at maximum");
});

test("a scrubbed eruption carries its arcade over its region, in solar radii", () => {
  const model = createSunModel(5);
  const frame = model.frameAt(input({ eruptionScrub: 0.6 }));
  const { eruption } = frame;
  assert.ok(eruption);
  assert.equal(eruption.s, 0.6);
  assert.ok(eruption.lines.length > 20);
  assert.ok(eruption.goesClass.startsWith("X") || eruption.goesClass.startsWith("M"));
  assert.ok(eruption.cmeFront > 1 && eruption.flareLight > 0.5);
  const region = frame.regions.find((r) => r.id === eruption.regionId);
  assert.ok(region && region.strength > 0);
  for (const line of eruption.lines) {
    assert.ok(line.count >= 2);
    for (let i = 0; i < line.count; i++) {
      const r = Math.hypot(line.points[3 * i], line.points[3 * i + 1], line.points[3 * i + 2]);
      assert.ok(r >= 1 - 1e-6 && r < 4, `point at ${r} R`);
    }
  }
  assert.equal(
    model.frameAt(input()).eruption === null || model.frameAt(input()).eruption.s >= 0,
    true,
  );
});

test("geometry revisions track reused buffers, without changing for a light-only redraw", () => {
  const model = createSunModel(5);
  const frame = model.frameAt(input({ eruptionScrub: 0.35 }));
  const field = frame.fieldLines;
  const arcade = frame.eruption.lines;
  const fieldRevision = frame.fieldRevision;
  const eruptionRevision = frame.eruptionRevision;
  const positions = arcade.map((line) => Array.from(line.points.slice(0, line.count * 3)));
  model.frameAt(input({ eruptionScrub: 0.35, light: "halpha" }));
  assert.equal(frame.fieldRevision, fieldRevision);
  assert.equal(frame.eruptionRevision, eruptionRevision);
  model.frameAt(input({ eruptionScrub: 0.75 }));
  assert.equal(frame.eruption.lines, arcade, "the geometry pool is reused");
  assert.ok(frame.eruptionRevision > eruptionRevision, "a renderer must upload the new arcade");
  assert.notDeepEqual(
    arcade.map((line) => Array.from(line.points.slice(0, line.count * 3))),
    positions,
  );
  model.frameAt(input({ eruptionScrub: 0.75, fieldLineCount: 24 }));
  assert.equal(frame.fieldLines, field);
  assert.ok(frame.fieldRevision > fieldRevision, "the corona must reshape with the field");
});

test("a held eruption follows its ageing region and stays exact after scrubbing and re-entry", () => {
  const options = { seeded: SEEDED_GROUPS };
  const model = createSunModel(7, options);
  let previous = null;
  for (const [time, eruptionScrub] of [
    [0, 0.6],
    [DAY_S, 0.6],
    [DAY_S, 1],
    [2 * DAY_S, 1],
    [2 * DAY_S, 0.3],
    [2 * DAY_S, null],
    [0, 0.6],
  ]) {
    const ask = input({ time, eruptionScrub, fieldLineCount: 0 });
    const frame = model.frameAt(ask);
    const expected = createSunModel(7, options).frameAt(ask);
    assert.deepEqual(frame.eruption, expected.eruption, "reused contours match a fresh solve");
    if (time === DAY_S && eruptionScrub === 0.6) {
      assert.notDeepEqual(frame.eruption.lines, previous, "the arcade follows the moving region");
    }
    previous = frame.eruption ? structuredClone(frame.eruption.lines) : null;
  }
});
