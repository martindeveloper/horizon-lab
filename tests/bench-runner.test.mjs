import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseCli, parseSizes } from "../bench/cli.ts";
import { buildRun, createAccumulator, pooledTimeline, runInteractive } from "../bench/measure.ts";

test("bench sizes are canonical, unique and positive", () => {
  assert.deepEqual(parseSizes(" 01280x0720,1280x720,640x360 "), [
    { size: "1280x720", width: 1280, height: 720 },
    { size: "640x360", width: 640, height: 360 },
  ]);
  assert.equal(parseSizes("matrix").length, 4);
  for (const value of [
    "",
    "0x720",
    "1280x0",
    "1.5x720",
    "-1x720",
    "Infinityx720",
    "999999999999999999x720",
  ])
    assert.throws(() => parseSizes(value), /positive integer dimensions/);
});

test("bench CLI keeps defaults and rejects invalid arguments before opening a browser", () => {
  const config = parseCli([]);
  assert.equal(config.options.frames, 30);
  assert.equal(config.options.minMs, 500);
  assert.equal(config.settings.settle, 2000);
  assert.equal(config.rounds, 1);
  assert.equal(config.options.capture, true);
  assert.deepEqual(config.sizes, ["1280x720"]);
  assert.deepEqual(parseCli(["--help"]), { help: true });
  assert.throws(() => parseCli(["--compare", "old", "--baseline", "old"]), /not both/);
  for (const value of ["NaN", "Infinity", "-1", " "])
    assert.throws(() => parseCli([`--frames=${value}`]), /non-negative number/);
});

test("replay inherits measurement settings while explicit options take precedence", (t) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "horizon-bench-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const settings = {
    frames: 60,
    minTime: 700,
    warmup: 8,
    time: 20,
    rounds: 3,
    settle: 1000,
    trace: true,
    profile: true,
  };
  writeFileSync(
    path.join(directory, "report.json"),
    JSON.stringify({
      version: 3,
      createdAt: "2026-10-16T00:00:00Z",
      options: { ...settings, sizes: ["640x360", "1280x720"] },
      fingerprints: { settings: { values: settings } },
      runs: [],
      scaling: [],
      findings: [],
      errors: [],
    }),
  );
  const replay = parseCli(["--compare", directory]);
  assert.deepEqual(replay.settings, settings);
  assert.deepEqual(replay.sizes, ["640x360", "1280x720"]);
  const override = parseCli([
    "--compare",
    directory,
    "--frames",
    "10",
    "--sizes",
    "640x360",
    "--no-images",
  ]);
  assert.equal(override.settings.frames, 10);
  assert.equal(override.settings.warmup, 8);
  assert.equal(override.options.capture, false);
  assert.deepEqual(override.sizes, ["640x360"]);
  assert.equal(parseCli(["--baseline", directory]).options.frames, 30);
});

test("pooled frames use per-frame medians and fall back when GPU samples are missing", async () => {
  const frame = (gpuMs, wallMs) => ({ progress: 0, gpuMs, wallMs, submitMs: 0.1 });
  const timelines = [[frame(1, 2)], [frame(null, 3)], [frame(100, 101)]];
  assert.deepEqual(pooledTimeline(timelines), [frame(null, 3)]);
  const samples = createAccumulator();
  samples.mountMs = [2, 1];
  samples.firstFrameMs = [20, 10];
  samples.gpu = [1, null, 100];
  samples.wall = [2, 3, 101];
  samples.submit = [0.1, 0.1, 0.1];
  const result = await buildRun(
    {
      target: "demo",
      scene: { id: "static", description: "Static scene" },
      sceneHash: "hash",
      width: 100,
      height: 100,
      size: "100x100",
      key: "demo/static@100x100",
    },
    samples,
    "/unused",
  );
  assert.equal(result.timer, "cpu");
  assert.equal(result.ms, 3);
  assert.equal(result.gpu, null);
  assert.equal(result.mountMs, 1);
  assert.equal(result.firstFrameMs, 20);
});

test("interactive measurement closes the scene after a failed frame", async () => {
  const calls = [];
  const page = {
    async evaluate(_callback, [method]) {
      calls.push(method);
      if (method === "open") return { environment: {}, mountMs: 1 };
      if (method === "warm") return 1;
      if (method === "frame") throw new Error("frame failed");
      if (method === "close") return { gpuMs: [] };
      assert.fail(`Unexpected runtime call: ${method}`);
    },
  };
  await assert.rejects(
    runInteractive(
      page,
      {
        target: "demo",
        scene: { id: "sequence", script: { frames: 2, duration: 1 } },
      },
      { time: 0, warmup: 0, capture: false },
      createAccumulator(),
    ),
    /frame failed/,
  );
  assert.deepEqual(calls, ["open", "warm", "frame", "close"]);
});
