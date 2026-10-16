import path from "node:path";

import type { Page } from "playwright-core";

import {
  findSpikes,
  inputActions,
  keyframeIndices,
  sequenceFrames,
  summarizeTimings,
  type BenchEnvironment,
  type BenchOptions,
  type BenchScene,
} from "@horizon/toolkit/bench";

import { call, dispatchInput } from "./browser";
import { writeLossless } from "./images";
import type { Run, TimelineFrame } from "./model";

export const median = (values: number[]) => summarizeTimings(values).median;

export type Job = {
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
export type Accumulator = {
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

export function createAccumulator(): Accumulator {
  return {
    mountMs: [],
    firstFrameMs: [],
    gpu: [],
    wall: [],
    submit: [],
    timelines: [],
    images: {},
  };
}

function appendFrames(
  samples: Accumulator,
  frames: readonly Pick<TimelineFrame, "gpuMs" | "wallMs" | "submitMs">[],
) {
  for (const frame of frames) {
    samples.gpu.push(frame.gpuMs);
    samples.wall.push(frame.wallMs);
    samples.submit.push(frame.submitMs);
  }
}

function appendTimeline(samples: Accumulator, timeline: TimelineFrame[]) {
  appendFrames(samples, timeline);
  samples.timelines.push(timeline);
  const latestFacts = timeline.at(-1)?.facts;
  if (latestFacts !== undefined) samples.facts = latestFacts;
}

export async function runStatic(page: Page, job: Job, options: BenchOptions, samples: Accumulator) {
  const result = await call(page, "run", job.target, job.scene.id, options);
  samples.environment = result.environment;
  samples.mountMs.push(result.mountMs);
  samples.firstFrameMs.push(result.firstFrameMs);
  appendFrames(samples, result.frames);
  const latestFacts = result.facts?.at(-1) ?? samples.facts;
  if (latestFacts !== undefined) samples.facts = latestFacts;
  Object.assign(samples.images, result.images);
}

/** A sequence without input: every frame rendered back to back inside the page. */
export async function runScripted(
  page: Page,
  job: Job,
  options: BenchOptions,
  samples: Accumulator,
) {
  const result = await call(page, "sequence", job.target, job.scene.id, options);
  const frames = sequenceFrames(job.scene.script!, options.time);
  samples.environment = result.environment;
  samples.mountMs.push(result.mountMs);
  samples.firstFrameMs.push(result.firstFrameMs);
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
  appendTimeline(samples, timeline);
  Object.assign(samples.images, result.images);
}

/**
 * A sequence with input, frame by frame: the harness delivers trusted events
 * between frames. The GPU idles during each round trip, so expect noisier
 * times than in-page sequences.
 */
export async function runInteractive(
  page: Page,
  job: Job,
  options: BenchOptions,
  samples: Accumulator,
) {
  const script = job.scene.script!;
  const frames = sequenceFrames(script, options.time);
  const keyframes = keyframeIndices(script);
  const opened = await call(page, "open", job.target, job.scene.id, options);
  samples.environment = opened.environment;
  samples.mountMs.push(opened.mountMs);
  const timeline: TimelineFrame[] = [];
  let closed: Awaited<ReturnType<typeof call<"close">>> | undefined;
  try {
    samples.firstFrameMs.push(await call(page, "warm", frames[0]!));
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
      if (result.image) samples.images[keyframes.get(frame.index)!] = result.image;
    }
  } finally {
    closed = await call(page, "close");
  }
  closed.gpuMs.forEach((gpu, i) => {
    if (timeline[i]) timeline[i].gpuMs = gpu;
  });
  appendTimeline(samples, timeline);
}

/** Median of each frame across rounds, so one round's hitch does not define the timeline. */
export function pooledTimeline(timelines: TimelineFrame[][]): TimelineFrame[] {
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

export async function buildRun(job: Job, samples: Accumulator, outDir: string): Promise<Run> {
  const gpuSamples = samples.gpu.every((g): g is number => g !== null) ? samples.gpu : [];
  const gpu = gpuSamples.length ? summarizeTimings(gpuSamples) : null;
  const wall = summarizeTimings(samples.wall);
  const submit = summarizeTimings(samples.submit);
  const timer = gpu ? "gpu" : "cpu";
  const ms = (gpu ?? wall).median;
  const images = await Promise.all(
    Object.entries(samples.images)
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
    const timeline = pooledTimeline(samples.timelines);
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
    mountMs: Math.min(...samples.mountMs),
    firstFrameMs: samples.firstFrameMs[0] ?? 0,
    ...(samples.heap !== undefined ? { heap: samples.heap } : {}),
    ...(samples.facts !== undefined ? { facts: samples.facts } : {}),
    ...(sequence !== undefined ? { sequence } : {}),
    images,
    sceneHash: job.sceneHash,
  };
}
