import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera } from "three";

import { atViewScale, nearestView } from "@horizon/toolkit/camera";

import { modelSelfCheck } from "../src/features/orrery/lib/model/model-check.ts";
import { driftYearsPerSecond } from "../src/features/orrery/lib/model/views.ts";
import { createCameraRig } from "../src/features/orrery/lib/scene/camera-rig.ts";
import { createHud } from "../src/features/orrery/lib/scene/hud.ts";
import { ORRERY_EDGE } from "../src/features/orrery/lib/scene/kit.ts";
import { useOrrery } from "../src/features/orrery/lib/store.ts";
import { SOLAR_VIEWS } from "../src/space/solar-system/model/views.ts";
import { assertSmoothFlight } from "./toolkit-helpers.mjs";

const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

test("the along-orbit speed-up blends across its steps", () => {
  /* Away from the edges each step keeps its rate. */
  assert.equal(driftYearsPerSecond(6), 0.35);
  assert.equal(driftYearsPerSecond(72), 2.5);
  assert.equal(driftYearsPerSecond(170_000), 30_000);
  let last = driftYearsPerSecond(1);
  for (let k = 1; k <= 2000; k += 1) {
    const rate = driftYearsPerSecond(10 ** (k / 333));
    assert.ok(rate >= last, "monotonic");
    assert.ok(rate / last < 1.25, `no jump at ${10 ** (k / 333)}`);
    last = rate;
  }
});

function rigWith({ reduced = false } = {}) {
  const camera = new PerspectiveCamera(48, 1.6, 0.05, 2e6);
  const rig = createCameraRig(camera, {
    reduceMotion: { matches: reduced },
    closeUp: () => null,
  });
  const frame = (dt) => {
    rig.step(dt);
    rig.home();
    rig.applyPose();
    return camera.position.clone();
  };
  return { rig, camera, frame };
}

test("the Orrery stops just past the Oort cloud, where Deep Field takes over", () => {
  const { rig } = rigWith();
  const oort = SOLAR_VIEWS.find((v) => v.id === "oort");
  assert.equal(SOLAR_VIEWS.at(-1), oort, "the Oort cloud is the farthest view");
  assert.equal(rig.limits().max, ORRERY_EDGE);
  assert.ok(ORRERY_EDGE > oort.dist * 2 && ORRERY_EDGE < 7 * 63_241, "a few light-years");
});

test("a flight from the Oort cloud down to the planets is one smooth zoom", () => {
  const { rig, camera, frame } = rigWith();
  rig.snapToView("oort");
  frame(0);
  rig.flyToView("inner");
  /* Inward all the way, never faster than ~10 e-folds/s, and no lurch between frames. */
  assertSmoothFlight(rig, camera, frame, { maxSpeed: 10 });
  assert.equal(rig.pose.distance, 6);
  assert.ok(rig.aim.length() < 1e-9, "aimed at the Sun");
  assert.equal(rig.moving, false);
});

test("wheel steps glide into each other and interrupt a flight without a jolt", () => {
  const { rig, frame } = rigWith();
  rig.snapToView("giants");
  frame(0);
  const dt = 1 / 60;
  /* Three wheel notches in quick succession: one smooth glide, no overshoot. */
  for (let k = 0; k < 3; k += 1) {
    rig.zoomTo(rig.inputPose().distance * 1.13, false);
    frame(dt);
  }
  const goal = rig.target;
  near(goal, 72 * 1.13 ** 3, 1e-9, "notches add up");
  let last = rig.pose.distance;
  for (let k = 0; k < 120; k += 1) {
    frame(dt);
    assert.ok(rig.pose.distance >= last - 1e-12 && rig.pose.distance <= goal + 1e-9);
    last = rig.pose.distance;
  }
  near(rig.pose.distance, goal, 1e-9, "settles");
  assert.equal(rig.moving, false);
  /* A flight interrupted mid-way carries its speed into the glide. */
  rig.flyToView("oort");
  for (let k = 0; k < 40; k += 1) frame(dt);
  const before = Math.log(rig.pose.distance);
  frame(dt);
  const speed = (Math.log(rig.pose.distance) - before) / dt;
  rig.cancel();
  const at = Math.log(rig.pose.distance);
  frame(dt);
  const after = (Math.log(rig.pose.distance) - at) / dt;
  assert.ok(speed > 1, `flying out at ${speed}`);
  assert.ok(Math.abs(after - speed) < speed * 0.25, `${after} vs ${speed}`);
});

test("reduced motion lands every zoom at once", () => {
  const { rig } = rigWith({ reduced: true });
  rig.snapToView("giants");
  rig.zoomTo(150, false);
  assert.equal(rig.pose.distance, 150);
  rig.flyToView("oort");
  assert.equal(rig.flying, false);
  assert.equal(rig.pose.distance, 170_000);
});

test("the orrery model passes its own consistency checks, here rather than on every WebGL startup", () => {
  assert.deepEqual(modelSelfCheck(), []);
});

test("the orrery HUD throttles drift readouts to 1 Hz even across forced redraws", () => {
  const original = useOrrery.getState();
  try {
    useOrrery.setState({ driftYears: 0, driftRate: 2.5 });
    const hud = createHud(useOrrery, { fov: 48 }, { width: 1200, height: 800 });
    /* Turned a step right of the start and raised 30°: the camera pad reads whole degrees. */
    const angles = { azimuth: -Math.PI / 12, inclination: Math.PI / 6 };
    // Forced redraws update scale/rate immediately without churning driftYears every frame.
    hud.update(0.016, true, {
      dist: 170_000,
      driftRate: driftYearsPerSecond(170_000),
      driftYears: 500,
      syncView: true,
      angles,
    });
    assert.equal(useOrrery.getState().driftRate, 30_000);
    assert.deepEqual(useOrrery.getState().cameraAngles, { heading: 345, tilt: 30 });
    assert.equal(useOrrery.getState().driftYears, 0);
    hud.update(0.5, false, {
      dist: 170_000,
      driftRate: driftYearsPerSecond(170_000),
      driftYears: 15_500,
      syncView: true,
      angles,
    });
    assert.equal(useOrrery.getState().driftYears, 0);
    hud.update(0.5, false, {
      dist: 170_000,
      driftRate: driftYearsPerSecond(170_000),
      driftYears: 30_000,
      syncView: true,
      angles,
    });
    assert.equal(useOrrery.getState().driftYears, 30_000);
    // Resetting driftYears to 0 commits at once.
    hud.update(0.016, true, {
      dist: 170_000,
      driftRate: driftYearsPerSecond(170_000),
      driftYears: 0,
      syncView: true,
      angles,
    });
    assert.equal(useOrrery.getState().driftYears, 0);
    // Manual zooming updates the active view and clears preset distance match when between presets.
    for (const v of SOLAR_VIEWS) {
      assert.equal(nearestView(SOLAR_VIEWS, (view) => view.dist, v.dist).id, v.id);
      assert.equal(atViewScale(v.dist, v.dist), true);
    }
    assert.equal(atViewScale(30, 72), false);
    hud.update(0.016, true, {
      dist: 6,
      driftRate: driftYearsPerSecond(170_000),
      driftYears: 0,
      syncView: true,
      angles,
    });
    assert.equal(useOrrery.getState().view, "inner");
    assert.equal(useOrrery.getState().viewDist, 6);
  } finally {
    useOrrery.setState(original, true);
  }
});
