import assert from "node:assert/strict";
import test from "node:test";

import {
  blankPlaneLine,
  contours,
  displayHeight,
  displayWidth,
  eruptionAt,
  flareLightAt,
  geometryAt,
  planeFieldAt,
  reconnectionAt,
  referenceHeight,
  ropeHeight,
} from "../src/space/sun/model/eruption.ts";
import {
  CME_FINAL_HEIGHT_R,
  CME_SPREAD_RAD,
  ERUPTION_SCALE_R,
  ERUPTION_STAGES,
  RECONNECTION,
  X_POINT_S,
} from "../src/space/sun/model/parameters.ts";
import {
  contourX,
  contourY,
  fluxAt,
  fluxTransferRateAt,
  transferredFluxAt,
  transportAt,
} from "../src/space/sun/model/reconnection.ts";

const near = (actual, expected, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
const dt = 1e-5;

test("one magnetic field obeys divergence and Faraday's law throughout reconnection", () => {
  for (const s of [0.2, 0.41, 0.55, 0.8, 0.99]) {
    for (const [x, y] of [
      [0, 1],
      [0.04, 0.95],
      [-0.2, 1.3],
      [0.4, 0.7],
      [0, 2],
      [0.3, 2.3],
    ]) {
      const xp = fluxAt(x + dt, y, s),
        xm = fluxAt(x - dt, y, s);
      const yp = fluxAt(x, y + dt, s),
        ym = fluxAt(x, y - dt, s);
      const sp = fluxAt(x, y, s + dt),
        sm = fluxAt(x, y, s - dt);
      near((xp.ay - xm.ay - yp.ax + ym.ax) / (2 * dt), 0);
      near((sp.ay - sm.ay + yp.electric - ym.electric) / (2 * dt), 0);
      near((-sp.ax + sm.ax - xp.electric + xm.electric) / (2 * dt), 0);
    }
  }
});

test("plasma converges from both sides and leaves upward and downward, with nonnegative local resistivity", () => {
  for (const s of [0.45, 0.6, 0.85]) {
    assert.ok(transportAt(-0.2, 1, s).vx > 0);
    assert.ok(transportAt(0.2, 1, s).vx < 0);
    assert.ok(transportAt(0, 1.3, s).vy > 0);
    assert.ok(transportAt(0, 0.7, s).vy < 0);
    for (const [x, y] of [
      [0, 1],
      [0.03, 0.98],
      [0.12, 1.2],
      [0.3, 1.3],
      [0, 2],
    ]) {
      const b = fluxAt(x, y, s),
        v = transportAt(x, y, s);
      assert.ok(Number.isFinite(v.vx) && Number.isFinite(v.vy) && v.resistivity >= 0);
      near(b.electric - v.vx * b.ax - v.vy * b.ay, v.resistivity * b.current);
      if (
        Math.abs(x) >= RECONNECTION.diffusionWidth ||
        Math.abs(y - 1) >= RECONNECTION.diffusionHeight
      ) {
        assert.equal(v.resistivity, 0);
        near(
          (fluxAt(x, y, s + dt).a - fluxAt(x, y, s - dt).a) / (2 * dt) + v.vx * b.ax + v.vy * b.ay,
          0,
        );
      }
    }
  }
});

test("transport tends continuously to rest at the X-point without reversing either outflow", () => {
  for (const s of [0.45, 0.6, 0.85]) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
    ]) {
      let previousSpeed = Infinity;
      for (const radius of [1e-3, 1e-4, 1e-5, 1e-6, 1e-7]) {
        const x = dx * radius,
          y = 1 + dy * radius;
        const v = transportAt(x, y, s),
          b = fluxAt(x, y, s);
        const speed = Math.hypot(v.vx, v.vy);
        if (dx) assert.ok(v.vx * dx < 0, "inflow must approach the sheet from either side");
        if (dy) assert.ok(v.vy * dy > 0, "outflow must leave the null in both vertical directions");
        assert.ok(speed < previousSpeed * 0.11, "velocity must vanish linearly near the null");
        near(b.electric - v.vx * b.ax - v.vy * b.ay, v.resistivity * b.current, 1e-12);
        previousSpeed = speed;
      }
      assert.ok(previousSpeed < 2e-5);
    }
    near(transportAt(0, 1, s).vx, 0, 1e-12);
    near(transportAt(0, 1, s).vy, 0, 1e-12);
  }
});

test("the nonnegative resistive closure keeps its required current sign across the diffusion region", () => {
  for (let step = 0; step <= 20; step++) {
    const s = X_POINT_S + ((1 - X_POINT_S) * step) / 20;
    for (let ix = -12; ix <= 12; ix++) {
      for (let iy = -25; iy <= 25; iy++) {
        const x = (ix / 12) * RECONNECTION.diffusionWidth;
        const y = 1 + (iy / 25) * RECONNECTION.diffusionHeight;
        const b = fluxAt(x, y, s),
          v = transportAt(x, y, s);
        assert.ok(
          b.current > 0,
          "the scalar closure requires positive current throughout its support",
        );
        assert.ok(Number.isFinite(v.resistivity) && v.resistivity >= 0);
        near(b.electric - v.vx * b.ax - v.vy * b.ay, v.resistivity * b.current, 1e-12);
      }
    }
  }
});

test("the X-point transfers equal flux to both products while the photospheric field stays fixed", () => {
  const initialIslandFlux = fluxAt(0, 2, 0).a - fluxAt(0, 1, 0).a;
  const initialArcadeFlux = fluxAt(0, 0, 0).a - fluxAt(0, 1, 0).a;
  for (const s of [0.2, 0.45, 0.6, 0.8, 1]) {
    const x = fluxAt(0, 1, s);
    near(x.ax, 0);
    near(x.ay, 0);
    near(fluxAt(0, 2, s).a - x.a - initialIslandFlux, transferredFluxAt(s));
    near(fluxAt(0, 0, s).a - x.a - initialArcadeFlux, transferredFluxAt(s));
    near(x.electric, fluxTransferRateAt(s));
    near((transferredFluxAt(s + dt) - transferredFluxAt(s - dt)) / (2 * dt), fluxTransferRateAt(s));
    for (const foot of [-1, -0.5, 0, 0.5, 1]) {
      near(fluxAt(foot, 0, s).a, fluxAt(foot, 0, 0).a);
      near(fluxAt(foot, 0, s).ax, fluxAt(foot, 0, 0).ax);
    }
  }
});

test("every rendered line is a complete component of one flux contour, including both reconnection products", () => {
  const lines = Array.from({ length: 24 }, blankPlaneLine);
  for (let step = 0; step <= 100; step++) {
    const s = step / 100,
      g = geometryAt(s);
    const count = contours(s, lines.length, lines, g);
    assert.ok(count >= 10 && count <= lines.length);
    for (const line of lines.slice(0, count)) {
      assert.ok(line.count >= 2);
      for (let j = 0; j < line.count; j++) {
        const y = referenceHeight(line.points[2 * j + 1], g);
        const x = line.points[2 * j] / (g.lambda * displayWidth(y, g));
        assert.ok(y >= 0);
        near(fluxAt(x, y, s).a, line.flux, 4e-6);
      }
      if (line.kind === "rope") {
        assert.deepEqual(
          line.points.slice(0, 2),
          line.points.slice(2 * (line.count - 1), 2 * line.count),
        );
      } else {
        assert.equal(line.points[1], 0);
        assert.equal(line.points[2 * (line.count - 1) + 1], 0);
        near(line.points[0], -line.points[2 * (line.count - 1)]);
      }
      if (line.kind === "postflare") {
        const upper = lines
          .slice(0, count)
          .find((other) => other.kind === "rope" && other.strand === line.strand);
        assert.ok(upper);
        assert.equal(upper.flux, line.flux);
      }
    }
  }
});

test("incoming contours converge, reconnected lower loops contract with fixed feet, and upper loops rise", () => {
  const lines = Array.from({ length: 24 }, blankPlaneLine);
  const previous = new Map();
  let contractions = 0,
    rises = 0;
  for (let step = 40; step <= 90; step++) {
    const s = step / 100;
    const count = contours(s, lines.length, lines);
    for (const line of lines.slice(0, count)) {
      const key = `${line.kind}:${line.strand}`;
      const ys = Array.from({ length: line.count }, (_, i) => line.points[2 * i + 1]);
      const current = { top: Math.max(...ys), bottom: Math.min(...ys), foot: line.points[0] };
      const prior = previous.get(key);
      if (prior && line.kind === "postflare") {
        assert.ok(current.top < prior.top);
        near(current.foot, prior.foot);
        contractions++;
      }
      if (prior && line.kind === "rope") {
        assert.ok(current.top > prior.top && current.bottom > prior.bottom);
        rises++;
      }
      previous.set(key, current);
    }
  }
  assert.ok(contractions > 100 && rises > 100);
  // A fixed incoming contour approaches the sheet before it changes connectivity.
  const a = -0.2,
    y = 1;
  assert.ok(contourX(y, a, 0.55) < contourX(y, a, 0.4));
});

test("the ideal expansion keeps the mapped field divergence-free and its height mapping invertible", () => {
  for (const s of [0, 0.4, 0.6, 0.9]) {
    const g = geometryAt(s);
    for (const y of [0, 0.8, 1, 1.2, 2, 3]) near(referenceHeight(displayHeight(y, g), g), y);
    for (const [x, y] of [
      [0.1, g.base * 0.8],
      [0.2, g.h],
      [-0.4, g.h * 2],
    ]) {
      near(
        (planeFieldAt(x + dt, y, g).bx -
          planeFieldAt(x - dt, y, g).bx +
          planeFieldAt(x, y + dt, g).by -
          planeFieldAt(x, y - dt, g).by) /
          (2 * dt),
        0,
        1e-6,
      );
    }
  }
});

test("the prescribed rise and display deformation have continuous velocities at stage joins", () => {
  const epsilon = 1e-6;
  for (const join of [
    ERUPTION_STAGES.storage,
    X_POINT_S,
    ERUPTION_STAGES.rise,
    ERUPTION_STAGES.breakaway,
  ]) {
    const coordinates = [ropeHeight, (s) => geometryAt(s).lambda];
    for (const y of [0.8, 1, 1.2, 2, 3]) {
      coordinates.push((s) => displayHeight(y, geometryAt(s)));
      coordinates.push((s) => geometryAt(s).lambda * displayWidth(y, geometryAt(s)));
    }
    for (const coordinate of coordinates) {
      const center = coordinate(join);
      const left = (center - coordinate(join - epsilon)) / epsilon;
      const right = (coordinate(join + epsilon) - center) / epsilon;
      near(left, right, 2e-3);
    }
  }
});

test("the CME front moves continuously while envelope visibility fades in independently", () => {
  let previousFront = 1;
  let previousPresence = 0;
  for (let i = 0; i <= 100; i++) {
    const s = i / 100,
      state = eruptionAt(s);
    assert.ok(state.cmeFront >= previousFront);
    assert.ok(state.cmePresence >= previousPresence && state.cmePresence <= 1);
    if (s <= ERUPTION_STAGES.rise) assert.equal(state.cmePresence, 0);
    if (s >= ERUPTION_STAGES.breakaway) assert.equal(state.cmePresence, 1);
    previousFront = state.cmeFront;
    previousPresence = state.cmePresence;
  }
  const start = ERUPTION_STAGES.rise;
  const before = eruptionAt(start - 1e-6),
    at = eruptionAt(start),
    after = eruptionAt(start + 1e-6);
  assert.ok(at.cmeFront > 1 && at.cmePresence === 0);
  near(before.cmeFront, at.cmeFront, 1e-4);
  near(after.cmeFront, at.cmeFront, 1e-4);
  near(before.cmePresence, after.cmePresence, 1e-8);
});

test("light follows flux transfer, the eruption rises, and ribbon separation grows", () => {
  let ratePeak = 0,
    lightPeak = 0,
    maxRate = 0,
    maxLight = 0;
  let previousHeight = 0,
    previousGap = 0;
  for (let i = 0; i <= 100; i++) {
    const s = i / 100,
      state = eruptionAt(s);
    const rate = reconnectionAt(s),
      light = flareLightAt(s);
    assert.ok(rate >= 0 && rate <= 1 + 1e-10 && light >= 0 && light <= 1);
    if (s <= X_POINT_S) {
      assert.equal(rate, 0);
      assert.equal(light, 0);
    }
    if (rate > maxRate) {
      maxRate = rate;
      ratePeak = s;
    }
    if (light > maxLight) {
      maxLight = light;
      lightPeak = s;
    }
    assert.ok(ropeHeight(s) >= previousHeight);
    assert.ok(state.ribbonGap >= previousGap);
    previousHeight = ropeHeight(s);
    previousGap = state.ribbonGap;
  }
  assert.ok(lightPeak > ratePeak);
  assert.ok(flareLightAt(1) > 0 && flareLightAt(1) < 0.3);
  near(eruptionAt(1).cmeFront, 5);
});

test("the rope lifts off as one round body inside the CME's width, over a lengthening sheet", () => {
  let previousLength = 0;
  for (let i = 41; i <= 100; i++) {
    const g = geometryAt(i / 100);
    assert.ok(g.q - g.p > previousLength, "the current sheet lengthens under the rising rope");
    previousLength = g.q - g.p;
  }
  const g = geometryAt(1);
  assert.ok(g.q - g.p > 4 * g.p, "the sheet is several times longer than the arcade is tall");
  const lines = Array.from({ length: 24 }, blankPlaneLine);
  const count = contours(1, lines.length, lines, g);
  const cores = lines.slice(0, count).filter((line) => line.kind === "rope" && line.flux > 0);
  assert.ok(cores.length > 0);
  for (const line of cores)
    for (let j = 0; j < line.count; j++)
      assert.ok(line.points[2 * j + 1] > g.q, "the rope's own field has left the sheet");
  // The outer separatrix above the sheet, its x an arc on the sphere: as wide as the span from
  // the sheet's top to the front, at the catalogued half-width.
  const a = fluxAt(0, 1, 1).a,
    top = contourY(a, 1, 2, 4);
  let lateral = 0,
    angle = 0;
  for (let k = 0; k <= 200; k++) {
    const y =
      1 + RECONNECTION.diffusionHeight + ((top - 1 - RECONNECTION.diffusionHeight) * k) / 200;
    const arc = Math.atan(ERUPTION_SCALE_R * g.lambda * displayWidth(y, g) * contourX(y, a, 1));
    angle = Math.max(angle, arc);
    lateral = Math.max(lateral, (1 + ERUPTION_SCALE_R * displayHeight(y, g)) * Math.sin(arc));
  }
  near(1 + ERUPTION_SCALE_R * displayHeight(top, g), CME_FINAL_HEIGHT_R, 1e-6);
  near(2 * lateral, ERUPTION_SCALE_R * (displayHeight(top, g) - g.q), 0.02 * lateral);
  near(angle, CME_SPREAD_RAD, 0.01);
});
