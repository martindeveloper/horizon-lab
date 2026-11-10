import assert from "node:assert/strict";
import test from "node:test";

import { TAP_SLOP_PX } from "@horizon/toolkit/camera";
import { DisposalScope } from "@horizon/toolkit/rendering";

import { createGiantsInput } from "../src/features/giants/lib/input.ts";
import { RUNG_IDS } from "../src/features/giants/lib/model/rungs.ts";
import { useGiants } from "../src/features/giants/lib/store.ts";
import { event } from "./toolkit-helpers.mjs";

class FakeHost extends EventTarget {
  clientWidth = 800;
  clientHeight = 600;
  captured = new Set();
  /** The stage is no body's name button. */
  closest() {
    return null;
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

/** The stage's input over a scene the test describes: the globe and the body under any point. */
function stageInput(t, { globe = null, body = null } = {}) {
  const original = { window: globalThis.window, Element: globalThis.Element };
  globalThis.window = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
  globalThis.Element ??= FakeHost;
  const resources = new DisposalScope();
  const host = new FakeHost();
  const calls = [];
  const input = createGiantsInput(resources, host, {
    inputAllowed: () => true,
    surveying: () => false,
    stage: () => ({ width: host.clientWidth, height: host.clientHeight }),
    pick: () => body,
    globeAt: () => globe,
    turn: (index) => calls.push(["turn", index]),
    release: (index, moving) => calls.push(["release", index, moving]),
    lastRung: RUNG_IDS.length - 1,
    navigation: {
      paired: () => false,
      take: () => calls.push(["take"]),
      nearest: () => 0,
      stop: () => calls.push(["stop"]),
      nudge: (by) => calls.push(["nudge", by]),
      drag: (by) => calls.push(["drag", by]),
      coast: (by, velocity) => calls.push(["coast", by, velocity]),
      snap: () => calls.push(["snap"]),
    },
  });
  t.after(() => {
    resources.dispose();
    Object.assign(globalThis, original);
  });
  const pointer = (type, pointerId, x = 0, y = 0) =>
    event(host, type, { pointerId, clientX: x, clientY: y, pointerType: "touch", button: 0 });
  return { host, input, calls, pointer };
}

test("a tap that stops the camera lets it settle, and a cancelled touch flies nowhere", (t) => {
  const elsewhere = (useGiants.getState().focus + 1) % RUNG_IDS.length;
  const { host, input, calls, pointer } = stageInput(t, { body: elsewhere });
  const flight = () => useGiants.getState().flight;

  const before = flight();
  pointer("pointerdown", 1);
  pointer("pointercancel", 1);
  assert.deepEqual(calls, [["stop"], ["coast", 0, null]], "the stopped camera settles at rest");
  assert.equal(flight(), before, "a touch the system took is no tap on the body under it");
  assert.equal(input.dragging, false);
  assert.equal(host.hasPointerCapture(1), false);

  calls.length = 0;
  pointer("pointerdown", 2);
  pointer("pointerup", 2);
  assert.deepEqual(calls, [["stop"], ["coast", 0, null]], "a tap lets go of the camera it stopped");
  assert.notEqual(flight(), before, "and flies to the body under it");
});

test("a second finger leaves the first one's globe in its hand until that lets go", (t) => {
  const { input, calls, pointer } = stageInput(t, { globe: 4 });
  const far = TAP_SLOP_PX * 4;
  pointer("pointerdown", 1);
  pointer("pointermove", 1, far, 0);
  pointer("pointerdown", 2, 300, 300);
  pointer("pointerup", 2, 300, 300);
  assert.deepEqual(calls, [["turn", 4]], "the second finger starts and ends nothing");
  assert.equal(input.dragging, true);
  pointer("pointerup", 1, far, 0);
  assert.deepEqual(calls.at(-1), ["release", 4, true], "the flicked globe is let go, coasting");
  assert.equal(input.dragging, false);

  calls.length = 0;
  pointer("pointerdown", 3);
  pointer("pointermove", 3, far, 0);
  input.cancel();
  assert.deepEqual(
    calls,
    [
      ["turn", 4],
      ["release", 4, false],
    ],
    "a cancelled turn is let go at rest",
  );
});
