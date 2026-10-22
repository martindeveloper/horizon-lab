import assert from "node:assert/strict";
import test from "node:test";

import { cn } from "../packages/toolkit/src/ui/utils.ts";

test("type-role overrides change size without dropping the text color", () => {
  assert.equal(cn("text-ui text-fg-primary", "text-caption"), "text-fg-primary text-caption");
  assert.equal(cn("text-body text-fg-secondary", "text-sm"), "text-fg-secondary text-sm");
  assert.equal(cn("text-[13px] text-accent", "text-detail"), "text-accent text-detail");
  assert.equal(cn("text-body/5", "text-ui"), "text-ui");
  assert.equal(cn("leading-tight", "text-body/5"), "text-body/5");
  assert.equal(cn("text-section md:text-feature", "md:text-panel"), "text-section md:text-panel");
});

test("panel inset overrides respect axis and responsive boundaries", () => {
  assert.equal(cn("px-panel py-panel-row", "px-3"), "py-panel-row px-3");
  assert.equal(cn("p-4", "p-panel-compact"), "p-panel-compact");
  assert.equal(
    cn("px-panel-compact md:px-panel", "md:px-panel-wide"),
    "px-panel-compact md:px-panel-wide",
  );
  assert.equal(cn("gap-section", "gap-3"), "gap-3");
  assert.equal(cn("space-y-4", "space-y-section-roomy"), "space-y-section-roomy");
});

test("kicker tracking can be overridden without changing its family or casing", () => {
  assert.equal(
    cn("font-mono tracking-label uppercase", "tracking-instrument"),
    "font-mono uppercase tracking-instrument",
  );
  assert.equal(cn("tracking-instrument", "tracking-[0.18em]"), "tracking-[0.18em]");
});
