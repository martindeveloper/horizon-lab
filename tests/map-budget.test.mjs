import assert from "node:assert/strict";
import test from "node:test";

/**
 * The space scenes' map streaming for a camera that flies up to the bodies: which tier a
 * globe's size asks for, and the budget's policy (far first, one close-up map per tier,
 * paced uploads, idle release, failures), with the loader stubbed.
 */
import { MAPS } from "@horizon/toolkit/bodies";
import { DisposalScope } from "@horizon/toolkit/rendering";

import { bytesOf, tierFor, widthFor } from "../src/space/solar-system/graphics/map-tiers.ts";
import { createMapBudget } from "../src/space/solar-system/scene/map-budget.ts";

const EARTH = MAPS.earth.widths;

test("a globe asks for the smallest tier that keeps a texel per device pixel", () => {
  assert.ok(Math.abs(widthFor(1024 / (2 * Math.PI)) - 1024) < 1e-9);
  assert.equal(tierFor(100, EARTH, "near"), "far");
  assert.equal(tierFor(200, EARTH, "near"), "nearLight");
  assert.equal(tierFor(400, EARTH, "near"), "near");
  assert.equal(tierFor(2000, EARTH, "near"), "near");
  /* Never past what the quality allows. */
  assert.equal(tierFor(400, EARTH, "nearLight"), "nearLight");
  assert.equal(tierFor(400, EARTH, "far"), "far");
  /* Tiers of one width are one file: the Moon's are all 1024. */
  assert.equal(tierFor(400, MAPS.moon.widths, "near"), "far");
  assert.ok(bytesOf(4096) > 16 * bytesOf(1024) * 0.99);
});

/** A budget over a stubbed loader; `settle` resolves the pending load and lets it land. */
function harness({ budget = 1e9, allow = "near", cruising = true } = {}) {
  const scope = new DisposalScope();
  const loads = [];
  const shown = [];
  const released = [];
  const failed = [];
  const uploaded = [];
  const map = createMapBudget(scope, {
    base: "/maps",
    quality: () => ({ budget, anisotropy: 4, allow }),
    onShow: (id, texture, tier) => shown.push([id, tier, texture]),
    onRelease: (id) => released.push(id),
    onFail: (id) => failed.push(id),
    upload: (texture) => uploaded.push(texture),
    wake: () => {},
    load: (file, _signal, anisotropy) =>
      new Promise((resolve, reject) => loads.push({ file, anisotropy, resolve, reject })),
  });
  map.start(true);
  const texture = (file) => ({ file, anisotropy: 4, needsUpdate: false, dispose() {} });
  const settle = async (ok = true) => {
    const load = loads.shift();
    if (ok) load.resolve(texture(load.file));
    else load.reject(new Error("HTTP 404"));
    await new Promise((resolve) => setImmediate(resolve));
  };
  const frame = (need, options = { cruising }) => map.update(1 / 60, new Map(need), options);
  return { map, loads, shown, released, failed, uploaded, settle, frame, scope };
}

test("far maps load first, then the tier the globe's size asks for", async () => {
  const h = harness();
  h.frame([["earth", 400]]);
  assert.equal(h.loads.length, 1);
  assert.match(h.loads[0].file, /earth-far/);
  await h.settle();
  h.frame([["earth", 400]]);
  assert.deepEqual(h.shown.at(-1).slice(0, 2), ["earth", "far"]);
  assert.equal(h.uploaded.length, 1);
  assert.match(h.loads[0].file, /earth-near\.webp/);
  await h.settle();
  h.frame([["earth", 400]]);
  assert.deepEqual(h.shown.at(-1).slice(0, 2), ["earth", "near"]);
  assert.equal(h.map.tierOf("earth"), "near");
  /* Still enough: nothing more asked for. */
  h.frame([["earth", 400]]);
  assert.equal(h.loads.length, 0);
});

test("bodies with no map yet come before another body's close-up tier", async () => {
  const h = harness();
  h.frame([["earth", 400]]);
  await h.settle();
  h.frame([
    ["earth", 400],
    ["mars", 5],
  ]);
  assert.match(h.loads[0].file, /mars-far/);
});

test("one close-up map per tier stays: the newest replaces the last, which keeps its far map", async () => {
  const h = harness();
  for (const id of ["earth", "mars"]) {
    h.frame([[id, 400]]);
    await h.settle();
    h.frame([[id, 400]]);
    await h.settle();
    h.frame([[id, 400]]);
    assert.equal(h.map.tierOf(id), "near");
  }
  assert.equal(h.map.tierOf("earth"), "far");
  assert.deepEqual(
    h.shown.filter(([id]) => id === "earth").map(([, tier]) => tier),
    ["far", "near", "far"],
  );
  assert.equal(h.released.length, 0);
});

test("uploads are paced half a second apart unless the scene is cruising", async () => {
  const h = harness({ cruising: false });
  h.frame([["earth", 400]]);
  await h.settle();
  assert.equal(h.frame([["earth", 400]]), false);
  assert.equal(h.uploaded.length, 1);
  await h.settle();
  /* The near map is decoded but waits for its slot. */
  assert.equal(h.frame([["earth", 400]]), true);
  assert.equal(h.uploaded.length, 1);
  for (let i = 0; i < 40; i += 1) h.frame([["earth", 400]]);
  assert.equal(h.uploaded.length, 2);
  assert.equal(h.map.tierOf("earth"), "near");
});

test("a close-up tier of a body that shrank away is released; the far map stays", async () => {
  const h = harness();
  h.frame([["earth", 400]]);
  await h.settle();
  h.frame([["earth", 400]]);
  await h.settle();
  h.frame([["earth", 400]]);
  assert.equal(h.map.tierOf("earth"), "near");
  for (let i = 0; i < 60 * 11; i += 1) h.frame([["earth", 4]]);
  assert.equal(h.map.tierOf("earth"), "far");
  assert.deepEqual(h.shown.at(-1).slice(0, 2), ["earth", "far"]);
});

test("over the far budget, the longest-idle far map goes; what is kept never does", async () => {
  const h = harness({ budget: bytesOf(1024) * 1.5 });
  h.frame([["earth", 5]]);
  await h.settle();
  h.frame([["earth", 5]]);
  h.frame([["mars", 5]]);
  await h.settle();
  h.frame([["mars", 5]]);
  assert.equal(h.map.tierOf("earth"), "far");
  for (let i = 0; i < 60 * 21; i += 1) h.frame([["mars", 5]], { keep: "earth" });
  assert.equal(h.map.tierOf("earth"), "far");
  for (let i = 0; i < 60 * 21; i += 1) h.frame([["mars", 5]]);
  assert.equal(h.map.tierOf("earth"), null);
  assert.deepEqual(h.released, ["earth"]);
});

test("a failed far map paints the body; a failed close-up tier leaves the far map", async () => {
  const h = harness();
  h.frame([["earth", 5]]);
  await h.settle(false);
  assert.deepEqual(h.failed, ["earth"]);
  h.frame([["mars", 400]]);
  await h.settle();
  h.frame([["mars", 400]]);
  await h.settle(false);
  h.frame([["mars", 400]]);
  assert.deepEqual(h.failed, ["earth"]);
  assert.equal(h.map.tierOf("mars"), "far");
  /* Not retried. */
  assert.equal(h.loads.length, 0);
});

test("disposal aborts and frees everything", async () => {
  const h = harness();
  h.frame([["earth", 5]]);
  await h.settle();
  h.frame([["earth", 5]]);
  h.scope.dispose();
  assert.equal(h.map.tierOf("earth"), null);
});
