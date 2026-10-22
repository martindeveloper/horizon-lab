import assert from "node:assert/strict";
import test from "node:test";

import {
  createSolarActivityDynamics,
  regionCourse,
} from "../src/features/orrery/lib/model/solar-activity-dynamics.ts";
import {
  PROMINENCE_REGIONS,
  SUN_ACTIVITY_CYCLE_SECONDS,
  SUN_ACTIVITY_DRAIN_SPEED,
  SUN_ACTIVITY_ERUPTION_DRAIN,
  SUN_ACTIVITY_FAST_RISE_END,
  SUN_ACTIVITY_FAST_RISE_START,
  SUN_ACTIVITY_MAX_HEIGHT,
  SUN_ACTIVITY_MAX_LIFT,
  SUN_ACTIVITY_REGION_COUNT,
  SUN_ACTIVITY_SLOW_RISE_LIFT,
  SUN_ACTIVITY_SLOW_RISE_START,
  SUN_ACTIVITY_SWAY_LIMIT,
  SUN_ACTIVITY_TIME_SCALE,
  SUN_RADIUS_MM,
  solarActivityVisible,
} from "../src/features/orrery/lib/model/solar-activity.ts";
import { solarActivityBounds } from "../src/features/orrery/lib/scene/solar-activity.ts";
import { useOrrery } from "../src/features/orrery/lib/store.ts";
import { createProminenceDensity } from "../src/space/sun/graphics/prominence/density.ts";
import {
  createProminenceGeometry,
  prominenceReach,
} from "../src/space/sun/graphics/prominence/geometry.ts";

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
  assert.deepEqual(held.values, pose, "pause/reduced motion freezes the body and its flows");
  held.advance(120, true);
  reference.advance(0.1, true);
  assert.equal(held.time, reference.time);
  assert.deepEqual(held.values, reference.values, "resume preserves momentum without catch-up");
  held.reset();
  assert.equal(held.time, 0);
  assert.deepEqual(held.values, createSolarActivityDynamics().values);
});

test("a region's cycle is a quiescent spell, a slow then fast rise that thins it away, and re-formation", () => {
  const quiet = regionCourse(SUN_ACTIVITY_SLOW_RISE_START / 2);
  assert.deepEqual(quiet, { lift: 1, fade: 1, drain: 1 });
  const slow = regionCourse((SUN_ACTIVITY_SLOW_RISE_START + SUN_ACTIVITY_FAST_RISE_START) / 2);
  assert.ok(
    slow.lift > 1 && slow.lift < SUN_ACTIVITY_SLOW_RISE_LIFT,
    "the slow rise lifts a little",
  );
  assert.equal(slow.fade, 1, "the body stays condensed through the slow rise");
  const fast = regionCourse(SUN_ACTIVITY_FAST_RISE_START + 1e-9);
  assert.ok(
    Math.abs(fast.lift - SUN_ACTIVITY_SLOW_RISE_LIFT) < 1e-6,
    "the fast rise continues the slow one",
  );
  assert.equal(fast.drain, SUN_ACTIVITY_ERUPTION_DRAIN, "the legs drain fastest while it erupts");
  const gone = regionCourse(SUN_ACTIVITY_FAST_RISE_END - 1e-9);
  assert.ok(
    Math.abs(gone.lift - SUN_ACTIVITY_MAX_LIFT) < 1e-3 && gone.fade < 1e-6,
    "thinned away at its top lift",
  );
  const reforming = regionCourse((SUN_ACTIVITY_FAST_RISE_END + 1) / 2);
  assert.equal(reforming.lift, 1, "a new body condenses at its quiescent height");
  assert.ok(
    reforming.fade > 0 && reforming.fade < 1 && reforming.drain < 1,
    "condensing, draining slowly",
  );
  const wrapped = regionCourse(1 - 1e-12);
  assert.ok(wrapped.lift === 1 && wrapped.fade > 1 - 1e-6, "the cycle wraps without a jump");
  // The fast rise is tens of kilometres per second (Sterling & Moore 2005): neither a crawl nor a flash.
  const riseMm =
    (SUN_ACTIVITY_MAX_LIFT - SUN_ACTIVITY_SLOW_RISE_LIFT) * SUN_ACTIVITY_MAX_HEIGHT * SUN_RADIUS_MM;
  const riseSeconds =
    (SUN_ACTIVITY_FAST_RISE_END - SUN_ACTIVITY_FAST_RISE_START) *
    SUN_ACTIVITY_CYCLE_SECONDS *
    SUN_ACTIVITY_TIME_SCALE;
  const kms = (riseMm * 1000) / riseSeconds;
  assert.ok(kms > 10 && kms < 100, `fast rise at ${kms.toFixed(0)} km/s`);
  // Thread flows of 10–20 km/s cross a quiescent body's height within a minute of display time.
  const drainSeconds = SUN_ACTIVITY_MAX_HEIGHT / SUN_ACTIVITY_DRAIN_SPEED;
  assert.ok(
    drainSeconds > 3 && drainSeconds < 60,
    `a thread drains in ${drainSeconds.toFixed(1)} s`,
  );
});

test("the live model is frame-rate independent, continuous while visible, bounded and rocked by eruptions", () => {
  const results = [];
  for (const fps of [24, 30, 60, 120]) {
    const model = createSolarActivityDynamics();
    for (let i = 0; i < 14 * fps; i++) model.advance(1 / fps, true);
    results.push(model.values.slice());
  }
  for (const result of results) assert.deepEqual(result, results[0]);

  const model = createSolarActivityDynamics();
  let previous = model.values.slice();
  let swayPeak = 0;
  let eruptions = 0;
  const lifts = new Set();
  for (let i = 0; i < SUN_ACTIVITY_CYCLE_SECONDS * 120 * 2; i++) {
    model.advance(1 / 120, true);
    for (let region = 0; region < SUN_ACTIVITY_REGION_COUNT; region++) {
      const [lift, fade, sway, drained] = model.values.subarray(region * 4, region * 4 + 4);
      const [oldLift, oldFade, oldSway, oldDrained] = previous.subarray(region * 4, region * 4 + 4);
      assert.ok(lift >= 1 && lift <= SUN_ACTIVITY_MAX_LIFT + 1e-6, "lift stays in its range");
      assert.ok(fade >= 0 && fade <= 1, "fade stays in its range");
      assert.ok(Math.abs(sway) <= SUN_ACTIVITY_SWAY_LIMIT + 1e-6, "sway stays in its range");
      assert.ok(drained >= 0 && Number.isFinite(drained));
      // The visible body never pops: the lift only snaps back once nothing is left to see.
      if (Math.abs(lift - oldLift) > 0.02) {
        assert.ok(oldFade < 1e-3 && fade < 1e-3, "lift resets only while thinned away");
        eruptions++;
      }
      assert.ok(Math.abs(fade - oldFade) < 0.02, "no visibility pop");
      assert.ok(Math.abs(sway - oldSway) < 0.005, "no sideways pop");
      const drainedStep = drained - oldDrained;
      assert.ok(
        drainedStep < 0 ||
          drainedStep <= (SUN_ACTIVITY_DRAIN_SPEED * SUN_ACTIVITY_ERUPTION_DRAIN) / 120 + 1e-4,
        "threads drain at the schedule's rate",
      );
      swayPeak = Math.max(swayPeak, Math.abs(sway));
      lifts.add(Math.round(lift * 100));
    }
    previous = model.values.slice();
  }
  assert.equal(eruptions, SUN_ACTIVITY_REGION_COUNT * 2, "every region erupts once per cycle");
  assert.ok(swayPeak > 0.01, "eruptions rock the other bodies visibly");
  assert.ok(swayPeak <= SUN_ACTIVITY_SWAY_LIMIT, "but gently");
  assert.ok(lifts.size > 20, "the rise is gradual, not a jump");
  assert.equal(model.time, 0, "clock stays bounded over repeated cycles");

  // Left alone, a rocked body settles: the kink oscillation is damped.
  const settle = createSolarActivityDynamics();
  for (let i = 0; i < SUN_ACTIVITY_CYCLE_SECONDS * 120; i++) settle.advance(1 / 120, true);
  const kicked = [...settle.values].filter((_, i) => i % 4 === 2).map(Math.abs);
  assert.ok(Math.max(...kicked) < SUN_ACTIVITY_SWAY_LIMIT * 0.5, "damped within the cycle");
});

test("prominence bounds use one small draw and contain the erupting, swaying volumes", () => {
  const geometry = createProminenceGeometry(solarActivityBounds());
  try {
    const p = geometry.getAttribute("position");
    const anchor = geometry.getAttribute("aAnchor");
    const along = geometry.getAttribute("aAlong");
    const shape = geometry.getAttribute("aShape");
    const mirror = geometry.getAttribute("aMirror");
    assert.ok(p.count / 3 <= 72, "only the six volume bounds are geometry");
    assert.ok(
      geometry.boundingSphere.radius < 1.3,
      "camera stays outside every volume at minimum zoom",
    );
    assert.equal(geometry.boundingSphere.radius, prominenceReach(solarActivityBounds()));
    assert.equal(geometry.groups.length, 0, "one material/draw group");
    for (const attribute of Object.values(geometry.attributes))
      assert.ok(attribute.array.every(Number.isFinite));
    const mirrors = new Set();
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
      assert.ok(Math.abs(mirror.getX(i)) === 1 && Math.abs(mirror.getY(i)) === 1);
      mirrors.add(`${mirror.getX(i)}${mirror.getY(i)}`);
      const halfSpan = shape.getY(i);
      assert.ok(Number.isInteger(shape.getW(i)) && shape.getW(i) < SUN_ACTIVITY_REGION_COUNT);
      assert.ok(shape.getX(i) <= SUN_ACTIVITY_MAX_HEIGHT && halfSpan <= 0.2);
      const top = 1 + shape.getX(i) * SUN_ACTIVITY_MAX_LIFT;
      assert.ok(
        Math.hypot(top, halfSpan) <= geometry.boundingSphere.radius + 1e-6,
        "animated corners cannot be culled early",
      );
    }
    assert.ok(mirrors.size >= 4, "the one baked body is mirrored four ways");
  } finally {
    geometry.dispose();
  }
});

test("the baked density is small, sparse, reproducible and transparent at every volume boundary", () => {
  let fullSize = 0;
  for (const tight of [false, true]) {
    const { data, width, height, depth } = createProminenceDensity(tight);
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
    assert.deepEqual(data, createProminenceDensity(tight).data);
  }
});

test("the hedgerow stands on pillars with dark arches between, as a thin sheet with barbs to both sides", () => {
  const { data, width, height, depth } = createProminenceDensity(false);
  const stride = width * height;
  const at = (x, y, z) => data[x + y * width + z * stride];
  // Along the sheet, where the plasma reaches the chromosphere: the pillars and the two legs.
  const column = (x) => {
    let mass = 0;
    for (let y = 1; y <= Math.floor(height * 0.06); y++)
      for (let z = 1; z < depth - 1; z++) mass += at(x, y, z);
    return mass;
  };
  const masses = Array.from({ length: width }, (_, x) => column(x));
  const peak = Math.max(...masses);
  let pillars = 0,
    inside = false;
  for (const mass of masses) {
    const standing = mass > peak * 0.25;
    if (standing && !inside) pillars++;
    inside = standing;
  }
  assert.ok(pillars >= 4, `${pillars} rooted pillars along the sheet`);
  const arches = masses.filter(
    (mass, x) => x > width * 0.1 && x < width * 0.9 && mass < peak * 0.05,
  );
  assert.ok(arches.length > width * 0.2, "dark arches between the pillars");
  // The body hangs in the corona above those arches.
  let body = 0;
  for (let y = Math.floor(height * 0.3); y <= Math.floor(height * 0.7); y++)
    for (let x = Math.floor(width * 0.2); x <= Math.floor(width * 0.8); x++)
      for (let z = 1; z < depth - 1; z++) body += at(x, y, z);
  assert.ok(body > masses.reduce((sum, mass) => sum + mass, 0), "a dense suspended sheet");
  // Across it, the sheet is thin at mid-height and its barbs reach out on either side lower down.
  const across = (yFrom, yTo) => {
    const profile = Array.from({ length: depth }, () => 0);
    for (let z = 1; z < depth - 1; z++)
      for (let y = Math.floor(height * yFrom); y <= Math.floor(height * yTo); y++)
        for (let x = 1; x < width - 1; x++) profile[z] += at(x, y, z);
    return profile;
  };
  const high = across(0.55, 0.85);
  const highTotal = high.reduce((sum, mass) => sum + mass, 0);
  const core = high
    .slice(Math.floor(depth * 0.3), Math.ceil(depth * 0.7))
    .reduce((s, m) => s + m, 0);
  assert.ok(core > highTotal * 0.8, "the upper body is a thin sheet across its middle");
  const low = across(0.02, 0.25);
  const left = low.slice(1, Math.floor(depth * 0.25)).reduce((s, m) => s + m, 0);
  const right = low.slice(Math.ceil(depth * 0.75), depth - 1).reduce((s, m) => s + m, 0);
  assert.ok(left > 0 && right > 0, "barbs reach the chromosphere on both sides");
  for (const [lat, , tilt] of PROMINENCE_REGIONS) {
    assert.ok(lat * tilt < 0, "Joy's law: opposite polarity-inversion tilt in N and S hemispheres");
  }
});
