import assert from "node:assert/strict";
import test from "node:test";

import {
  FLIGHT_KEYS,
  STICK_DEADZONE,
  axesIdle,
  createFlightAxes,
  createFlightInput,
  flightAxesFromKeys,
  readGamepad,
  stickValue,
  wheelPixels,
} from "@horizon/toolkit/camera";

import { close, event } from "./toolkit-helpers.mjs";

test("held keys map to axes, opposed keys cancel and Shift boosts", () => {
  const axes = createFlightAxes();
  assert.ok(axesIdle(axes));
  flightAxesFromKeys(new Set(["KeyW", "KeyD", "KeyR", "KeyE", "ShiftLeft", "Space"]), axes);
  assert.deepEqual(axes, {
    thrust: 1,
    strafe: 1,
    lift: 1,
    roll: 1,
    boost: 1,
    brake: 0,
    park: true,
  });
  flightAxesFromKeys(new Set(["KeyS", "KeyA", "KeyF", "KeyQ"]), axes);
  assert.deepEqual([axes.thrust, axes.strafe, axes.lift, axes.roll], [-1, -1, -1, -1]);
  assert.equal(axes.boost, 0);
  assert.equal(axes.park, false);
  flightAxesFromKeys(new Set(["KeyW", "KeyS", "ShiftRight"]), axes);
  assert.equal(axes.thrust, 0);
  assert.equal(axes.boost, 1);
  assert.ok(!axesIdle(axes));
  flightAxesFromKeys(new Set(["KeyX"]), axes);
  assert.equal(axes.brake, 1);
  flightAxesFromKeys(new Set(["KeyZ"]), axes);
  assert.ok(axesIdle(axes));
  for (const code of [
    "KeyW",
    "KeyS",
    "KeyA",
    "KeyD",
    "KeyQ",
    "KeyE",
    "KeyR",
    "KeyF",
    "KeyX",
    "Space",
  ])
    assert.ok(FLIGHT_KEYS.has(code), code);
});

test("stick values pass a deadzone and stretch back to full travel", () => {
  assert.equal(stickValue(0.1), 0);
  assert.equal(stickValue(-STICK_DEADZONE), 0);
  assert.equal(stickValue(1), 1);
  assert.equal(stickValue(-1), -1);
  assert.equal(stickValue(1.5), 1);
  close(stickValue(0.575), 0.5);
  close(stickValue(-0.575), -0.5);
  assert.equal(stickValue(Number.NaN), 0);
  assert.equal(stickValue(0.3, 0.5), 0);
  close(stickValue(0.75, 0.5), 0.5);
});

test("wheel travel normalizes lines and pages to pixels", () => {
  assert.equal(wheelPixels(5, 0, 600), 5);
  assert.equal(wheelPixels(3, 1, 600), 48);
  assert.equal(wheelPixels(-1, 2, 600), -600);
  assert.equal(wheelPixels(1, 2, 0), 800);
});

test("a standard-mapping gamepad reads thrust, strafe, triggers and look, and the keyboard keeps its larger values", () => {
  const axes = createFlightAxes();
  const pad = {
    axes: [0.575, -1, 0.5, -0.5],
    buttons: Array.from({ length: 17 }, (_, i) => ({ value: i === 7 ? 0.5 : i === 6 ? 1 : 0 })),
  };
  const look = readGamepad(pad, axes, STICK_DEADZONE, 24);
  close(axes.thrust, 1);
  close(axes.strafe, 0.5);
  assert.equal(axes.boost, 0.5);
  assert.equal(axes.brake, 1);
  close(look.dx, stickValue(0.5) * 24);
  close(look.dy, stickValue(-0.5) * 24);
  flightAxesFromKeys(new Set(["KeyS", "ShiftLeft"]), axes);
  readGamepad({ axes: [0, -0.5, 0, 0], buttons: [] }, axes);
  assert.equal(axes.thrust, -1, "a full key beats a half stick");
  assert.equal(axes.boost, 1);
  assert.equal(axes.brake, 0);
});

class FakeCanvas extends EventTarget {
  style = { touchAction: "auto" };
  clientHeight = 500;
  captured = new Set();
  parentElement = { contains: (node) => node === this || node === this.parentElement };
  contains(node) {
    return node === this;
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

/** A window, a document with a focused element and a navigator without gamepads, restored after. */
function withDom(run) {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
  };
  const window = new EventTarget();
  const document = { activeElement: null };
  globalThis.window = window;
  globalThis.document = document;
  Object.defineProperty(globalThis, "navigator", {
    value: { getGamepads: () => [] },
    configurable: true,
    writable: true,
  });
  try {
    run(window, document);
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    Object.defineProperty(globalThis, "navigator", {
      value: previous.navigator,
      configurable: true,
      writable: true,
    });
  }
}

test("flight input looks on drag, throttles on wheel, reads keys only while the stage has focus and lets go on blur", () => {
  withDom((window, document) => {
    const canvas = new FakeCanvas();
    const looks = [];
    const wheels = [];
    let published = 0;
    let shortcut = true;
    const input = createFlightInput(canvas, {
      onLook: (dx, dy) => looks.push([dx, dy]),
      onAxes: () => {
        published += 1;
      },
      onWheel: (delta, pinch) => wheels.push([delta, pinch]),
      isShortcut: () => shortcut,
    });
    try {
      assert.equal(canvas.style.touchAction, "none");
      event(canvas, "pointerdown", {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: "mouse",
        button: 0,
      });
      assert.ok(input.active);
      event(canvas, "pointermove", { pointerId: 1, clientX: 10, clientY: -4 });
      event(canvas, "pointermove", { pointerId: 2, clientX: 99, clientY: 99 });
      assert.deepEqual(looks, [[10, -4]]);
      event(canvas, "pointerup", { pointerId: 1 });
      assert.ok(!input.active);
      assert.equal(canvas.captured.size, 0);
      const wheel = event(canvas, "wheel", { deltaY: 2, deltaMode: 1, ctrlKey: true });
      assert.ok(wheel.defaultPrevented);
      assert.deepEqual(wheels, [[32, true]]);

      // Nothing has focus: keys pass through to the page.
      event(window, "keydown", { code: "KeyW" });
      assert.equal(input.axes.thrust, 0);
      assert.equal(published, 0);
      document.activeElement = canvas;
      const down = event(window, "keydown", { code: "KeyW" });
      assert.ok(down.defaultPrevented);
      assert.equal(input.axes.thrust, 1);
      assert.equal(published, 1);
      assert.ok(input.active);
      event(window, "keydown", { code: "KeyW", repeat: true });
      assert.equal(published, 1, "auto-repeat does not republish");
      event(window, "keydown", { code: "KeyW", ctrlKey: true });
      event(window, "keydown", { code: "KeyD", metaKey: true });
      assert.equal(input.axes.strafe, 0, "browser chords are not the ship's");
      shortcut = false;
      event(window, "keydown", { code: "KeyD" });
      assert.equal(input.axes.strafe, 0, "the host's shortcut gate holds");
      shortcut = true;
      event(window, "keydown", { code: "ShiftLeft" });
      assert.equal(input.axes.boost, 1);
      event(window, "keyup", { code: "KeyW" });
      assert.equal(input.axes.thrust, 0);
      assert.equal(input.axes.boost, 1);
      event(window, "blur");
      assert.ok(axesIdle(input.axes));
      assert.ok(!input.active);
      const before = published;
      event(window, "blur");
      assert.equal(published, before, "an idle blur publishes nothing");
      // Focus inside the stage, not on the canvas, still counts.
      document.activeElement = canvas.parentElement;
      event(window, "keydown", { code: "Space" });
      assert.equal(input.axes.park, true);
      input.cancel();
      assert.equal(input.axes.park, false);
      input.dispose();
      assert.equal(canvas.style.touchAction, "auto");
      event(window, "keydown", { code: "KeyW" });
      assert.equal(input.axes.thrust, 0);
    } finally {
      input.dispose();
    }
  });
});

test("a gamepad polls while connected and stops, publishing idle axes, when it goes", async () => {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
  };
  const window = new EventTarget();
  let pads = [];
  globalThis.window = window;
  globalThis.document = { activeElement: null };
  Object.defineProperty(globalThis, "navigator", {
    value: { getGamepads: () => pads },
    configurable: true,
    writable: true,
  });
  const canvas = new FakeCanvas();
  const published = [];
  const looks = [];
  const input = createFlightInput(canvas, {
    onLook: (dx, dy) => looks.push([dx, dy]),
    onAxes: (axes) => published.push({ ...axes }),
    onWheel: () => {},
  });
  const tick = () => new Promise((resolve) => setTimeout(resolve, 300));
  try {
    pads = [{ axes: [0, -1, 1, 0], buttons: [] }];
    event(window, "gamepadconnected");
    await tick();
    assert.ok(input.active);
    assert.equal(published.at(-1)?.thrust, 1);
    assert.ok(looks.length > 0 && looks[0][0] > 0);
    pads = [];
    event(window, "gamepaddisconnected");
    assert.ok(!input.active);
    assert.ok(axesIdle(published.at(-1)));
    const count = published.length;
    await tick();
    assert.equal(published.length, count, "no polling after disconnect");
  } finally {
    input.dispose();
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    Object.defineProperty(globalThis, "navigator", {
      value: previous.navigator,
      configurable: true,
      writable: true,
    });
  }
});
