import assert from "node:assert/strict";
import test from "node:test";

import {
  clamp,
  clamp01,
  smoothstep,
  toLogFraction,
  fromLogFraction,
  mulberry32,
  lcg,
  wrap,
  wrapSigned,
  valueNoise2,
  valueNoise3,
  fbm3,
} from "@horizon/toolkit/math";

import { close } from "./toolkit-helpers.mjs";

test("log controls round-trip across the entire zoom range and reject invalid bounds", () => {
  for (const t of [0, 0.01, 0.25, 0.5, 0.8, 1])
    close(toLogFraction(fromLogFraction(t, 0.32, 480), 0.32, 480), t);
  assert.equal(fromLogFraction(-1, 1, 100), 1);
  assert.equal(fromLogFraction(2, 1, 100), 100);
  assert.throws(() => fromLogFraction(0.5, 0, 10), RangeError);
  assert.throws(() => toLogFraction(5, 10, 1), RangeError);
  assert.equal(clamp(12, 0, 10), 10);
});

test("procedural random sequences stay reproducible across consumers", () => {
  const random = mulberry32(11);
  assert.deepEqual(
    Array.from({ length: 4 }, () => random()),
    [0.5115870486479253, 0.5299464082345366, 0.6081185641232878, 0.5901576359756291],
  );
  const sky = lcg(71);
  assert.deepEqual(
    Array.from({ length: 3 }, () => sky()),
    [0.085498, 0.081041, 0.24742],
  );
});

test("value noise is deterministic, bounded and smooth", () => {
  close(valueNoise2(3.7, -12.25), 0.46034655756846765);
  close(valueNoise3(0.3, 1.9, -4.6), 0.2001713072554169);
  close(fbm3(0.3, 1.9, -4.6, 4), 0.32321365644593975);
  close(valueNoise3(256.3, 1.9, -4.6), valueNoise3(0.3, 1.9, -4.6));
  const random = mulberry32(5);
  for (let i = 0; i < 2000; i += 1) {
    const [x, y, z] = [random() * 400 - 200, random() * 400 - 200, random() * 400 - 200];
    for (const v of [valueNoise2(x, y), valueNoise3(x, y, z), fbm3(x, y, z, 1 + (i % 6))])
      assert.ok(v >= 0 && v <= 1, `${v}`);
    assert.ok(Math.abs(valueNoise3(x, y, z) - valueNoise3(x + 1e-6, y, z)) < 1e-4);
  }
});

test("scalar wrap, clamp and smoothstep follow their GLSL counterparts", () => {
  assert.equal(clamp01(-0.2), 0);
  assert.equal(clamp01(1.7), 1);
  close(smoothstep(0, 2, 1), 0.5);
  close(smoothstep(2, 0, 0.5), smoothstep(0, 2, 1.5));
  close(wrap(-30, 360), 330);
  close(wrap(725, 360), 5);
  close(wrap(-0.5, 2 * Math.PI), 2 * Math.PI - 0.5);
  close(wrapSigned(350 - 10, 360), -20);
  close(wrapSigned(-200, 360), 160);
});
