import assert from "node:assert/strict";

/** `actual` within `tolerance` of `expected`; `label` names the figure in the failure. */
export const close = (actual, expected, tolerance = 1e-9, label = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label ? `${label}: ` : ""}${actual} is not within ${tolerance} of ${expected}`,
  );

/** `actual` within a share `relative` of `expected`, or of 1 below it: a figure near zero keeps an absolute floor. */
export const closeRelative = (actual, expected, relative = 1e-9, label = "") =>
  assert.ok(
    Math.abs(actual - expected) <= relative * Math.max(1, Math.abs(expected)),
    `${label ? `${label}: ` : ""}${actual} is not within ${relative * 100}% of ${expected}`,
  );

export function event(target, type, values = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, values);
  target.dispatchEvent(e);
  return e;
}

/**
 * A Storage over a Map, installed as the tab's session (or local) storage before the module
 * under test reads it. `onRead` sees every getItem. Returns the Map and the stub.
 */
export function stubStorage(initial = [], { area = "session", onRead } = {}) {
  const saved = new Map(initial);
  const store = {
    getItem: (key) => {
      onRead?.();
      return saved.get(key) ?? null;
    },
    setItem: (key, value) => saved.set(key, String(value)),
    removeItem: (key) => saved.delete(key),
  };
  globalThis[`${area}Storage`] = store;
  return { saved, store };
}

/**
 * Steps a camera rig through the flight it has just begun, at 60 fps, and asserts one smooth
 * zoom inward: the log distance never backs out, never changes faster than `maxSpeed` e-folds
 * per second, never lurches between frames, and the camera never cuts; the flight lasts
 * between one and seven seconds. `frame(dt)` advances the rig and returns the camera position.
 */
export function assertSmoothFlight(rig, camera, frame, { maxSpeed }) {
  const dt = 1 / 60;
  let last = Math.log(rig.pose.distance);
  let lastSpeed = 0;
  let lastPosition = camera.position.clone();
  let frames = 0;
  while (rig.flying && frames < 1000) {
    const position = frame(dt);
    const x = Math.log(rig.pose.distance);
    const speed = (x - last) / dt;
    assert.ok(speed <= 1e-9, "never backs out");
    assert.ok(Math.abs(speed) < maxSpeed, `speed ${speed}`);
    assert.ok(Math.abs(speed - lastSpeed) < 0.5, `speed jump at frame ${frames}`);
    assert.ok(position.distanceTo(lastPosition) < rig.pose.distance * 0.25, `cut at ${frames}`);
    last = x;
    lastSpeed = speed;
    lastPosition = position;
    frames += 1;
  }
  assert.ok(frames > 60 && frames < 400, `${frames} frames`);
}
