/**
 * Frame grab: records one frame's WebGL 2 calls, the way RenderDoc or Spector
 * would, but small and JSON-shaped for reports and language models. The
 * context's methods are wrapped on the instance for the duration of one frame
 * and restored afterwards, so renderers that keep a reference to the context
 * (Three.js does) are recorded without changes.
 */

export type GrabOptions = {
  /** Read back the bound render target after every draw. */
  snapshots: boolean;
  /** Width of snapshot thumbnails in pixels. */
  thumbWidth: number;
  maxSnapshots: number;
  /** Calls kept in the log; counts include every call. */
  maxCalls: number;
};

export type GrabCall = { n: number; fn: string; args: string; draw?: number };

export type GrabDraw = {
  index: number;
  /** Position in the call log. */
  call: number;
  fn: string;
  mode: string;
  count: number;
  instances: number;
  program: string | null;
  framebuffer: string | null;
  viewport: [number, number, number, number];
  /** GPU time of this draw alone, from a timer query around it. */
  gpuMs: number | null;
  /** Active uniform values at the draw. */
  uniforms: Record<string, unknown>;
  /** PNG data URL of the render target after the draw, when readable. */
  snapshot?: string;
  /** Why the render target could not be read back (a float target, for example). */
  snapshotError?: string;
};

export type GrabShader = {
  type: "vertex" | "fragment";
  /** The source the driver received, after the renderer's own prefixes. */
  source: string;
  /** The driver's translation (HLSL, MSL or desktop GLSL), when WEBGL_debug_shaders exists. */
  translated?: string;
  /** Compile time of a fresh copy, in milliseconds; blocks until the driver finishes. */
  compileMs?: number;
};

export type GrabProgram = {
  id: string;
  uniforms: { name: string; type: string; size: number }[];
  attributes: { name: string; type: string; size: number }[];
  shaders: GrabShader[];
};

export type GrabPass = { framebuffer: string | null; draws: number; width: number; height: number };

export type FrameGrab = {
  /** Wall time of the instrumented frame: inflated by recording, for orientation only. */
  instrumentedMs: number;
  calls: GrabCall[];
  truncated: boolean;
  counts: Record<string, number>;
  draws: GrabDraw[];
  /** Consecutive draws into one render target. */
  passes: GrabPass[];
  programs: GrabProgram[];
  uploads: { textureCalls: number; textureBytes: number; bufferCalls: number; bufferBytes: number };
  /** gl.getError() results after the frame. */
  errors: string[];
};

const DRAWS = new Set([
  "drawArrays",
  "drawElements",
  "drawArraysInstanced",
  "drawElementsInstanced",
  "drawRangeElements",
]);
const TEXTURE_UPLOADS = new Set([
  "texImage2D",
  "texSubImage2D",
  "texImage3D",
  "texSubImage3D",
  "compressedTexImage2D",
  "compressedTexSubImage2D",
  "copyTexImage2D",
]);
const BUFFER_UPLOADS = new Set(["bufferData", "bufferSubData"]);
const DRAW_MODES = [
  "POINTS",
  "LINES",
  "LINE_LOOP",
  "LINE_STRIP",
  "TRIANGLES",
  "TRIANGLE_STRIP",
  "TRIANGLE_FAN",
];
const CLEAR_BITS: [number, string][] = [
  [0x4000, "COLOR_BUFFER_BIT"],
  [0x100, "DEPTH_BUFFER_BIT"],
  [0x400, "STENCIL_BUFFER_BIT"],
];

let enumNames: Map<number, string> | null = null;
/** GL constant names by value. Values below 0x200 are ambiguous (0 is ZERO, NONE, POINTS…) and stay numbers. */
function enumName(value: number) {
  if (!enumNames) {
    enumNames = new Map();
    for (const name of Object.getOwnPropertyNames(WebGL2RenderingContext)) {
      const v: unknown = Reflect.get(WebGL2RenderingContext, name);
      if (typeof v === "number" && /^[A-Z0-9_]+$/.test(name) && !enumNames.has(v))
        enumNames.set(v, name);
    }
  }
  return value >= 0x200 ? enumNames.get(value) : undefined;
}

const round = (value: number) => (Number.isInteger(value) ? value : Number(value.toPrecision(6)));

type Timer = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

/** Short stable names for GL objects, by kind and first appearance: `program#1`, `texture#3`. */
type Label = (object: object) => string;
function createLabeller(): Label {
  const ids = new WeakMap<object, string>();
  const serial = new Map<string, number>();
  return (object) => {
    let id = ids.get(object);
    if (!id) {
      const kind = object.constructor.name.replace(/^WebGL/, "").toLowerCase();
      const n = (serial.get(kind) ?? 0) + 1;
      serial.set(kind, n);
      id = `${kind}#${n}`;
      ids.set(object, id);
    }
    return id;
  };
}

/** Drains `gl.getError()` into `into`, at most 16 entries. */
function drainErrors(gl: WebGL2RenderingContext, into: string[]) {
  for (let e = gl.getError(); e !== gl.NO_ERROR && into.length < 16; e = gl.getError())
    into.push(enumName(e) ?? String(e));
}

/** One call argument for the log: enum names, short strings, typed-array sizes, object labels. */
function formatArg(arg: unknown, label: Label): string {
  if (typeof arg === "number") return enumName(arg) ?? String(round(arg));
  if (arg === null || arg === undefined || typeof arg === "boolean") return String(arg);
  if (typeof arg === "string")
    return JSON.stringify(arg.length > 60 ? `${arg.slice(0, 57)}…` : arg);
  if (ArrayBuffer.isView(arg)) {
    const length = "length" in arg && typeof arg.length === "number" ? arg.length : arg.byteLength;
    return `${arg.constructor.name}(${length})`;
  }
  if (arg instanceof ArrayBuffer) return `ArrayBuffer(${arg.byteLength})`;
  if (Array.isArray(arg))
    return `[${arg
      .slice(0, 8)
      .map((item) => formatArg(item, label))
      .join(", ")}${arg.length > 8 ? ", …" : ""}]`;
  if (typeof arg === "object") {
    const name = arg.constructor.name;
    return name.startsWith("WebGL") && name !== "WebGLUniformLocation" ? label(arg) : name;
  }
  return typeof arg;
}

/** The `clear` call's arguments as its bit names; any other call's as formatted arguments. */
function formatArgs(name: string, args: unknown[], label: Label) {
  return name === "clear"
    ? CLEAR_BITS.filter(([bit]) => Number(args[0]) & bit)
        .map(([, bit]) => bit)
        .join(" | ")
    : args.map((arg) => formatArg(arg, label)).join(", ");
}

/** Bytes a texture upload moves: the data given, an image's pixels, or an allocation's size. */
function textureUploadBytes(args: unknown[]) {
  for (const arg of args) {
    if (ArrayBuffer.isView(arg) || arg instanceof ArrayBuffer) return arg.byteLength;
    if (arg && typeof arg === "object" && "width" in arg && "height" in arg)
      return Number(arg.width) * Number(arg.height) * 4;
  }
  // Allocation without data: texImage2D(target, level, format, width, height, …).
  const [width, height] = [args[3], args[4]];
  return typeof width === "number" && typeof height === "number" ? width * height * 4 : 0;
}

/** Bytes a buffer upload moves: `bufferData(target, size | data, …)`. */
function bufferUploadBytes(data: unknown) {
  return typeof data === "number"
    ? data
    : ArrayBuffer.isView(data) || data instanceof ArrayBuffer
      ? data.byteLength
      : 0;
}

/** A program's interface and shaders; compiles a fresh copy of each shader to time and translate it. */
function describeProgram(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  id: string,
): GrabProgram {
  const typeName = (type: number) => enumName(type) ?? String(type);
  const uniforms = [];
  for (let i = 0; i < Number(gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)); i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms.push({ name: info.name, type: typeName(info.type), size: info.size });
  }
  const attributes = [];
  for (let i = 0; i < Number(gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)); i++) {
    const info = gl.getActiveAttrib(program, i);
    if (info) attributes.push({ name: info.name, type: typeName(info.type), size: info.size });
  }
  const debug = gl.getExtension("WEBGL_debug_shaders");
  const shaders = (gl.getAttachedShaders(program) ?? []).map((shader): GrabShader => {
    const type = Number(gl.getShaderParameter(shader, gl.SHADER_TYPE));
    const source = gl.getShaderSource(shader) ?? "";
    // Renderers delete shaders once linked, so translate and time a fresh copy.
    const copy = gl.createShader(type);
    let translated: string | undefined;
    let compileMs: number | undefined;
    if (copy) {
      gl.shaderSource(copy, source);
      const start = performance.now();
      gl.compileShader(copy);
      gl.getShaderParameter(copy, gl.COMPILE_STATUS);
      compileMs = performance.now() - start;
      translated = debug?.getTranslatedShaderSource(copy) || undefined;
      gl.deleteShader(copy);
    }
    return {
      type: type === gl.VERTEX_SHADER ? "vertex" : "fragment",
      source,
      ...(translated !== undefined ? { translated } : {}),
      ...(compileMs !== undefined ? { compileMs } : {}),
    };
  });
  return { id, uniforms, attributes, shaders };
}

/** The current value of every active uniform, numbers rounded for the report. */
function uniformValues(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const values: Record<string, unknown> = {};
  for (let i = 0; i < Number(gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)); i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const location = gl.getUniformLocation(program, info.name);
    if (!location) continue;
    const value: unknown = gl.getUniform(program, location);
    values[info.name] = isList(value)
      ? Array.from(value, (item) => (typeof item === "number" ? round(item) : item))
      : typeof value === "number"
        ? round(value)
        : value;
  }
  return values;
}

/** The bound render target's `width` × `height` as a PNG thumbnail `thumbWidth` wide, or why not. */
function snapshot(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  thumbWidth: number,
): { image?: string; error?: string } {
  if (width <= 0 || height <= 0) return { error: "empty viewport" };
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const error = gl.getError();
  // Float targets, for example, cannot be read as RGBA8.
  if (error !== gl.NO_ERROR) return { error: enumName(error) ?? String(error) };
  const full = document.createElement("canvas");
  full.width = width;
  full.height = height;
  const image = new ImageData(width, height);
  const row = width * 4;
  for (let y = 0; y < height; y++)
    image.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  full.getContext("2d")!.putImageData(image, 0, 0);
  const scale = Math.min(1, thumbWidth / width);
  const thumb = document.createElement("canvas");
  thumb.width = Math.max(1, Math.round(width * scale));
  thumb.height = Math.max(1, Math.round(height * scale));
  thumb.getContext("2d")!.drawImage(full, 0, 0, thumb.width, thumb.height);
  return { image: thumb.toDataURL("image/png") };
}

/** The vertex count of a draw call from its arguments. */
function drawCount(name: string, args: unknown[]) {
  // drawArrays*(mode, first, count…), drawElements*(mode, count…), drawRangeElements(mode, start, end, count…)
  return Number(
    args[name.startsWith("drawArrays") ? 2 : name === "drawRangeElements" ? 3 : 1] ?? 0,
  );
}

/** Consecutive draws into one render target. */
function passesOf(draws: readonly GrabDraw[]) {
  const passes: GrabPass[] = [];
  for (const draw of draws) {
    const last = passes.at(-1);
    if (last && last.framebuffer === draw.framebuffer) last.draws++;
    else
      passes.push({
        framebuffer: draw.framebuffer,
        draws: 1,
        width: draw.viewport[2],
        height: draw.viewport[3],
      });
  }
  return passes;
}

/** Waits up to four seconds for every timer query, then reads the GPU time of each draw. */
async function readTimers(
  gl: WebGL2RenderingContext,
  timer: Timer,
  queries: readonly (WebGLQuery | null)[],
  draws: GrabDraw[],
) {
  const deadline = performance.now() + 4000;
  const pending = queries.filter((q): q is WebGLQuery => q !== null);
  while (!pending.every((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) {
    if (performance.now() > deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
  const disjoint = Boolean(gl.getParameter(timer.GPU_DISJOINT_EXT));
  queries.forEach((query, i) => {
    if (!query) return;
    if (!disjoint && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))
      draws[i]!.gpuMs = Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6;
    gl.deleteQuery(query);
  });
}

export async function grabFrame(
  gl: WebGL2RenderingContext,
  render: () => void,
  options: GrabOptions,
): Promise<FrameGrab> {
  const label = createLabeller();
  let internal = false;
  const errors: string[] = [];
  /** Runs the grab's own GL calls unrecorded; errors they raise are discarded. */
  const call = <T>(fn: () => T): T => {
    const was = internal;
    internal = true;
    try {
      /* Errors the frame raised so far are collected first, so none are misattributed. */
      if (!was) drainErrors(gl, errors);
      return fn();
    } finally {
      if (!was) for (let i = 0; i < 16 && gl.getError() !== gl.NO_ERROR; i++);
      internal = was;
    }
  };

  const programs = new Map<string, GrabProgram>();
  const programId = (program: WebGLProgram) =>
    call(() => {
      const id = label(program);
      if (!programs.has(id)) programs.set(id, describeProgram(gl, program, id));
      return id;
    });

  const timerValue: unknown = call(() => gl.getExtension("EXT_disjoint_timer_query_webgl2"));
  const timer = isTimer(timerValue) ? timerValue : null;
  const queries: (WebGLQuery | null)[] = [];
  const calls: GrabCall[] = [];
  const counts: Record<string, number> = {};
  const draws: GrabDraw[] = [];
  const uploads = { textureCalls: 0, textureBytes: 0, bufferCalls: 0, bufferBytes: 0 };
  let n = 0;
  let truncated = false;

  const wrapped: string[] = [];
  for (const name of Object.getOwnPropertyNames(WebGL2RenderingContext.prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(WebGL2RenderingContext.prototype, name);
    const original: unknown = descriptor?.value;
    if (name === "constructor" || typeof original !== "function") continue;
    wrapped.push(name);
    Reflect.set(gl, name, (...args: unknown[]) => {
      if (internal) return Reflect.apply(original, gl, args);
      n++;
      counts[name] = (counts[name] ?? 0) + 1;
      const entry: GrabCall = { n, fn: name, args: formatArgs(name, args, label) };
      if (calls.length < options.maxCalls) calls.push(entry);
      else truncated = true;
      if (TEXTURE_UPLOADS.has(name)) {
        uploads.textureCalls++;
        uploads.textureBytes += textureUploadBytes(args);
      } else if (BUFFER_UPLOADS.has(name)) {
        uploads.bufferCalls++;
        uploads.bufferBytes += bufferUploadBytes(args[1]);
      }
      if (!DRAWS.has(name)) return Reflect.apply(original, gl, args);

      const programValue: unknown = call(() => gl.getParameter(gl.CURRENT_PROGRAM));
      const program = programValue instanceof WebGLProgram ? programValue : null;
      const framebufferValue: unknown = call(() => gl.getParameter(gl.FRAMEBUFFER_BINDING));
      const framebuffer = framebufferValue instanceof WebGLFramebuffer ? framebufferValue : null;
      const view: unknown = call(() => gl.getParameter(gl.VIEWPORT));
      const viewport: GrabDraw["viewport"] =
        view instanceof Int32Array
          ? [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0, view[3] ?? 0]
          : [0, 0, 0, 0];
      const draw: GrabDraw = {
        index: draws.length,
        call: n,
        fn: name,
        mode: DRAW_MODES[Number(args[0])] ?? formatArg(args[0], label),
        count: drawCount(name, args),
        instances: name.endsWith("Instanced") ? Number(args.at(-1) ?? 1) : 1,
        program: program ? programId(program) : null,
        framebuffer: framebuffer ? label(framebuffer) : null,
        viewport,
        gpuMs: null,
        uniforms: program ? call(() => uniformValues(gl, program)) : {},
      };
      entry.draw = draw.index;
      const query = timer ? call(() => gl.createQuery()) : null;
      if (timer && query) call(() => gl.beginQuery(timer.TIME_ELAPSED_EXT, query));
      const result = Reflect.apply(original, gl, args);
      if (timer && query) call(() => gl.endQuery(timer.TIME_ELAPSED_EXT));
      queries.push(query);
      if (options.snapshots && draws.length < options.maxSnapshots) {
        const shot = call(() => snapshot(gl, viewport[2], viewport[3], options.thumbWidth));
        if (shot.image !== undefined) draw.snapshot = shot.image;
        if (shot.error !== undefined) draw.snapshotError = shot.error;
      }
      draws.push(draw);
      return result;
    });
  }

  const start = performance.now();
  try {
    render();
    call(() => gl.finish());
  } finally {
    for (const name of wrapped) Reflect.deleteProperty(gl, name);
  }
  const instrumentedMs = performance.now() - start;

  if (timer) await readTimers(gl, timer, queries, draws);

  drainErrors(gl, errors);

  return {
    instrumentedMs,
    calls,
    truncated,
    counts,
    draws,
    passes: passesOf(draws),
    programs: [...programs.values()],
    uploads,
    errors,
  };
}

function isTimer(value: unknown): value is Timer {
  return (
    typeof value === "object" &&
    value !== null &&
    "TIME_ELAPSED_EXT" in value &&
    "GPU_DISJOINT_EXT" in value &&
    typeof value.TIME_ELAPSED_EXT === "number" &&
    typeof value.GPU_DISJOINT_EXT === "number"
  );
}

function isList(value: unknown): value is Iterable<unknown> {
  return ArrayBuffer.isView(value) && Symbol.iterator in value;
}
