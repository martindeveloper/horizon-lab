import assert from "node:assert/strict";
import test from "node:test";

import { jplElements, namedById } from "@horizon/toolkit/bodies";

import {
  equalTimeSectors,
  fanArea,
  orbitArc,
  sweptDegrees,
} from "../src/features/orrery/lib/graphics/tour-sketch.ts";
import {
  TOUR,
  sampleTourFlight,
  tourFlightSeconds,
} from "../src/features/orrery/lib/model/tour.ts";

test("Halley's equal-time sectors sweep equal areas (Kepler's second law)", () => {
  const el = namedById("halley").elementsAt(new Date("2026-10-16T00:00:00Z"), 0);
  const [peri, mid, aph] = equalTimeSectors(el, 36, 4000).map(fanArea);
  for (const area of [mid, aph]) assert.ok(Math.abs(area / peri - 1) < 1e-4, `${area} vs ${peri}`);
  // Same area, very different shapes: short and wide near the Sun, long and thin far out.
  const span = (arc) => Math.hypot(...arc[0].map((v, i) => v - arc.at(-1)[i]));
  const [p, , a] = equalTimeSectors(el);
  assert.ok(span(p) > 5 * span(a));
});

test("one-year arcs close Earth's loop and narrow with distance", () => {
  const earth = jplElements("earth", 0);
  const jupiter = jplElements("jupiter", 0);
  const neptune = jplElements("neptune", 0);
  assert.ok(Math.abs(sweptDegrees(earth, 1) - 360) < 0.5);
  assert.ok(Math.abs(sweptDegrees(jupiter, 1) - 30.3) < 0.5);
  assert.ok(sweptDegrees(neptune, 1) < 2.3);
  const loop = orbitArc(earth, earth.M, earth.M + 360);
  assert.ok(Math.hypot(...loop[0].map((v, i) => v - loop.at(-1)[i])) < 1e-9);
});

test("tour flights land exactly and take their own time", () => {
  const from = { azimuth: 0.2, inclination: 0.5, distance: 72 };
  for (const step of TOUR) {
    const end = sampleTourFlight(1, from, step);
    assert.equal(end.inclination, step.inclination, step.id);
    assert.equal(end.distance, step.distance, step.id);
    const turn = end.azimuth - step.azimuth;
    assert.ok(Math.abs(Math.sin(turn)) < 1e-9 && Math.cos(turn) > 0, step.id);
    assert.ok(tourFlightSeconds(step) >= 5, step.id);
  }
});
