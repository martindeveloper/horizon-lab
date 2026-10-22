import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera } from "three";

import { DisposalScope } from "@horizon/toolkit/rendering";

import { createShipCamera } from "../src/features/voyage/lib/scene/ship-camera.ts";
import { close, event } from "./toolkit-helpers.mjs";

class Canvas extends EventTarget {
  style = { touchAction: "auto" };
  clientHeight = 500;
  captured = new Set();
  parentElement = null;
  getAttribute() {
    return null;
  }
  removeAttribute() {}
  closest() {
    return null;
  }
  contains(node) {
    return node === this;
  }
  focus() {
    document.activeElement = this;
  }
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

function setup(t, reduced) {
  const previous = Object.fromEntries(
    ["window", "document", "navigator"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const window = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
  for (const [key, value] of Object.entries({
    window,
    document: { activeElement: null },
    navigator: { getGamepads: () => [] },
  })) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const scope = new DisposalScope();
  t.after(() => {
    try {
      scope.dispose();
    } finally {
      for (const [key, descriptor] of Object.entries(previous)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  });
  const canvas = new Canvas();
  const camera = new PerspectiveCamera(48, 1.6, 0.001, 1e12);
  const now = new Date(0);
  const rig = createShipCamera(scope, camera, canvas, {
    reduceMotion: { matches: reduced },
    bodyAt: (id, date, out) => {
      out[0] = id === "sun" ? 0 : id === "mars" ? 2e8 : 1e8;
      out[1] = 0;
      out[2] = id === "sun" ? 0 : (date.getTime() / 1000) * 30;
      if (id === "moon") out[0] += 384_400;
      return out;
    },
    now: () => now,
    clock: (seconds) => {
      now.setTime(seconds * 1000);
      return now;
    },
    nearest: () => "earth",
    warp: () => 1,
    halfTan: () => Math.tan((camera.fov * Math.PI) / 360),
    isShortcut: () => true,
    invalidate: () => {},
  });
  rig.snapTo("earth");
  rig.step(0, 0);
  return { rig, camera, canvas, window };
}

function drag(canvas, pointerType = "mouse") {
  event(canvas, "pointerdown", {
    pointerId: 1,
    pointerType,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  event(canvas, "pointermove", { pointerId: 1, clientX: 180, clientY: 140 });
  event(canvas, "pointerup", { pointerId: 1 });
}

function pinch(canvas) {
  for (const [pointerId, clientX] of [
    [1, 100],
    [2, 200],
  ]) {
    event(canvas, "pointerdown", {
      pointerId,
      pointerType: "touch",
      clientX,
      clientY: 100,
    });
  }
  event(canvas, "pointermove", { pointerId: 1, clientX: 50, clientY: 100 });
  event(canvas, "pointermove", { pointerId: 2, clientX: 250, clientY: 100 });
  for (const pointerId of [1, 2]) event(canvas, "pointerup", { pointerId });
}

const viewOf = (rig, camera) => ({
  position: [...rig.ship.x],
  attitude: camera.quaternion.toArray(),
  fov: camera.fov,
  zoom: camera.zoom,
});

for (const reduced of [false, true]) {
  test(`parked cockpit ignores drag, zoom gestures and camera-pad turns (reduced motion: ${reduced})`, (t) => {
    const { rig, camera, canvas } = setup(t, reduced);
    const fixedView = () => {
      const before = viewOf(rig, camera);
      for (const input of [
        () => drag(canvas),
        () => drag(canvas, "touch"),
        () => pinch(canvas),
        ...[-100, 100].flatMap((deltaY) =>
          [false, true].map(
            (ctrlKey) => () => event(canvas, "wheel", { deltaY, deltaMode: 0, ctrlKey }),
          ),
        ),
        () => rig.turnBy({ azimuth: 1, inclination: 1 }),
      ]) {
        input();
        rig.step(2, 0);
        assert.deepEqual(viewOf(rig, camera), before);
        assert.equal(rig.mode, "orbit");
      }
    };
    fixedView();
    // Parking after manual flight must lock the new station too.
    rig.setMode("free");
    rig.step(2, 0);
    drag(canvas);
    rig.step(1, 0);
    rig.setMode("orbit");
    rig.step(2, 0);
    fixedView();
    // Autopilot arrivals keep the same restriction, including reduced-motion cuts.
    rig.flyTo("mars");
    rig.step(1e6, 0);
    assert.equal(rig.flying, false);
    assert.equal(rig.aim, "mars");
    rig.step(0, 0);
    fixedView();
    const before = [...rig.ship.x];
    rig.step(1, 1);
    close(rig.ship.x[2] - before[2], 30);
  });
}

test("manual flight still responds to the keys, drag, camera pad and throttle", (t) => {
  const { rig, camera, canvas, window } = setup(t, true);
  canvas.focus();
  event(window, "keydown", { code: "KeyW" });
  assert.equal(rig.mode, "free");
  assert.equal(rig.axes.thrust, 1);
  rig.step(0.1, 1);
  event(window, "keyup", { code: "KeyW" });
  const before = viewOf(rig, camera);
  drag(canvas);
  rig.step(1, 0);
  assert.notDeepEqual(camera.quaternion.toArray(), before.attitude);
  assert.deepEqual([...rig.ship.x], before.position, "steering rotates in place");
  const heading = camera.quaternion.toArray();
  rig.turnBy({ azimuth: 1, inclination: 0 });
  rig.step(1, 0);
  assert.notDeepEqual(camera.quaternion.toArray(), heading);
  rig.setMode("orbit");
  rig.step(0, 0);
  rig.setThrottle(0.5);
  assert.equal(rig.mode, "free");
  assert.equal(rig.axes.thrust, 0.5);
});
