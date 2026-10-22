import assert from "node:assert/strict";
import test from "node:test";

import { IconButton } from "../packages/toolkit/src/ui/icon-button.tsx";

test("ARIA-disabled icon controls keep keyboard access but suppress activation", () => {
  for (const disabled of [true, "true"]) {
    for (const detail of [0, 1]) {
      let calls = 0;
      let prevented = false;
      let stopped = false;
      const button = IconButton({
        "aria-label": "Previous",
        "aria-disabled": disabled,
        onClick: () => calls++,
      });
      const event = {
        detail,
        preventDefault: () => (prevented = true),
        stopPropagation: () => (stopped = true),
      };
      button.props.onClick(event);
      assert.equal(calls, 0);
      assert.equal(prevented, true);
      assert.equal(stopped, true);
      assert.equal(button.props["aria-disabled"], disabled);
      assert.equal(button.props.disabled, undefined);
      assert.notEqual(button.props.tabIndex, -1);
    }
  }
});

test("enabled icon controls forward the original activation event once", () => {
  for (const disabled of [undefined, false, "false"]) {
    const events = [];
    const button = IconButton({
      "aria-label": "Previous",
      "aria-disabled": disabled,
      onClick: (event) => events.push(event),
    });
    const event = {
      preventDefault: () => assert.fail("An enabled click must retain its default action"),
      stopPropagation: () => assert.fail("An enabled click must keep propagating"),
    };
    button.props.onClick(event);
    assert.deepEqual(events, [event]);
    assert.equal(events[0], event);
  }
});
