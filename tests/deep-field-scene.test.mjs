import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import { GALACTIC_CENTRE, GALACTIC_EAST, GALACTIC_POLE } from "@horizon/toolkit/scene";

import { VIEWS, viewById, worldDistance } from "../src/features/deep-field/lib/model/views.ts";
import { createCameraRig } from "../src/features/deep-field/lib/scene/camera-rig.ts";
import { labelInsets } from "../src/features/deep-field/lib/scene/kit.ts";
import { ATLAS_LANDMARKS } from "../src/space/cosmos/model/atlas.ts";
import { CMB_LY, anchorById, anchorToday } from "../src/space/cosmos/model/cosmos.ts";
import { modernGalaxy } from "../src/space/galaxy/graphics/galaxy.ts";
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
} from "../src/space/galaxy/scene/frames.ts";
import { assertSmoothFlight, close } from "./toolkit-helpers.mjs";

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
  close((up.angleTo(galacticUp) * 180) / Math.PI, 83.7, 0.5, "plane tilt");
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
  close(centre.length() / LY, Math.hypot(...SUN_ANCHOR), 1e-6, "centre distance");
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

test("the CMB shell fits portrait and desktop views without changing the depth or orbit", () => {
  const { rig, camera, frame } = rigWith();
  rig.snapToView("observable-universe");
  frame(0);
  const position = camera.position.clone();
  const distance = rig.pose.distance;
  const originalFov = camera.fov;
  const R = CMB_LY * LY;
  for (const [width, height] of [
    [1440, 920],
    [390, 780],
    [554, 1024],
    [920, 390],
  ]) {
    camera.aspect = width / height;
    frame(0);
    assert.equal(rig.pose.distance, distance, "resizing does not change scientific depth");
    assert.equal(camera.position.distanceTo(position), 0, "resizing does not move the observer");
    const d = camera.position.length();
    const centre = camera.position.clone().multiplyScalar((R * R) / (d * d));
    const radius = R * Math.sqrt(1 - (R / d) ** 2);
    for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 1, 0)]) {
      axis.applyQuaternion(camera.quaternion);
      for (const sign of [-1, 1]) {
        const edge = centre
          .clone()
          .addScaledVector(axis, sign * radius)
          .project(camera);
        assert(
          Math.abs(edge.x) < 0.85 && Math.abs(edge.y) < 0.85,
          `CMB clipped at ${width}×${height}`,
        );
      }
    }
    if (width >= height) assert.equal(camera.fov, originalFov, "desktop framing is preserved");
  }
  camera.aspect = 0.5;
  rig.snapToView("cosmic-web");
  frame(0);
  assert.equal(camera.fov, originalFov, "nearer views retain their existing framing");
});

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
  close(rig.pose.distance, 6, 1e-9, "the inner planets' view, in au");
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
  close(rig.pose.distance / LY, viewById("stars").ly, 1e-9, "at the stars");
  assert.equal(realmOf(rig.pose.distance), "stars");
  assert.ok(rig.aim.length() < 1e-9, "still turning about the Sun");
});

test("reduced motion lands every flight at once", () => {
  const { rig, frame } = rigWith({ reduced: true });
  rig.snapToView("stars");
  rig.flyToView("galaxy");
  assert.equal(rig.flying, false);
  close(rig.pose.distance, 92_000 * LY, 1e-3, "at the galaxy");
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

test("selecting any new atlas landmark brings its actual position into a phone's field", () => {
  const camera = new PerspectiveCamera(48, 390 / 844, 0.05, 2e6);
  const state = { selection: null };
  const rig = createCameraRig(camera, { state: () => state, reduceMotion: { matches: true } });
  rig.snapToView("cosmic-web");
  for (const [id, landmark] of Object.entries(ATLAS_LANDMARKS)) {
    state.selection = { kind: "cosmos", id };
    rig.step(0);
    rig.home();
    rig.applyPose();
    camera.updateMatrixWorld();
    const p = cosmicToWorld(landmark.at, new Vector3()).project(camera);
    close(p.x, 0, 1e-8, `${id} centred horizontally`);
    close(p.y, 0, 1e-8, `${id} centred vertically`);
  }
  state.selection = null;
  rig.step(0);
  rig.home();
  rig.applyPose();
  assert.ok(
    rig.aim.distanceTo(cosmicToWorld(ATLAS_LANDMARKS.sculptorVoid.at, new Vector3())) > LY,
    "closing the card returns the overview",
  );
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
