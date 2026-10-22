import assert from "node:assert/strict";
import test from "node:test";

import { Group, Mesh, PerspectiveCamera, Ray, Sphere, Vector3 } from "three";

import { DisposalScope } from "../packages/toolkit/src/rendering/disposal.ts";
import {
  bodyLabelBounds,
  bodyVisible,
  labelAt,
  labelDepthMask,
  labelMaskCache,
  labelOccluders,
  overlapsBody,
} from "../packages/toolkit/src/scene/label-geometry.ts";
import { createLabels } from "../packages/toolkit/src/scene/labels.ts";

const cameraAt = () => {
  const camera = new PerspectiveCamera(48, 1, 0.01, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
};

test("occluded and edge-clipped labels stay hidden without repeated layout writes and return when clear", () => {
  const original = globalThis.document;
  const elements = [];
  const writes = [];
  let reads = 0;
  globalThis.document = {
    createElement() {
      const element = {
        dataset: {},
        style: new Proxy(
          { setProperty() {} },
          {
            set(style, key, value) {
              writes.push([key, value]);
              style[key] = value;
              return true;
            },
          },
        ),
        get offsetWidth() {
          reads++;
          return this.style.display === "none" ? 0 : this.textContent.length * 8;
        },
        get offsetHeight() {
          reads++;
          return this.style.display === "none" ? 0 : 16;
        },
        remove() {},
      };
      elements.push(element);
      return element;
    },
  };
  const scope = new DisposalScope();
  try {
    const words = { first: "First name", second: "Second name", edge: "Edge name" };
    const labels = createLabels(
      { scope, camera: cameraAt(), viewport: { width: 800, height: 800 } },
      { appendChild() {} },
      () => words,
    );
    const draw = (secondX = 0, edgeX = 4.3) => {
      labels.place("first", 0, 0, 0, true, { strong: true });
      labels.place("second", secondX, 0, 0, true);
      labels.place("edge", edgeX, 0, 0, true);
      labels.flush();
    };
    const visible = () => labels.hits(() => true).map(({ key }) => key);
    draw();
    assert.deepEqual(visible(), ["first"]);
    assert.equal(elements[1].style.display, "none");
    assert.equal(elements[2].style.display, "none");
    writes.length = 0;
    reads = 0;
    for (let frame = 0; frame < 120; frame++) draw();
    assert.equal(writes.length, 0, "unchanged hidden candidates must not dirty DOM styles");
    assert.equal(reads, 0, "unchanged names keep their measured size");
    draw(2, -2);
    assert.deepEqual(visible(), ["first", "second", "edge"]);
    assert.equal(elements[1].style.display, "block");
    assert.equal(elements[2].style.display, "block");
    draw();
    words.second = "A translated name";
    draw();
    assert.deepEqual(visible(), ["first"]);
    draw(2, -2);
    assert.equal(
      labels.hits(() => true)[1].rect.right - labels.hits(() => true)[1].rect.left,
      words.second.length * 8,
    );
  } finally {
    scope.dispose();
    globalThis.document = original;
  }
});

test("depth masks cover only intersecting text pixels and retain foreground labels", () => {
  const camera = cameraAt();
  const mesh = new Mesh();
  mesh.updateMatrixWorld();
  const bodies = [{ key: "sun", mesh }];
  // Cross the solar limb: some of the label remains readable outside it.
  const rect = { left: 470, right: 520, top: 395, bottom: 405 };
  const mask = (anchor, key = "moon") =>
    labelDepthMask(rect, anchor, key, labelOccluders(bodies, camera), camera, 800, 800);
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
    labelOccluders(bodies, camera),
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

/* Every pixel's ray against every globe, as the mask is defined. */
function marchedMask(rect, anchor, key, bodies, camera, width, height) {
  const origin = camera.getWorldPosition(new Vector3());
  const depth = -anchor.clone().applyMatrix4(camera.matrixWorldInverse).z;
  const w = Math.ceil(rect.right - rect.left);
  const h = Math.ceil(rect.bottom - rect.top);
  const globes = bodies
    .filter((body) => body.key !== key && bodyVisible(body.mesh))
    .map(({ mesh }) => ({ inverse: mesh.matrixWorld.clone().invert(), world: mesh.matrixWorld }));
  const sphere = new Sphere(new Vector3(), 1);
  const rows = [];
  for (let y = 0; y < h; y += 1) {
    let row = "";
    for (let x = 0; x < w; x += 1) {
      const direction = new Vector3(
        ((rect.left + x + 0.5) / width) * 2 - 1,
        1 - ((rect.top + y + 0.5) / height) * 2,
        0.5,
      )
        .unproject(camera)
        .sub(origin)
        .normalize();
      const covered = globes.some((globe) => {
        const hit = new Ray(origin.clone(), direction.clone())
          .applyMatrix4(globe.inverse)
          .intersectSphere(sphere, new Vector3());
        if (!hit) return false;
        hit.applyMatrix4(globe.world).applyMatrix4(camera.matrixWorldInverse);
        return -hit.z < depth * (1 - 1e-7);
      });
      row += covered ? "#" : ".";
    }
    rows.push(row);
  }
  return rows;
}

/* The pixels a mask leaves visible, row by row, from its SVG runs. */
function maskRows(mask, rect) {
  const w = Math.ceil(rect.right - rect.left);
  const h = Math.ceil(rect.bottom - rect.top);
  const rows = Array.from({ length: h }, () => Array(w).fill(mask === "none" ? "." : "#"));
  if (mask !== "none") {
    const path = decodeURIComponent(mask).match(/d="([^"]*)"/)[1];
    for (const [, start, y, length] of path.matchAll(/M(\d+) (\d+)h(\d+)/g))
      for (let x = Number(start); x < Number(start) + Number(length); x += 1) rows[y][x] = ".";
  }
  return rows.map((row) => row.join(""));
}

test("depth masks match a ray march for oblique, oblate, near and straddling globes", () => {
  const camera = new PerspectiveCamera(48, 1.5, 0.01, 1e6);
  camera.position.set(0.3, -0.2, 0.1);
  camera.lookAt(0.4, 0.1, -10);
  camera.updateMatrixWorld();
  const globe = (key, x, y, z, scale, tilt) => {
    const mesh = new Mesh();
    mesh.position.set(x, y, z);
    mesh.scale.set(scale, scale * 0.9, scale);
    mesh.rotation.set(tilt, tilt * 0.5, 0);
    mesh.updateMatrixWorld();
    return { key, mesh };
  };
  const bodies = [
    globe("far", 0.5, 0.2, -12, 3, 0.4),
    // Across the camera plane, beside the camera: its bounding box has no screen bounds.
    globe("beside", 2.6, 0, 0.5, 2.2, 0.2),
    globe("behind", 0, 0, 6, 1, 0),
    globe("small", -0.6, -0.3, -4, 0.35, 1.1),
  ];
  const occluders = labelOccluders(bodies, camera);
  const [width, height] = [900, 600];
  let masked = 0;
  for (let i = 0; i < 60; i += 1) {
    const left = (i * 137) % 860;
    const top = (i * 211) % 580;
    const rect = { left: left + 0.3, right: left + 37.6, top: top + 0.7, bottom: top + 12.2 };
    const anchor = new Vector3(0.4, 0.1, -10).addScaledVector(new Vector3(0, 0, 1), (i % 5) * 3);
    const key = i % 7 === 0 ? "far" : "label";
    const mask = labelDepthMask(rect, anchor, key, occluders, camera, width, height);
    const expected = marchedMask(rect, anchor, key, bodies, camera, width, height);
    assert.deepEqual(maskRows(mask, rect), expected, `label ${i}`);
    if (mask !== "none") masked += 1;
  }
  assert.ok(masked > 5, "some labels sit behind a globe");
});

test("a cached mask is the same string until its pixels change", () => {
  const camera = cameraAt();
  const mesh = new Mesh();
  mesh.updateMatrixWorld();
  const occluders = labelOccluders([{ key: "sun", mesh }], camera);
  const cache = labelMaskCache();
  const at = (left) =>
    labelDepthMask(
      { left, right: left + 50, top: 395, bottom: 405 },
      new Vector3(0, 0, -4),
      "moon",
      occluders,
      camera,
      800,
      800,
      cache,
    );
  const first = at(470);
  assert.equal(at(470.01), first);
  assert.notEqual(at(480), first);
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
