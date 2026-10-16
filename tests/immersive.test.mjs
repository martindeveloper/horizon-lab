import assert from "node:assert/strict";
import test from "node:test";

import {
  enterFullscreen,
  exitFullscreen,
  fullscreenAvailable,
  immersiveKeyAction,
  isImmersive,
  markFocusReturn,
  setImmersive,
  subscribeImmersive,
  takeFocusReturn,
} from "../packages/toolkit/src/ui/immersive-state.ts";

const key = (overrides) => ({
  key: "f",
  repeat: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  defaultPrevented: false,
  target: null,
  ...overrides,
});

test("immersive state notifies once per change and focus return is taken once", () => {
  let calls = 0;
  const stop = subscribeImmersive(() => calls++);
  setImmersive(true);
  setImmersive(true);
  assert.equal(isImmersive(), true);
  setImmersive(false);
  assert.equal(calls, 2);
  stop();
  setImmersive(true);
  setImmersive(false);
  assert.equal(calls, 2);

  markFocusReturn();
  assert.equal(takeFocusReturn(), true);
  assert.equal(takeFocusReturn(), false);
});

test("F toggles immersive view and Escape only leaves it", () => {
  assert.equal(immersiveKeyAction(key(), false), "toggle");
  assert.equal(immersiveKeyAction(key({ key: "F" }), true), "toggle");
  assert.equal(immersiveKeyAction(key({ key: "Escape" }), true), "exit");
  assert.equal(immersiveKeyAction(key({ key: "Escape" }), false), null);
  for (const chord of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }])
    assert.equal(immersiveKeyAction(key(chord), false), null);
  assert.equal(immersiveKeyAction(key({ repeat: true }), false), null);
  assert.equal(immersiveKeyAction(key({ defaultPrevented: true }), true), null);
  const field = { closest: (selector) => (selector.includes("input") ? {} : null) };
  assert.equal(immersiveKeyAction(key({ target: field }), false), null);
  assert.equal(immersiveKeyAction(key({ key: " " }), false), null);
});

test("fullscreen is offered only when the document allows it and failures stay quiet", async () => {
  assert.equal(fullscreenAvailable(undefined), false);
  assert.equal(fullscreenAvailable({}), false);
  assert.equal(fullscreenAvailable({ fullscreenEnabled: false }), false);
  assert.equal(fullscreenAvailable({ fullscreenEnabled: true }), true);

  const doc = { fullscreenElement: null, exits: 0 };
  doc.exitFullscreen = async () => {
    doc.exits++;
    throw new Error("not active");
  };
  const stage = { ownerDocument: doc, requestFullscreen: async () => {} };
  assert.equal(await enterFullscreen(stage), true);
  assert.equal(
    await enterFullscreen({ requestFullscreen: () => Promise.reject(new TypeError("denied")) }),
    false,
  );

  await exitFullscreen(stage);
  assert.equal(doc.exits, 0, "another element's fullscreen is left alone");
  doc.fullscreenElement = stage;
  await exitFullscreen(stage);
  assert.equal(doc.exits, 1);
});
