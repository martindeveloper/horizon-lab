import assert from "node:assert/strict";
import test from "node:test";

import { Object3D } from "three";

import { addVec3d, distanceVec3d, placeRelative, subVec3d, vec3d } from "@horizon/toolkit/scene";

test("placing relative to the viewer keeps what float32 world positions lose", () => {
  const far = 4.5e9; /* Neptune, km */
  const at = vec3d(far + 1.5, 0, 0);
  const viewer = vec3d(far, 0, 0);
  const object = placeRelative(new Object3D(), at, viewer);
  assert.equal(object.position.x, 1.5);
  /* The same 1.5 km is gone from a float32 world position, whose step there is 512 km. */
  assert.notEqual(Math.fround(far + 1.5) - Math.fround(far), 1.5);
  const out = vec3d();
  assert.deepEqual([...subVec3d(out, at, viewer)], [1.5, 0, 0]);
  assert.deepEqual([...addVec3d(out, viewer, [1, 2, 3], 2)], [far + 2, 4, 6]);
  assert.equal(distanceVec3d(at, viewer), 1.5);
});
