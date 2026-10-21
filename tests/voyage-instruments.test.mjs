import assert from "node:assert/strict";
import { test } from "node:test";

import { blipOnScanner, markOnScreen } from "../src/features/voyage/lib/model/instruments.ts";

const tanHalf = Math.tan(Math.PI / 6);

test("a mark ahead sits where the direction projects, one behind at the edge pointing out", () => {
  const out = { x: 0, y: 0, off: false, angle: 0 };
  markOnScreen(0, 0, -1, tanHalf, 1.5, 0.9, out);
  assert.deepEqual([out.x, out.y, out.off], [0, 0, false]);
  /* Up by half the field's half-angle: halfway up the screen. */
  markOnScreen(0, tanHalf / 2, -1, tanHalf, 1.5, 0.9, out);
  assert.ok(Math.abs(out.y - 0.5) < 1e-9 && !out.off);
  /* Behind and to the right: the chevron at the right edge, pointing right. */
  markOnScreen(1, 0, 1, tanHalf, 1.5, 0.9, out);
  assert.ok(out.off);
  assert.ok(Math.abs(out.x + 0.9) < 1e-9, "a direction behind is shown opposite its shadow");
  assert.equal(Math.abs(out.y), 0);
  /* Far to the left, ahead: at the left edge. */
  markOnScreen(-10, 0, -1, tanHalf, 1.5, 0.9, out);
  assert.ok(out.off && Math.abs(out.x + 0.9) < 1e-9);
  assert.ok(Math.abs(Math.abs(out.angle) - Math.PI) < 1e-9);
});

test("the scanner reads distance in decades about the aim's range, clamped to the disc", () => {
  const out = { r: 0, u: 0, w: 0, h: 0 };
  blipOnScanner(0, 0, -100, 100, out);
  assert.deepEqual([out.r, out.u, out.w, out.h], [0.5, 0, 0.5, 0]);
  blipOnScanner(1000, 0, 0, 100, out);
  assert.ok(Math.abs(out.r - 0.75) < 1e-9 && Math.abs(out.u - 0.75) < 1e-9);
  blipOnScanner(0, 0, 1e9, 100, out);
  assert.equal(out.r, 1, "a hundred times the range and beyond sits on the rim");
  assert.equal(out.w, -1);
  blipOnScanner(0, 1e-9, 0, 100, out);
  assert.equal(out.r, 0);
  /* Straight up: no foot on the disc, all height. */
  blipOnScanner(0, 100, 0, 100, out);
  assert.deepEqual([out.u, out.w, out.h], [0, 0, 0.5]);
  blipOnScanner(0, 0, 0, 100, out);
  assert.equal(out.r, 0);
});
