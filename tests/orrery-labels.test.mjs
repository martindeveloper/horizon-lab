import assert from "node:assert/strict";
import test from "node:test";

import { Group, Mesh, PerspectiveCamera, Vector3 } from "three";

import {
  bodyLabelBounds,
  bodyVisible,
  labelDepthMask,
  overlapsBody,
} from "../src/features/orrery/lib/scene/label-geometry.ts";

const cameraAt = () => {
  const camera = new PerspectiveCamera(48, 1, 0.01, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
};

test("depth masks cover only intersecting text pixels and retain foreground labels", () => {
  const camera = cameraAt();
  const mesh = new Mesh();
  mesh.updateMatrixWorld();
  const bodies = [{ key: "sun", mesh }];
  const bounds = [bodyLabelBounds(mesh, camera, 800, 800)];
  // Cross the solar limb: some of the label remains readable outside it.
  const rect = { left: 470, right: 520, top: 395, bottom: 405 };
  const mask = (anchor, key = "moon") =>
    labelDepthMask(rect, anchor, key, bodies, bounds, camera, 800, 800);
  const partial = mask(new Vector3(0, 0, -4));
  assert.notEqual(partial, "none");
  const svg = decodeURIComponent(partial);
  assert.match(svg, /<path fill="white" d="M/);
  // A nearer label and the Sun's own label keep all their text.
  assert.equal(mask(new Vector3(0, 0, 4)), "none");
  assert.equal(mask(new Vector3(), "sun"), "none");
  // The whole label can be behind the globe, without removing the DOM label.
  const full = labelDepthMask(
    { left: 390, right: 410, top: 395, bottom: 405 },
    new Vector3(0, 0, -4),
    "moon",
    bodies,
    bounds,
    camera,
    800,
    800,
  );
  assert.match(decodeURIComponent(full), /d=""/);
  const parent = new Group();
  parent.add(mesh);
  parent.visible = false;
  assert.equal(bodyVisible(mesh), false);
  assert.equal(mask(new Vector3(0, 0, -4)), "none");
});

test("projected bounds provide clearance for the whole label and grow with rendered size", () => {
  const camera = cameraAt();
  const mesh = new Mesh();
  mesh.updateMatrixWorld();
  const small = bodyLabelBounds(mesh, camera, 800, 800);
  mesh.scale.setScalar(3);
  mesh.updateMatrixWorld();
  const large = bodyLabelBounds(mesh, camera, 800, 800);
  assert.ok(large.top < small.top && large.right > small.right);
  const label = { left: 360, right: 440, top: large.top - 20, bottom: large.top - 6 };
  assert.equal(overlapsBody(label, large, 4), false);
  assert.equal(overlapsBody({ ...label, bottom: large.top + 1 }, large, 4), true);
  mesh.position.z = 20;
  mesh.updateMatrixWorld();
  assert.equal(bodyLabelBounds(mesh, camera, 800, 800), null);
});
