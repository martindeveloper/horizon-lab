import assert from "node:assert/strict";
import test from "node:test";

import { Vector3 } from "three";

/** Where a moving ship sees a body: ahead it is dead ahead and smaller, abeam it swings forward. */
import { placeSeen } from "../src/features/voyage/lib/scene/seen.ts";

const object = () => ({ position: new Vector3() });
const rest = { beta: 0, gamma: 1, forward: [0, 0, -1] };
const fast = { beta: 0.6, gamma: 1.25, forward: [0, 0, -1] };

test("at rest a body sits at its offset; the Doppler factor is one", () => {
  const o = object();
  assert.equal(placeSeen(o, [3, 4, 0], [1, 1, 0], rest), 1);
  assert.deepEqual(o.position.toArray(), [2, 3, 0]);
});

test("a body dead ahead stays ahead, D = γ(1 + β) farther and so 1/D as wide", () => {
  const o = object();
  const D = placeSeen(o, [0, 0, -100], [0, 0, 0], fast);
  assert.ok(Math.abs(D - 1.25 * 1.6) < 1e-12);
  assert.ok(Math.abs(o.position.x) < 1e-12 && Math.abs(o.position.y) < 1e-12);
  assert.ok(Math.abs(o.position.z + 100 * D) < 1e-9);
});

test("a body abeam swings toward the direction of travel; one astern recedes and grows", () => {
  const abeam = object();
  const D = placeSeen(abeam, [100, 0, 0], [0, 0, 0], fast);
  /* cos θ′ = (cos θ + β)/(1 + β cos θ) = β at 90°: the body is seen at 53° off the bow. */
  const seenCos = -abeam.position.z / abeam.position.length();
  assert.ok(Math.abs(seenCos - 0.6) < 1e-12, `${seenCos}`);
  assert.ok(Math.abs(D - 1.25) < 1e-12);
  const astern = object();
  const behind = placeSeen(astern, [0, 0, 100], [0, 0, 0], fast);
  assert.ok(Math.abs(behind - 1.25 * 0.4) < 1e-12);
  assert.ok(astern.position.length() < 100);
});
