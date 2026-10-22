import assert from "node:assert/strict";
import test from "node:test";

import {
  blankPlaneLine,
  contours,
  eruptionAt,
  flareLightAt,
  geometryAt,
  planeFieldAt,
  reconnectionAt,
  ropeHeight,
  sheetFieldAt,
} from "../src/space/sun/model/eruption.ts";
import {
  CME_FINAL_HEIGHT_R,
  ERUPTION_SCALE_R,
  ERUPTION_STAGES,
  X_POINT_S,
} from "../src/space/sun/model/parameters.ts";

test("the rope rises along its branch while the sources converge, then runs away after loss of equilibrium", () => {
  let previous = ropeHeight(0);
  for (let s = 0.01; s <= 1; s += 0.01) {
    const h = ropeHeight(s);
    assert.ok(h >= previous - 1e-12, `monotone at ${s}`);
    previous = h;
  }
  const storage = geometryAt(ERUPTION_STAGES.storage);
  assert.ok(
    Math.abs(storage.lambda - 1) < 1e-9 && Math.abs(storage.h - 1) < 1e-9,
    "the critical point: h = λ = λ₀",
  );
  assert.ok(
    geometryAt(0).lambda > 1 && geometryAt(0).h < 1,
    "sources apart and the rope low to begin",
  );
  const rate = (s) => (ropeHeight(s + 0.01) - ropeHeight(s)) / 0.01;
  assert.ok(rate(0.45) > 2 * rate(0.2), "accelerating after the loss of equilibrium");
  assert.ok(rate(0.8) > rate(0.5));
  assert.ok(
    Math.abs(geometryAt(1).h * ERUPTION_SCALE_R - CME_FINAL_HEIGHT_R) < 1e-6,
    "out to the final height",
  );
});

test("no sheet before the X-point; after it the sheet stretches up under the rope while its bottom rises slowly", () => {
  for (const s of [0, 0.2, X_POINT_S - 0.01]) {
    const g = geometryAt(s);
    assert.equal(g.p, 0);
    assert.equal(g.q, 0);
    assert.equal(reconnectionAt(s), 0);
    assert.equal(flareLightAt(s), 0);
  }
  let lastQ = 0;
  let lastP = 0;
  for (let s = X_POINT_S + 0.01; s <= 1; s += 0.01) {
    const g = geometryAt(s);
    assert.ok(g.p > 0 && g.q >= g.p, `sheet at ${s}`);
    assert.ok(g.q < g.h - g.rope, "under the rope");
    assert.ok(g.q >= lastQ - 1e-9 && g.p >= lastP - 1e-9, "both ends rise");
    lastQ = g.q;
    lastP = g.p;
  }
  assert.ok(lastQ > 50 * lastP, "the top follows the rope away, the bottom stays low");
});

test("the closed-form field vanishes at the sources and the sheet tips, is strong and reversed across the sheet, and has an X-point", () => {
  const g = geometryAt(0.55);
  const at = (x, y) => planeFieldAt(x, y, g);
  const near = (b) => Math.hypot(b.bx, b.by);
  assert.ok(near(at(g.lambda, 0)) < 1e-6, "zero at the source");
  assert.ok(near(at(1e-4, g.p)) < 0.05 * near(at(0.5, g.p)), "small at the lower tip");
  assert.ok(near(at(1e-4, g.q)) < 0.05 * near(at(0.5, g.q)), "small at the upper tip");
  const mid = (g.p + g.q) / 2;
  const right = at(1e-5, mid);
  const left = at(-1e-5, mid);
  assert.ok(
    Math.abs(right.by + left.by) < 1e-3 * Math.abs(right.by),
    "B_y reverses across the sheet",
  );
  assert.ok(Math.abs(right.by) > 0.1, "and is strong there");
  assert.ok(
    Math.abs(Math.abs(right.by) - sheetFieldAt(mid, g)) < 1e-2 * Math.abs(right.by),
    "as eq. 17 gives it",
  );
  /* Without a sheet the field on the axis is horizontal: the sheet carries the jump. */
  const noSheet = { ...g, p: 0, q: 0 };
  assert.ok(Math.abs(planeFieldAt(1e-5, mid, noSheet).by) < 1e-3);
  /* An arcade over the neutral line: B_x even in x, B_y odd. */
  const a = at(0.7, 1.2);
  const b = at(-0.7, 1.2);
  assert.ok(Math.abs(a.bx - b.bx) < 1e-9 && Math.abs(a.by + b.by) < 1e-9);
  /* Before the X-point forms, the only null is at the origin. */
  const early = geometryAt(0.2);
  assert.ok(near(planeFieldAt(0, 1e-6, early)) < 1e-3);
  assert.ok(near(planeFieldAt(0.1, 0.1, early)) > 1e-3);
});

test("reconnection comes only after the X-point, the flare's light peaks after it and decays slowly", () => {
  let peakRate = 0;
  let peakRateAt = 0;
  let peakLight = 0;
  let peakLightAt = 0;
  for (let s = 0; s <= 1; s += 0.002) {
    const rate = reconnectionAt(s);
    const light = flareLightAt(s);
    assert.ok(rate >= 0 && rate <= 1 && light >= 0 && light <= 1);
    if (s < X_POINT_S) assert.equal(rate, 0);
    if (rate > peakRate) {
      peakRate = rate;
      peakRateAt = s;
    }
    if (light > peakLight) {
      peakLight = light;
      peakLightAt = s;
    }
  }
  assert.ok(
    Math.abs(peakRate - 1) < 1e-2 && Math.abs(peakLight - 1) < 1e-2,
    `peaks ${peakRate}, ${peakLight}`,
  );
  assert.ok(
    peakRateAt > X_POINT_S && peakRateAt < ERUPTION_STAGES.breakaway,
    `rate peaks at ${peakRateAt}`,
  );
  assert.ok(peakLightAt > peakRateAt, "light lags the release");
  assert.ok(flareLightAt(1) > 0 && flareLightAt(1) < 0.3, "a long tail");
  assert.ok(reconnectionAt(1) < 0.05, "the sheet has gone quiet");
});

test("the ejection's front leaves after breakaway, the ribbons separate, and the state reads in solar radii", () => {
  const before = eruptionAt(0.45);
  assert.equal(before.cmeFront, 1);
  assert.equal(before.cmeSpread, 0);
  assert.ok(before.sheetBottom > 0 && before.sheetTop >= before.sheetBottom);
  assert.ok(Math.abs(before.ropeHeight - geometryAt(0.45).h * ERUPTION_SCALE_R) < 1e-12);
  let lastFront = 1;
  let lastGap = 0;
  for (let step = 10; step <= 20; step++) {
    const s = step / 20;
    const state = eruptionAt(s);
    assert.ok(state.cmeFront >= lastFront - 1e-9, `front at ${s}`);
    assert.ok(
      state.ribbonGap >= lastGap - 1e-6,
      `ribbons at ${s}: ${state.ribbonGap} after ${lastGap}`,
    );
    lastFront = state.cmeFront;
    lastGap = state.ribbonGap;
  }
  assert.ok(lastFront > CME_FINAL_HEIGHT_R, `the front reaches ${lastFront} R`);
  assert.ok(lastGap > 0.05 && lastGap < 0.3, `ribbons ${lastGap} rad apart`);
  assert.ok(eruptionAt(1).cmeSpread > 0.3);
  const out = eruptionAt(0.2);
  assert.equal(eruptionAt(0.7, out), out, "writes into the given state");
});

test("field lines trace from the sources: an arcade at rest, post-flare loops under the sheet, lines around the rope", () => {
  const lines = Array.from({ length: 20 }, blankPlaneLine);
  const kindsAt = (s) => {
    const used = contours(s, 14, lines);
    const kinds = { arcade: 0, postflare: 0, rope: 0, open: 0 };
    for (let i = 0; i < used; i++) {
      const line = lines[i];
      assert.ok(line.count >= 2);
      for (let j = 0; j < line.count; j++)
        assert.ok(line.points[2 * j + 1] >= -1e-9, "never under the photosphere");
      kinds[line.kind]++;
    }
    return kinds;
  };
  const rest = kindsAt(0.1);
  assert.equal(rest.postflare, 0, "no post-flare loops before any reconnection");
  assert.ok(rest.arcade >= 6);
  assert.ok(rest.rope >= 3, "the rope's rings");
  const late = kindsAt(0.9);
  assert.ok(late.postflare >= 3, `post-flare loops fill in: ${JSON.stringify(late)}`);
  /* A landed arcade line at rest goes over to the other source. */
  contours(0.1, 6, lines);
  const arcade = lines.find((line) => line.kind === "arcade");
  const g = geometryAt(0.1);
  const endX = arcade.points[2 * (arcade.count - 1)];
  assert.ok(Math.abs(endX + g.lambda) < 0.1, `lands at the other source: ${endX}`);
});
