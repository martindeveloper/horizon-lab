import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import { GALACTIC_CENTRE, GALACTIC_EAST, GALACTIC_POLE } from "@horizon/toolkit/scene";

import { modernGalaxy } from "../src/features/deep-field/lib/graphics/galaxy.ts";
import { anchorById, anchorToday } from "../src/features/deep-field/lib/model/cosmos.ts";
import { VIEWS, viewById, worldDistance } from "../src/features/deep-field/lib/model/views.ts";
import { createCameraRig } from "../src/features/deep-field/lib/scene/camera-rig.ts";
import { labelInsets } from "../src/features/deep-field/lib/scene/kit.ts";
import {
  COSMIC_HANDOFF,
  GALAXY_FRAME,
  HANDOFF,
  LY,
  SUN_ANCHOR,
  SUPERGALACTIC_FRAME,
  cosmicToWorld,
  cosmosMix,
  galaxyMix,
  galaxyToWorld,
  realmOf,
} from "../src/features/deep-field/lib/scene/lod.ts";
import { assertSmoothFlight } from "./toolkit-helpers.mjs";

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
    const d = worldDistance(view.ly);
    const mix = galaxyMix(d);
    const beyond = cosmosMix(d);
    assert.equal(realmOf(d), view.realm, view.id);
    const near = view.realm === "solar" || view.realm === "stars";
    assert.ok(near ? mix < 0.01 : mix > 0.99, view.id);
    assert.ok(view.realm === "cosmos" ? beyond > 0.99 : beyond < 0.01, view.id);
  }
});

test("far out the camera orbits in the supergalactic plane, where Virgo lies", () => {
  const up = new Vector3(0, 1, 0).applyQuaternion(SUPERGALACTIC_FRAME);
  const galacticUp = new Vector3(0, 1, 0).applyQuaternion(GALAXY_FRAME);
  /* The two planes stand about 84° apart. */
  near((up.angleTo(galacticUp) * 180) / Math.PI, 83.7, 0.5, "plane tilt");
});

test("the Galaxy model lines up with the sky's galactic frame, the Sun at the origin", () => {
  const axis = (x, y, z) => new Vector3(x, y, z).applyQuaternion(GALAXY_FRAME);
  /* Today the Sun sits on +X, so the centre lies along −X; +Y is the north galactic pole. */
  assert.ok(axis(-1, 0, 0).distanceTo(GALACTIC_CENTRE) < 1e-9);
  assert.ok(axis(0, 1, 0).distanceTo(GALACTIC_POLE) < 1e-9);
  assert.ok(axis(0, 0, 1).distanceTo(GALACTIC_EAST) < 1e-9);
  const at = galaxyToWorld(SUN_ANCHOR[0], SUN_ANCHOR[1], SUN_ANCHOR[2], new Vector3());
  assert.ok(at.length() < 1e-6);
  const centre = galaxyToWorld(0, 0, 0, new Vector3());
  near(centre.length() / LY, Math.hypot(...SUN_ANCHOR), 1e-6, "centre distance");
  assert.ok(centre.clone().normalize().dot(GALACTIC_CENTRE) > 0.999);
});

function rigWith({ reduced = false } = {}) {
  const camera = new PerspectiveCamera(48, 1.6, 0.05, 2e6);
  const state = { selection: null };
  const rig = createCameraRig(camera, {
    state: () => state,
    reduceMotion: { matches: reduced },
  });
  const frame = (dt) => {
    rig.step(dt);
    rig.home();
    rig.applyPose();
    return camera.position.clone();
  };
  return { rig, camera, frame };
}

test("a flight from Laniakea to the Galaxy is one smooth zoom, its aim gliding home", () => {
  const { rig, camera, frame } = rigWith();
  assert.ok(rig.limits().max >= 1.2e9 * LY, "the zoom reaches past Laniakea");
  rig.snapToView("laniakea");
  frame(0);
  assert.equal(realmOf(rig.pose.distance), "cosmos");
  assert.ok(rig.aim.length() > 200e6 * LY, "aimed at the Great Attractor");
  rig.flyToView("galaxy");
  assertSmoothFlight(rig, camera, frame, { maxSpeed: 10 });
  assert.equal(realmOf(rig.pose.distance), "galaxy");
});

test("one zoom from the inner planets out past the nearest stars, turning about the Sun", () => {
  const { rig, frame } = rigWith();
  rig.snapToView("inner");
  frame(0);
  assert.equal(realmOf(rig.pose.distance), "solar");
  near(rig.pose.distance, 6, 1e-9, "the inner planets' view, in au");
  assert.ok(rig.aim.length() < 1e-9, "turning about the Sun");
  assert.ok(rig.limits().min <= 0.35 + 1e-9, "close enough for Mercury");
  rig.flyToView("stars");
  let last = Math.log(rig.pose.distance);
  for (let k = 0; k < 900 && rig.flying; k += 1) {
    frame(1 / 60);
    const x = Math.log(rig.pose.distance);
    assert.ok(x >= last - 1e-9, "never backs in");
    last = x;
  }
  near(rig.pose.distance / LY, viewById("stars").ly, 1e-9, "at the stars");
  assert.equal(realmOf(rig.pose.distance), "stars");
  assert.ok(rig.aim.length() < 1e-9, "still turning about the Sun");
});

test("reduced motion lands every flight at once", () => {
  const { rig, frame } = rigWith({ reduced: true });
  rig.snapToView("stars");
  rig.flyToView("galaxy");
  assert.equal(rig.flying, false);
  near(rig.pose.distance, 92_000 * LY, 1e-3, "at the galaxy");
  frame(1 / 60);
  assert.equal(realmOf(rig.pose.distance), "galaxy");
});

test("the cosmic web view keeps its landmarks apart and in frame, phone and desktop", () => {
  const ids = ["greatAttractor", "perseusCluster", "comaCluster", "shapleyCore", "sloanGreatWall"];
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    const { rig, camera, frame } = rigWith();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    rig.snapToView("cosmic-web");
    frame(0);
    camera.updateMatrixWorld();
    const px = ids.map((id) => {
      const p = cosmicToWorld(anchorToday(anchorById(id)), new Vector3()).project(camera);
      return [(p.x * 0.5 + 0.5) * width, (-p.y * 0.5 + 0.5) * height];
    });
    for (const [i, [x, y]] of px.entries())
      assert.ok(x > 30 && x < width - 30 && y > 70 && y < height - 170, `${ids[i]} in frame`);
    for (let i = 0; i < px.length; i += 1)
      for (let j = i + 1; j < px.length; j += 1) {
        const gap = Math.hypot(px[i][0] - px[j][0], px[i][1] - px[j][1]);
        assert.ok(gap > 60, `${ids[i]} and ${ids[j]} ${gap.toFixed(0)} px apart at ${width}`);
      }
  }
});

test("names keep above the sightline, the phone's ladder and the guide's caption", () => {
  assert.equal(labelInsets(true, 120).bottom, 120, "wide: the ladder is down the side");
  assert.equal(labelInsets(false, 120).bottom, 192, "phones: the ladder sits on the sightline");
  assert.equal(labelInsets(false, 120, 340).bottom, 340, "a caption above both wins");
  assert.equal(labelInsets(true, 120, 60).bottom, 120, "a caption below the dock changes nothing");
});

test("the modern Milky Way is a thin, finite disk with dust and a populated centre", () => {
  const { stars, dust } = modernGalaxy(6000);
  const pos = stars.getAttribute("position").array;
  assert.ok(stars.getAttribute("position").count > 5500);
  assert.ok(dust.getAttribute("position").count > 1500);
  const radii = [];
  const heights = [];
  for (let i = 0; i < pos.length; i += 3) {
    assert.ok(Number.isFinite(pos[i] + pos[i + 1] + pos[i + 2]));
    radii.push(Math.hypot(pos[i], pos[i + 2]));
    heights.push(Math.abs(pos[i + 1]));
  }
  radii.sort((a, b) => a - b);
  heights.sort((a, b) => a - b);
  const median = (values) => values[Math.floor(values.length / 2)];
  // Half the light inside the solar circle; the disk roughly 1:50 thin.
  assert.ok(median(radii) > 6_000 && median(radii) < 27_000, `median R ${median(radii)}`);
  assert.ok(median(heights) < 1_200, `median |z| ${median(heights)}`);
});
