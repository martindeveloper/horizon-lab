import path from "node:path";
import { parseArgs } from "node:util";

import type { BenchOptions } from "@horizon/toolkit/bench";

import { loadReport, settingsOf } from "./compare";
import type { BenchSettings } from "./fingerprint";

export const HELP = `Headless rendering bench: timings, images, sequences, frame grabs, reports.

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

function parseNumber(value: string | undefined, fallback: number, name: string) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 0)
    throw new Error(`--${name} needs a non-negative number`);
  return parsed;
}

export function parseSizes(value: string) {
  const sizes = SIZE_SETS[value] ?? value.split(",");
  const unique = new Map<string, { size: string; width: number; height: number }>();
  for (const raw of sizes) {
    const match = raw.trim().match(/^(\d+)x(\d+)$/);
    const width = Number(match?.[1]);
    const height = Number(match?.[2]);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0)
      throw new Error(`Size "${raw}" must contain positive integer dimensions, e.g. 1280x720`);
    const size = `${width}x${height}`;
    unique.set(size, { size, width, height });
  }
  return [...unique.values()];
}

export function parseCli(args: string[]) {
  const { values } = parseArgs({
    args,
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
  if (values.help) return { help: true as const };
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
  const parsedSizes = parseSizes(sizeArg);
  const sizes = parsedSizes.map(({ size }) => size);
  const options: BenchOptions = {
    width: 0,
    height: 0,
    frames: Math.max(1, Math.round(parseNumber(values.frames, prior.frames ?? 30, "frames"))),
    warmup: Math.round(parseNumber(values.warmup, prior.warmup ?? 5, "warmup")),
    time: parseNumber(values.time, prior.time ?? 12, "time"),
    minMs: parseNumber(values["min-time"], prior.minTime ?? 500, "min-time"),
    capture: !values["no-images"],
  };
  const rounds = Math.max(1, Math.round(parseNumber(values.rounds, prior.rounds ?? 1, "rounds")));
  const settings: BenchSettings = {
    frames: options.frames,
    minTime: options.minMs,
    warmup: options.warmup,
    time: options.time,
    rounds,
    settle: parseNumber(values.settle, prior.settle ?? 2000, "settle"),
    trace: values.trace ?? prior.trace ?? false,
    profile: values.profile ?? prior.profile ?? false,
  };
  const budgets = {
    slowdown:
      values["max-slowdown"] === undefined
        ? null
        : parseNumber(values["max-slowdown"], 0, "max-slowdown"),
    changed:
      values["max-changed"] === undefined
        ? null
        : parseNumber(values["max-changed"], 0, "max-changed"),
  };

  return {
    help: false as const,
    values,
    baselineDir,
    previous,
    parsedSizes,
    sizes,
    options,
    rounds,
    settings,
    budgets,
  };
}
