import assert from "node:assert/strict";
import test from "node:test";

import {
  FrameClock,
  createFrameLoop,
  bufferSize,
  DisposalScope,
  probeWebGL,
  watchContextLoss,
  createEngineHost,
  ContextLostError,
} from "@horizon/toolkit/rendering";

import { close, event } from "./toolkit-helpers.mjs";

test("buffer sizing preserves CSS aspect and caps DPR while warming up", () => {
  assert.deepEqual(bufferSize(1000, 500, { scale: 0.9, dpr: 3, dprCap: 2 }), {
    width: 1800,
    height: 900,
  });
  assert.deepEqual(bufferSize(1000, 500, { scale: 0.9, dpr: 1, dprCap: 2, warmupScale: 0.38 }), {
    width: 342,
    height: 171,
  });
  assert.deepEqual(bufferSize(0, 0, { scale: 1, dpr: 1, dprCap: 2 }), { width: 1, height: 1 });
});

test("frame pacing accumulates elapsed time, caps stalls and resets on resume", () => {
  const clock = new FrameClock();
  assert.equal(clock.advance(0, 30), 0);
  assert.equal(clock.advance(16, 30), null);
  assert.equal(clock.advance(32, 30), null);
  close(clock.advance(48, 30), 0.048);
  close(clock.advance(5000), 0.1);
  clock.reset();
  assert.equal(clock.advance(9000), 0);
});

test("resource disposal is reverse ordered, complete on errors and idempotent", () => {
  const order = [],
    scope = new DisposalScope();
  scope.defer(() => order.push(1));
  scope.defer(() => {
    order.push(2);
    throw new Error("failure");
  });
  scope.defer(() => order.push(3));
  assert.throws(() => scope.dispose(), AggregateError);
  scope.dispose();
  assert.deepEqual(order, [3, 2, 1]);
  scope.defer(() => order.push(4));
  assert.deepEqual(order, [3, 2, 1, 4]);
});

test("frame loop sleeps while hidden or paused and removes scheduled work on disposal", () => {
  const previousWindow = globalThis.window,
    previousDocument = globalThis.document;
  const window = new EventTarget(),
    document = new EventTarget();
  const scheduled = new Map();
  let id = 0,
    count = 0,
    lastDt = -1,
    paused = false;
  window.requestAnimationFrame = (callback) => {
    scheduled.set(++id, callback);
    return id;
  };
  window.cancelAnimationFrame = (key) => scheduled.delete(key);
  document.hidden = false;
  globalThis.window = window;
  globalThis.document = document;
  const loop = createFrameLoop({
    render: (dt) => {
      count++;
      lastDt = dt;
    },
    paused: () => paused,
  });
  const frame = (now) => {
    const [key, callback] = scheduled.entries().next().value;
    scheduled.delete(key);
    callback(now);
  };
  try {
    frame(0);
    assert.equal(count, 1);
    assert.equal(scheduled.size, 1);
    document.hidden = true;
    event(document, "visibilitychange");
    assert.equal(scheduled.size, 0);
    document.hidden = false;
    event(document, "visibilitychange");
    frame(5000);
    assert.equal(count, 2);
    paused = true;
    loop.sync();
    assert.equal(scheduled.size, 0);
    paused = false;
    loop.sync();
    assert.equal(scheduled.size, 1);
    // A sync while running (a drag marks the scene dirty) keeps the clock: dt stays honest.
    frame(5100);
    loop.sync();
    loop.sync();
    assert.equal(scheduled.size, 1);
    frame(5200);
    assert.ok(Math.abs(lastDt - 0.1) < 1e-9, `dt after sync while running: ${lastDt}`);
    loop.dispose();
    assert.equal(scheduled.size, 0);
    event(window, "focus");
    assert.equal(scheduled.size, 0);
  } finally {
    loop.dispose();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("WebGL probe separates hardware, software and missing WebGL 2, releasing every context", () => {
  let released = 0;
  const context = (renderer, unmasked) => ({
    RENDERER: 1,
    getParameter: (key) => (key === 1 ? renderer : unmasked),
    getExtension: (name) =>
      name === "WEBGL_lose_context"
        ? { loseContext: () => released++ }
        : name === "WEBGL_debug_renderer_info" && unmasked
          ? { UNMASKED_RENDERER_WEBGL: 2 }
          : null,
  });
  const probe = (strict, relaxed) =>
    probeWebGL(() => ({
      getContext: (type, options) => {
        assert.equal(type, "webgl2");
        return options?.failIfMajorPerformanceCaveat ? strict : relaxed;
      },
    }));
  assert.equal(probe(context("Apple M2"), null), "ready");
  assert.equal(probe(context("WebKit WebGL", "ANGLE (NVIDIA GeForce RTX 4070)"), null), "ready");
  assert.equal(
    probe(context("WebKit WebGL", "ANGLE (Google, SwiftShader Device)"), null),
    "software",
  );
  assert.equal(probe(context("llvmpipe (LLVM 17.0.6, 256 bits)"), null), "software");
  assert.equal(probe(null, context("Apple M2")), "software", "major performance caveat");
  assert.equal(probe(null, null), "unavailable");
  assert.equal(released, 5);
  const throwing = () => ({
    getContext() {
      throw new Error("blocked");
    },
  });
  assert.equal(probeWebGL(throwing), "unavailable");
});

test("context loss pauses, restores, and reports a loss that outlasts visible time", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const previousDocument = globalThis.document;
  const document = new EventTarget();
  document.hidden = false;
  globalThis.document = document;
  const canvas = new EventTarget();
  const calls = [];
  const watcher = watchContextLoss(canvas, {
    onLost: () => calls.push("lost"),
    onRestored: () => calls.push("restored"),
    onError: (error) => calls.push(error),
    timeout: 1000,
  });
  try {
    const lost = event(canvas, "webglcontextlost");
    assert.ok(lost.defaultPrevented, "loss must be prevented so the browser can restore");
    assert.equal(watcher.lost, true);
    event(canvas, "webglcontextlost");
    t.mock.timers.tick(900);
    event(canvas, "webglcontextrestored");
    assert.equal(watcher.lost, false);
    t.mock.timers.tick(5000);
    assert.deepEqual(calls, ["lost", "restored"]);

    // Hidden time does not count: a backgrounded tab is restored when shown.
    event(canvas, "webglcontextlost");
    document.hidden = true;
    event(document, "visibilitychange");
    t.mock.timers.tick(5000);
    assert.equal(calls.length, 3);
    document.hidden = false;
    event(document, "visibilitychange");
    t.mock.timers.tick(999);
    assert.equal(calls.length, 3);
    t.mock.timers.tick(1);
    assert.ok(calls[3] instanceof ContextLostError);

    watcher.dispose();
    event(canvas, "webglcontextrestored");
    assert.equal(calls.length, 4, "disposal removes the listeners");
  } finally {
    watcher.dispose();
    globalThis.document = previousDocument;
  }
});

test("engine host sizes the buffer, redraws on demand and pauses through context loss", () => {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    ResizeObserver: globalThis.ResizeObserver,
  };
  const window = new EventTarget();
  const document = new EventTarget();
  const scheduled = new Map();
  let id = 0;
  window.requestAnimationFrame = (callback) => {
    scheduled.set(++id, callback);
    return id;
  };
  window.cancelAnimationFrame = (key) => scheduled.delete(key);
  document.hidden = false;
  let observers = 0;
  globalThis.window = window;
  globalThis.document = document;
  globalThis.ResizeObserver = class {
    observe() {
      observers++;
    }
    disconnect() {
      observers--;
    }
  };
  const host = { getBoundingClientRect: () => ({ width: 300.7, height: 200 }) };
  const canvas = new EventTarget();
  const sizes = [];
  const frames = [];
  let restored = 0;
  let idle = false;
  const frame = (now) => {
    const [key, callback] = scheduled.entries().next().value;
    scheduled.delete(key);
    callback(now);
  };
  const engine = createEngineHost({
    canvas,
    host,
    resolution: () => ({ scale: 1, dpr: 2, dprCap: 1.5 }),
    onResize: (w, h) => sizes.push([w, h]),
  });
  try {
    assert.deepEqual(sizes, [[450, 300]]);
    assert.equal(engine.dirty, true);
    engine.invalidate();
    assert.equal(scheduled.size, 0, "nothing runs before start");
    engine.start({
      render: (dt, invalidated) => frames.push([dt, invalidated, engine.dirty]),
      paused: () => idle && !engine.dirty,
      onRestored: () => restored++,
    });
    assert.throws(() => engine.start({ render() {} }), /already started/);
    frame(0);
    assert.deepEqual(frames, [[0, true, false]], "the dirty flag clears before render");
    idle = true;
    engine.sync();
    assert.equal(scheduled.size, 0, "an idle scene sleeps");
    engine.markDirty();
    assert.equal(scheduled.size, 0, "markDirty does not wake the loop");
    engine.invalidate();
    assert.equal(scheduled.size, 1, "invalidate wakes it for one frame");
    frame(16);
    assert.equal(scheduled.size, 0);

    event(canvas, "webglcontextlost");
    assert.equal(engine.lost, true);
    assert.equal(scheduled.size, 0, "a lost context pauses even a dirty scene");
    event(canvas, "webglcontextrestored");
    assert.equal(restored, 1);
    assert.equal(sizes.length, 2, "restore re-measures the buffer");
    assert.equal(scheduled.size, 1, "and redraws");

    engine.dispose();
    assert.equal(scheduled.size, 0);
    assert.equal(observers, 0);
  } finally {
    engine.dispose();
    Object.assign(globalThis, previous);
  }
});
