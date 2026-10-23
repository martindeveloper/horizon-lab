import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector2, Vector3 } from "three";

import { PLACE_IDS } from "../src/features/sun/lib/model/places.ts";
import { createPlaceAnchors } from "../src/features/sun/lib/scene/anchors.ts";
import { createPlaceNames } from "../src/features/sun/lib/scene/names.ts";
import { createSunModel } from "../src/space/sun/frame.ts";
import { DAY_S, SOURCE_SURFACE_R } from "../src/space/sun/model/parameters.ts";
import { PASSBANDS } from "../src/space/sun/model/passbands.ts";
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
  const namesFrom = (position, light = "halpha", spicules = true) => {
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
      light: light === "white" ? "white" : "band",
      weights: PASSBANDS[light].weights,
      spicules,
      prominence: 1,
    });
    return shown;
  };
  const shownFrom = (position) => namesFrom(position).get("chromosphere");
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

test("a place is named only where the light draws it: no chromosphere or spicules in white light", () => {
  const frame = createSunModel(5).frameAt(input());
  const camera = new PerspectiveCamera(40, 1, 0.001, 100);
  const anchorOf = createPlaceAnchors();
  /* From three radii out, looking at the centre with the place's anchor on the limb, on a stage
     `size` px square: a larger stage stands for a closer look, its jets more pixels apart. */
  const namesAt = (place, light, { size = 1200, spicules = true } = {}) => {
    const at = new Vector3(...anchorOf(frame, place, [0, 0, 0])).applyAxisAngle(
      new Vector3(0, 1, 0),
      frame.surfaceTurn,
    );
    const over = at.clone().normalize();
    const side = new Vector3().crossVectors(over, new Vector3(0, 1, 0)).normalize();
    const offAxis = Math.acos(1 / 3) - 0.02;
    camera.position
      .copy(over)
      .multiplyScalar(Math.cos(offAxis))
      .addScaledVector(side, Math.sin(offAxis))
      .multiplyScalar(3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const shown = new Map();
    createPlaceNames((key, _x, _y, _z, on) => shown.set(key, on)).update(frame, {
      camera,
      viewport: { width: size, height: size },
      shown: true,
      cut: new Vector2(0, 0),
      cutShown: 0,
      light: light === "white" ? "white" : "band",
      weights: PASSBANDS[light].weights,
      spicules,
      prominence: 1,
    });
    return shown.get(place);
  };
  /* White light draws no chromosphere or corona at the limb: nothing there to name. */
  assert.equal(namesAt("chromosphere", "white"), false);
  assert.equal(namesAt("spicule", "white", { size: 6000 }), false);
  assert.equal(namesAt("corona", "white"), false);
  /* Hα draws the rim; the spicules only once their jets are resolved, and only where drawn. */
  assert.equal(namesAt("chromosphere", "halpha"), true);
  assert.equal(namesAt("spicule", "halpha"), false, "the whole disc: jets too fine to see");
  assert.equal(namesAt("spicule", "halpha", { size: 6000 }), true, "a closer look: jets apart");
  assert.equal(namesAt("spicule", "halpha", { size: 6000, spicules: false }), false);
  /* 193 Å shows the corona alone: no rim of the chromosphere to name there. */
  assert.equal(namesAt("chromosphere", "fe193"), false);
});
