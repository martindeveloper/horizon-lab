import type {
  BenchEnvironment,
  GrabPass,
  ImageDifference,
  ScalingFit,
  TimingSummary,
} from "@horizon/toolkit/bench";

import type { Fingerprints, Mismatch } from "./fingerprint";

/** One frame of a sequence, as recorded (median across rounds). */
export type TimelineFrame = {
  progress: number;
  gpuMs: number | null;
  wallMs: number;
  submitMs: number;
  facts?: Record<string, number | string | boolean>;
};

export type GrabSummary = {
  /** Directory with grab.json, draws/ and shaders/, relative to the report. */
  dir: string;
  draws: number;
  calls: number;
  programs: number;
  passes: GrabPass[];
  drawGpuMs: number | null;
  uploads: { textureCalls: number; textureBytes: number; bufferCalls: number; bufferBytes: number };
  stateChanges: number;
  /** Each shader as the driver sees it: size, translation size and compile time. */
  shaders: {
    program: string;
    type: "vertex" | "fragment";
    lines: number;
    bytes: number;
    translatedBytes: number | null;
    compileMs: number | null;
  }[];
  errors: string[];
};

export type Run = {
  /** target/scene@WxH: the stable key results and baselines match on. */
  key: string;
  target: string;
  scene: string;
  description: string;
  tags: readonly string[];
  width: number;
  height: number;
  kind: "static" | "sequence";
  /** Which clock `ms` comes from: GPU timer queries, or wall time to completion. */
  timer: "gpu" | "cpu";
  /** Median frame time on `timer`'s clock. */
  ms: number;
  nsPerPixel: number;
  gpu: TimingSummary | null;
  wall: TimingSummary;
  submit: TimingSummary;
  mountMs: number;
  firstFrameMs: number;
  heap?: { before: number; after: number };
  /** Facts from the last timed frame (camera, quality…). */
  facts?: Record<string, number | string | boolean>;
  sequence?: {
    frames: number;
    duration: number;
    /** Frames slower than twice the median, worst first. */
    spikes: number[];
    worst: { index: number; progress: number; ms: number };
    timeline: TimelineFrame[];
  };
  /** Captured frames: progress → image path relative to the report. */
  images: { progress: string; path: string }[];
  /** Fingerprint of the scene's full definition (camera, quality, script, input). */
  sceneHash?: string;
  grab?: GrabSummary;
  trace?: string;
  profile?: string;
};

export type Scaling = {
  target: string;
  scene: string;
  points: { size: string; pixels: number; ms: number }[];
  fit: ScalingFit;
};

export type Comparison = {
  key: string;
  timer: "gpu" | "cpu";
  beforeMs: number;
  afterMs: number;
  deltaPct: number;
  image: (ImageDifference & { progress: string; heatmap?: string }) | "size" | null;
  slower: boolean;
  changed: boolean;
  /** The scene's definition differs from the baseline's; null when the baseline has no fingerprint. */
  sceneChanged: boolean | null;
};

export type ComparisonSummary = {
  baseline: string;
  label: string | null;
  createdAt: string;
  /** Settings, environment and every compared scene match the baseline. */
  likeForLike: boolean;
  mismatches: Mismatch[];
  /** Runs whose scene definition changed since the baseline. */
  changedScenes: string[];
  /** In the baseline but not measured now, and the reverse. */
  missing: string[];
  added: string[];
  /** Same benchmarked code as the baseline: differences are then run-to-run noise. */
  sameCode: boolean | null;
  /** The baseline predates fingerprints; settings and scenes were only partly checked. */
  legacy: boolean;
  rows: Comparison[];
};

export type Finding = {
  level: "error" | "regression" | "warning" | "info";
  key?: string;
  message: string;
};

export type Report = {
  version: 2 | 3;
  createdAt: string;
  label: string | null;
  command: string;
  machine: { platform: string; cpu: string; cores: number; memoryGb: number; node: string };
  browser: string;
  gpu: BenchEnvironment | null;
  options: { sizes: string[]; frames: number; warmup: number; time: number; rounds: number };
  /** Version 3: hashes of settings, environment and code (see fingerprint.ts). */
  fingerprints?: Fingerprints;
  runs: Run[];
  scaling: Scaling[];
  comparison?: ComparisonSummary;
  findings: Finding[];
  errors: { key: string; message: string }[];
};
