import assert from "node:assert/strict";
import test from "node:test";

import {
  createCameraSnapshot,
  writeCameraSnapshot,
  projectWorld,
  sampleOrbitFlight,
  createOrbitInput,
} from "@horizon/toolkit/camera";
import { smootherstep } from "@horizon/toolkit/math";

import { close, event } from "./toolkit-helpers.mjs";

test("tour interpolation preserves relative yaw, endpoints and smooth clamping", () => {
  const from = { azimuth: 6, inclination: 0.2, distance: 30 };
  const target = { yaw: 2, inclination: 1, distance: 100 };
  assert.deepEqual(sampleOrbitFlight(-1, from, target), from);
  assert.deepEqual(sampleOrbitFlight(2, from, target), {
    azimuth: 8,
    inclination: 1,
    distance: 100,
  });
  close(smootherstep(0.5), 0.5);
  assert.ok(smootherstep(0.001) < 1e-7);
});

test("tour shaping arcs mid-flight, vanishes at the ends and zooms geometrically", () => {
  const from = { azimuth: 0, inclination: 0.2, distance: 120 };
  const plain = { yaw: 1, inclination: 0.6, distance: 30 };
  const shaped = { ...plain, lift: 0.3, swing: 0.2, lead: 0.6 };
  assert.deepEqual(sampleOrbitFlight(1, from, shaped), sampleOrbitFlight(1, from, plain));
  assert.deepEqual(sampleOrbitFlight(0, from, shaped), from);
  const mid = sampleOrbitFlight(0.5, from, shaped);
  close(sampleOrbitFlight(0.5, from, plain).distance, 60);
  close(mid.inclination, 0.4 + 0.3);
  close(mid.distance, 60 * 1.2);
  assert.ok(mid.azimuth > sampleOrbitFlight(0.5, from, plain).azimuth, "lead turns first");
  const late = sampleOrbitFlight(0.5, from, { ...plain, lead: -0.6 });
  assert.ok(late.azimuth < 0.5, "negative lead turns last");
});

test("camera projection inverts the shader ray convention in portrait and landscape", () => {
  const camera = createCameraSnapshot();
  const other = createCameraSnapshot();
  writeCameraSnapshot(
    camera,
    { x: 0, y: 0, z: 10 },
    { x: 0, y: 0, z: -1 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    10,
    Math.PI / 2,
  );
  assert.equal(other.posZ, 0, "Camera instances must be independent");
  for (const [width, height] of [
    [1200, 700],
    [390, 844],
  ]) {
    for (const [x, y] of [
      [width / 2, height / 2],
      [width * 0.2, height * 0.7],
    ]) {
      // Build a point ten units along the unnormalized shader ray (screen y is inverted).
      const wx = ((x - width / 2) / height) * Math.tan(camera.fov / 2) * 10;
      const wy = ((height / 2 - y) / height) * Math.tan(camera.fov / 2) * 10;
      const projected = projectWorld(camera, wx, wy, 0, width, height);
      close(projected.x, x);
      close(projected.y, y);
      assert.ok(projected.visible);
    }
    assert.equal(projectWorld(camera, 0, 0, 11, width, height).visible, false);
  }
});

class FakeCanvas extends EventTarget {
  style = { touchAction: "auto" };
  captured = new Set();
  setPointerCapture(id) {
    this.captured.add(id);
  }
  hasPointerCapture(id) {
    return this.captured.has(id);
  }
  releasePointerCapture(id) {
    this.captured.delete(id);
  }
}

test("orbit input handles drag, pinch handoff, wheel, cancellation and cleanup", () => {
  const original = globalThis.window;
  globalThis.window = new EventTarget();
  const canvas = new FakeCanvas();
  let pose = { azimuth: 0, inclination: 0, distance: 10 };
  const input = createOrbitInput(canvas, {
    getPose: () => pose,
    onChange: (next) => {
      pose = next;
    },
    distance: { min: 1, max: 20 },
  });
  try {
    event(canvas, "pointerdown", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: "mouse",
      button: 0,
    });
    event(canvas, "pointermove", { pointerId: 1, clientX: 10, clientY: 10 });
    close(pose.azimuth, -0.05);
    close(pose.inclination, 0.04);
    event(canvas, "pointerdown", { pointerId: 2, clientX: 110, clientY: 10, pointerType: "touch" });
    event(canvas, "pointermove", { pointerId: 2, clientX: 210, clientY: 10 });
    close(pose.distance, 5);
    event(canvas, "pointerup", { pointerId: 2 });
    event(canvas, "pointermove", { pointerId: 1, clientX: 40, clientY: 40 });
    close(pose.azimuth, -0.05); // Do not jump from a pinch into one-finger orbit.
    event(canvas, "pointerup", { pointerId: 1 });
    assert.equal(input.active, false);
    event(canvas, "wheel", { deltaY: 1e5, ctrlKey: false });
    assert.equal(pose.distance, 20);
    input.dispose();
    assert.equal(canvas.style.touchAction, "auto");
    event(canvas, "wheel", { deltaY: -1e5 });
    assert.equal(pose.distance, 20);
  } finally {
    input.dispose();
    globalThis.window = original;
  }
});

test("close-start pinch recovers and wheel units have equivalent zoom", () => {
  const original = globalThis.window;
  globalThis.window = new EventTarget();
  const canvas = new FakeCanvas();
  canvas.clientHeight = 800;
  let pose = { azimuth: 0, inclination: 0, distance: 10 };
  const input = createOrbitInput(canvas, {
    getPose: () => pose,
    onChange: (next) => {
      pose = next;
    },
    distance: { min: 1, max: 100 },
  });
  try {
    event(canvas, "pointerdown", { pointerId: 1, clientX: 0, clientY: 0, pointerType: "touch" });
    event(canvas, "pointerdown", { pointerId: 2, clientX: 5, clientY: 0, pointerType: "touch" });
    event(canvas, "pointermove", { pointerId: 2, clientX: 30, clientY: 0 });
    close(pose.distance, 10);
    event(canvas, "pointermove", { pointerId: 2, clientX: 60, clientY: 0 });
    close(pose.distance, 5);
    input.cancel();
    for (const [deltaMode, deltaY] of [
      [0, 16],
      [1, 1],
      [2, 0.02],
    ]) {
      pose = { ...pose, distance: 10 };
      event(canvas, "wheel", { deltaMode, deltaY, ctrlKey: false });
      close(pose.distance, 10 * Math.exp(0.016));
    }
  } finally {
    input.dispose();
    globalThis.window = original;
  }
});
