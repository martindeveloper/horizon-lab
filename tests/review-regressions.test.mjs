import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createOrbitWriter, writeOrbit, ephemerisSelfCheck } from "@horizon/toolkit/bodies";

import { startEngine } from "../src/components/simulations/engine-lifecycle.ts";
import { custom, holeById } from "../src/features/black-hole/lib/holes/index.ts";
import { useBlackHole } from "../src/features/black-hole/lib/store.ts";
import { formatYearsAgo } from "../src/features/orrery/components/format.ts";
import { modernGalaxy } from "../src/features/orrery/lib/graphics/galaxy.ts";
import {
  createSunTrailWriter,
  writeSunTrail,
} from "../src/features/orrery/lib/model/galactic-orbit.ts";
import { modelSelfCheck } from "../src/features/orrery/lib/model/model-check.ts";
import { neighboursSelfCheck } from "../src/features/orrery/lib/model/neighbours.ts";
import { SUN_BIRTH } from "../src/features/orrery/lib/model/parameters.ts";
import { VIEWS, atViewDistance, viewForDistance } from "../src/features/orrery/lib/model/views.ts";
import { lineOf } from "../src/features/orrery/lib/scene/geometry.ts";
import { createHud } from "../src/features/orrery/lib/scene/hud.ts";
import { useOrrery } from "../src/features/orrery/lib/store.ts";
import { resolveView } from "../src/features/orrery/routing.ts";

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("lazy engines clean up late arrivals once and suppress failures after navigation", async () => {
  let resolve;
  let report;
  let signal;
  let disposed = 0;
  const errors = [];
  const lifetime = startEngine(
    (abort, onError) => {
      signal = abort;
      report = onError;
      return new Promise((done) => {
        resolve = done;
      });
    },
    (error) => errors.push(error),
  );
  await flush();
  lifetime.dispose();
  assert.equal(signal.aborted, true);
  resolve({
    dispose() {
      disposed++;
    },
  });
  await flush();
  report(new Error("late failure"));
  lifetime.dispose();
  assert.equal(disposed, 1);
  assert.deepEqual(errors, []);
});

test("lazy engine failures are reported and synchronous cancellation never starts work", async () => {
  const error = new Error("GPU unavailable");
  const errors = [];
  const failed = startEngine(
    async () => {
      throw error;
    },
    (value) => errors.push(value),
  );
  await flush();
  assert.deepEqual(errors, [error]);
  failed.dispose();
  let started = false;
  const cancelled = startEngine(
    async () => {
      started = true;
    },
    () => {},
  );
  cancelled.dispose();
  await flush();
  assert.equal(started, false);
  let disposed = 0;
  const ready = startEngine(
    async () => ({
      dispose() {
        disposed++;
      },
    }),
    () => {},
  );
  await flush();
  ready.dispose();
  ready.dispose();
  assert.equal(disposed, 1);
});

test("opening a tour from a hotspot restores the original orbit setting", () => {
  const original = useBlackHole.getState();
  try {
    for (const autoRotate of [true, false]) {
      useBlackHole.setState({ autoRotate });
      useBlackHole.getState().setActivePin("horizon");
      assert.equal(useBlackHole.getState().autoRotate, false);
      useBlackHole.getState().startGuide();
      assert.equal(useBlackHole.getState().activePin, null);
      useBlackHole.getState().endGuide();
      assert.equal(useBlackHole.getState().autoRotate, autoRotate);
    }
  } finally {
    useBlackHole.setState(original, true);
  }
});

test("lookup tables do not mistake Object prototype names for simulation IDs", () => {
  for (const name of ["constructor", "toString", "__proto__"]) {
    assert.equal(holeById(name), custom);
    assert.equal(resolveView(name), null);
  }
  assert.equal(resolveView("milky-way"), "galaxy");
});

test("orrery scientific self-checks run in tests rather than on every WebGL startup", () => {
  assert.deepEqual(ephemerisSelfCheck(), []);
  assert.deepEqual(modelSelfCheck(), []);
  assert.deepEqual(neighboursSelfCheck(), []);
});

test("the modern Milky Way is a thin, finite disk with dust and a populated centre", () => {
  const { stars, dust } = modernGalaxy(6000);
  const pos = stars.getAttribute("position").array;
  assert.ok(stars.getAttribute("position").count > 5500);
  assert.ok(dust.getAttribute("position").count > 1500);
  const radii = [];
  const heights = [];
  for (let i = 0; i < pos.length; i += 3) {
    assert.ok(Number.isFinite(pos[i] + pos[i + 1] + pos[i + 2]));
    radii.push(Math.hypot(pos[i], pos[i + 2]));
    heights.push(Math.abs(pos[i + 1]));
  }
  radii.sort((a, b) => a - b);
  heights.sort((a, b) => a - b);
  const median = (values) => values[Math.floor(values.length / 2)];
  // Half the light inside the solar circle; the disk roughly 1:50 thin.
  assert.ok(median(radii) > 6_000 && median(radii) < 27_000, `median R ${median(radii)}`);
  assert.ok(median(heights) < 1_200, `median |z| ${median(heights)}`);
});

test("orbit buffers preserve periapsis/apoapsis and skip changes to mean anomaly alone", () => {
  const el = { a: 20, e: 0.8, i: 63, omega: 120, node: 45, M: 0 };
  const buffer = new Float32Array(97 * 3);
  const update = createOrbitWriter(buffer);
  assert.equal(update(el, true), true);
  assert.ok(Math.abs(Math.hypot(...buffer.slice(0, 3)) - 4) < 1e-5);
  assert.ok(Math.abs(Math.hypot(...buffer.slice(48 * 3, 49 * 3)) - 36) < 1e-5);
  const initial = buffer.slice();
  assert.equal(update({ ...el, M: 180 }, true), false);
  assert.deepEqual(buffer, initial);
  assert.equal(update(el, false), true);
  for (let i = 0; i < buffer.length; i += 3)
    assert.ok(Math.abs(Math.hypot(...buffer.slice(i, i + 3)) - 20) < 1e-5);
  const changed = { ...el, node: 90 };
  assert.equal(update(changed, true), true);
  const expected = new Float32Array(buffer.length);
  writeOrbit(expected, changed, true);
  assert.deepEqual(buffer, expected);
  assert.equal(update(changed, true), false);
});

test("galaxy trail cache preserves vertices and invalidates for time, shape and pre-birth transitions", () => {
  const buffer = new Float32Array(97 * 3);
  const expected = new Float32Array(buffer.length);
  const update = createSunTrailWriter(buffer);
  for (const [yearsAgo, wobble] of [
    [0, false],
    [0, true],
    [1e9, true],
    [SUN_BIRTH + 1, true],
    [0, false],
  ]) {
    const count = writeSunTrail(expected, yearsAgo, wobble);
    assert.equal(update(yearsAgo, wobble), count);
    assert.deepEqual(buffer, expected);
    const snapshot = buffer.slice();
    assert.equal(update(yearsAgo, wobble), null);
    assert.deepEqual(buffer, snapshot);
  }
});

test("orrery HUD throttles drift readouts to 1 Hz even across forced redraws and keeps fixed decimals", () => {
  const original = useOrrery.getState();
  try {
    useOrrery.setState({ driftYears: 0, driftRate: 2.5 });
    const hud = createHud(useOrrery, { width: 1200, height: 800, dpr: 1 });
    // Forced redraws update scale/rate immediately without churning driftYears every frame.
    hud.update(0.016, true, { dist: 170_000, realm: "solar", drift: true, driftYears: 500 });
    assert.equal(useOrrery.getState().driftRate, 30_000);
    assert.equal(useOrrery.getState().driftYears, 0);
    hud.update(0.5, false, { dist: 170_000, realm: "solar", drift: true, driftYears: 15_500 });
    assert.equal(useOrrery.getState().driftYears, 0);
    hud.update(0.5, false, { dist: 170_000, realm: "solar", drift: true, driftYears: 30_000 });
    assert.equal(useOrrery.getState().driftYears, 30_000);
    // Resetting driftYears to 0 commits at once.
    hud.update(0.016, true, { dist: 170_000, realm: "solar", drift: true, driftYears: 0 });
    assert.equal(useOrrery.getState().driftYears, 0);
    // Manual zooming updates the active view and clears preset distance match when between presets.
    for (const v of VIEWS) {
      assert.equal(viewForDistance(v.dist, v.realm), v.id);
      assert.equal(atViewDistance(v.dist, v.dist), true);
    }
    assert.equal(atViewDistance(30, 72), false);
    hud.update(0.016, true, {
      dist: 6,
      realm: "solar",
      drift: true,
      driftYears: 0,
      syncView: true,
    });
    assert.equal(useOrrery.getState().view, "inner");
    assert.equal(useOrrery.getState().viewDist, 6);
  } finally {
    useOrrery.setState(original, true);
  }

  const t = (key, values) => `${key}:${values?.value ?? ""}`;
  const f = {
    number: (value, opts) =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: opts.minimumFractionDigits,
        maximumFractionDigits: opts.maximumFractionDigits,
      }).format(value),
  };
  assert.equal(formatYearsAgo(t, f, 4e9), "time.billion:4.00");
  assert.equal(formatYearsAgo(t, f, 4.5e9), "time.billion:4.50");
  assert.equal(formatYearsAgo(t, f, 5e6), "time.million:5.0");
});

test("sky and schematic disks draw in the pre-body pass and planetesimals use smooth cratered sRGB shaders", () => {
  const orbit = lineOf(0xffffff, 0.6);
  assert.equal(orbit.material.depthWrite, false);
  orbit.geometry.dispose();
  orbit.material.dispose();

  const skySource = readFileSync(
    new URL("../src/features/orrery/lib/graphics/sky.ts", import.meta.url),
    "utf8",
  );
  // Pre-body additive sky materials must keep transparent: false so Three.js
  // sorts their negative renderOrder ahead of opaque 3D bodies instead of
  // drawing stars on top of planets and planetesimals in the transparent pass.
  assert.doesNotMatch(skySource, /transparent:\s*true/);
  assert.match(skySource, /band\.renderOrder\s*=\s*-4/);

  const rockVert = readFileSync(
    new URL("../src/features/orrery/lib/graphics/shaders/rock.vert.glsl", import.meta.url),
    "utf8",
  );
  const rockFrag = readFileSync(
    new URL("../src/features/orrery/lib/graphics/shaders/rock.frag.glsl", import.meta.url),
    "utf8",
  );
  assert.match(rockVert, /smoothValue3/);
  assert.match(rockVert, /rockShape/);
  assert.match(rockVert, /worldRadius\s*<=\s*0\.0/);
  assert.match(rockVert, /vDetail/);
  assert.doesNotMatch(rockVert, /floor\(position/);
  assert.match(rockFrag, /craterLayer/);
  assert.match(rockFrag, /valueGrad3/);
  assert.match(rockFrag, /vDetail\s*>\s*0\.02/);
  assert.match(rockFrag, /linearToOutputTexel/);
  assert.doesNotMatch(rockFrag, /floor\(n\s*\*/);
});
