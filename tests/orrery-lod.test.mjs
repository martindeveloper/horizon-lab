import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import {
  GALACTIC_CENTRE,
  GALACTIC_EAST,
  GALACTIC_POLE,
} from "../src/features/orrery/lib/graphics/coordinates.ts";
import { sunGalactic } from "../src/features/orrery/lib/model/galactic-orbit.ts";
import { SUN_BIRTH } from "../src/features/orrery/lib/model/parameters.ts";
import {
  VIEWS,
  driftYearsPerSecond,
  worldDistance,
} from "../src/features/orrery/lib/model/views.ts";
import { createCameraRig } from "../src/features/orrery/lib/scene/camera-rig.ts";
import {
  COSMIC_HANDOFF,
  GALAXY_FRAME,
  HANDOFF,
  LY,
  SUPERGALACTIC_FRAME,
  cosmosMix,
  fade,
  framed,
  galacticAnchor,
  galaxyMix,
  galaxyToWorld,
  pickLevel,
  realmOf,
} from "../src/features/orrery/lib/scene/lod.ts";

const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

test("the realm blend is continuous and every view sits in its own map", () => {
  assert.equal(galaxyMix(HANDOFF.from), 0);
  assert.equal(galaxyMix(HANDOFF.to), 1);
  let last = 0;
  for (let k = 0; k <= 400; k += 1) {
    const d = HANDOFF.from * (HANDOFF.to / HANDOFF.from) ** (k / 400);
    const mix = galaxyMix(d);
    assert.ok(mix >= last, "monotonic");
    assert.ok(mix - last < 0.01, "no step");
    last = mix;
  }
  assert.equal(cosmosMix(COSMIC_HANDOFF.from), 0);
  assert.equal(cosmosMix(COSMIC_HANDOFF.to), 1);
  last = 0;
  for (let k = 0; k <= 400; k += 1) {
    const d = COSMIC_HANDOFF.from * (COSMIC_HANDOFF.to / COSMIC_HANDOFF.from) ** (k / 400);
    const mix = cosmosMix(d);
    assert.ok(mix >= last && mix - last < 0.01, "the second handoff is smooth too");
    last = mix;
  }
  assert.ok(HANDOFF.to < COSMIC_HANDOFF.from, "the two handoffs never overlap");
  for (const view of VIEWS) {
    const d = worldDistance(view.dist, view.realm);
    const mix = galaxyMix(d);
    const beyond = cosmosMix(d);
    assert.equal(realmOf(mix, beyond), view.realm, view.id);
    assert.ok(view.realm === "solar" ? mix < 0.01 : mix > 0.99, view.id);
    assert.ok(view.realm === "cosmos" ? beyond > 0.99 : beyond < 0.01, view.id);
  }
});

test("far out the camera orbits in the supergalactic plane, where Virgo lies", () => {
  const up = new Vector3(0, 1, 0).applyQuaternion(SUPERGALACTIC_FRAME);
  const galacticUp = new Vector3(0, 1, 0).applyQuaternion(GALAXY_FRAME);
  /* The two planes stand about 84° apart. */
  near((up.angleTo(galacticUp) * 180) / Math.PI, 83.7, 0.5, "plane tilt");
});

test("the Galaxy model lines up with the sky's galactic frame", () => {
  const axis = (x, y, z) => new Vector3(x, y, z).applyQuaternion(GALAXY_FRAME);
  /* Today the Sun sits on +X, so the centre lies along −X; +Y is the north galactic pole. */
  assert.ok(axis(-1, 0, 0).distanceTo(GALACTIC_CENTRE) < 1e-9);
  assert.ok(axis(0, 1, 0).distanceTo(GALACTIC_POLE) < 1e-9);
  assert.ok(axis(0, 0, 1).distanceTo(GALACTIC_EAST) < 1e-9);
  /* The Sun is the scene's origin and the centre is ~8 kpc along the sky's centre direction. */
  const anchor = galacticAnchor(0, false);
  const sun = sunGalactic(0, false);
  const at = galaxyToWorld(sun[0], sun[1], sun[2], anchor, new Vector3());
  assert.ok(at.length() < 1e-6);
  const centre = galaxyToWorld(0, 0, 0, anchor, new Vector3());
  near(centre.length() / LY, Math.hypot(...anchor), 1e-6, "centre distance");
  assert.ok(centre.clone().normalize().dot(GALACTIC_CENTRE) > 0.999);
  /* Before the Sun the map is anchored at its birthplace. */
  assert.deepEqual(galacticAnchor(SUN_BIRTH * 2, false), galacticAnchor(SUN_BIRTH, false));
});

test("presence bands and the framing rule ease instead of switching", () => {
  const band = fade(10, 20, 100, 200);
  assert.equal(band(5), 0);
  assert.equal(band(50), 1);
  assert.equal(band(400), 0);
  assert.ok(band(14) > 0 && band(14) < 1);
  assert.equal(fade(0, 0, 100, 200)(1e-6), 1);
  /* Something reaching 30 % of the camera distance is framed; 1 % or 3× is not. */
  assert.equal(framed(30, 30, 100), 1);
  assert.equal(framed(1, 1, 100), 0);
  assert.equal(framed(300, 300, 100), 0);
  let last = framed(2.5, 2.5, 100);
  for (let r = 2.5; r < 4.5; r += 0.01) {
    const next = framed(r, r, 100);
    assert.ok(Math.abs(next - last) < 0.05, "smooth");
    last = next;
  }
});

test("levels step up past a threshold and down only below its hysteresis", () => {
  const up = [36, 360];
  assert.equal(pickLevel(0, 30, up), 0);
  assert.equal(pickLevel(0, 40, up), 1);
  assert.equal(pickLevel(1, 33, up), 1, "holds inside the gap");
  assert.equal(pickLevel(1, 25, up), 0);
  assert.equal(pickLevel(0, 500, up), 2);
  assert.equal(pickLevel(2, 320, up), 2);
  assert.equal(pickLevel(2, 10, up), 0);
});

test("the along-orbit speed-up blends across its steps", () => {
  /* Away from the edges each step keeps its rate. */
  assert.equal(driftYearsPerSecond(6, "solar"), 0.35);
  assert.equal(driftYearsPerSecond(72, "solar"), 2.5);
  assert.equal(driftYearsPerSecond(170_000, "solar"), 30_000);
  assert.equal(driftYearsPerSecond(1e6, "galaxy"), 0);
  let last = driftYearsPerSecond(1, "solar");
  for (let k = 1; k <= 2000; k += 1) {
    const rate = driftYearsPerSecond(10 ** (k / 333), "solar");
    assert.ok(rate >= last, "monotonic");
    assert.ok(rate / last < 1.25, `no jump at ${10 ** (k / 333)}`);
    last = rate;
  }
});

function rigWith({ reduced = false } = {}) {
  const camera = new PerspectiveCamera(48, 1.6, 0.05, 2e6);
  const state = { selection: null, yearsAgo: 0, show: { halo: false, elliptical: false } };
  const rig = createCameraRig(camera, {
    state: () => state,
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

test("a flight from the whole Galaxy down to the planets is one smooth zoom", () => {
  const { rig, camera, frame } = rigWith();
  rig.snapToView("galaxy");
  frame(0);
  rig.flyToView("inner");
  const dt = 1 / 60;
  let last = Math.log(rig.pose.distance);
  let lastSpeed = 0;
  let lastPosition = camera.position.clone();
  let frames = 0;
  while (rig.flying && frames < 1000) {
    const position = frame(dt);
    const x = Math.log(rig.pose.distance);
    const speed = (x - last) / dt;
    /* Inward all the way, never faster than ~10 e-folds/s, and no lurch between frames. */
    assert.ok(speed <= 1e-9, "never backs out");
    assert.ok(Math.abs(speed) < 10, `speed ${speed}`);
    assert.ok(Math.abs(speed - lastSpeed) < 0.5, `speed jump at frame ${frames}`);
    /* The camera moves a small part of its distance per frame, even across the handoff. */
    assert.ok(position.distanceTo(lastPosition) < rig.pose.distance * 0.25, `cut at ${frames}`);
    last = x;
    lastSpeed = speed;
    lastPosition = position;
    frames += 1;
  }
  assert.ok(frames > 60 && frames < 400, `${frames} frames`);
  assert.equal(rig.pose.distance, 6);
  assert.equal(rig.realm, "solar");
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

test("a flight from Laniakea to the Galaxy is one smooth zoom, its aim gliding home", () => {
  const { rig, camera, frame } = rigWith();
  assert.ok(rig.limits().max >= 1.2e9 * LY, "the zoom reaches past Laniakea");
  rig.snapToView("laniakea");
  frame(0);
  assert.equal(rig.realm, "cosmos");
  assert.ok(rig.aim.length() > 200e6 * LY, "aimed at the Great Attractor");
  rig.flyToView("galaxy");
  const dt = 1 / 60;
  let last = Math.log(rig.pose.distance);
  let lastSpeed = 0;
  let lastPosition = camera.position.clone();
  let frames = 0;
  while (rig.flying && frames < 1000) {
    const position = frame(dt);
    const x = Math.log(rig.pose.distance);
    const speed = (x - last) / dt;
    assert.ok(speed <= 1e-9, "never backs out");
    assert.ok(Math.abs(speed - lastSpeed) < 0.5, `speed jump at frame ${frames}`);
    assert.ok(position.distanceTo(lastPosition) < rig.pose.distance * 0.25, `cut at ${frames}`);
    last = x;
    lastSpeed = speed;
    lastPosition = position;
    frames += 1;
  }
  assert.ok(frames > 60 && frames < 400, `${frames} frames`);
  assert.equal(rig.realm, "galaxy");
});

test("reduced motion lands every zoom at once", () => {
  const { rig, frame } = rigWith({ reduced: true });
  rig.snapToView("giants");
  rig.zoomTo(150, false);
  assert.equal(rig.pose.distance, 150);
  rig.flyToView("galaxy");
  assert.equal(rig.flying, false);
  near(rig.pose.distance, 92_000 * LY, 1e-3, "at the galaxy");
  frame(1 / 60);
  assert.equal(rig.realm, "galaxy");
});
