import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector2 } from "three";

import { createPlaceOutline } from "../src/features/sun/lib/scene/outline.ts";

const viewport = { width: 1000, height: 1000 };
const FOV = 40;

/** The outline over a stand-in stage: its SVG elements only record what is written to them. */
function outlineOver() {
  const made = [];
  const previous = globalThis.document;
  globalThis.document = {
    createElementNS: () => {
      const el = {
        attributes: {},
        style: {},
        dataset: {},
        setAttribute(key, value) {
          this.attributes[key] = value;
        },
        append() {},
        remove() {},
      };
      made.push(el);
      return el;
    },
  };
  try {
    const outline = createPlaceOutline({ defer() {} }, { prepend() {} });
    const of = (name) => made.find((el) => el.attributes.class === `sun-outline${name}`);
    const svg = of("");
    const line = of("-line");
    return {
      outline,
      svg,
      path: () => line.attributes.d ?? "",
      ticks: () => of("-ticks").attributes.d ?? "",
    };
  } finally {
    globalThis.document = previous;
  }
}

const cameraAt = (x, y, z) => {
  const camera = new PerspectiveCamera(FOV, viewport.width / viewport.height, 0.001, 100);
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
};

const view = (camera, place, over = {}) => ({
  camera,
  viewport,
  place,
  shown: () => true,
  light: "white",
  cut: new Vector2(0, 0),
  cutShown: 0,
  reduceMotion: true,
  ...over,
});

const pointsOf = (path) =>
  [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)]);

test("the photosphere is outlined on the limb, all round, ticked square to the screen", () => {
  const { outline, path, ticks } = outlineOver();
  const d = 4;
  outline.update({}, view(cameraAt(0, 0, d), "photosphere"), 0.016);
  const points = pointsOf(path());
  assert.ok(points.length > 32 && path().endsWith("Z"), "one closed circle");
  /* The disc's angular radius is asin(1/d); on screen its tangent over the half-field's. */
  const limbPx =
    (Math.tan(Math.asin(1 / d)) / Math.tan((FOV * Math.PI) / 360)) * (viewport.height / 2);
  for (const [x, y] of points)
    assert.ok(Math.abs(Math.hypot(x - 500, y - 500) - limbPx) < 0.2, `${x}, ${y} off the limb`);
  /* Four ticks standing out from the limb, the first straight above the centre. */
  const marks = pointsOf(ticks());
  assert.equal(marks.length, 8);
  const [top, topEnd] = marks;
  assert.ok(Math.abs(top[0] - 500) < 0.2 && Math.abs(topEnd[0] - 500) < 0.2, "at the top");
  assert.ok(topEnd[1] < top[1] && top[1] < 500 - limbPx, "outward, off the line");
});

test("a layer is outlined on the open cut's faces that face the camera, and nowhere else", () => {
  /* The wedge opened toward +z, a quarter of the Sun wide. */
  const cut = new Vector2(Math.PI / 4, Math.PI / 2);
  const front = outlineOver();
  front.outline.update({}, view(cameraAt(0, 1, 4), "convectionZone", { cut, cutShown: 1 }), 0.016);
  assert.equal(front.path().match(/Z/g)?.length, 2, "a closed band on each face");

  const behind = outlineOver();
  behind.outline.update(
    {},
    view(cameraAt(0, 1, -4), "convectionZone", { cut, cutShown: 1 }),
    0.016,
  );
  assert.equal(behind.path(), "", "the faces turn away from a camera behind the Sun");

  const closed = outlineOver();
  closed.outline.update({}, view(cameraAt(0, 1, 4), "convectionZone", { cut }), 0.016);
  assert.equal(closed.path(), "", "no band while the cut is closed");
});

test("a new place's outline comes in only once the last has faded out", () => {
  const { outline, svg } = outlineOver();
  const camera = cameraAt(0, 0, 4);
  const step = (place) => {
    outline.update({}, view(camera, place, { reduceMotion: false }), 0.1);
    return Number(svg.style.opacity);
  };
  step("star");
  while (outline.moving) step("star");
  assert.equal(step("star"), 1);
  const seen = [];
  do seen.push(step("photosphere"));
  while (outline.moving);
  const low = seen.indexOf(Math.min(...seen));
  /* The new one starts in the frame the old one is gone: one step up from nothing. */
  assert.ok(seen[low] < 0.05, "the star's outline leaves entirely first");
  assert.ok(
    seen.slice(0, low + 1).every((o, i, a) => i === 0 || o <= a[i - 1]),
    "fading out",
  );
  assert.ok(
    seen.slice(low).every((o, i, a) => i === 0 || o >= a[i - 1]),
    "then the photosphere's fading in",
  );
  assert.equal(seen.at(-1), 1);
});
