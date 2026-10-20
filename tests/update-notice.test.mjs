import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { event } from "./toolkit-helpers.mjs";

const { CHECK_EVERY, isNewVersion, watchVersion } =
  await import("../src/components/shell/update-notice-state.ts");

const flush = () => new Promise((resolve) => setImmediate(resolve));

function fakePage(hidden = false) {
  const page = new EventTarget();
  page.hidden = hidden;
  page.show = (value) => {
    page.hidden = !value;
    event(page, "visibilitychange");
  };
  return page;
}

test("a new version needs both IDs, and different ones", () => {
  assert.equal(isNewVersion("a", "b"), true);
  assert.equal(isNewVersion("a", "a"), false);
  assert.equal(isNewVersion("", "b"), false, "No build ID: never new");
  for (const seen of ["", undefined, null, 7, {}])
    assert.equal(isNewVersion("a", seen), false, `Unreadable ${JSON.stringify(seen)}`);
});

test("without a build ID the watcher never fetches", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const page = fakePage();
  let loads = 0;
  watchVersion("", () => assert.fail("never new"), { page, load: async () => loads++ });
  page.show(false);
  page.show(true);
  t.mock.timers.tick(CHECK_EVERY * 3);
  await flush();
  assert.equal(loads, 0);
});

test("checks on return and while visible, never hidden, and stops once newer", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const page = fakePage(true);
  const seen = [];
  let live = "a";
  const load = mock.fn(async () => {
    if (live === "down") throw new Error("offline");
    return live;
  });
  const stop = watchVersion("a", () => seen.push(live), { page, load });

  t.mock.timers.tick(CHECK_EVERY * 2);
  assert.equal(load.mock.callCount(), 0, "Hidden tab: no checks");

  page.show(true);
  await flush();
  assert.equal(load.mock.callCount(), 1, "Checked on becoming visible");

  live = "down";
  t.mock.timers.tick(CHECK_EVERY);
  await flush();
  assert.equal(load.mock.callCount(), 2, "Checked every interval");
  assert.deepEqual(seen, [], "Network errors are ignored");

  page.show(false);
  t.mock.timers.tick(CHECK_EVERY * 2);
  assert.equal(load.mock.callCount(), 2, "Hiding stops the timer");

  live = "b";
  page.show(true);
  await flush();
  assert.deepEqual(seen, ["b"]);

  page.show(false);
  page.show(true);
  t.mock.timers.tick(CHECK_EVERY * 2);
  await flush();
  assert.equal(load.mock.callCount(), 3, "No more checks after a newer version");
  stop();
});
