import assert from "node:assert/strict";
import test from "node:test";

import { stubStorage } from "./toolkit-helpers.mjs";

const { flag, json, numbers, oneOf, storageCell, text } = await import("@horizon/toolkit/storage");

/** A fresh storage area that counts its reads. */
function install(area = "session") {
  let reads = 0;
  const { saved, store } = stubStorage([], { area, onRead: () => (reads += 1) });
  Object.defineProperty(store, "reads", { get: () => reads });
  return { saved, store };
}

const deny = () => {
  throw new DOMException("denied", "SecurityError");
};

test("a session cell stores the codec payload and reads it from memory", () => {
  const { saved, store } = install();
  const cell = storageCell({ key: "horizon:text", codec: text });
  assert.equal(cell.get(), null);
  assert.equal(cell.freshness(), 0);
  cell.set("a\nb");
  assert.equal(saved.get("horizon:text"), "a\nb");
  assert.equal(store.reads, 1, "The miss loaded once");
  const reads = store.reads;
  assert.equal(cell.get(), "a\nb");
  assert.equal(cell.freshness(), 1);
  assert.equal(store.reads, reads, "A hit does not read storage again");
  cell.clear();
  assert.equal(cell.get(), null);
  assert.equal(saved.has("horizon:text"), false);
});

test("flags, string sets and number records skip JSON", () => {
  const { saved } = install();
  const on = storageCell({ key: "horizon:music", codec: flag("on") });
  on.set(true);
  assert.equal(saved.get("horizon:music"), "on");
  assert.equal(on.get(), true);
  on.set(false);
  assert.equal(saved.has("horizon:music"), false);
  assert.equal(on.get(), null);

  const mode = storageCell({
    key: "horizon:debug:webgl",
    codec: oneOf("ready", "software", "unavailable"),
  });
  mode.set("software");
  assert.equal(saved.get("horizon:debug:webgl"), "software");
  assert.equal(mode.get(), "software");

  const clock = storageCell({
    key: "horizon:debug:sky",
    codec: numbers("sky", "wall", "scale"),
  });
  clock.set({ sky: 10, wall: 20, scale: 1.5 });
  assert.equal(saved.get("horizon:debug:sky"), "10,20,1.5");
  assert.deepEqual(clock.get(), { sky: 10, wall: 20, scale: 1.5 });
  assert.throws(() => clock.set({ sky: Number.NaN, wall: 0, scale: 1 }), TypeError);
});

test("a bad payload is dropped, and JSON keeps only values the guard accepts", () => {
  const { saved } = install();
  saved.set("horizon:debug:webgl", "nope");
  const mode = storageCell({
    key: "horizon:debug:webgl",
    codec: oneOf("ready", "software", "unavailable"),
  });
  assert.equal(mode.get(), null);
  assert.equal(saved.has("horizon:debug:webgl"), false);

  const point = json(
    (value) =>
      !!value && typeof value === "object" && Number.isFinite(value.x) && Number.isFinite(value.y),
  );
  const cell = storageCell({ key: "horizon:point", codec: point });
  cell.set({ x: 1, y: -2 });
  assert.equal(saved.get("horizon:point"), '{"x":1,"y":-2}');
  assert.deepEqual(cell.get(), { x: 1, y: -2 });
  saved.set("horizon:point", '{"x":1}');
  const again = storageCell({ key: "horizon:point", codec: point });
  assert.equal(again.get(), null);
});

test("lifetime keeps a value, then decay lowers its strength and removes it", () => {
  const { saved } = install();
  const cell = storageCell({
    key: "horizon:fading",
    codec: text,
    lifetime: 1000,
    decay: 1000,
  });
  cell.set("hello", 5_000);
  assert.equal(saved.get("horizon:fading"), `${(5000).toString(36)}\nhello`);
  assert.equal(cell.get(6_000), "hello");
  assert.equal(cell.freshness(6_000), 1);
  assert.equal(cell.freshness(6_500), 0.5);
  assert.equal(cell.get(6_500), "hello");
  assert.equal(saved.has("horizon:fading"), true, "A fading value stays stored");
  assert.equal(cell.get(7_000), null);
  assert.equal(cell.freshness(7_000), 0);
  assert.equal(saved.has("horizon:fading"), false);

  cell.set("again", 8_000);
  assert.equal(cell.freshness(8_000), 1, "A new write restarts the clock");
  assert.equal(cell.get(10_000), null);
});

test("without a decay the value ends at the lifetime, and a bare decay fades from the write", () => {
  const { saved } = install();
  const step = storageCell({ key: "horizon:step", codec: text, lifetime: 100 });
  step.set("a", 0);
  assert.equal(step.get(100), "a");
  assert.equal(step.get(101), null);
  assert.equal(saved.has("horizon:step"), false);

  const fade = storageCell({ key: "horizon:fade", codec: text, decay: 100 });
  fade.set("b", 0);
  assert.equal(fade.freshness(0), 1);
  assert.equal(fade.freshness(50), 0.5);
  assert.equal(fade.get(100), null);
});

test("a lifetime rejects an unstamped payload, and each area has its own store", () => {
  const session = install("session");
  const local = install("local");
  session.saved.set("horizon:aged", "plain");
  const aged = storageCell({ key: "horizon:aged", codec: text, lifetime: 50 });
  assert.equal(aged.get(0), null);
  assert.equal(session.saved.has("horizon:aged"), false);

  const tab = storageCell({ key: "horizon:shared", codec: text });
  const origin = storageCell({ key: "horizon:shared", area: "local", codec: text });
  tab.set("tab");
  origin.set("origin");
  assert.equal(session.saved.get("horizon:shared"), "tab");
  assert.equal(local.saved.get("horizon:shared"), "origin");
  assert.equal(tab.get(), "tab");
  assert.equal(origin.get(), "origin");
});

test("blocked or missing storage never throws and still serves this page", () => {
  globalThis.sessionStorage = { getItem: deny, setItem: deny, removeItem: deny };
  const blocked = storageCell({ key: "horizon:blocked", codec: text });
  assert.equal(blocked.get(), null);
  assert.doesNotThrow(() => blocked.set("kept"));
  assert.equal(blocked.get(), "kept");
  assert.doesNotThrow(() => blocked.clear());
  assert.equal(blocked.get(), null);

  globalThis.sessionStorage = undefined;
  const missing = storageCell({ key: "horizon:missing", codec: flag() });
  assert.equal(missing.get(), null);
  assert.doesNotThrow(() => missing.set(true));
  assert.equal(missing.get(), true);
});

test("a local cell sees another tab's write and a cleared origin", () => {
  const { saved, store } = install("local");
  const listeners = new Set();
  globalThis.window = {
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  };
  try {
    const cell = storageCell({ key: "horizon:local", area: "local", codec: text });
    cell.set("dark");
    saved.set("horizon:local", "light");
    assert.equal(cell.get(), "dark", "This tab keeps its copy until told otherwise");
    for (const fn of listeners) fn({ key: "horizon:local", storageArea: store });
    assert.equal(cell.get(), "light");

    saved.delete("horizon:local");
    for (const fn of listeners) fn({ key: null, storageArea: store });
    assert.equal(cell.get(), null);
  } finally {
    delete globalThis.window;
  }
});

test("a cell rejects an empty key or a negative span", () => {
  assert.throws(() => storageCell({ key: "", codec: text }), TypeError);
  assert.throws(() => storageCell({ key: "k", codec: text, lifetime: -1 }), TypeError);
  assert.throws(() => storageCell({ key: "k", codec: text, decay: -1 }), TypeError);
  assert.throws(() => oneOf(), TypeError);
  assert.throws(() => flag(""), TypeError);
});
