import assert from "node:assert/strict";
import test from "node:test";

import {
  compareRgba,
  differenceMap,
  findSpikes,
  fitScaling,
  inputActions,
  keyframeIndices,
  sequenceFrames,
  summarizeTimings,
} from "@horizon/toolkit/bench";

import { buildBenchBundle } from "../bench/build.ts";
import { compare } from "../bench/compare.ts";
import { diffFields, fingerprint, fingerprints, stableStringify } from "../bench/fingerprint.ts";
import { html } from "../bench/html.ts";
import { comparisonWarnings, findings, llmSummary } from "../bench/report.ts";
import {
  BENCH_SCENES,
  benchMotion,
  benchPose,
} from "../src/features/black-hole/lib/bench-scenes.ts";
import { close } from "./toolkit-helpers.mjs";

test("timing summaries use nearest-rank percentiles and reject empty runs", () => {
  const summary = summarizeTimings([5, 1, 4, 2, 3, 10, 6, 7, 9, 8]);
  assert.deepEqual(summary, { count: 10, min: 1, median: 5, p90: 9, max: 10, mean: 5.5 });
  assert.equal(summarizeTimings([2.5]).p90, 2.5);
  assert.throws(() => summarizeTimings([]), RangeError);
});

test("hitches are measured against the local median, so trends are not spikes", () => {
  const ramp = Array.from({ length: 60 }, (_, i) => 1 + i * 0.1); // 1 → 6.9 ms, no hitch
  assert.deepEqual(findSpikes(ramp), []);
  const hitch = [...ramp];
  hitch[30] = 20;
  hitch[10] = 9;
  assert.deepEqual(findSpikes(hitch), [30, 10]);
});

test("scaling fit separates fixed and per-pixel cost", () => {
  const points = [0.5e6, 1e6, 2e6, 4e6].map((pixels) => ({
    pixels,
    ms: 0.25 + 0.8 * (pixels / 1e6),
  }));
  const fit = fitScaling(points);
  close(fit.fixedMs, 0.25);
  close(fit.msPerMegapixel, 0.8);
  close(fit.r2, 1);
  assert.equal(fitScaling(points.slice(0, 1)), null);
});

test("image comparison and difference maps ignore alpha", () => {
  const a = new Uint8Array([10, 10, 10, 255, 0, 0, 0, 255, 200, 200, 200, 255, 0, 0, 0, 0]);
  const b = new Uint8Array([10, 10, 10, 0, 9, 0, 0, 255, 200, 140, 200, 255, 0, 0, 8, 255]);
  const diff = compareRgba(a, b);
  assert.equal(diff.maxAbs, 60);
  assert.equal(diff.changed, 2 / 4);
  assert.equal(diff.meanAbs, (9 + 60 + 8) / 12);
  assert.throws(() => compareRgba(a, b.subarray(4)), RangeError);
  const map = differenceMap(a, b);
  assert.deepEqual([...map.subarray(0, 4)], [0, 0, 0, 255], "equal pixels are black");
  assert.ok(map[8] > map[4], "larger differences are brighter");
});

test("sequences span their duration and keyframes land on frames", () => {
  const frames = sequenceFrames({ frames: 5, duration: 2 }, 10);
  assert.deepEqual(
    frames.map((f) => [f.progress, f.time, f.dt]),
    [
      [0, 10, 0],
      [0.25, 10.5, 0.5],
      [0.5, 11, 0.5],
      [0.75, 11.5, 0.5],
      [1, 12, 0.5],
    ],
  );
  assert.deepEqual(
    [...keyframeIndices({ frames: 5, duration: 1 }).entries()],
    [
      [0, "0"],
      [2, "0.5"],
      [4, "1"],
    ],
  );
});

test("scripted input becomes press, moves and release at the right frames", () => {
  const drag = [{ kind: "drag", from: [0, 0.5], to: [1, 0.5], start: 0.25, end: 0.75 }];
  const at = (i) => inputActions(drag, i, 5);
  assert.deepEqual(at(0), []);
  assert.deepEqual(at(1), [
    { type: "move", x: 0, y: 0.5 },
    { type: "down", button: "left" },
  ]);
  assert.deepEqual(at(2), [{ type: "move", x: 0.5, y: 0.5 }]);
  assert.deepEqual(at(3), [
    { type: "move", x: 1, y: 0.5 },
    { type: "up", button: "left" },
  ]);
  assert.deepEqual(at(4), []);
  const once = [
    { kind: "wheel", at: 0.5, deltaY: -100 },
    { kind: "key", at: 0, key: "Space" },
  ];
  const all = Array.from({ length: 5 }, (_, i) => inputActions(once, i, 5)).flat();
  assert.deepEqual(all, [
    { type: "key", key: "Space" },
    { type: "wheel", x: 0.5, y: 0.5, deltaX: 0, deltaY: -100 },
  ]);
});

test("black-hole camera paths are continuous and end where they say", () => {
  const scene = (id) => BENCH_SCENES.find((s) => s.id === id);
  const dolly = scene("dolly-in");
  close(benchMotion(dolly, 0, 0).pose.distance, 480);
  close(benchMotion(dolly, 1, 6).pose.distance, 3, 1e-9);
  const spin = scene("spin-sweep");
  close(benchMotion(spin, 1, 3).spin, 0.998);
  // A guided tour must not jump between beats.
  const tour = scene("tour-m87");
  const { duration, frames } = tour.script;
  let previous = benchMotion(tour, 0, 0).pose;
  close(previous.distance, benchPose(tour).distance);
  for (let i = 1; i < frames * 4; i++) {
    const t = (i / (frames * 4 - 1)) * duration;
    const pose = benchMotion(tour, t / duration, t).pose;
    assert.ok(Math.abs(Math.log(pose.distance / previous.distance)) < 0.1, `distance jump at ${t}`);
    assert.ok(Math.abs(pose.azimuth - previous.azimuth) < 0.1, `azimuth jump at ${t}`);
    previous = pose;
  }
});

const timing = (median) => ({
  count: 3,
  min: median,
  median,
  p90: median,
  max: median,
  mean: median,
});
const run = (scene, width, ms, extra = {}) => ({
  key: `demo/${scene}@${width}x${width / 2}`,
  target: "demo",
  scene,
  description: `${scene} <scene>`,
  tags: [],
  width,
  height: width / 2,
  kind: "static",
  timer: "gpu",
  ms,
  nsPerPixel: (ms * 1e6) / (width * (width / 2)),
  gpu: timing(ms),
  wall: timing(ms + 0.1),
  submit: timing(0.01),
  mountMs: 2,
  firstFrameMs: 300,
  images: [{ progress: "1", path: `images/demo/${scene}.png` }],
  ...extra,
});

test("reports flag slow frames, serialize measurements and escape HTML", () => {
  const report = {
    version: 2,
    createdAt: "2026-10-16T00:00:00.000Z",
    label: "unit",
    command: "npm run bench",
    machine: { platform: "test", cpu: "CPU", cores: 8, memoryGb: 16, node: "v26" },
    browser: "chromium 1",
    gpu: { renderer: "Test GPU", timerQueries: true },
    options: { sizes: ["800x400", "1600x800"], frames: 3, warmup: 1, time: 0, rounds: 1 },
    runs: [
      run("a", 800, 1),
      run("a", 1600, 3.6),
      run("seq", 800, 1, {
        kind: "sequence",
        sequence: {
          frames: 3,
          duration: 1,
          spikes: [1],
          worst: { index: 1, progress: 0.5, ms: 5 },
          timeline: [0, 0.5, 1].map((progress, i) => ({
            progress,
            gpuMs: i === 1 ? 5 : 1,
            wallMs: 1,
            submitMs: 0.01,
          })),
        },
      }),
    ],
    scaling: [
      {
        target: "demo",
        scene: "a",
        points: [
          { size: "800x400", pixels: 320000, ms: 1 },
          { size: "1600x800", pixels: 1280000, ms: 3.6 },
        ],
        fit: fitScaling([
          { pixels: 320000, ms: 1 },
          { pixels: 1280000, ms: 3.6 },
        ]),
      },
    ],
    findings: [],
    errors: [],
  };
  report.findings = findings(report, { slowdown: null, changed: null });
  assert.ok(report.findings.some((f) => f.key === report.runs[2].key && f.level === "warning"));

  const summary = llmSummary(report);
  assert.equal(summary.runs.length, 3);
  assert.equal(summary.runs[2].spikes, 1);
  const serialized = JSON.stringify(summary); // must survive JSON for scripts and models
  assert.equal(JSON.parse(serialized).gpu, "Test GPU");

  const page = html(report, new Map());
  assert.match(page, /a &lt;scene&gt;/, "template output is escaped");
  assert.doesNotMatch(page, /a <scene>/);
});

test("bench bundle builds with the application's shader loader", async () => {
  const bundle = await buildBenchBundle();
  assert.match(bundle, /__horizonBench/);
  assert.match(bundle, /"black-hole"/);
  assert.match(bundle, /vec3 lensTail\(/, "GLSL includes are expanded");
  assert.doesNotMatch(bundle, /#include <horizon\//);
});

test("fingerprints ignore key order and missing fields, and see every value", () => {
  assert.equal(
    stableStringify({ b: 1, a: { d: [2, 1], c: undefined } }),
    '{"a":{"d":[2,1]},"b":1}',
  );
  assert.equal(fingerprint({ a: 1, b: 2 }), fingerprint({ b: 2, a: 1 }));
  assert.notEqual(fingerprint({ a: 1, b: 2 }), fingerprint({ a: 1, b: 3 }));
  assert.match(fingerprint("x"), /^[0-9a-f]{12}$/);
  assert.deepEqual(
    diffFields(
      "settings",
      { frames: 30, rounds: 2, settle: undefined },
      { frames: 20, rounds: 2, settle: 0 },
    ),
    [{ scope: "settings", field: "frames", before: 30, after: 20 }],
  );
});

const settings = {
  frames: 30,
  warmup: 5,
  time: 12,
  rounds: 1,
  settle: 2000,
  trace: false,
  profile: false,
};
const environment = { gpu: "GPU A", browser: "chromium 1", cpu: "CPU", platform: "test" };
const fingerprinted = (overrides, runs) => ({
  version: 3,
  createdAt: "2026-10-16T00:00:00.000Z",
  label: "x",
  command: "npm run bench",
  machine: { platform: "test", cpu: "CPU", cores: 8, memoryGb: 16, node: "v26" },
  browser: "chromium 1",
  gpu: { renderer: "GPU A", timerQueries: true },
  options: { sizes: ["800x400"], frames: 30, warmup: 5, time: 12, rounds: 1 },
  fingerprints: fingerprints(
    { ...settings, ...overrides.settings },
    { ...environment, ...overrides.environment },
    overrides.code ?? "bundle",
  ),
  runs,
  scaling: [],
  findings: [],
  errors: [],
});

test("comparisons say when settings, environment or a scene differ", async () => {
  const before = [
    run("a", 800, 1, { sceneHash: "aaa" }),
    run("b", 800, 2, { sceneHash: "bbb" }),
    run("c", 800, 1),
  ];
  const same = fingerprinted({}, [
    run("a", 800, 1.1, { sceneHash: "aaa" }),
    run("b", 800, 2, { sceneHash: "bbb" }),
  ]);
  const budgets = { slowdown: null, changed: null };
  const baseline = fingerprinted({}, before);
  const alike = await compare(same, "/tmp/out", "/tmp/base", baseline, () => true, budgets);
  assert.equal(alike.likeForLike, true);
  assert.equal(alike.sameCode, true);
  assert.deepEqual(alike.missing, ["demo/c@800x400"]);
  assert.deepEqual(comparisonWarnings(alike), []);
  close(alike.rows[0].deltaPct, 10, 1e-9);

  const skewed = fingerprinted(
    { settings: { frames: 10 }, environment: { gpu: "GPU B" }, code: "changed" },
    [
      run("a", 800, 1, { sceneHash: "aaa" }),
      run("b", 800, 2, { sceneHash: "b2" }),
      run("d", 800, 1),
    ],
  );
  const unlike = await compare(
    skewed,
    "/tmp/out",
    "/tmp/base",
    baseline,
    (r) => r.scene !== "c",
    budgets,
  );
  assert.equal(unlike.likeForLike, false);
  assert.equal(unlike.sameCode, false);
  assert.deepEqual(unlike.changedScenes, ["demo/b@800x400"]);
  assert.deepEqual(unlike.missing, [], "runs outside the selection are not missing");
  assert.deepEqual(unlike.added, ["demo/d@800x400"]);
  assert.deepEqual(
    unlike.mismatches.map((m) => `${m.scope}.${m.field}`),
    ["settings.frames", "environment.gpu"],
  );
  const warnings = comparisonWarnings(unlike);
  assert.equal(warnings.length, 3);
  skewed.comparison = unlike;
  assert.equal(llmSummary(skewed).comparison.likeForLike, false);

  // Reports from before fingerprints still compare, with a note.
  const legacy = { ...baseline, version: 2, fingerprints: undefined };
  const old = await compare(same, "/tmp/out", "/tmp/base", legacy, () => true, budgets);
  assert.equal(old.legacy, true);
  assert.equal(old.likeForLike, false, "an unverifiable baseline is not like for like");
  assert.equal(old.sameCode, null);
  assert.deepEqual(old.mismatches, [], "fields the old report lacks are not mismatches");
});
