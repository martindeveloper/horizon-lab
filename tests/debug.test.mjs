import assert from "node:assert/strict";
import test from "node:test";

import { stubStorage } from "./toolkit-helpers.mjs";

// The overrides only apply with the developer tools on; a test run counts as production.
process.env.NEXT_PUBLIC_DEBUG = "on";
const { saved } = stubStorage([["horizon:debug:webgl", "unavailable"]]);
const {
  webglOverride,
  setWebGLOverride,
  subscribeDebug,
  triggerCrash,
  onCrash,
  showDesktopNotice,
  onDesktopNotice,
  skyNow,
  skyTimeScale,
  skyRunsFast,
  setSkyTime,
  setSkyTimeScale,
} = await import("../src/lib/debug.ts");

test("debug WebGL override survives a reload and notifies the gate", () => {
  assert.equal(webglOverride(), "unavailable");
  let calls = 0;
  const stop = subscribeDebug(() => calls++);
  setWebGLOverride("software");
  assert.equal(webglOverride(), "software");
  assert.equal(saved.get("horizon:debug:webgl"), "software");
  setWebGLOverride(null);
  assert.equal(webglOverride(), null);
  assert.equal(saved.has("horizon:debug:webgl"), false);
  stop();
  setWebGLOverride("ready");
  assert.equal(calls, 2, "Unsubscribed listeners stay quiet");
  setWebGLOverride(null);
});

test("debug crashes reach only mounted triggers of their scope", () => {
  assert.equal(triggerCrash("route"), false);
  const hits = [];
  const stopRoute = onCrash("route", () => hits.push("route"));
  const stopRoot = onCrash("root", () => hits.push("root"));
  assert.equal(triggerCrash("route"), true);
  assert.deepEqual(hits, ["route"]);
  stopRoute();
  stopRoot();
  assert.equal(triggerCrash("root"), false);
});

test("debug desktop notice preview reaches the mounted notice only", () => {
  assert.equal(showDesktopNotice(), false);
  let shown = 0;
  const stop = onDesktopNotice(() => shown++);
  assert.equal(showDesktopNotice(), true);
  assert.equal(shown, 1);
  stop();
  assert.equal(showDesktopNotice(), false);
});

test("debug sky clock sets a moment, runs it faster and returns to real time", () => {
  const near = (a, b, tolerance, message) => assert.ok(Math.abs(a - b) <= tolerance, message);
  near(skyNow(), Date.now(), 5, "Real time without an override");
  let calls = 0;
  const stop = subscribeDebug(() => calls++);
  const solstice = new Date("2026-12-21T16:00:00").getTime();
  setSkyTime(solstice);
  near(skyNow(), solstice, 50, "The sky shows the chosen moment");
  assert.equal(skyRunsFast(), false);
  setSkyTimeScale(600);
  assert.equal(skyTimeScale(), 600);
  assert.ok(skyRunsFast());
  const wall = Date.now();
  near(skyNow(wall + 1000), skyNow(wall) + 600_000, 1, "One wall second is ten sky minutes");
  assert.ok(saved.has("horizon:debug:sky"), "The clock survives a reload");
  setSkyTimeScale(0);
  near(skyNow(Date.now() + 5000), skyNow(), 1, "Scale 0 freezes the sky");
  setSkyTime(null);
  setSkyTimeScale(1);
  near(skyNow(), Date.now(), 5, "Back to real time");
  assert.equal(saved.has("horizon:debug:sky"), false);
  stop();
  assert.equal(calls, 5);
});
