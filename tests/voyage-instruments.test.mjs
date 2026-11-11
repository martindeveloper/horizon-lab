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
  assert.ok(Math.abs(out.x - 0.9) < 1e-9, "a direction behind is shown opposite its shadow");
  assert.equal(Math.abs(out.y), 0);
  assert.equal(Math.abs(out.angle), 0);
  /* Crossing from ahead to behind, high on the right, the chevron keeps its place. */
  const ahead = markOnScreen(3, 2, -1e-6, tanHalf, 1.5, 0.9, { ...out });
  const behind = markOnScreen(3, 2, 1e-6, tanHalf, 1.5, 0.9, { ...out });
  assert.ok(Math.abs(ahead.x - behind.x) < 1e-3 && Math.abs(ahead.y - behind.y) < 1e-3);
  assert.ok(Math.abs(ahead.angle - behind.angle) < 1e-3);
  /* Dead astern still has a place. */
  markOnScreen(0, 0, 1, tanHalf, 1.5, 0.9, out);
  assert.ok(out.off && out.x === 0 && Math.abs(out.y + 0.9) < 1e-9);
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

test("the HUD's spring trails a push, overshoots a little and settles within a second", async () => {
  const { createSway, stepSway, swaySettled } =
    await import("../src/features/voyage/lib/model/sway.ts");
  const sway = createSway();
  const target = { x: 10, y: -6, s: 0.98 };
  let peak = 0;
  let t = 0;
  for (; t < 2 && !swaySettled(sway, target); t += 1 / 60) {
    stepSway(sway, target, 1 / 60);
    peak = Math.max(peak, sway.x);
  }
  assert.ok(t < 1.2, `settled after ${t} s`);
  assert.ok(peak > 10 && peak < 13, `overshoot to ${peak}`);
  /* A long frame is stepped in pieces: the same place as the short frames it spans. */
  const a = stepSway(createSway(), target, 0.2);
  const b = createSway();
  for (let i = 0; i < 12; i += 1) stepSway(b, target, 1 / 60);
  assert.ok(Math.abs(a.x - b.x) < 1e-9, `${a.x} vs ${b.x}`);
});

test("the ship's feel: an impact holds, tells the crash once, jolts and settles; the drive spools up", async () => {
  const { PerspectiveCamera } = await import("three");
  const { createShipFeel } = await import("../src/features/voyage/lib/scene/feel.ts");
  const camera = new PerspectiveCamera(48, 1, 1, 10);
  const feel = createShipFeel(camera);
  let told = 0;
  feel.impact(3, () => (told += 1));
  /* Held for 0.12 s, seven frames at 60 Hz: the ship gets no time, and the crash waits. */
  for (let i = 0; i < 7; i += 1) assert.equal(feel.step(1 / 60), 0);
  assert.equal(told, 0);
  assert.equal(feel.step(1 / 60), 1 / 60);
  assert.equal(told, 1);
  /* The jolt turns the camera a little, then the impact is over. */
  feel.apply(1 / 60, 0, false);
  const turned = camera.quaternion.angleTo(new camera.quaternion.constructor());
  assert.ok(turned > 0 && turned <= (0.6 * Math.PI) / 180, `jolt ${turned} rad`);
  for (let i = 0; i < 60; i += 1) feel.step(1 / 60);
  assert.equal(feel.busy, false);
  assert.equal(told, 1);
  /* The view widens with the drive and comes back. */
  for (let i = 0; i < 30; i += 1) feel.apply(1 / 60, 1, false);
  assert.ok(Math.abs(camera.fov - 51) < 0.01, `fov ${camera.fov}`);
  for (let i = 0; i < 60; i += 1) feel.apply(1 / 60, 0, false);
  assert.equal(camera.fov, 48);
  /* The autopilot's drive: dark through most of the align, full by its end, on while it burns. */
  assert.equal(feel.spool("align", 1), 0);
  assert.ok(feel.spool("align", 1.7) > 0 && feel.spool("align", 1.7) < 1);
  assert.equal(feel.spool("align", 2), 1);
  assert.equal(feel.spool("burn", 5), 1);
  assert.equal(feel.spool("cruise", 5), 0);
});
