import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector2, Vector3 } from "three";

import { PLACE_IDS } from "../src/features/sun/lib/model/places.ts";
import { createPlaceAnchors } from "../src/features/sun/lib/scene/anchors.ts";
import { createPlaceNames } from "../src/features/sun/lib/scene/names.ts";
import { createSunModel } from "../src/space/sun/frame.ts";
import { DAY_S, SOURCE_SURFACE_R } from "../src/space/sun/model/parameters.ts";
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

test("every place has an anchor in the body frame, or none when the Sun lacks it", () => {
  const model = createSunModel(5);
  const frame = model.frameAt(input({ eruptionScrub: 0.7 }));
  const anchorOf = createPlaceAnchors();
  const anchor = (place, f = frame) => anchorOf(f, place, [0, 0, 0]);
  for (const place of PLACE_IDS) {
    const at = anchor(place);
    if (at === null) continue;
    assert.equal(at.length, 3, place);
    assert.ok(at.every(Number.isFinite), place);
  }
  assert.ok(Math.abs(radius(anchor("core")) - LAYERS.core / 2) < 1e-9);
  assert.ok(Math.abs(radius(anchor("tachocline")) - LAYERS.tachocline) < 1e-9);
  assert.ok(Math.abs(radius(anchor("photosphere")) - 1) < 1e-9);
  assert.ok(Math.abs(radius(anchor("granule")) - 1) < 1e-9);
  assert.ok(radius(anchor("chromosphere")) > 1 && radius(anchor("chromosphere")) < 1.01);
  assert.ok(radius(anchor("spicule")) > radius(anchor("chromosphere")));
  assert.ok(radius(anchor("corona")) > 1.2);
  const sunspot = anchor("sunspot");
  assert.ok(sunspot && Math.abs(radius(sunspot) - 1) < 1e-9, "on the featured region");
  const flare = anchor("flare");
  const ejection = anchor("ejection");
  assert.ok(flare && radius(flare) > 1, "over the erupting region");
  assert.ok(
    ejection && Math.abs(radius(ejection) - frame.eruption.cmeFront) < 1e-9,
    "at the ejection's front",
  );
  const streamer = anchor("streamer");
  assert.ok(
    streamer && radius(streamer) > 1.05 && radius(streamer) < SOURCE_SURFACE_R,
    "a closed line's apex",
  );
  const wind = anchor("wind");
  assert.ok(wind && Math.abs(radius(wind) - SOURCE_SURFACE_R) < 1e-3, "where an open line leaves");
  model.frameAt(input({ eruptionScrub: 0.5 }));
  assert.ok(frame.eruption.cmeFront > 1, "the geometric front already exists before visibility");
  assert.equal(frame.eruption.cmePresence, 0);
  assert.equal(anchor("ejection"), null, "do not label a hidden CME envelope");
  /* A quiet Sun with no eruption has no flare or ejection to name; another model's field is its own. */
  const quiet = createSunModel(5).frameAt(input({ cyclePhase: 25.0, fieldLineCount: 0 }));
  assert.equal(anchor("ejection", quiet), null);
  assert.equal(anchor("streamer", quiet), null);
  assert.ok(anchor("wind", quiet), "the pole's open field stands in");
});

test("a limb feature is named where it stands on the limb, not over the disc's centre", () => {
  const frame = createSunModel(5).frameAt(input());
  const viewport = { width: 1200, height: 1200 };
  const camera = new PerspectiveCamera(40, 1, 0.01, 100);
  /* The chromosphere's anchor in the world: the body turned by the frame. */
  const limb = new Vector3(
    ...createPlaceAnchors()(frame, "chromosphere", [0, 0, 0]),
  ).applyAxisAngle(new Vector3(0, 1, 0), frame.surfaceTurn);
  const shownFrom = (position) => {
    camera.position.copy(position);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const shown = new Map();
    const names = createPlaceNames((key, _x, _y, _z, on) => shown.set(key, on));
    names.update(frame, {
      camera,
      viewport,
      shown: true,
      cut: new Vector2(0, 0),
      cutShown: 0,
      light: "band",
    });
    return shown.get("chromosphere");
  };
  /* Three radii out, the limb lies acos(1/3) off the axis: from there the anchor stands on it. */
  const over = limb.clone().normalize();
  const side = new Vector3().crossVectors(over, new Vector3(0, 1, 0)).normalize();
  const offAxis = Math.acos(1 / 3) - 0.02;
  const onLimb = over
    .clone()
    .multiplyScalar(Math.cos(offAxis))
    .addScaledVector(side, Math.sin(offAxis));
  assert.equal(shownFrom(onLimb.multiplyScalar(3)), true, "on the limb");
  /* Straight over it: the anchor is at the disc's centre, far from the limb. */
  assert.equal(shownFrom(over.clone().multiplyScalar(3)), false, "not over the disc's centre");
});
