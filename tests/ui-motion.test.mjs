import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { afterMotion, uiMotion } from "../packages/toolkit/src/ui/motion.ts";
import { cn } from "../packages/toolkit/src/ui/utils.ts";
import { VisualizationOverlay } from "../packages/toolkit/src/ui/visualization-shell.tsx";

function animation(endTime) {
  const pending = Promise.withResolvers();
  return {
    ...pending,
    finished: pending.promise,
    effect: { getComputedTiming: () => ({ endTime }) },
  };
}

test("exit waits for every finite transition, without waiting for ambient loops", async () => {
  const opacity = animation(300);
  const visibility = animation(500);
  const ambient = animation(Infinity);
  const element = { getAnimations: () => [opacity, visibility, ambient] };
  let removed = 0;
  const stop = afterMotion(element, () => removed++);
  opacity.resolve();
  await setImmediate();
  assert.equal(removed, 0, "a faster property cannot remove a still-moving surface");
  visibility.resolve();
  await setImmediate();
  assert.equal(removed, 1, "an ambient loop cannot keep a hidden surface mounted");
  stop();
});

test("reopening cancels an old exit's removal, including when it finishes later", async () => {
  const oldExit = animation(500);
  const nextExit = animation(500);
  let removed = 0;
  const stop = afterMotion({ getAnimations: () => [oldExit] }, () => removed++);
  stop();
  afterMotion({ getAnimations: () => [nextExit] }, () => removed++);
  oldExit.resolve();
  await setImmediate();
  assert.equal(removed, 0);
  nextExit.resolve();
  await setImmediate();
  assert.equal(removed, 1);
});

test("absent and cancelled motion both complete without a fixed-duration wait", async () => {
  let removed = 0;
  afterMotion({ getAnimations: () => [] }, () => removed++);
  assert.equal(removed, 0, "no synchronous state update during effect setup");
  await setImmediate();
  assert.equal(removed, 1);
  const exit = animation(500);
  afterMotion({ getAnimations: () => [exit] }, () => removed++);
  exit.reject(new Error("Animation cancelled as reduced motion was enabled"));
  await setImmediate();
  assert.equal(removed, 2);
});

test("an explicit loading hold and the fade must both finish", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fade = animation(500);
  let removed = 0;
  afterMotion({ getAnimations: () => [fade] }, () => removed++, 200);
  t.mock.timers.tick(200);
  await setImmediate();
  assert.equal(removed, 0, "a short hold cannot cut the fade short");
  fade.resolve();
  await setImmediate();
  assert.equal(removed, 1);

  const stop = afterMotion({ getAnimations: () => [] }, () => removed++, 200);
  t.mock.timers.tick(199);
  await setImmediate();
  assert.equal(removed, 1, "even an immediate fade honors an explicit hold");
  stop();
  t.mock.timers.tick(1);
  await setImmediate();
  assert.equal(removed, 1, "reopening cancels the hold too");
});

test("Web Animations read local CSS tokens and the current motion preference", (t) => {
  let reduced = false;
  const originalStyle = Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => {
    if (originalStyle) Object.defineProperty(globalThis, "getComputedStyle", originalStyle);
    else delete globalThis.getComputedStyle;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  });
  globalThis.window = { matchMedia: () => ({ matches: reduced }) };
  globalThis.getComputedStyle = (element) => ({ getPropertyValue: (key) => element[key] ?? "" });
  const element = {
    "--transition-duration-control": " 275ms ",
    "--transition-duration-reveal": ".45s",
    "--ease-standard": "ease",
    "--ease-exit": "cubic-bezier(0.4, 0, 0.2, 1)",
  };
  assert.deepEqual(uiMotion(element, "control"), { duration: 275, easing: "ease" });
  assert.deepEqual(uiMotion(element, "reveal", "exit"), {
    duration: 450,
    easing: element["--ease-exit"],
  });
  reduced = true;
  assert.equal(uiMotion(element, "reveal").duration, 0);
  reduced = false;
  assert.deepEqual(uiMotion({}, "control"), { duration: 0, easing: "linear" });
});

test("unready visualization controls are inert even if a caller supplies inert=false", () => {
  const render = (props) => renderToStaticMarkup(createElement(VisualizationOverlay, props));
  assert.match(render({ ready: false, inert: false }), /\binert=""/);
  assert.doesNotMatch(render({ ready: true }), /\binert=/);
  assert.doesNotMatch(render({}), /\binert=/);
  assert.match(render({ ready: true, inert: true }), /\binert=""/);
});

test("motion presets can be overridden through component classes without conflicting timings", () => {
  assert.equal(
    cn("duration-reveal ease-enter", "duration-control ease-exit"),
    "duration-control ease-exit",
  );
  assert.equal(cn("duration-feedback", "duration-700"), "duration-700");
  assert.equal(cn("duration-700", "duration-scene"), "duration-scene");
  assert.equal(cn("anim-rise", "anim-fade"), "anim-fade");
  assert.equal(cn("anim-sheet", "md:anim-rail"), "anim-sheet md:anim-rail");
  assert.equal(cn("md:duration-scene", "md:duration-control"), "md:duration-control");
});
