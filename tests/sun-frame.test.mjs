import assert from "node:assert/strict";
import test from "node:test";

import { PLACE_IDS, createSunModel, dipoleAt, placeAnchor } from "../src/space/sun/frame.ts";
import {
  DAY_S,
  MAX_FIELD_LINES,
  PROMINENCE_SLOTS,
  REGION_SLOTS,
  SOURCE_SURFACE_R,
} from "../src/space/sun/model/parameters.ts";
import { LAYERS } from "../src/space/sun/model/structure.ts";

const input = (over = {}) => ({
  time: 120 * DAY_S,
  cyclePhase: 25.4,
  light: "fe171",
  eruptionScrub: null,
  fieldLineCount: 80,
  ...over,
});
const radius = (p) => Math.hypot(...p);

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

test("every place has an anchor in the body frame, or none when the Sun lacks it", () => {
  const model = createSunModel(5);
  const frame = model.frameAt(input({ eruptionScrub: 0.7 }));
  for (const place of PLACE_IDS) {
    const anchor = placeAnchor(frame, place);
    if (anchor === null) continue;
    assert.equal(anchor.length, 3, place);
    assert.ok(anchor.every(Number.isFinite), place);
  }
  assert.ok(Math.abs(radius(placeAnchor(frame, "core")) - LAYERS.core / 2) < 1e-9);
  assert.ok(Math.abs(radius(placeAnchor(frame, "tachocline")) - LAYERS.tachocline) < 1e-9);
  assert.ok(Math.abs(radius(placeAnchor(frame, "photosphere")) - 1) < 1e-9);
  assert.ok(Math.abs(radius(placeAnchor(frame, "granule")) - 1) < 1e-9);
  assert.ok(
    radius(placeAnchor(frame, "chromosphere")) > 1 &&
      radius(placeAnchor(frame, "chromosphere")) < 1.01,
  );
  assert.ok(radius(placeAnchor(frame, "spicule")) > radius(placeAnchor(frame, "chromosphere")));
  assert.ok(radius(placeAnchor(frame, "corona")) > 1.2);
  const sunspot = placeAnchor(frame, "sunspot");
  assert.ok(sunspot && Math.abs(radius(sunspot) - 1) < 1e-9, "on the strongest region");
  const flare = placeAnchor(frame, "flare");
  const ejection = placeAnchor(frame, "ejection");
  assert.ok(flare && radius(flare) > 1, "over the erupting region");
  assert.ok(
    ejection && Math.abs(radius(ejection) - frame.eruption.cmeFront) < 1e-9,
    "at the ejection's front",
  );
  const streamer = placeAnchor(frame, "streamer");
  assert.ok(
    streamer && radius(streamer) > 1.05 && radius(streamer) < SOURCE_SURFACE_R,
    "a closed line's apex",
  );
  const wind = placeAnchor(frame, "wind");
  assert.ok(wind && Math.abs(radius(wind) - SOURCE_SURFACE_R) < 1e-3, "where an open line leaves");
  /* A quiet Sun with no eruption has no flare or ejection to name. */
  const quiet = createSunModel(5).frameAt(input({ cyclePhase: 25.0, fieldLineCount: 0 }));
  assert.equal(placeAnchor(quiet, "ejection"), null);
  assert.equal(placeAnchor(quiet, "streamer"), null);
  assert.ok(placeAnchor(quiet, "wind"), "the pole's open field stands in");
});
