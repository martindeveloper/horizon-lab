import assert from "node:assert/strict";
import test from "node:test";

import {
  fadeFocusBlur,
  focusBlurRadius,
  needsFocusBlur,
} from "../src/features/giants/lib/model/focus-blur.ts";
import { RUNG_IDS } from "../src/features/giants/lib/model/rungs.ts";
import { useGiants } from "../src/features/giants/lib/store.ts";

test("blur bypass preserves offscreen feathering, foreground ordering and changing viewports", () => {
  const disc = (x, y, z, w = z) => ({ x, y, z, w });
  const visible = disc(50, 50, 20);
  assert.equal(needsFocusBlur([visible], [0], 1, 100, 100), false);
  assert.equal(needsFocusBlur([visible], [2], 1, 100, 100), true);
  assert.equal(needsFocusBlur([disc(-100, 50, 20)], [2], 1, 100, 100), false);
  assert.equal(
    needsFocusBlur([disc(-30, 50, 20)], [2], 1, 100, 100),
    true,
    "a body outside the frame can still contribute the filter's feathered edge",
  );
  assert.equal(
    needsFocusBlur([disc(-150, 50, 100, 10)], [2], 1, 100, 100),
    true,
    "flattened discs need a proportionally wider fade on their long axis",
  );
  const covering = disc(50, 50, 100);
  assert.equal(needsFocusBlur([visible, covering], [2, 0], 2, 100, 100), false);
  assert.equal(needsFocusBlur([covering, visible], [0, 2], 2, 100, 100), true);
  assert.equal(
    needsFocusBlur([visible, covering], [2, 0], 2, 200, 200),
    true,
    "resizing can expose a neighbour again",
  );
  assert.equal(needsFocusBlur([visible], [2], 0, 100, 100), false, "stale disc slots are ignored");
});

test("focus blur keeps the nearest body sharp and hands over continuously in either direction", () => {
  for (let place = 0; place <= RUNG_IDS.length - 1; place += 0.01) {
    assert.equal(focusBlurRadius(Math.round(place), place, 300), 0);
    for (const index of [Math.floor(place), Math.ceil(place)]) {
      const blur = focusBlurRadius(index, place, 300);
      assert.ok(blur >= 0 && blur <= 2);
      assert.ok(Math.abs(blur - focusBlurRadius(index, place + 0.001, 300)) < 0.007);
      assert.equal(blur, focusBlurRadius(0, Math.abs(index - place), 300));
    }
  }
  assert.equal(focusBlurRadius(4, 3.5, 300), 0);
  assert.equal(focusBlurRadius(3, 3.5, 300), 0);
  assert.ok(focusBlurRadius(4, 3.2, 300) > focusBlurRadius(4, 3.4, 300));
});

test("blur stays subtle at any zoom and does not swallow small neighbouring bodies", () => {
  for (const radius of [0, 0.5, 2, 8, 30, 300, 4800]) {
    const blur = focusBlurRadius(4, 3, radius);
    assert.ok(blur <= radius * 0.12 && blur <= 2);
    assert.equal(blur, focusBlurRadius(8, 3, radius), "distant rungs do not get ever blurrier");
  }
  assert.equal(focusBlurRadius(4, 3, 300), focusBlurRadius(4, 3, 4800));
});

test("the blur toggle fades at the same speed across frame rates, bypasses fully, and respects reduced motion", () => {
  const advance = (from, enabled, fps, seconds) => {
    for (let i = 0; i < fps * seconds; i++) from = fadeFocusBlur(from, enabled, 1 / fps, false);
    return from;
  };
  assert.ok(Math.abs(advance(0, true, 30, 0.2) - advance(0, true, 120, 0.2)) < 1e-12);
  assert.equal(advance(0, true, 60, 1), 1);
  assert.equal(advance(1, false, 60, 1), 0);
  assert.equal(fadeFocusBlur(0.2, true, 0, true), 1);
  assert.equal(fadeFocusBlur(0.8, false, 0, true), 0);
  assert.equal(fadeFocusBlur(0, false, 0, false), 0);

  const api = useGiants.getState();
  assert.equal(api.focusBlur, false, "size comparisons start sharp");
  api.setFocusBlur(true);
  api.go(4);
  assert.equal(useGiants.getState().focusBlur, true, "navigation preserves the setting");
  api.resetView();
  assert.equal(useGiants.getState().focusBlur, false, "Reset restores the sharp baseline");
});
