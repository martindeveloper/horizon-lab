# Bench

Import from `@horizon/toolkit/bench`: a renderer-agnostic contract, an in-page
runner and a WebGL frame recorder for benchmarking WebGL 2 scenes. A harness
drives it, such as this repository's `bench/` CLI. Importing the module touches
no browser globals. It imports no Three.js, UI or shader code.

## Contract

- `BenchTarget`: `id`, `scenes`, and `mount(sceneId, { canvas, width, height })`
  returning a `BenchInstance`: `{ gl, render(frame), describe?(), dispose() }`. The
  target owns its renderer, scene state and input handlers. `render` draws one
  complete frame and must not wait for the GPU.
- `BenchScene`: stable `id`, `description`, optional `tags` and `script`.
- `BenchScript`: `frames` over `duration` simulation seconds, optional `input`
  (`drag`, `wheel`, `click`, `key` at a progress between 0 and 1) and `keyframes`
  to capture.
- `BenchFrame`: `index`, `count`, `progress`, `time`, `dt`. Static scenes always
  receive the same frame, so each timed frame does identical work.

Target and scene ids start with a letter or digit and use only letters, digits,
hyphens and underscores; scene ids are unique per target. The runtime rejects
invalid ids and scripts before mounting: frame counts must be positive integers,
durations finite and non-negative, and input/keyframe progress within 0–1 with
each drag ending at or after its start.

Mounts reset persistent scene state and clean up their own partial initialization
if they throw. Once mounted, the runner owns disposal and releases its canvas and
context even if the instance's disposal fails. Drivers issue runtime calls serially.

## Runner

- `BenchSession`: one mounted scene on a fresh canvas. It has these methods:
  - `warm(frame)`: an untimed frame.
  - `frame(frame, capture)`: one timed frame. GPU time comes from
    `EXT_disjoint_timer_query_webgl2`; the `render` call alone is the submit time;
    a 1-pixel readback closes the frame and gives wall time. `capture` returns a PNG.
  - `grab(frame, options)`: records a frame (below).
  - `close()`: resolves GPU times, then disposes the instance, loses the context
    and removes the canvas.
- `runBenchScene` and `runBenchSequence` measure a static scene or an input-free
  sequence in one call. Frames run back to back, so the GPU never idles between them.
- `installBenchRuntime(registry)` exposes `list`, `run`, `sequence`, `open`, `warm`,
  `frame`, `grab` and `close` as `globalThis.__horizonBench`. A driver such as
  Playwright can then deliver trusted input between frames. Registry values are lazy
  loaders; it throws when a target's `id` differs from its key.

## Frame grab

`grabFrame(gl, render, options)` wraps every `WebGL2RenderingContext` method on the
context instance for one frame and restores them afterwards. It returns:

- `calls`: the call log with readable arguments, capped at `maxCalls`
- `counts`: calls per function
- `draws`: mode, count, instances, program, render target, viewport, GPU time,
  uniform values, and a snapshot or the reason one failed
- `passes`, texture and buffer `uploads` with bytes, and the frame's own WebGL `errors`
- `programs`: active uniforms, attributes and shaders as received, plus the driver's
  translation and compile time, measured on a fresh copy because renderers delete
  linked shaders

The grab's own GL calls are unrecorded, and errors they raise are discarded. Recording
inflates the frame's cost, so treat `instrumentedMs` as orientation only.

## Scripts and statistics

- `sequenceFrames`, `inputActions` and `keyframeIndices` turn a script into frames,
  per-frame input steps (in canvas fractions) and capture points.
- `summarizeTimings`: count, min, nearest-rank median and p90, max, mean.
- `rollingMedian` and `findSpikes`: hitches against the local median.
- `fitScaling`: least-squares `ms = fixed + per-megapixel × MP`, with r².
- `compareRgba` and `differenceMap`: image differences and a heat map, ignoring alpha.

Timings depend on the device, browser and GPU clocks. Compare runs from one machine
only, and check the renderer string: a software rasteriser's numbers do not describe
a GPU.
