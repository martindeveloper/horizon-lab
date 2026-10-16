import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import type { Browser, Page } from "playwright-core";

import {
  findSpikes,
  fitScaling,
  inputActions,
  keyframeIndices,
  sequenceFrames,
  staticFrame,
  summarizeTimings,
  type BenchEnvironment,
  type BenchOptions,
  type BenchScene,
  type FrameGrab,
  type GrabDraw,
} from "@horizon/toolkit/bench";

import { call, dispatchInput, launchBrowser, openBenchPage } from "./browser";
import { buildBenchBundle, discoverTargets, ROOT } from "./build";
import { compare, loadReport, settingsOf } from "./compare";
import { fingerprint, fingerprints, type BenchSettings } from "./fingerprint";
import { html } from "./html";
import { writeDataUrl, writeLossless } from "./images";
import {
  findings,
  llmSummary,
  markdown,
  type Report,
  type Run,
  type Scaling,
  type TimelineFrame,
} from "./report";

const HELP = `Headless rendering bench: timings, images, sequences, frame grabs, reports.

Usage: npm run bench -- [options]

Selection
  -t, --target <id>      Target to run (repeatable). Default: every src/features/*/bench.ts
  -s, --scene <id|tag:x> Scene id or tag (repeatable), e.g. -s m87 -s tag:sequence
      --sizes <list|set> Sizes, e.g. 1280x720,1920x1080, or a set:
                         default (1280x720), matrix (640x360 → 2560x1440),
                         full (matrix + 3840x2160 + 1179x2556 phone portrait)
      --list             List targets and scenes, then exit

Measurement
      --frames <n>       Timed frames per static scene, at least (default 30)
      --min-time <ms>    Keep timing a static scene at least this long (default 500)
      --warmup <n>       Untimed frames after the first (default 5)
      --time <s>         Simulation time of static frames and sequence starts (default 12)
      --rounds <n>       Repeat everything n times, interleaved, and pool frames (default 1)
      --settle <ms>      Load the GPU this long before measuring, so clocks are up (default 2000)

Investigation
      --grab             Frame grab per run: every WebGL call, per-draw GPU time,
                         uniforms, render target after each draw, compiled shaders
      --trace            Chrome performance trace per run (open in Perfetto or DevTools)
      --profile          JavaScript CPU profile per run (.cpuprofile, open in DevTools)
      --no-images        Skip image capture (untimed, so it does not change timings)

Comparison
      --compare <dir>    Re-run exactly what an earlier run measured (its scenes, sizes,
                         frames, warm-up, rounds, settle, trace and profile settings)
                         and compare with it. -t, -s and --sizes narrow the replay.
      --baseline <dir>   Compare this run, configured as given, with an earlier one
      --strict           Exit 1 when the comparison is not like for like
      --max-slowdown <%> Exit 1 when a median grows by more than this
      --max-changed <%>  Exit 1 when more than this share of pixels changes

Output
      --out <dir>        Results directory (default bench-results/<timestamp>[-label])
      --label <name>     Name for this run
      --browser <name>   chrome, msedge, chromium or an executable path
      --headed           Show the browser window
  -h, --help

Writes report.json (all data), summary.json (compact, for scripts and LLMs),
report.md and index.html (images, charts, grabs) to the results directory.
Every report carries fingerprints of its settings, environment, scenes and code;
comparisons warn when settings, environment or a scene's definition differ.
`;

const SIZE_SETS: Record<string, string[]> = {
  default: ["1280x720"],
  matrix: ["640x360", "1280x720", "1920x1080", "2560x1440"],
  full: ["640x360", "1280x720", "1920x1080", "2560x1440", "3840x2160", "1179x2556"],
};

const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "toplevel",
  "blink",
  "v8",
  "cc",
  "viz",
  "gpu",
  "disabled-by-default-gpu.service",
];

const STATE =
  /^(enable|disable|blend|depth|cull|bind|useProgram|viewport|scissor|colorMask|stencil|activeTexture|pixelStorei|frontFace|polygonOffset|vertexAttrib)/;

const write = (text = "") => process.stdout.write(`${text}\n`);
const fixed = (value: number, digits = 2) => value.toFixed(digits);
const median = (values: number[]) => summarizeTimings(values).median;

function number(value: string | undefined, fallback: number, name: string) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`--${name} needs a number`);
  return parsed;
}

function table(header: string[], rows: string[][]) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)));
  const pad = (cells: string[]) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join("  ");
  write(pad(header));
  write(widths.map((w) => "─".repeat(w)).join("  "));
  for (const row of rows) write(pad(row));
}

type Job = {
  target: string;
  scene: BenchScene;
  /** Fingerprint of the full scene definition the target reported. */
  sceneHash: string;
  width: number;
  height: number;
  key: string;
  size: string;
};

/** Everything measured for one job, pooled across rounds. */
type Accumulator = {
  environment?: BenchEnvironment;
  mountMs: number[];
  firstFrameMs: number[];
  gpu: (number | null)[];
  wall: number[];
  submit: number[];
  timelines: TimelineFrame[][];
  facts?: Record<string, number | string | boolean>;
  heap?: { before: number; after: number };
  images: Record<string, string>;
};

function selectScenes(scenes: readonly BenchScene[], filters: string[]) {
  if (filters.length === 0) return scenes;
  return scenes.filter((scene) =>
    filters.some((filter) =>
      filter.startsWith("tag:") ? scene.tags?.includes(filter.slice(4)) : filter === scene.id,
    ),
  );
}

async function runStatic(page: Page, job: Job, options: BenchOptions, acc: Accumulator) {
  const result = await call(page, "run", job.target, job.scene.id, options);
  acc.environment = result.environment;
  acc.mountMs.push(result.mountMs);
  acc.firstFrameMs.push(result.firstFrameMs);
  for (const frame of result.frames) {
    acc.gpu.push(frame.gpuMs);
    acc.wall.push(frame.wallMs);
    acc.submit.push(frame.submitMs);
  }
  const latestFacts = result.facts?.at(-1) ?? acc.facts;
  if (latestFacts !== undefined) acc.facts = latestFacts;
  Object.assign(acc.images, result.images);
}

/** A sequence without input: every frame rendered back to back inside the page. */
async function runScripted(page: Page, job: Job, options: BenchOptions, acc: Accumulator) {
  const result = await call(page, "sequence", job.target, job.scene.id, options);
  const frames = sequenceFrames(job.scene.script!, options.time);
  acc.environment = result.environment;
  acc.mountMs.push(result.mountMs);
  acc.firstFrameMs.push(result.firstFrameMs);
  const timeline = result.frames.map((frame, i): TimelineFrame => {
    const facts = result.facts?.[i];
    return {
      progress: frames[i]?.progress ?? 0,
      gpuMs: frame.gpuMs,
      wallMs: frame.wallMs,
      submitMs: frame.submitMs,
      ...(facts !== undefined ? { facts } : {}),
    };
  });
  for (const frame of timeline) {
    acc.gpu.push(frame.gpuMs);
    acc.wall.push(frame.wallMs);
    acc.submit.push(frame.submitMs);
  }
  acc.timelines.push(timeline);
  const latestFacts = timeline.at(-1)?.facts ?? acc.facts;
  if (latestFacts !== undefined) acc.facts = latestFacts;
  Object.assign(acc.images, result.images);
}

/**
 * A sequence with input, frame by frame: the harness delivers trusted events
 * between frames. The GPU idles during each round trip, so expect noisier
 * times than in-page sequences.
 */
async function runInteractive(page: Page, job: Job, options: BenchOptions, acc: Accumulator) {
  const script = job.scene.script!;
  const frames = sequenceFrames(script, options.time);
  const keyframes = keyframeIndices(script);
  const opened = await call(page, "open", job.target, job.scene.id, options);
  acc.environment = opened.environment;
  acc.mountMs.push(opened.mountMs);
  const timeline: TimelineFrame[] = [];
  let closed: Awaited<ReturnType<typeof call<"close">>> | undefined;
  try {
    acc.firstFrameMs.push(await call(page, "warm", frames[0]!));
    for (let i = 0; i < options.warmup; i++) await call(page, "warm", frames[0]!);
    for (const frame of frames) {
      const actions = inputActions(script.input ?? [], frame.index, frame.count);
      if (actions.length) await dispatchInput(page, actions, job.width, job.height);
      const capture = options.capture && keyframes.has(frame.index);
      const result = await call(page, "frame", frame, capture);
      timeline.push({
        progress: frame.progress,
        gpuMs: null,
        wallMs: result.wallMs,
        submitMs: result.submitMs,
        ...(result.facts !== undefined ? { facts: result.facts } : {}),
      });
      if (result.image) acc.images[keyframes.get(frame.index)!] = result.image;
    }
  } finally {
    closed = await call(page, "close");
  }
  closed.gpuMs.forEach((gpu, i) => {
    if (timeline[i]) timeline[i].gpuMs = gpu;
  });
  for (const frame of timeline) {
    acc.gpu.push(frame.gpuMs);
    acc.wall.push(frame.wallMs);
    acc.submit.push(frame.submitMs);
  }
  acc.timelines.push(timeline);
  const latestFacts = timeline.at(-1)?.facts ?? acc.facts;
  if (latestFacts !== undefined) acc.facts = latestFacts;
}

/** Median of each frame across rounds, so one round's hitch does not define the timeline. */
function pooledTimeline(timelines: TimelineFrame[][]): TimelineFrame[] {
  const first = timelines[0] ?? [];
  return first.map((frame, i) => {
    const at = timelines.map((t) => t[i]).filter((t): t is TimelineFrame => Boolean(t));
    const gpu = at.map((t) => t.gpuMs);
    return {
      progress: frame.progress,
      gpuMs: gpu.every((g): g is number => g !== null) ? median(gpu) : null,
      wallMs: median(at.map((t) => t.wallMs)),
      submitMs: median(at.map((t) => t.submitMs)),
      ...(frame.facts !== undefined ? { facts: frame.facts } : {}),
    };
  });
}

async function buildRun(job: Job, acc: Accumulator, outDir: string): Promise<Run> {
  const gpuSamples = acc.gpu.every((g): g is number => g !== null) ? acc.gpu : [];
  const gpu = gpuSamples.length ? summarizeTimings(gpuSamples) : null;
  const wall = summarizeTimings(acc.wall);
  const submit = summarizeTimings(acc.submit);
  const timer = gpu ? "gpu" : "cpu";
  const ms = (gpu ?? wall).median;
  const images = await Promise.all(
    Object.entries(acc.images)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(async ([progress, dataUrl]) => {
        const suffix = job.scene.script ? `~${progress}` : "";
        const file = path.join("images", job.target, `${job.scene.id}@${job.size}${suffix}.webp`);
        await writeLossless(path.join(outDir, file), dataUrl);
        return { progress, path: file };
      }),
  );
  let sequence: Run["sequence"];
  if (job.scene.script) {
    const timeline = pooledTimeline(acc.timelines);
    const values = timeline.map((t) => (timer === "gpu" ? (t.gpuMs ?? t.wallMs) : t.wallMs));
    const spikes = findSpikes(values);
    const worstIndex = values.indexOf(Math.max(...values));
    sequence = {
      frames: timeline.length,
      duration: job.scene.script.duration,
      spikes,
      worst: {
        index: worstIndex,
        progress: timeline[worstIndex]?.progress ?? 0,
        ms: values[worstIndex] ?? 0,
      },
      timeline,
    };
  }
  return {
    key: job.key,
    target: job.target,
    scene: job.scene.id,
    description: job.scene.description,
    tags: job.scene.tags ?? [],
    width: job.width,
    height: job.height,
    kind: job.scene.script ? "sequence" : "static",
    timer,
    ms,
    nsPerPixel: (ms * 1e6) / (job.width * job.height),
    gpu,
    wall,
    submit,
    mountMs: Math.min(...acc.mountMs),
    firstFrameMs: acc.firstFrameMs[0] ?? 0,
    ...(acc.heap !== undefined ? { heap: acc.heap } : {}),
    ...(acc.facts !== undefined ? { facts: acc.facts } : {}),
    ...(sequence !== undefined ? { sequence } : {}),
    images,
    sceneHash: job.sceneHash,
  };
}

/** Records one steady-state frame call by call and writes its artifacts. */
async function grab(page: Page, job: Job, options: BenchOptions, outDir: string) {
  const script = job.scene.script;
  const frame = script
    ? sequenceFrames(script, options.time)[Math.floor((script.frames - 1) / 2)]!
    : staticFrame(options.time);
  await call(page, "open", job.target, job.scene.id, { ...options, capture: false });
  let result: FrameGrab;
  try {
    for (let i = 0; i <= options.warmup; i++) await call(page, "warm", frame);
    result = await call(page, "grab", frame, {
      snapshots: true,
      thumbWidth: 480,
      maxSnapshots: 48,
      maxCalls: 6000,
    });
  } finally {
    await call(page, "close");
  }
  const dir = path.join("grabs", job.target, `${job.scene.id}@${job.size}`);
  const abs = path.join(outDir, dir);
  mkdirSync(path.join(abs, "shaders"), { recursive: true });
  const draws: GrabDraw[] = result.draws.map((draw) => {
    if (!draw.snapshot) return draw;
    const file = path.join("draws", `${String(draw.index).padStart(3, "0")}.png`);
    writeDataUrl(path.join(abs, file), draw.snapshot);
    return { ...draw, snapshot: path.join(dir, file) };
  });
  for (const program of result.programs)
    for (const shader of program.shaders) {
      const base = path.join(abs, "shaders", `${program.id.replace("#", "-")}.${shader.type}`);
      writeFileSync(`${base}.glsl`, shader.source);
      if (shader.translated) writeFileSync(`${base}.translated.txt`, shader.translated);
    }
  const stored = {
    ...result,
    draws: draws.map((d) => ({
      ...d,
      snapshot: d.snapshot ? path.relative(dir, d.snapshot) : undefined,
    })),
    programs: result.programs.map((p) => ({
      ...p,
      shaders: p.shaders.map((s) => ({
        type: s.type,
        file: `shaders/${p.id.replace("#", "-")}.${s.type}.glsl`,
        translated: s.translated
          ? `shaders/${p.id.replace("#", "-")}.${s.type}.translated.txt`
          : null,
        lines: s.source.split("\n").length,
        compileMs: s.compileMs ?? null,
      })),
    })),
  };
  writeFileSync(path.join(abs, "grab.json"), `${JSON.stringify(stored, null, 1)}\n`);
  const gpuTimes = draws.map((d) => d.gpuMs);
  return {
    draws,
    summary: {
      dir,
      draws: result.draws.length,
      calls: Object.values(result.counts).reduce((a, b) => a + b, 0),
      programs: result.programs.length,
      passes: result.passes,
      drawGpuMs:
        gpuTimes.length && gpuTimes.every((g): g is number => g !== null)
          ? gpuTimes.reduce((a, b) => a + b, 0)
          : null,
      uploads: result.uploads,
      stateChanges: Object.entries(result.counts)
        .filter(([name]) => STATE.test(name))
        .reduce((sum, [, n]) => sum + n, 0),
      shaders: result.programs.flatMap((p) =>
        p.shaders.map((s) => ({
          program: p.id,
          type: s.type,
          lines: s.source.split("\n").length,
          bytes: Buffer.byteLength(s.source),
          translatedBytes: s.translated ? Buffer.byteLength(s.translated) : null,
          compileMs: s.compileMs ?? null,
        })),
      ),
      errors: result.errors,
    },
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      target: { type: "string", short: "t", multiple: true },
      scene: { type: "string", short: "s", multiple: true },
      list: { type: "boolean" },
      sizes: { type: "string" },
      size: { type: "string" },
      frames: { type: "string" },
      "min-time": { type: "string" },
      warmup: { type: "string" },
      time: { type: "string" },
      rounds: { type: "string" },
      settle: { type: "string" },
      grab: { type: "boolean" },
      trace: { type: "boolean" },
      profile: { type: "boolean" },
      "no-images": { type: "boolean" },
      out: { type: "string" },
      label: { type: "string" },
      baseline: { type: "string" },
      compare: { type: "string" },
      strict: { type: "boolean" },
      "max-slowdown": { type: "string" },
      "max-changed": { type: "string" },
      browser: { type: "string" },
      headed: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) return write(HELP);
  if (values.compare && values.baseline)
    throw new Error(
      "Use --compare (replay an earlier run) or --baseline (compare as configured), not both",
    );

  // --compare replays the earlier run's settings; explicit options still win, and show as mismatches.
  const baselineDir = values.compare ?? values.baseline;
  const previous = baselineDir ? loadReport(path.resolve(baselineDir)) : null;
  const prior = values.compare && previous ? settingsOf(previous) : {};
  const priorSizes = values.compare && previous ? previous.options.sizes : null;

  const sizeArg = values.sizes ?? values.size ?? priorSizes?.join(",") ?? "default";
  const sizes = (SIZE_SETS[sizeArg] ?? sizeArg.split(",")).map((s) => s.trim());
  const parsedSizes = sizes.map((size) => {
    const match = size.match(/^(\d+)x(\d+)$/);
    if (!match)
      throw new Error(`Size "${size}" must look like 1280x720, or use default, matrix or full`);
    return { size, width: Number(match[1]), height: Number(match[2]) };
  });
  const options: BenchOptions = {
    width: 0,
    height: 0,
    frames: Math.max(1, Math.round(number(values.frames, prior.frames ?? 30, "frames"))),
    warmup: Math.round(number(values.warmup, prior.warmup ?? 5, "warmup")),
    time: number(values.time, prior.time ?? 12, "time"),
    minMs: number(values["min-time"], prior.minTime ?? 500, "min-time"),
    capture: !values["no-images"],
  };
  const rounds = Math.max(1, Math.round(number(values.rounds, prior.rounds ?? 1, "rounds")));
  const settings: BenchSettings = {
    frames: options.frames,
    minTime: options.minMs,
    warmup: options.warmup,
    time: options.time,
    rounds,
    settle: number(values.settle, prior.settle ?? 2000, "settle"),
    trace: values.trace ?? prior.trace ?? false,
    profile: values.profile ?? prior.profile ?? false,
  };
  const budgets = {
    slowdown:
      values["max-slowdown"] === undefined
        ? null
        : number(values["max-slowdown"], 0, "max-slowdown"),
    changed:
      values["max-changed"] === undefined ? null : number(values["max-changed"], 0, "max-changed"),
  };

  const available = discoverTargets();
  const wanted =
    values.target ??
    (values.compare && previous
      ? [...new Set(previous.runs.map((r) => r.target))]
      : available.map((t) => t.id));
  const unknown = wanted.filter((id) => !available.some((t) => t.id === id));
  if (unknown.length && !values.compare) throw new Error(`Unknown target ${unknown.join(", ")}`);
  const targets = available.filter((t) => wanted.includes(t.id));

  write(`Bundling ${targets.map((t) => t.id).join(", ")}…`);
  const bundle = await buildBenchBundle(targets);
  const browser: Browser = await launchBrowser(values.browser, Boolean(values.headed));
  try {
    const page = await openBenchPage(browser, bundle);
    const listing = await call(page, "list");
    if (values.list) {
      for (const target of listing) {
        write(target.id);
        for (const scene of target.scenes) {
          const seq = scene.script
            ? ` (${scene.script.frames} frames${scene.script.input?.length ? ", input" : ""})`
            : "";
          const tags = scene.tags?.length ? `  [${scene.tags.join(", ")}]` : "";
          write(`  ${scene.id.padEnd(24)} ${scene.description}${seq}${tags}`);
        }
      }
      return;
    }

    const job = (target: string, scene: BenchScene, size: (typeof parsedSizes)[number]): Job => ({
      target,
      scene,
      sceneHash: fingerprint({ target, scene }),
      width: size.width,
      height: size.height,
      size: size.size,
      key: `${target}/${scene.id}@${size.size}`,
    });
    const sceneFilters = values.scene ?? [];
    const sizeFilter = new Set(parsedSizes.map((s) => s.size));
    /** Whether a baseline run falls inside this run's selection (for "not measured" reports). */
    const expected = (run: Run) =>
      wanted.includes(run.target) &&
      sizeFilter.has(`${run.width}x${run.height}`) &&
      selectScenes([{ id: run.scene, description: "", tags: run.tags }], sceneFilters).length > 0;
    const jobs: Job[] =
      values.compare && previous
        ? // Replay the earlier run's own list, in its order.
          previous.runs.filter(expected).flatMap((run) => {
            const scene = listing
              .find((t) => t.id === run.target)
              ?.scenes.find((s) => s.id === run.scene);
            const size = parsedSizes.find((s) => s.size === `${run.width}x${run.height}`);
            return scene && size ? [job(run.target, scene, size)] : [];
          })
        : parsedSizes.flatMap((size) =>
            listing.flatMap((target) =>
              selectScenes(target.scenes, sceneFilters).map((scene) => job(target.id, scene, size)),
            ),
          );
    if (jobs.length === 0) throw new Error("No scenes match the selection");

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outDir = path.resolve(
      values.out ??
        path.join(ROOT, "bench-results", values.label ? `${stamp}-${values.label}` : stamp),
    );
    mkdirSync(outDir, { recursive: true });
    const browserName = `${browser.browserType().name()} ${browser.version()}`;
    write(
      `${browserName} · ${jobs.length} run(s) · ${sizes.join(", ")} · ${rounds} round(s) → ${path.relative(process.cwd(), outDir)}`,
    );

    // A cold GPU idles at low clocks; the first scenes would otherwise look slow.
    const settleMs = settings.settle;
    if (settleMs > 0) {
      const first = jobs[0]!;
      process.stdout.write(`Settling the GPU for ${settleMs} ms … `);
      await page.setViewportSize({ width: first.width, height: first.height });
      await call(page, "open", first.target, first.scene.id, {
        ...options,
        width: first.width,
        height: first.height,
        capture: false,
      });
      const frame = staticFrame(options.time);
      const until = Date.now() + settleMs;
      while (Date.now() < until) await call(page, "warm", frame);
      await call(page, "close");
      write("done");
    }

    const pooled = new Map<string, Accumulator>();
    const errors: Report["errors"] = [];
    const traces = new Map<string, string>();
    const profiles = new Map<string, string>();
    // DevTools protocol: garbage-collected heap readings, and CPU profiles on request.
    const cdp = await page.context().newCDPSession(page);
    if (settings.profile) await cdp.send("Profiler.enable");
    const heapUsed = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      return (await cdp.send("Runtime.getHeapUsage")).usedSize;
    };
    for (let round = 0; round < rounds; round++) {
      if (rounds > 1) write(`Round ${round + 1}/${rounds}`);
      const last = round === rounds - 1;
      for (const job of jobs) {
        if (errors.some((e) => e.key === job.key)) continue;
        process.stdout.write(`  ${job.key} … `);
        const acc =
          pooled.get(job.key) ??
          ({
            mountMs: [],
            firstFrameMs: [],
            gpu: [],
            wall: [],
            submit: [],
            timelines: [],
            images: {},
          } satisfies Accumulator);
        pooled.set(job.key, acc);
        const runOptions = {
          ...options,
          width: job.width,
          height: job.height,
          capture: options.capture && last,
        };
        const safe = job.key.replace(/[/@]/g, "_");
        try {
          await page.setViewportSize({ width: job.width, height: job.height });
          if (settings.trace && last)
            await browser.startTracing(page, { categories: TRACE_CATEGORIES, screenshots: false });
          const heapBefore = last ? await heapUsed() : 0;
          if (settings.profile && last) await cdp.send("Profiler.start");
          if (job.scene.script?.input?.length) await runInteractive(page, job, runOptions, acc);
          else if (job.scene.script) await runScripted(page, job, runOptions, acc);
          else await runStatic(page, job, runOptions, acc);
          if (last) acc.heap = { before: heapBefore, after: await heapUsed() };
          if (settings.profile && last) {
            const { profile } = await cdp.send("Profiler.stop");
            const file = path.join("profiles", `${safe}.cpuprofile`);
            mkdirSync(path.join(outDir, "profiles"), { recursive: true });
            writeFileSync(path.join(outDir, file), JSON.stringify(profile));
            profiles.set(job.key, file);
          }
          if (settings.trace && last) {
            const trace = await browser.stopTracing();
            const file = path.join("traces", `${safe}.json`);
            mkdirSync(path.join(outDir, "traces"), { recursive: true });
            writeFileSync(path.join(outDir, file), trace);
            traces.set(job.key, file);
          }
          const latest = acc.timelines.at(-1);
          const frameMs = latest
            ? median(latest.map((t) => t.gpuMs ?? t.wallMs))
            : median(acc.gpu.every((g): g is number => g !== null) ? acc.gpu : acc.wall);
          write(`${fixed(frameMs)} ms`);
        } catch (error) {
          const message = String(error instanceof Error ? error.message : error).split("\n")[0]!;
          write(`failed: ${message}`);
          errors.push({ key: job.key, message });
        }
      }
    }

    const runs: Run[] = [];
    const grabDraws = new Map<string, GrabDraw[]>();
    for (const job of jobs) {
      const acc = pooled.get(job.key);
      if (!acc || acc.wall.length === 0) continue;
      const run = await buildRun(job, acc, outDir);
      const trace = traces.get(job.key);
      const profile = profiles.get(job.key);
      if (trace !== undefined) run.trace = trace;
      if (profile !== undefined) run.profile = profile;
      if (values.grab) {
        process.stdout.write(`  grab ${job.key} … `);
        try {
          await page.setViewportSize({ width: job.width, height: job.height });
          const grabbed = await grab(
            page,
            job,
            { ...options, width: job.width, height: job.height },
            outDir,
          );
          run.grab = grabbed.summary;
          grabDraws.set(job.key, grabbed.draws);
          write(`${grabbed.summary.calls} calls, ${grabbed.summary.draws} draws`);
        } catch (error) {
          const message = String(error instanceof Error ? error.message : error).split("\n")[0]!;
          write(`failed: ${message}`);
          errors.push({ key: `${job.key} (grab)`, message });
        }
      }
      runs.push(run);
    }

    const scaling: Scaling[] = [];
    if (parsedSizes.length > 1) {
      const groups = new Map<string, Run[]>();
      for (const run of runs) {
        const id = `${run.target}/${run.scene}`;
        groups.set(id, [...(groups.get(id) ?? []), run]);
      }
      for (const group of groups.values()) {
        const points = group.map((r) => ({
          size: `${r.width}x${r.height}`,
          pixels: r.width * r.height,
          ms: r.ms,
        }));
        const fit = fitScaling(points);
        if (fit) scaling.push({ target: group[0]!.target, scene: group[0]!.scene, points, fit });
      }
    }

    const machine = {
      platform: `${os.type()} ${os.release()} ${process.arch}`,
      cpu: os.cpus()[0]?.model ?? "unknown CPU",
      cores: os.cpus().length,
      memoryGb: Math.round(os.totalmem() / 1e9),
      node: process.version,
    };
    const gpu = [...pooled.values()].find((a) => a.environment)?.environment ?? null;
    const report: Report = {
      version: 3,
      createdAt: new Date().toISOString(),
      label: values.label ?? null,
      command: `npm run bench -- ${process.argv.slice(2).join(" ")}`.trim(),
      machine,
      browser: browserName,
      gpu,
      fingerprints: fingerprints(
        settings,
        {
          gpu: gpu?.renderer ?? "unknown",
          browser: browserName,
          cpu: machine.cpu,
          platform: machine.platform,
        },
        bundle,
      ),
      options: {
        sizes,
        frames: options.frames,
        warmup: options.warmup,
        time: options.time,
        rounds,
      },
      runs,
      scaling,
      findings: [],
      errors,
    };
    if (previous && baselineDir)
      report.comparison = await compare(
        report,
        outDir,
        path.resolve(baselineDir),
        previous,
        expected,
        budgets,
      );
    report.findings = findings(report, budgets);

    writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 1)}\n`);
    writeFileSync(
      path.join(outDir, "summary.json"),
      `${JSON.stringify(llmSummary(report), null, 1)}\n`,
    );
    writeFileSync(path.join(outDir, "report.md"), markdown(report));
    writeFileSync(path.join(outDir, "index.html"), html(report, grabDraws));

    write();
    write(`GPU: ${report.gpu?.renderer ?? "unknown"}`);
    write();
    table(
      ["run", "median ms", "p90 ms", "submit ms", "ns/px", "timer", "worst ms"],
      runs.map((r) => [
        r.key,
        fixed(r.ms),
        fixed((r.gpu ?? r.wall).p90),
        fixed(r.submit.median),
        fixed(r.nsPerPixel, 1),
        r.timer,
        r.sequence ? fixed(r.sequence.worst.ms) : "",
      ]),
    );
    if (report.comparison) {
      write();
      const c = report.comparison;
      const code = c.sameCode === null ? "" : c.sameCode ? ", same code" : ", code changed";
      write(
        `Against ${c.label ?? c.createdAt}: ${c.likeForLike ? "like for like" : "NOT like for like (see warnings)"}${code}`,
      );
      table(
        ["run", "before", "after", "Δ", "pixels changed", "scene"],
        report.comparison.rows.map((row) => [
          row.key,
          fixed(row.beforeMs),
          fixed(row.afterMs),
          `${row.deltaPct >= 0 ? "+" : ""}${fixed(row.deltaPct, 1)}%${row.slower ? " ✗" : ""}`,
          row.image === null
            ? "–"
            : row.image === "size"
              ? "size"
              : `${fixed(row.image.changed * 100, 2)}%${row.changed ? " ✗" : ""}`,
          row.sceneChanged ? "changed ⚠" : row.sceneChanged === null ? "?" : "same",
        ]),
      );
    }
    if (report.findings.length) {
      write();
      for (const finding of report.findings)
        write(
          `${finding.level.padEnd(10)} ${finding.key ? `${finding.key}: ` : ""}${finding.message}`,
        );
    }
    write();
    const rel = path.relative(process.cwd(), outDir) || ".";
    write(
      `Report: ${path.join(rel, "index.html")} · ${path.join(rel, "report.md")} · ${path.join(rel, "summary.json")}`,
    );
    const unlike = values.strict && report.comparison && !report.comparison.likeForLike;
    if (unlike) write("--strict: the comparison is not like for like.");
    if (errors.length || unlike || report.findings.some((x) => x.level === "regression"))
      process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
