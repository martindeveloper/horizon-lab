import assert from "node:assert/strict";
import test from "node:test";

import { Group, Mesh, PerspectiveCamera, Vector3 } from "three";

import {
  bodyLabelBounds,
  bodyVisible,
  labelAt,
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

test("label taps land on the name, reach a fingertip around small ones and prefer the nearest", () => {
  const rect = (left, top, width = 40, height = 12) => ({
    left,
    right: left + width,
    top,
    bottom: top + height,
  });
  const mars = { key: "mars", rect: rect(100, 100) };
  const ceres = { key: "ceres", rect: rect(130, 108) };
  // Squarely on the text, or a hair off it with the padding; a miss is a miss.
  assert.equal(labelAt([mars], 120, 106), "mars");
  assert.equal(labelAt([mars], 120, 98), null);
  assert.equal(labelAt([mars], 120, 98, 0, 2), "mars");
  assert.equal(labelAt([mars], 120, 80), null);
  // A 12 px tall name still takes a 44 px fingertip, centred on it, and no more.
  assert.equal(labelAt([mars], 120, 106 - 21, 44), "mars", "top of a 44 px target");
  assert.equal(labelAt([mars], 120, 106 + 21, 44), "mars", "bottom of a 44 px target");
  assert.equal(labelAt([mars], 120, 106 - 23, 44), null);
  // Wide names keep their width; the reach only grows the short side.
  assert.equal(labelAt([mars], 95, 106, 44), null);
  assert.equal(labelAt([mars], 95, 106, 44, 6), "mars");
  // Overlapping names: the one under the pointer, then the one nearest it.
  assert.equal(labelAt([mars, ceres], 140, 111), "ceres", "inside both, nearer centre");
  assert.equal(labelAt([mars, ceres], 110, 104), "mars");
  assert.equal(labelAt([ceres, mars], 160, 115), "ceres", "inside only ceres");
  assert.equal(labelAt([mars, ceres], 138, 124, 44), "ceres", "below both, nearer ceres");
  assert.equal(labelAt([mars, ceres], 132, 96, 44), "mars", "above both, nearer mars");
  assert.equal(labelAt([], 0, 0, 44), null);
});
