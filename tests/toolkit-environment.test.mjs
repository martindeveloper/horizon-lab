import assert from "node:assert/strict";
import test from "node:test";

import { REDUCED_MOTION_QUERY, prefersReducedMotion } from "@horizon/toolkit/environment";

test("media preferences read safely without a window", () => {
  assert.equal(globalThis.window, undefined);
  assert.equal(prefersReducedMotion(), false);
  globalThis.window = { matchMedia: (query) => ({ matches: query === REDUCED_MOTION_QUERY }) };
  try {
    assert.equal(prefersReducedMotion(), true);
  } finally {
    delete globalThis.window;
  }
});
