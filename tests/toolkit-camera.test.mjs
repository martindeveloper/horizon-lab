import assert from "node:assert/strict";
import test from "node:test";

import {
  createCameraSnapshot,
  DRIFT_DEFAULTS,
  createDriftCamera,
  createDriftRun,
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
  let source = null;
  const input = createOrbitInput(canvas, {
    getPose: () => pose,
    onChange: (next, from) => {
      pose = next;
      source = from;
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
    assert.deepEqual(source, { kind: "drag", x: 10, y: 10 }, "a drag says where the pointer is");
    event(canvas, "pointerdown", { pointerId: 2, clientX: 110, clientY: 10, pointerType: "touch" });
    event(canvas, "pointermove", { pointerId: 2, clientX: 210, clientY: 10 });
    close(pose.distance, 5);
    event(canvas, "pointerup", { pointerId: 2 });
    event(canvas, "pointermove", { pointerId: 1, clientX: 40, clientY: 40 });
    close(pose.azimuth, -0.05); // Do not jump from a pinch into one-finger orbit.
    event(canvas, "pointerup", { pointerId: 1 });
    assert.equal(input.active, false);
    event(canvas, "wheel", { deltaY: 1e5, ctrlKey: false, clientX: 3, clientY: 4 });
    assert.equal(pose.distance, 20);
    assert.deepEqual(source, { kind: "wheel", x: 3, y: 4 }, "a wheel says where the pointer is");
    input.dispose();
    assert.equal(canvas.style.touchAction, "auto");
    event(canvas, "wheel", { deltaY: -1e5 });
    assert.equal(pose.distance, 20);
  } finally {
    input.dispose();
    globalThis.window = original;
  }
});

test("a drag's turn follows the scale a scene gives it for the pose", () => {
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
    dragScale: (at) => at.distance / 10,
  });
  try {
    const down = { pointerId: 1, clientX: 0, clientY: 0, pointerType: "mouse", button: 0 };
    event(canvas, "pointerdown", down);
    event(canvas, "pointermove", { pointerId: 1, clientX: 10, clientY: 10 });
    close(pose.azimuth, -0.05);
    close(pose.inclination, 0.04);
    event(canvas, "pointerup", { pointerId: 1 });
    pose = { azimuth: 0, inclination: 0, distance: 2 };
    event(canvas, "pointerdown", down);
    event(canvas, "pointermove", { pointerId: 1, clientX: 10, clientY: 10 });
    const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
    near(pose.azimuth, -0.01); // A fifth of the turn at a fifth of the distance.
    near(pose.inclination, 0.008);
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

test("a drift flies each shot exactly as written at zero variance and holds for its hold", () => {
  const shots = [
    { azimuth: 0, inclination: 0.2, distance: 10, flight: { duration: 2 }, hold: 1 },
    { azimuth: 1, inclination: 0.6, distance: 100, flight: { duration: 4 }, hold: 2, roll: 0.1 },
    { azimuth: 2, inclination: 0.1, distance: 30 },
  ];
  const drift = createDriftCamera(shots, {
    variance: 0,
    creep: 0,
    drift: 0,
    sway: 0,
    flight: 3,
    hold: 1,
  });
  assert.equal(drift.index, -1);
  /* From beside the first shot the sequence goes on from the one after it. */
  drift.start({ azimuth: 0.1, inclination: 0.2, distance: 11 });
  assert.equal(drift.index, 1);
  assert.ok(drift.flying);
  const dt = 1 / 60;
  let frames = 0;
  let landedAt = -1;
  for (; frames < 60 * 10; frames++) {
    const { pose, landed } = drift.step(dt);
    if (landed) {
      landedAt = frames;
      close(pose.azimuth, 1, 1e-9);
      close(pose.inclination, 0.6, 1e-9);
      close(pose.distance, 100, 1e-9);
      close(pose.roll, 0.1, 1e-9);
      assert.equal(drift.flying, false);
      break;
    }
  }
  assert.ok(landedAt >= 60 * 4 - 1 && landedAt <= 60 * 4 + 1, `landed after ${landedAt} frames`);
  /* The hold keeps the pose still (no orbit, no push) and lasts its two seconds. */
  let heldFrames = 0;
  while (drift.index === 1 && heldFrames < 1000) {
    const { pose } = drift.step(dt);
    if (drift.index !== 1) break;
    heldFrames++;
    close(pose.distance, 100, 1e-9);
    close(pose.azimuth, 1, 1e-9);
  }
  assert.ok(heldFrames >= 60 * 2 - 2 && heldFrames <= 60 * 2 + 2, `held ${heldFrames} frames`);
  assert.equal(drift.index, 2, "the next flight begins once the hold is over");
  assert.ok(drift.flying);
  /* The third shot names no timing: the settings' defaults apply. */
  let steps = 0;
  while (drift.flying && steps < 1000) {
    drift.step(dt);
    steps++;
  }
  assert.ok(steps >= 60 * 3 - 1 && steps <= 60 * 3 + 1, `${steps} frames of flight`);
  drift.reset();
  assert.equal(drift.index, -1);
  assert.deepEqual(drift.step(dt).landed, false);
});

test("a drift's hold orbits and pushes in, speed scales its clock and reduced motion cuts", () => {
  const shot = { azimuth: 0, inclination: 0.3, distance: 50, flight: { duration: 2 }, hold: 4 };
  const slow = createDriftCamera([shot, { ...shot, azimuth: 3 }], {
    variance: 0,
    drift: 0.1,
    creep: 0.2,
  });
  slow.start({ azimuth: 3, inclination: 0.3, distance: 50 });
  assert.equal(slow.index, 0, "sequence: after the shot nearest the camera");
  const dt = 1 / 60;
  while (slow.flying) slow.step(dt);
  const landed = { ...slow.pose };
  for (let i = 0; i < 60 * 3.9; i++) slow.step(dt);
  /* The orbit turns on the way the flight turned: here back round, so it falls. */
  assert.ok(slow.pose.azimuth < landed.azimuth - 0.05, "the hold orbits the way the flight turned");
  assert.ok(slow.pose.distance < landed.distance * 0.9, "the hold pushes in");
  assert.ok(slow.pose.distance > landed.distance * 0.79, "no further than the creep");

  const fast = createDriftCamera([shot, { ...shot, azimuth: 3 }], { variance: 0, speed: 2 });
  fast.start({ azimuth: 3, inclination: 0.3, distance: 50 });
  let frames = 0;
  while (fast.flying && frames < 1000) {
    fast.step(dt);
    frames++;
  }
  assert.ok(frames >= 59 && frames <= 61, `double speed halves the flight: ${frames}`);

  const reduce = { matches: true };
  const still = createDriftCamera([shot, { ...shot, azimuth: 3 }], {
    variance: 0,
    drift: 0.1,
    creep: 0.2,
    reduceMotion: reduce,
  });
  still.start({ azimuth: 3, inclination: 0.3, distance: 50 });
  assert.equal(still.step(dt).landed, true, "reduced motion lands at once");
  const at = { ...still.pose };
  for (let i = 0; i < 60; i++) still.step(dt);
  assert.deepEqual(still.pose, at, "and holds still");
});

test("a drift never stands still: the orbit and sway carry through every landing and hold", () => {
  const shots = [0, 1.5, 3, 4.5].map((azimuth) => ({
    azimuth,
    inclination: 0.4,
    distance: 20,
    flight: { duration: 6 },
    hold: 5,
  }));
  const drift = createDriftCamera(shots, { variance: 0, creep: 0 });
  drift.start({ azimuth: 0, inclination: 0.4, distance: 20 });
  const dt = 1 / 60;
  /* The orbit eases up from the visitor's still camera first. */
  for (let i = 0; i < 60 * 10; i++) drift.step(dt);
  let slowest = Infinity;
  let landings = 0;
  let last = { ...drift.pose };
  for (let i = 0; i < 60 * 60; i++) {
    if (drift.step(dt).landed) landings++;
    const { pose } = drift;
    const moved = Math.hypot(
      pose.azimuth - last.azimuth,
      pose.inclination - last.inclination,
      Math.log(pose.distance / last.distance),
    );
    slowest = Math.min(slowest, moved / dt);
    /* It reports how it turned, for a host taking the camera over to carry on. */
    close(drift.motion.azimuth, (pose.azimuth - last.azimuth) / dt, 1e-9);
    close(drift.motion.inclination, (pose.inclination - last.inclination) / dt, 1e-9);
    last = { ...pose };
  }
  assert.ok(landings >= 4, `${landings} landings and holds were crossed`);
  assert.ok(slowest > DRIFT_DEFAULTS.drift * 0.6, `slowest ${slowest} rad/s`);
});

test("a drift's variance stays within its spread, keeps inclination in bounds and shuffles through every shot", () => {
  /* A generator that always answers 1 pushes every spread to its limit. */
  const edge = createDriftCamera(
    [{ azimuth: 0, inclination: 1.4, distance: 10, flight: { duration: 1 }, hold: 1 }],
    {
      variance: 1,
      random: () => 0.999999,
      drift: 0,
      creep: 0,
      inclination: { min: -1.45, max: 1.45 },
    },
  );
  edge.start({ azimuth: 0, inclination: 0, distance: 10 });
  while (edge.flying) edge.step(1 / 60);
  assert.ok(edge.pose.inclination <= 1.45 + 1e-9, "inclination is clamped");
  assert.ok(Math.abs(edge.pose.azimuth) <= 0.5 + 1e-6, `azimuth spread ${edge.pose.azimuth}`);
  assert.ok(
    edge.pose.distance <= 10 * Math.exp(0.3) + 1e-6,
    `distance spread ${edge.pose.distance}`,
  );

  let seed = 1;
  const lcg = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const shots = [0, 1, 2, 3].map((i) => ({
    azimuth: i,
    inclination: 0,
    distance: 10,
    flight: { duration: 0.5 },
    hold: 0,
  }));
  const shuffle = createDriftCamera(shots, { order: "shuffle", random: lcg, variance: 0 });
  shuffle.start({ azimuth: 0, inclination: 0, distance: 10 });
  const seen = new Set([shuffle.index]);
  let last = shuffle.index;
  for (let i = 0; i < 60 * 20; i++) {
    shuffle.step(1 / 60);
    if (shuffle.index !== last) {
      last = shuffle.index;
      seen.add(last);
    }
  }
  assert.equal(seen.size, 4, "every shot comes up");
  assert.throws(() => createDriftCamera([]));
});

test("a handoff shot waits for the host and the drift goes on from where the host left the camera", () => {
  const shots = [
    { azimuth: 0, inclination: 0.2, distance: 10, flight: { duration: 1 }, hold: 0 },
    { handoff: true },
    { azimuth: 2, inclination: 0.4, distance: 40, flight: { duration: 1 }, hold: 0 },
  ];
  const drift = createDriftCamera(shots, { variance: 0, drift: 0, sway: 0, creep: 0 });
  drift.start({ azimuth: 2, inclination: 0.4, distance: 40 });
  assert.equal(drift.index, 0, "from beside the last shot the sequence wraps to the first");
  drift.start({ azimuth: 0, inclination: 0.2, distance: 10 });
  assert.equal(
    drift.index,
    2,
    "a drift opens with a flight: the handoff after the nearest shot is skipped",
  );
  drift.start({ azimuth: 2, inclination: 0.4, distance: 40 });
  const dt = 1 / 60;
  while (!drift.handoff) drift.step(dt);
  assert.equal(drift.index, 1);
  assert.equal(drift.flying, false);
  const before = { ...drift.pose };
  const turning = { ...drift.motion };
  for (let i = 0; i < 120; i++) drift.step(dt);
  assert.deepEqual(drift.pose, before, "nothing moves while the host has the shot");
  assert.deepEqual(
    drift.motion,
    turning,
    "and it still says how it was turning as the host took it",
  );
  assert.equal(drift.landing, null, "no flight to land while the host has the shot");
  /* The host brings the camera back somewhere else; the next flight starts from there. */
  drift.resume({ azimuth: 1, inclination: 0.9, distance: 0.01, roll: 0 });
  assert.equal(drift.index, 2);
  assert.ok(drift.flying);
  const landing = drift.landing;
  assert.ok(landing && Math.abs(landing.distance - 40) < 1e-9, "the flight says where it lands");
  const first = drift.step(dt).pose;
  assert.ok(
    first.distance > 0.01 && first.distance < 0.02,
    "the flight leaves from the host's pose",
  );
  assert.ok(first.inclination < 0.9 && first.inclination > 0.4);
  while (drift.flying) drift.step(dt);
  assert.ok(Math.abs(drift.pose.distance - 40) < 1e-9);
  assert.equal(drift.landing, null);
  drift.resume(drift.pose);
  assert.equal(drift.index, 2, "resume outside a handoff does nothing");
});

test("a drift run starts from the host's camera, holds, hands off, and ends where it stopped", () => {
  const shots = [
    { azimuth: 0, inclination: 0.2, distance: 10, flight: { duration: 1 }, hold: 0 },
    { handoff: true },
    { azimuth: 2, inclination: 0.4, distance: 40, flight: { duration: 1 }, hold: 0 },
  ];
  const run = createDriftRun(shots, { variance: 0, drift: 0, creep: 0 });
  const at = { azimuth: 2, inclination: 0.4, distance: 40, roll: 0 };
  const dt = 1 / 60;
  assert.deepEqual(run.step("off", at, dt), {
    pose: null,
    started: false,
    ended: false,
    handoff: false,
  });
  assert.deepEqual(run.step("paused", at, dt), {
    pose: null,
    started: false,
    ended: false,
    handoff: false,
  });
  /* Held, the drift neither starts nor flies. */
  assert.equal(run.step("playing", at, dt, true).started, false);
  assert.equal(run.flying, false);
  const first = run.step("playing", at, dt);
  assert.equal(first.started, true);
  assert.ok(first.pose && first.pose.distance < 40, "flies from the host's camera at once");
  assert.equal(run.flying, true);
  /* A pause leaves the camera; playing on starts again from wherever the host's camera is. */
  assert.equal(run.step("paused", at, dt).pose, null);
  assert.equal(run.flying, false);
  const again = run.step("playing", { ...at, distance: 5 }, dt);
  assert.equal(again.started, true);
  assert.ok(again.pose && again.pose.distance > 5 && again.pose.distance < 10);
  while (!run.camera.handoff) run.step("playing", at, dt);
  const handed = run.step("playing", at, dt);
  assert.deepEqual(handed, { pose: null, started: false, ended: false, handoff: true });
  run.camera.resume(at);
  assert.ok(run.step("playing", at, dt).pose, "resumed, it flies on");
  const end = run.step("off", at, dt);
  assert.equal(end.ended, true, "the host hears the end once");
  assert.equal(run.step("off", at, dt).ended, false);
  assert.equal(run.camera.index, -1, "and the camera is reset");
});
