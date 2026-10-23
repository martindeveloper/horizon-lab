import assert from "node:assert/strict";
import test from "node:test";

import {
  DIALOG_MIN,
  fillMargin,
  fillSize,
  resizedBy,
} from "../packages/toolkit/src/ui/dialog-size.ts";
import {
  ZOOM_MAX,
  ZOOM_REST,
  clampView,
  panBy,
  zoomAbout,
} from "../packages/toolkit/src/ui/zoom-pan.ts";

const W = 600;
const H = 240;
/** Where a point of the content sits in the frame under a view. */
const onFrame = (view, cx, cy) => [view.x + cx * view.scale, view.y + cy * view.scale];

test("zooming keeps the content under the pointer where it was, within the zoom's limits", () => {
  const view = zoomAbout(ZOOM_REST, 3, 420, 90, W, H);
  assert.equal(view.scale, 3);
  const [x, y] = onFrame(view, 420, 90);
  assert.ok(Math.abs(x - 420) < 1e-9 && Math.abs(y - 90) < 1e-9);
  /* A second zoom about another point keeps that one. */
  const before = [(150 - view.x) / view.scale, (200 - view.y) / view.scale];
  const deeper = zoomAbout(view, 1.5, 150, 200, W, H);
  const [x2, y2] = onFrame(deeper, ...before);
  assert.ok(Math.abs(x2 - 150) < 1e-9 && Math.abs(y2 - 200) < 1e-9);
  assert.equal(zoomAbout(view, 100, 0, 0, W, H).scale, ZOOM_MAX);
  assert.deepEqual(zoomAbout(view, 0.01, 300, 120, W, H), ZOOM_REST, "out to the whole figure");
});

test("a zoomed figure always covers its frame: it pans to its edges and no further", () => {
  const view = zoomAbout(ZOOM_REST, 2, W / 2, H / 2, W, H);
  assert.deepEqual(panBy(view, 10_000, 10_000, W, H), { scale: 2, x: 0, y: 0 });
  assert.deepEqual(panBy(view, -10_000, -10_000, W, H), { scale: 2, x: -W, y: -H });
  assert.deepEqual(panBy(ZOOM_REST, 50, 50, W, H), ZOOM_REST, "the whole figure does not move");
  assert.deepEqual(clampView({ scale: 0.5, x: 40, y: -40 }, W, H), ZOOM_REST);
});

test("a dialog dragged by an edge stays centred and on the screen, at least readable", () => {
  const start = { width: 800, height: 500 };
  /* The right edge 50 px out: centred, it grows by both sides. */
  assert.deepEqual(resizedBy(start, 50, 0, 1, 0, 1440, 900), { width: 900, height: 500 });
  /* The top-left corner dragged in shrinks both, no smaller than the minimum. */
  assert.deepEqual(resizedBy(start, 1000, 1000, -1, -1, 1440, 900), DIALOG_MIN);
  /* Never past the screen less its margin, the same size filling it gives. */
  const most = fillSize(1440, 900);
  assert.deepEqual(resizedBy(start, 5000, 5000, 1, 1, 1440, 900), most);
  assert.equal(most.width, 1440 - 2 * fillMargin(1440));
  assert.ok(fillMargin(375) >= 16 && fillMargin(3840) <= 40, "a phone's margin to a wide screen's");
  /* On a screen smaller than the minimum, the screen wins. */
  assert.deepEqual(resizedBy(start, -900, -900, 1, 1, 300, 200), fillSize(300, 200));
});
