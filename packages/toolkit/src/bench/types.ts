/** A point on the canvas as fractions of its width and height, from the top left. */
export type BenchPoint = readonly [x: number, y: number];

/**
 * Scripted user input, timed by sequence progress (0–1). The harness delivers
 * it as trusted browser input, so pointer capture and default actions behave
 * as for a real visitor.
 */
export type BenchInput =
  | {
      kind: "drag";
      from: BenchPoint;
      to: BenchPoint;
      start: number;
      end: number;
      button?: "left" | "middle" | "right";
    }
  | { kind: "wheel"; at: number; deltaY: number; deltaX?: number; point?: BenchPoint }
  | { kind: "click"; at: number; point: BenchPoint }
  | { kind: "key"; at: number; key: string };

/**
 * A sequence: `frames` frames spanning `duration` seconds of simulation time.
 * Without a script a scene renders the same frame repeatedly, so every timed
 * frame does identical work.
 */
export type BenchScript = {
  frames: number;
  duration: number;
  input?: readonly BenchInput[];
  /** Progress values (0–1) to capture as a filmstrip. Default: start, middle, end. */
  keyframes?: readonly number[];
};

/** One reproducible view: a preset, a camera, a quality level, optionally a sequence. */
export type BenchScene = {
  /** Stable id: results and baselines are matched by target, scene id and size. */
  id: string;
  description: string;
  tags?: readonly string[];
  script?: BenchScript;
};

/** The canvas the runner hands a target, sized in device pixels. */
export type BenchSurface = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

/** What a frame should show. Static scenes keep index 0 and progress 0. */
export type BenchFrame = {
  index: number;
  count: number;
  /** 0 at the first frame of a sequence, 1 at the last. */
  progress: number;
  /** Simulation time in seconds. */
  time: number;
  /** Simulation seconds since the previous frame; 0 for static scenes. */
  dt: number;
};

/** A mounted scene. Each `render` draws one complete frame. */
export type BenchInstance = {
  /** The context the frame is drawn into; the runner times, grabs and captures through it. */
  gl: WebGL2RenderingContext;
  /** Draws one frame. Must not wait for the GPU. */
  render(frame: BenchFrame): void;
  /** Optional per-frame facts for the report (camera, quality, counters). */
  describe?(): Record<string, number | string | boolean>;
  dispose(): void;
};

/**
 * A simulation's benchmark entry. Targets own their renderer, scene state and
 * input handling; the runner owns timing, grabbing, capture and reporting.
 */
export type BenchTarget = {
  id: string;
  scenes: readonly BenchScene[];
  mount(sceneId: string, surface: BenchSurface): BenchInstance | Promise<BenchInstance>;
};

export type BenchOptions = {
  width: number;
  height: number;
  /** Untimed frames after the first, so drivers settle and caches warm. */
  warmup: number;
  /** Timed frames for static scenes; sequences time each of their own frames. */
  frames: number;
  /**
   * Static scenes keep rendering until this many milliseconds have passed as
   * well, so the measurement outlasts GPU clock ramps (0: frames only).
   */
  minMs: number;
  /** Simulation time of static scenes and of a sequence's first frame. */
  time: number;
  /** Capture PNGs: the last frame, or a sequence's keyframes. */
  capture: boolean;
};

/** Timings of one frame, in milliseconds. */
export type FrameTiming = {
  /** JavaScript and command submission: the `render` call alone. */
  submitMs: number;
  /** Submission until a 1-pixel readback returns: the frame's wall-clock cost. */
  wallMs: number;
  /** GPU execution from EXT_disjoint_timer_query_webgl2; null when unavailable. */
  gpuMs: number | null;
};

export type BenchEnvironment = {
  renderer: string;
  vendor: string;
  version: string;
  shadingLanguage: string;
  maxTextureSize: number;
  maxRenderbufferSize: number;
  extensions: string[];
  timerQueries: boolean;
  devicePixelRatio: number;
  userAgent: string;
};

export type BenchResult = {
  target: string;
  scene: string;
  width: number;
  height: number;
  environment: BenchEnvironment;
  /** Milliseconds to mount: renderer, resources and uniforms. */
  mountMs: number;
  /** Milliseconds to the first finished frame, including shader compilation. */
  firstFrameMs: number;
  frames: FrameTiming[];
  /** Target facts per timed frame, when the target describes itself. */
  facts?: Record<string, number | string | boolean>[];
  /** PNG data URLs keyed by sequence progress ("1" for a static scene's last frame). */
  images: Record<string, string>;
};
