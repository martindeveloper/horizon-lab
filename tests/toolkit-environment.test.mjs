import assert from "node:assert/strict";
import test from "node:test";

import {
  REDUCED_MOTION_QUERY,
  WIDE_GAMUT_QUERY,
  prefersReducedMotion,
  showsWideGamut,
} from "@horizon/toolkit/environment";

test("media preferences read safely without a window", () => {
  assert.equal(globalThis.window, undefined);
  assert.equal(prefersReducedMotion(), false);
  assert.equal(showsWideGamut(), false);
  globalThis.window = { matchMedia: (query) => ({ matches: query === REDUCED_MOTION_QUERY }) };
  try {
    assert.equal(prefersReducedMotion(), true);
    assert.equal(showsWideGamut(), false);
    globalThis.window.matchMedia = (query) => ({ matches: query === WIDE_GAMUT_QUERY });
    assert.equal(showsWideGamut(), true);
  } finally {
    delete globalThis.window;
  }
});
