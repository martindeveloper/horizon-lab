import assert from "node:assert/strict";

export const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

export function event(target, type, values = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, values);
  target.dispatchEvent(e);
  return e;
}
