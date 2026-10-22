import { grabFrame, type FrameGrab, type GrabOptions } from "./grab";
import { keyframeIndices, sequenceFrames } from "./script";
import type {
  BenchEnvironment,
  BenchFrame,
  BenchInstance,
  BenchOptions,
  BenchResult,
  BenchTarget,
} from "./types";
import { validateTarget } from "./validate";

type TimerQuery = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

function isTimerQuery(value: unknown): value is TimerQuery {
  return (
    typeof value === "object" &&
    value !== null &&
    "TIME_ELAPSED_EXT" in value &&
    typeof value.TIME_ELAPSED_EXT === "number" &&
    "GPU_DISJOINT_EXT" in value &&
    typeof value.GPU_DISJOINT_EXT === "number"
  );
}

function timerExtension(value: unknown): TimerQuery | null {
  return isTimerQuery(value) ? value : null;
}
type Facts = Record<string, number | string | boolean>;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A still frame: static scenes render this one repeatedly. */
export const staticFrame = (time: number): BenchFrame => ({
  index: 0,
  count: 1,
  progress: 0,
  time,
  dt: 0,
});

function environmentOf(gl: WebGL2RenderingContext): BenchEnvironment {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    renderer: String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    vendor: String(gl.getParameter(info ? info.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
    version: String(gl.getParameter(gl.VERSION)),
    shadingLanguage: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    maxRenderbufferSize: Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)),
    extensions: gl.getSupportedExtensions() ?? [],
    timerQueries: Boolean(gl.getExtension("EXT_disjoint_timer_query_webgl2")),
    devicePixelRatio: window.devicePixelRatio,
    userAgent: navigator.userAgent,
  };
}

/**
 * One mounted scene, driven frame by frame. Frames render back to back
 * without presenting, so timings measure rendering work, not vsync. Each
 * timed frame is closed by a 1-pixel readback, which waits for the GPU.
 */
export class BenchSession {
  readonly environment: BenchEnvironment;
  private readonly pixel = new Uint8Array(4);
  private readonly timer: TimerQuery | null;
  private readonly queries: (WebGLQuery | null)[] = [];
  private closed = false;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly instance: BenchInstance,
    readonly mountMs: number,
  ) {
    this.environment = environmentOf(instance.gl);
    this.timer = timerExtension(instance.gl.getExtension("EXT_disjoint_timer_query_webgl2"));
  }

  static async open(target: BenchTarget, sceneId: string, options: BenchOptions) {
    validateTarget(target);
    if (!target.scenes.some((scene) => scene.id === sceneId))
      throw new Error(`Unknown scene ${target.id}/${sceneId}`);
    const canvas = document.createElement("canvas");
    canvas.width = options.width;
    canvas.height = options.height;
    // CSS pixels equal device pixels (the harness sets DPR 1), so input lands where scripted.
    canvas.style.width = `${options.width}px`;
    canvas.style.height = `${options.height}px`;
    document.body.append(canvas);
    const start = performance.now();
    let instance: BenchInstance | undefined;
    try {
      instance = await target.mount(sceneId, {
        canvas,
        width: options.width,
        height: options.height,
      });
      return new BenchSession(canvas, instance, performance.now() - start);
    } catch (error) {
      try {
        instance?.dispose();
      } finally {
        try {
          canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
        } finally {
          canvas.remove();
        }
      }
      throw error;
    }
  }

  private finish() {
    const { gl } = this.instance;
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixel);
  }

  /** An untimed frame, for warm-up; returns its wall time (the first includes compilation). */
  warm(frame: BenchFrame) {
    const start = performance.now();
    this.instance.render(frame);
    this.finish();
    return performance.now() - start;
  }

  /** A timed frame. GPU times resolve in `close()`. */
  frame(frame: BenchFrame, capture = false) {
    const { gl } = this.instance;
    if (this.queries.length === 0 && this.timer) gl.getParameter(this.timer.GPU_DISJOINT_EXT);
    const query = this.timer ? gl.createQuery() : null;
    if (this.timer && query) gl.beginQuery(this.timer.TIME_ELAPSED_EXT, query);
    const start = performance.now();
    this.queries.push(query);
    let submitted: number;
    try {
      this.instance.render(frame);
      submitted = performance.now();
    } finally {
      if (this.timer && query) gl.endQuery(this.timer.TIME_ELAPSED_EXT);
    }
    this.finish();
    const end = performance.now();
    // Read in the same task as the draw: the drawing buffer is not preserved.
    const image = capture ? this.canvas.toDataURL("image/png") : undefined;
    const facts = this.instance.describe?.();
    return {
      submitMs: submitted - start,
      wallMs: end - start,
      ...(facts !== undefined ? { facts } : {}),
      ...(image !== undefined ? { image } : {}),
    };
  }

  /** An untimed frame captured as a PNG data URL, with the target's facts at that frame. */
  capture(frame: BenchFrame) {
    this.instance.render(frame);
    // Read in the same task as the draw: the drawing buffer is not preserved.
    return { image: this.canvas.toDataURL("image/png"), facts: this.instance.describe?.() };
  }

  /** Records one more frame call by call. Untimed: recording inflates its cost. */
  grab(frame: BenchFrame, options: GrabOptions): Promise<FrameGrab> {
    return grabFrame(this.instance.gl, () => this.instance.render(frame), options);
  }

  /** Resolves GPU times and releases everything the scene created. */
  async close(): Promise<{ gpuMs: (number | null)[] }> {
    if (this.closed) return { gpuMs: [] };
    this.closed = true;
    const { gl } = this.instance;
    try {
      let gpuMs: (number | null)[] = this.queries.map(() => null);
      if (this.timer && this.queries.length) {
        const pending = this.queries.filter((q): q is WebGLQuery => q !== null);
        const deadline = performance.now() + 4000;
        while (!pending.every((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) {
          if (performance.now() > deadline) break;
          await wait(8);
        }
        const disjoint = Boolean(gl.getParameter(this.timer.GPU_DISJOINT_EXT));
        gpuMs = this.queries.map((q) =>
          q && !disjoint && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)
            ? Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6
            : null,
        );
        for (const q of pending) gl.deleteQuery(q);
      }
      return { gpuMs };
    } finally {
      try {
        this.instance.dispose();
      } finally {
        try {
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        } finally {
          this.canvas.remove();
        }
      }
    }
  }
}

/** Upper bound on timed frames of a static scene, whatever `minMs` asks for. */
const MAX_STATIC_FRAMES = 5000;

/**
 * Static scene: captured once, untimed, after the warm-up, then the same frame at least
 * `options.frames` times and for at least `options.minMs`. A target whose own clock moves on
 * with every frame (a scene engine's loop) is thus captured at the same moment in every run,
 * however many frames the minimum time takes; the facts reported are those of that frame.
 */
export async function runBenchScene(
  target: BenchTarget,
  sceneId: string,
  options: BenchOptions,
): Promise<BenchResult> {
  const session = await BenchSession.open(target, sceneId, options);
  const frame = staticFrame(options.time);
  const frames: { submitMs: number; wallMs: number }[] = [];
  const facts: Facts[] = [];
  const images: Record<string, string> = {};
  let shown: Facts | undefined;
  let firstFrameMs = 0;
  try {
    firstFrameMs = session.warm(frame);
    for (let i = 0; i < options.warmup; i++) session.warm(frame);
    if (options.capture) {
      const captured = session.capture(frame);
      images["1"] = captured.image;
      shown = captured.facts;
    }
    const start = performance.now();
    for (
      let i = 0;
      i < MAX_STATIC_FRAMES && (i < options.frames || performance.now() - start < options.minMs);
      i++
    ) {
      const result = session.frame(frame);
      frames.push({ submitMs: result.submitMs, wallMs: result.wallMs });
      if (result.facts) facts.push(result.facts);
    }
  } catch (error) {
    await session.close();
    throw error;
  }
  const closed = await session.close();
  return {
    target: target.id,
    scene: sceneId,
    width: options.width,
    height: options.height,
    environment: session.environment,
    mountMs: session.mountMs,
    firstFrameMs,
    frames: frames.map((f, i) => ({ ...f, gpuMs: closed.gpuMs[i] ?? null })),
    /* The image's own facts where one was captured: the report shows them beside it. */
    ...(shown ? { facts: [shown] } : facts.length > 0 ? { facts } : {}),
    images,
  };
}

/**
 * A scripted sequence without input, rendered back to back in the page so
 * the GPU never idles between frames. Input sequences need the harness
 * between frames and use `open`/`frame` instead.
 */
export async function runBenchSequence(
  target: BenchTarget,
  sceneId: string,
  options: BenchOptions,
): Promise<BenchResult> {
  validateTarget(target);
  const scene = target.scenes.find((s) => s.id === sceneId);
  if (!scene?.script) throw new Error(`${target.id}/${sceneId} has no script`);
  const frames = sequenceFrames(scene.script, options.time);
  const keyframes = keyframeIndices(scene.script);
  const session = await BenchSession.open(target, sceneId, options);
  const timings: { submitMs: number; wallMs: number }[] = [];
  const facts: Facts[] = [];
  const images: Record<string, string> = {};
  let firstFrameMs = 0;
  try {
    firstFrameMs = session.warm(frames[0]!);
    for (let i = 0; i < options.warmup; i++) session.warm(frames[0]!);
    for (const frame of frames) {
      const result = session.frame(frame, options.capture && keyframes.has(frame.index));
      timings.push({ submitMs: result.submitMs, wallMs: result.wallMs });
      facts.push(result.facts ?? {});
      if (result.image) images[keyframes.get(frame.index)!] = result.image;
    }
  } catch (error) {
    await session.close();
    throw error;
  }
  const closed = await session.close();
  return {
    target: target.id,
    scene: sceneId,
    width: options.width,
    height: options.height,
    environment: session.environment,
    mountMs: session.mountMs,
    firstFrameMs,
    frames: timings.map((f, i) => ({ ...f, gpuMs: closed.gpuMs[i] ?? null })),
    facts,
    images,
  };
}

/** Lazily loaded targets, keyed by id; a target's code runs only when it is benchmarked. */
export type BenchRegistry = Readonly<Record<string, () => Promise<BenchTarget>>>;

/**
 * The page API a harness drives. `run` and `sequence` measure a scene in
 * one call; `open`, `warm`, `frame`, `grab` and `close` let the harness
 * interleave trusted input between frames.
 */
export type BenchRuntime = {
  list(): Promise<{ id: string; scenes: BenchTarget["scenes"] }[]>;
  run(targetId: string, sceneId: string, options: BenchOptions): Promise<BenchResult>;
  sequence(targetId: string, sceneId: string, options: BenchOptions): Promise<BenchResult>;
  open(
    targetId: string,
    sceneId: string,
    options: BenchOptions,
  ): Promise<{ environment: BenchEnvironment; mountMs: number }>;
  warm(frame: BenchFrame): number;
  frame(
    frame: BenchFrame,
    capture?: boolean,
  ): { submitMs: number; wallMs: number; facts?: Facts; image?: string };
  grab(frame: BenchFrame, options: GrabOptions): Promise<FrameGrab>;
  close(): Promise<{ gpuMs: (number | null)[] }>;
};

/** Exposes the registry to a driving harness as `globalThis.__horizonBench`. */
export function installBenchRuntime(registry: BenchRegistry): BenchRuntime {
  const load = async (id: string) => {
    if (!Object.hasOwn(registry, id)) throw new Error(`Unknown bench target: ${id}`);
    const target = await registry[id]!();
    if (target.id !== id) throw new Error(`Bench target ${id} reports id ${target.id}`);
    validateTarget(target);
    return target;
  };
  let session: BenchSession | null = null;
  const current = () => {
    if (!session) throw new Error("No open bench session");
    return session;
  };
  const runtime: BenchRuntime = {
    async list() {
      const targets = await Promise.all(Object.keys(registry).map(load));
      return targets.map(({ id, scenes }) => ({ id, scenes }));
    },
    async run(targetId, sceneId, options) {
      return runBenchScene(await load(targetId), sceneId, options);
    },
    async sequence(targetId, sceneId, options) {
      return runBenchSequence(await load(targetId), sceneId, options);
    },
    async open(targetId, sceneId, options) {
      const previous = session;
      session = null;
      await previous?.close();
      session = await BenchSession.open(await load(targetId), sceneId, options);
      return { environment: session.environment, mountMs: session.mountMs };
    },
    warm: (frame) => current().warm(frame),
    frame: (frame, capture) => current().frame(frame, capture),
    grab: (frame, options) => current().grab(frame, options),
    async close() {
      const previous = current();
      session = null;
      return previous.close();
    },
  };
  Object.assign(globalThis, { __horizonBench: runtime });
  return runtime;
}
