import assert from "node:assert/strict";
import test from "node:test";

import { createSolarActivityDensity } from "../src/features/orrery/lib/model/solar-activity-density.ts";
import { createSolarActivityDynamics } from "../src/features/orrery/lib/model/solar-activity-dynamics.ts";
import {
  PROMINENCE_REGIONS,
  SUN_ACTIVITY_CYCLE_SECONDS,
  SUN_ACTIVITY_DEPTH_RATIO,
  SUN_ACTIVITY_LEAN_LIMIT,
  SUN_ACTIVITY_MAX_STRETCH,
  SUN_ACTIVITY_REGION_COUNT,
  SUN_ACTIVITY_TWIST_LIMIT,
  SUN_ACTIVITY_WAVE_AMPLITUDE,
  solarActivityVisible,
} from "../src/features/orrery/lib/model/solar-activity.ts";
import { createSolarActivityGeometry } from "../src/features/orrery/lib/scene/solar-activity-geometry.ts";
import { useOrrery } from "../src/features/orrery/lib/store.ts";

const api = useOrrery.getState;
const reset = () => useOrrery.setState(useOrrery.getInitialState(), true);

test("solar activity requires an explicit choice in a Sun close-up and resets on every exit", () => {
  reset();
  assert.equal(api().solarActivity, false);
  api().toggleSolarActivity();
  assert.equal(api().solarActivity, false, "not available in the overview");
  api().select({ kind: "planet", id: "mars" });
  api().enterCloseUp();
  api().toggleSolarActivity();
  assert.equal(api().solarActivity, false, "not available on other bodies");
  const exits = [
    () => api().leaveCloseUp(),
    () => api().select(null),
    () => api().select({ kind: "planet", id: "earth" }),
    () => api().setView("oort"),
    () => api().setYearsAgo(4e9),
    () => api().setYearsFromPlay(4e9),
    () => api().togglePlay(),
    () => api().replay(),
    () => api().startGuide(),
  ];
  for (const leave of exits) {
    reset();
    api().select({ kind: "sun" });
    api().enterCloseUp();
    api().toggleSolarActivity();
    api().select({ kind: "sun" });
    assert.equal(api().solarActivity, true, "re-selecting the Sun preserves the model");
    api().toggleSolarActivityPaused();
    assert.equal(api().solarActivityPaused, true);
    leave();
    assert.equal(api().solarActivity, false, String(leave));
    assert.equal(api().solarActivityPaused, false, String(leave));
    if (api().guideOpen) api().endGuide();
    api().setYearsAgo(0);
    api().select({ kind: "sun" });
    api().enterCloseUp();
    assert.equal(api().solarActivity, false, "returning never re-enables the effect");
  }
  reset();
});

test("render gating rejects flights, other bodies, hidden solar maps and other close-ups", () => {
  const state = {
    solarActivity: true,
    solarActivityPaused: false,
    closeUp: { kind: "sun" },
  };
  const close = { id: "sun", phase: "on" };
  assert.ok(solarActivityVisible(state, close, true));
  assert.equal(solarActivityVisible(state, close, false), false);
  assert.equal(solarActivityVisible(state, null, true), false);
  for (const phase of ["in", "out"])
    assert.equal(solarActivityVisible(state, { ...close, phase }, true), false);
  assert.equal(solarActivityVisible(state, { ...close, id: "earth" }, true), false);
  for (const patch of [
    { solarActivity: false },
    { closeUp: null },
    { closeUp: { kind: "planet" } },
  ])
    assert.equal(solarActivityVisible({ ...state, ...patch }, close, true), false);
});

test("dynamics preserve the complete pose and momentum across pause and tab restoration", () => {
  const held = createSolarActivityDynamics();
  const reference = createSolarActivityDynamics();
  for (let i = 0; i < 13 * 30; i++) {
    held.advance(1 / 30, true);
    reference.advance(1 / 30, true);
  }
  const pose = held.values.slice();
  const time = held.time;
  held.advance(120, false);
  for (const dt of [-1, NaN, Infinity]) held.advance(dt, true);
  assert.equal(held.time, time);
  assert.deepEqual(held.values, pose, "pause/reduced motion freezes deformation and plasma flow");
  held.advance(120, true);
  reference.advance(0.1, true);
  assert.equal(held.time, reference.time);
  assert.deepEqual(held.values, reference.values, "resume preserves inertia without catch-up");
  held.reset();
  assert.equal(held.time, 0);
  assert.deepEqual(held.values, createSolarActivityDynamics().values);
});

test("prominence growth, sideways release and recoil are independent of playback frame rate", () => {
  const results = [];
  for (const fps of [24, 30, 60, 120]) {
    const model = createSolarActivityDynamics();
    for (let i = 0; i < 14 * fps; i++) model.advance(1 / fps, true);
    results.push(model.values.slice());
  }
  for (const result of results) assert.deepEqual(result, results[0]);
  const model = createSolarActivityDynamics();
  const heights = [],
    bends = [];
  let previous = model.values.slice();
  for (let i = 0; i < SUN_ACTIVITY_CYCLE_SECONDS * 120 * 3; i++) {
    model.advance(1 / 120, true);
    heights.push(model.values[0]);
    bends.push(model.values[1]);
    for (let j = 0; j < model.values.length; j++) {
      const value = model.values[j];
      const axis = j % 4;
      const limit =
        axis === 0
          ? SUN_ACTIVITY_MAX_STRETCH
          : axis === 3
            ? SUN_ACTIVITY_TWIST_LIMIT
            : SUN_ACTIVITY_LEAN_LIMIT;
      assert.ok(Number.isFinite(value) && Math.abs(value) <= limit + 1e-6);
      if (axis === 0) assert.ok(value >= 0.25, "no inverted or collapsed volume");
      assert.ok(Math.abs(value - previous[j]) < 0.025, "no pose pop, including across cycle wrap");
    }
    previous = model.values.slice();
  }
  assert.ok(
    Math.max(...heights) > 1.7 && Math.min(...heights) < 0.45,
    "visible growth and descent",
  );
  assert.ok(Math.max(...bends) > 0.4 && Math.min(...bends) < -0.35, "release reverses the bend");
  assert.equal(model.time, 0, "clock stays bounded over repeated cycles");
});

test("prominence bounds use one small draw and contain the expanded, anchored volumes", () => {
  const geometry = createSolarActivityGeometry();
  try {
    const p = geometry.getAttribute("position");
    const anchor = geometry.getAttribute("aAnchor");
    const along = geometry.getAttribute("aAlong");
    const shape = geometry.getAttribute("aShape");
    assert.ok(p.count / 3 <= 72, "only the six volume bounds are geometry");
    assert.ok(
      geometry.boundingSphere.radius < 1.3,
      "camera stays outside every volume at minimum zoom",
    );
    assert.equal(geometry.groups.length, 0, "one material/draw group");
    for (const attribute of Object.values(geometry.attributes))
      assert.ok(attribute.array.every(Number.isFinite));
    for (let i = 0; i < p.count; i++) {
      const normal = [anchor.getX(i), anchor.getY(i), anchor.getZ(i)];
      const tangent = [along.getX(i), along.getY(i), along.getZ(i)];
      assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-6);
      assert.ok(Math.abs(Math.hypot(...tangent) - 1) < 1e-6);
      assert.ok(
        Math.abs(normal.reduce((sum, value, axis) => sum + value * tangent[axis], 0)) < 1e-6,
      );
      assert.ok(
        Math.abs(p.getX(i)) <= 1 && p.getY(i) >= 0 && p.getY(i) <= 1 && Math.abs(p.getZ(i)) <= 1,
      );
      const span = shape.getY(i);
      assert.ok(Number.isInteger(shape.getW(i)) && shape.getW(i) < SUN_ACTIVITY_REGION_COUNT);
      const top = 1 - span * span * 0.3 + shape.getX(i) * SUN_ACTIVITY_MAX_STRETCH;
      const extent = Math.hypot(
        top,
        span * (1.25 + SUN_ACTIVITY_LEAN_LIMIT + 2 * SUN_ACTIVITY_WAVE_AMPLITUDE),
        span *
          SUN_ACTIVITY_DEPTH_RATIO *
          (1 +
            SUN_ACTIVITY_TWIST_LIMIT +
            SUN_ACTIVITY_LEAN_LIMIT +
            2 * SUN_ACTIVITY_WAVE_AMPLITUDE),
      );
      assert.ok(
        extent <= geometry.boundingSphere.radius + 1e-6,
        "animated corners cannot be culled early",
      );
    }
  } finally {
    geometry.dispose();
  }
});

test("the baked density is small, sparse, reproducible and transparent at every volume boundary", () => {
  let fullSize = 0;
  for (const tight of [false, true]) {
    const { data, width, height, depth } = createSolarActivityDensity(tight);
    assert.equal(data.length, width * height * depth);
    assert.ok(data.byteLength < 1024 * 1024, "single-channel volume stays under 1 MiB");
    if (tight) assert.ok(data.byteLength < fullSize / 3);
    else fullSize = data.byteLength;
    let nonzero = 0,
      maximum = 0;
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const density = data[x + y * width + z * width * height];
          if (
            x === 0 ||
            y === 0 ||
            z === 0 ||
            x === width - 1 ||
            y === height - 1 ||
            z === depth - 1
          )
            assert.equal(density, 0, "the proxy's rectangular edges must never be visible");
          if (density) nonzero++;
          maximum = Math.max(maximum, density);
        }
      }
    }
    assert.ok(
      nonzero > data.length * 0.01 && nonzero < data.length * 0.25,
      "threads and transparent gaps, not a filled box",
    );
    assert.ok(maximum > 128, "retain bright density knots");
    assert.deepEqual(data, createSolarActivityDensity(tight).data);
  }
});

test("flux-rope density roots both legs, clears the sub-arch cavity and follows Joy's law", () => {
  const { data, width, height, depth } = createSolarActivityDensity(false);
  const stride = width * height;
  let leftFoot = 0,
    rightFoot = 0,
    cavity = 0,
    crown = 0;
  for (let z = 1; z < depth - 1; z++) {
    for (let y = 1; y <= Math.floor(height * 0.14); y++) {
      for (let x = 1; x < width - 1; x++) {
        const d = data[x + y * width + z * stride];
        if (x < width * 0.34) leftFoot += d;
        else if (x > width * 0.66) rightFoot += d;
        else if (x > width * 0.44 && x < width * 0.56) cavity += d;
      }
    }
    for (let y = Math.floor(height * 0.45); y <= Math.floor(height * 0.85); y++) {
      for (let x = Math.floor(width * 0.3); x <= Math.floor(width * 0.7); x++) {
        crown += data[x + y * width + z * stride];
      }
    }
  }
  assert.ok(leftFoot > 20_000 && rightFoot > 20_000, "both chromospheric legs stay firmly rooted");
  assert.ok(cavity < Math.min(leftFoot, rightFoot) * 0.25, "open magnetic cavity beneath the arch");
  assert.ok(crown > leftFoot + rightFoot, "dense dipped spine across the upper arch");
  for (const [lat, , tilt] of PROMINENCE_REGIONS) {
    assert.ok(lat * tilt < 0, "Joy's law: opposite polarity-inversion tilt in N and S hemispheres");
  }
});
