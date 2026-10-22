import assert from "node:assert/strict";
import test from "node:test";

import {
  FLOW_PARTICLES,
  flowReferenceAt,
  eruptionFlow,
} from "../src/space/sun/model/eruption-flow.ts";
import { blankEruptionLine, eruptionLines } from "../src/space/sun/model/eruption-lines.ts";
import { blankPlaneLine, contours, geometryAt } from "../src/space/sun/model/eruption.ts";
import {
  ARCADE_SLICES,
  ERUPTION_LINES,
  ERUPTION_SCALE_R,
} from "../src/space/sun/model/parameters.ts";
import { transportAt } from "../src/space/sun/model/reconnection.ts";

const region = { lat: 0.2, lon: 0.7, tilt: 0.15, size: 0.05, polarity: 1, strength: 1 };
const radiusAt = (line, i) => Math.hypot(...line.points.slice(3 * i, 3 * i + 3));

test("solar projection preserves complete closed islands and surface-connected flare loops", () => {
  const plane = Array.from({ length: ERUPTION_LINES }, blankPlaneLine);
  const lines = Array.from({ length: ERUPTION_LINES * ARCADE_SLICES }, blankEruptionLine);
  for (const s of [0, 0.4, 0.5, 0.6, 0.7, 0.85, 1]) {
    const g = geometryAt(s);
    const n = contours(s, ERUPTION_LINES, plane, g);
    const used = eruptionLines(region, plane, n, lines);
    assert.equal(used, n * ARCADE_SLICES);
    for (let k = 0; k < used; k++) {
      const line = lines[k],
        source = plane[k % n];
      assert.equal(line.count, source.count);
      for (let i = 0; i < line.count; i++) {
        const r = radiusAt(line, i);
        assert.ok(Number.isFinite(r) && r >= 1 - 1e-6);
        assert.ok(Math.abs(r - (1 + ERUPTION_SCALE_R * source.points[2 * i + 1])) < 1e-6);
      }
      if (line.kind === "rope") {
        assert.deepEqual(
          line.points.slice(0, 3),
          line.points.slice(3 * (line.count - 1), 3 * line.count),
        );
      } else {
        assert.ok(Math.abs(radiusAt(line, 0) - 1) < 1e-6);
        assert.ok(Math.abs(radiusAt(line, line.count - 1) - 1) < 1e-6);
      }
    }
  }
});

test("plasma tracers follow the reconnection velocity and reproduce exactly when scrubbed backward", () => {
  for (const s of [0.47, 0.57, 0.67, 0.77]) {
    for (let k = 0; k < FLOW_PARTICLES; k += 5) {
      const [x, y] = flowReferenceAt(k, s);
      const before = flowReferenceAt(k, s - 0.001),
        after = flowReferenceAt(k, s + 0.001);
      const v = transportAt(x, y, s);
      assert.ok(Math.abs((after[0] - before[0]) / 0.002 - v.vx) < 0.003);
      assert.ok(Math.abs((after[1] - before[1]) / 0.002 - v.vy) < 0.003);
    }
  }
  for (let k = 0; k < FLOW_PARTICLES; k++) {
    const start = flowReferenceAt(k, 0.4),
      end = flowReferenceAt(k, 0.85);
    assert.ok(Math.abs(end[0]) < Math.abs(start[0]), "inflow toward the sheet");
    assert.ok(
      (end[1] - start[1]) * (start[1] - 1) > 0,
      "outflow away from the X-point in both directions",
    );
  }
  const points = new Float32Array(3 * FLOW_PARTICLES);
  eruptionFlow(region, geometryAt(0.6), points);
  const expected = points.slice();
  eruptionFlow(region, geometryAt(0.9), points);
  eruptionFlow(region, geometryAt(0.6), points);
  assert.deepEqual(points, expected);
});
