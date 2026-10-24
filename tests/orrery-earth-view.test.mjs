import assert from "node:assert/strict";
import test from "node:test";

import {
  TRAIL_IDS,
  TRAIL_SAMPLES,
  createTrailRing,
  earthCentred,
  trailPoint,
  trailReach,
  trailSpan,
  trailStep,
} from "../src/features/orrery/lib/model/earth-view.ts";
import { positionOf } from "../src/space/solar-system/model/position.ts";

const NOW = new Date("2026-10-23T00:00:00Z");
const MIG = 1;

/** Ecliptic longitude of a scene point (X toward the equinox, Z = −y). */
const longitude = ([x, , z]) => Math.atan2(-z, x);

/** How often a body's motion across Earth's sky turns back over the trail's span. */
function reversals(id) {
  let count = 0;
  let last = null;
  let prev = longitude(trailPoint(id, MIG, -trailSpan(id), NOW, [0, 0, 0]));
  for (let k = 1; k <= TRAIL_SAMPLES; k += 1) {
    const lon = longitude(trailPoint(id, MIG, -trailSpan(id) + k * trailStep(id), NOW, [0, 0, 0]));
    let d = lon - prev;
    if (d > Math.PI) {
      d -= 2 * Math.PI;
    }
    if (d < -Math.PI) {
      d += 2 * Math.PI;
    }
    const dir = Math.sign(d);
    if (last !== null && dir !== 0 && dir !== last) {
      count += 1;
    }
    if (dir !== 0) {
      last = dir;
    }
    prev = lon;
  }
  return count;
}

test("a trail point is the scene's own position less Earth's", () => {
  const earth = positionOf({ kind: "planet", id: "earth" }, { mig: MIG, driftYears: 2.5 }, NOW);
  const mars = positionOf({ kind: "planet", id: "mars" }, { mig: MIG, driftYears: 2.5 }, NOW);
  const seen = trailPoint("mars", MIG, 2.5, NOW, [0, 0, 0]);
  for (let i = 0; i < 3; i += 1) {
    assert.ok(Math.abs(seen[i] - (mars[i] - earth[i])) < 1e-9);
  }
  const sun = trailPoint("sun", MIG, 2.5, NOW, [0, 0, 0]);
  for (let i = 0; i < 3; i += 1) {
    assert.ok(Math.abs(sun[i] + earth[i]) < 1e-9);
  }
});

test("seen from Earth the Sun keeps about one au away and the planets loop back", () => {
  for (let k = 0; k <= TRAIL_SAMPLES; k += 1) {
    const [x, y, z] = trailPoint("sun", MIG, -k * trailStep("sun"), NOW, [0, 0, 0]);
    const r = Math.hypot(x, y, z);
    assert.ok(r > 0.98 && r < 1.02, `Sun at ${r.toFixed(3)} au`);
  }
  /* Two reversals bound each retrograde loop: Mars loops at every opposition, Venus at
     every inferior conjunction (five in eight years), the outer planets once a year. */
  assert.ok(reversals("mars") >= 6, `Mars reverses ${reversals("mars")} times`);
  assert.ok(reversals("venus") >= 10, `Venus reverses ${reversals("venus")} times`);
  assert.ok(reversals("jupiter") >= 14, `Jupiter reverses ${reversals("jupiter")} times`);
  /* Mercury's year: three loops. */
  assert.ok(reversals("mercury") >= 6, `Mercury reverses ${reversals("mercury")} times`);
  assert.equal(reversals("sun"), 0);
});

test("trails reach from a body's nearest to its farthest from Earth", () => {
  assert.deepEqual(trailReach("sun", MIG, NOW), { near: 0, far: 2 });
  const mars = trailReach("mars", MIG, NOW);
  assert.ok(mars.near > 0.5 && mars.near < 0.55);
  assert.ok(mars.far > 2.5 && mars.far < 2.55);
  assert.ok(!TRAIL_IDS.includes("earth"));
});

test("Earth is the centre only in the present, outside the guide and the drift", () => {
  const on = { show: { fromEarth: true }, drift: "off", guideOpen: false, yearsAgo: 0 };
  assert.equal(earthCentred(on), true);
  assert.equal(earthCentred({ ...on, show: { fromEarth: false } }), false);
  assert.equal(earthCentred({ ...on, drift: "playing" }), false);
  assert.equal(earthCentred({ ...on, guideOpen: true }), false);
  assert.equal(earthCentred({ ...on, yearsAgo: 1e9 }), false);
});

/** A sampler whose points name their clock, so a read-out shows which steps it holds, in order. */
const stamp = (clock, out) => {
  out[0] = clock;
  out[1] = -clock;
  out[2] = 2 * clock;
  return out;
};
const STEP = 0.25;
const SAMPLES = 8;
const readOut = (ring) => {
  const positions = new Float32Array(SAMPLES * 3);
  ring.read(positions);
  return Array.from({ length: SAMPLES }, (_, k) => positions[k * 3]);
};
const fresh = (clock) => {
  const ring = createTrailRing(STEP, SAMPLES);
  ring.advance(clock, stamp);
  return readOut(ring);
};

test("a trail ring advanced step by step reads as one built at the clock", () => {
  assert.deepEqual(fresh(2), [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
  const ring = createTrailRing(STEP, SAMPLES);
  ring.advance(0, stamp);
  for (let clock = 0.1; clock <= 3.3; clock += 0.1) {
    ring.advance(clock, stamp);
    assert.deepEqual(readOut(ring), fresh(clock), `at ${clock.toFixed(1)}`);
  }
  /* A jump back, and a jump past the whole span, start over at the clock. */
  ring.advance(1, stamp);
  assert.deepEqual(readOut(ring), fresh(1));
  ring.advance(40, stamp);
  assert.deepEqual(readOut(ring), fresh(40));
  /* The clock within a step adds nothing: the newest sample is the last step passed. */
  ring.advance(40.2, stamp);
  assert.deepEqual(readOut(ring), fresh(40));
});
