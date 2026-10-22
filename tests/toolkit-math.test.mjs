import assert from "node:assert/strict";
import test from "node:test";

import {
  clamp,
  clamp01,
  smoothstep,
  toLogFraction,
  fromLogFraction,
  mulberry32,
  minstd,
  gaussian,
  onSphere,
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
  for (const generator of [mulberry32, lcg]) {
    const sample = (seed) => {
      const next = generator(seed);
      return Array.from({ length: 256 }, () => next());
    };
    const first = sample(11);
    assert.deepEqual(sample(11), first, "same seed reproduces the sequence");
    assert.notDeepEqual(sample(71), first, "different seeds produce different sequences");
    assert.ok(first.every((value) => value >= 0 && value < 1));
    assert.ok(new Set(first).size > 1, "the generator advances");
  }
});

test("value noise is deterministic, bounded and smooth", () => {
  close(valueNoise3(256.3, 1.9, -4.6), valueNoise3(0.3, 1.9, -4.6));
  for (const noise of [valueNoise2, valueNoise3, (x, y, z) => fbm3(x, y, z, 4)]) {
    const first = noise(0.3, 1.9, -4.6);
    assert.notEqual(noise(3.7, -12.25, 8.1), first, "noise varies with position");
    assert.equal(noise(0.3, 1.9, -4.6), first, "sampling other positions does not change a value");
  }
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

test("gaussian deviates are standard normal and onSphere directions are uniform unit vectors", () => {
  const rnd = mulberry32(3);
  const n = 20000;
  let sum = 0;
  let squares = 0;
  for (let i = 0; i < n; i += 1) {
    const g = gaussian(rnd);
    sum += g;
    squares += g * g;
  }
  const mean = sum / n;
  const variance = squares / n - mean * mean;
  assert.ok(Math.abs(mean) < 0.03, `mean ${mean}`);
  assert.ok(Math.abs(variance - 1) < 0.05, `variance ${variance}`);
  let up = 0;
  for (let i = 0; i < n; i += 1) {
    const [x, y, z] = onSphere(rnd);
    close(Math.hypot(x, y, z), 1);
    if (z > 0.5) up += 1;
  }
  assert.ok(Math.abs(up / n - 0.25) < 0.02, "a quarter of directions lie within 60° of the pole");
  const [x, y, z] = onSphere(mulberry32(9), 3);
  close(Math.hypot(x, y, z), 3);
  const a = minstd(7);
  const b = minstd(7);
  assert.deepEqual(Array.from({ length: 16 }, a), Array.from({ length: 16 }, b));
  assert.ok(Array.from({ length: 256 }, a).every((v) => v > 0 && v < 1));
});

test("log controls retain finite endpoints and midpoints across extreme and narrow ranges", () => {
  for (const [min, max] of [
    [1e-300, 1e300],
    [1, 1 + Number.EPSILON],
  ]) {
    assert.equal(fromLogFraction(0, min, max), min);
    assert.equal(fromLogFraction(1, min, max), max);
    assert.equal(toLogFraction(min, min, max), 0);
    assert.equal(toLogFraction(max, min, max), 1);
  }
  close(toLogFraction(1, 1e-300, 1e300), 0.5);
  close(fromLogFraction(0.5, 1e-300, 1e300), 1);
  for (const [min, max] of [
    [NaN, 2],
    [1, Infinity],
    [-1, 2],
    [1, 1],
  ]) {
    assert.throws(() => fromLogFraction(0.5, min, max), RangeError);
    assert.throws(() => toLogFraction(1, min, max), RangeError);
  }
});

test("vector operations preserve inputs, support aliasing and normalize finite extreme scales", async () => {
  const { add3, cross3, dot3, length3, normalize3, scale3 } = await import("@horizon/toolkit/math");
  const a = [2, -3, 4];
  const b = [-5, 6, 7];
  const cross = cross3(a, b);
  assert.deepEqual(cross, [-45, -34, -3]);
  assert.equal(dot3(cross, a), 0);
  assert.equal(dot3(cross, b), 0);
  for (const input of [0, 1]) {
    const left = [...a];
    const right = [...b];
    const out = input === 0 ? left : right;
    assert.equal(cross3(left, right, out), out);
    assert.deepEqual(out, cross);
  }
  const out = [...a];
  assert.equal(add3(out, b, out), out);
  assert.deepEqual(out, [-3, 3, 11]);
  assert.equal(scale3(out, -2, out), out);
  assert.deepEqual(out, [6, -6, -22]);
  assert.deepEqual(a, [2, -3, 4]);
  assert.deepEqual(b, [-5, 6, 7]);
  assert.deepEqual(normalize3([0, 0, 0]), [0, 0, 0]);
  for (const scale of [1e-320, 1, 1e308]) {
    const v = [scale, -scale, scale];
    assert.equal(normalize3(v, v), v);
    close(length3(v), 1);
    v.forEach((value, i) => close(value, (i === 1 ? -1 : 1) / Math.sqrt(3)));
  }
});
