import assert from "node:assert/strict";
import test from "node:test";

import { stubStorage } from "./toolkit-helpers.mjs";

const { saved } = stubStorage();
const { dismissNotice, noticeDismissed, shouldShowNotice } =
  await import("../src/components/shell/desktop-notice-state.ts");

test("desktop notice shows once per session, on phones only", () => {
  saved.clear();
  assert.equal(shouldShowNotice(false), false, "Desktops never see it");
  assert.equal(shouldShowNotice(true), true);
  dismissNotice();
  assert.equal(noticeDismissed(), true);
  assert.equal(shouldShowNotice(true), false, "Dismissed for the rest of the session");
});
