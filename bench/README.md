# Rendering bench

A headless benchmark and investigation tool for any WebGL 2 simulation. It renders
reproducible scenes in headless Chromium on the real GPU and produces:

- frame times: GPU, CPU submission and wall clock
- images
- sequences: camera paths, guided tours, scripted visitor input
- resolution scaling
- frame grabs of the whole WebGL pipeline
- optional Chrome traces and JavaScript CPU profiles

Results can be compared with an earlier run.

```bash
npm run bench
```

```bash
npm run bench -- --scene tag:sequence --sizes matrix --rounds 2
```

```bash
npm run bench -- --scene m87 --grab --trace --profile
```

```bash
npm run bench -- --compare bench-results/<earlier-run> --strict --max-slowdown 5 --max-changed 0.5
```

`npm run bench -- --help` lists every option; `--list` prints targets and scenes.

## Code layout

- `run.ts` orchestrates selection, rounds, diagnostics and report output.
- `cli.ts` parses options, validates sizes and resolves baseline settings.
- `measure.ts` runs scenes and pools frame samples across rounds.
- `grab.ts` records a frame and writes draw and shader artifacts.
- `browser.ts` handles Chromium, page setup and scripted input; `build.ts` bundles targets.
- `model.ts` defines the stored report data; `fingerprint.ts` and `compare.ts` match runs.
- `report.ts`, `html.ts` and `terminal.ts` format reports over `format.ts`; `templates/` holds HTML and CSS.
- `images.ts` encodes captures and compares pixels.

The CLI and report formats stay stable. Sizes are normalized and deduplicated before
measurement. If a round fails, that job is reported as an error and its partial samples
are excluded. Tracing and profiling are stopped before proceeding to another job.

## Reports

Each run writes `bench-results/<timestamp>[-label]/` (git-ignored):

| File                             | For                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `index.html`                     | People: scene images, sequence filmstrips and frame-time charts, scaling chart, comparisons, grabs             |
| `report.md`                      | People and conversations: the same tables in Markdown                                                          |
| `summary.json`                   | Scripts and language models: one compact object with numbers, findings and comparisons                         |
| `report.json`                    | Everything, including per-frame timelines and per-frame target facts                                           |
| `images/`                        | Captured frames as lossless WebP (pixel-exact, about half a PNG); `*.diff.webp` heat maps against a baseline   |
| `grabs/<target>/<scene>@<size>/` | `grab.json` (every WebGL call), `draws/` (render target after each draw), `shaders/` (compiled and translated) |
| `traces/`, `profiles/`           | Chrome performance traces (open in Perfetto or DevTools) and `.cpuprofile` files                               |

`index.html` comes from Eta templates in `templates/`. `html.ts` builds a view model
(formatted numbers, chart geometry), and the templates hold the markup.

Findings are automatic and conservative: errors, regressions beyond the given budgets,
hitches in sequences, and CPU-bound frames. They also cover heap growth (measured after
garbage collection), slow first frames, non-linear resolution scaling and per-frame
fixed cost.

## Comparing runs

`--compare <dir>` re-runs exactly what an earlier run measured, then compares with it. It
reuses that run's scenes, sizes, frames, minimum time, warm-up, rounds, settle, trace and
profile settings. `-t`, `-s` and `--sizes` narrow the replay; any other explicit option
overrides the earlier value and shows up as a mismatch. `--baseline <dir>` instead compares
a run configured as given.

Every report carries fingerprints (12-digit SHA-256 of sorted JSON):

- **settings**: everything that changes timings without changing the image (frames,
  minimum time, warm-up, rounds, settle, trace, profile). Image capture is untimed, so
  it is not part of it.
- **environment**: GPU, browser, CPU and OS.
- **scene**, per run: the target's full scene definition, including camera, quality,
  script and input.
- **code**: the benchmarked bundle (shaders, renderer, target).

A comparison is like for like when settings, environment and every compared scene match.
Otherwise the report says which fields differ (`frames 20 → 10`, `gpu A → B`) and marks rows
whose scene changed. Each part reports this: terminal, `index.html`, `report.md` and
`summary.json`. The comparison also lists runs not measured this time and runs new since
the baseline. A baseline from before fingerprints cannot prove its scenes match, so it is
never like for like.

`--strict` exits 1 when the comparison is not like for like; `--max-slowdown` and
`--max-changed` exit 1 on regressions. Code is expected to differ between compared runs,
so the code hash only informs. With the same code, every time difference is run-to-run
noise, and the report says so.

## What it measures

- **median / p90 ms**: GPU time per frame from `EXT_disjoint_timer_query_webgl2`.
  Without timer queries the row says `cpu`. That is wall time from submitting a frame
  until a 1-pixel readback returns.
- **submit ms**: the `render` call alone: JavaScript, uniform writes, uploads and
  command encoding. Growth here means CPU-side work, not shading.
- **ns/px**: median divided by pixels.
- **first ms**: the first frame, including shader compilation. The browser caches
  compiled programs, so only the first scene of a run shows the full cost. A grab
  reports each shader's compile time separately.
- **Resolution scaling** (two or more `--sizes`): a least-squares fit
  `ms = fixed + per-megapixel × MP`. Fragment-bound work is close to a line through the
  origin. The intercept is per-frame cost that resolution does not change.
- **Sequences**: per-frame times along a scripted path. Hitches are frames over twice
  their local (rolling) median, so a cost that rises legitimately (a camera pushing in)
  is not a hitch.

Static scenes render at least `--frames` frames and for at least `--min-time` ms
(default 500), so the measurement outlasts GPU clock ramps. Same-code runs then agree
within about 1% at 1280×720. Static scenes and sequences without input render back to
back inside the page. The
bench first loads the GPU for `--settle` milliseconds (default 2000), so clocks are up
before the first scene. Sequences with input return to Node between frames, so they are
noisier. `--rounds` interleaves everything and pools the frames; use it before trusting
small differences.

The report names the GPU, browser and machine. A software rasteriser prints a warning.
Compare runs from the same machine only; the comparison warns when they differ.

## Frame grab

`--grab` records one steady-state frame per run by wrapping the WebGL 2 context for that
frame. Renderers that keep a reference to the context, as Three.js does, need no changes.
It captures:

- every call with readable arguments (enum names, object ids), and counts per function
- each draw: mode, count, program, render target, viewport, its own GPU time and every
  active uniform's value
- the render target after each draw, as a thumbnail
- passes: consecutive draws into one target
- texture and buffer uploads with byte counts, and WebGL errors raised by the frame
- each program's shaders as the driver received them, the driver's translation
  (Metal, HLSL or desktop GLSL, via `WEBGL_debug_shaders`) and their compile time

Recording inflates the frame's cost, so the grabbed frame is not timed.

## Browser

The bench drives Chromium with `playwright-core`, which downloads nothing. It uses the
first of Chrome, Edge or a Playwright-managed Chromium it can launch. `--browser` picks
one. Without any, run `npx playwright-core install chromium`. Pages load from an
intercepted origin (`http://horizon.bench`), with no server or network. Files under
`public/` are served for targets that load assets. Scripted input arrives as trusted
mouse, wheel and key events, so pointer capture behaves as for a visitor.

## Adding a target

Add `src/features/<slug>/bench.ts` exporting `benchTarget: BenchTarget` from
`@horizon/toolkit/bench` with `id: "<slug>"`. The bench discovers it. It is a public
feature entry like `index.ts`, so it may import the feature's own `lib`.

- `scenes`: each needs a stable `id` (results and baselines match on target, scene and
  size), a `description` and `tags` for `--scene tag:<tag>`. Add a `script`
  (`frames`, `duration`, optional `input` and `keyframes`) for a sequence.
- `mount(sceneId, { canvas, width, height })` builds the renderer and returns:
  - `gl`
  - `render(frame)`: draws one complete frame without waiting for the GPU. `frame`
    carries `index`, `count`, `progress` (0–1), `time` and `dt`.
  - `describe()` (optional): facts per frame, such as camera distance or quality.
  - `dispose()`
- The bundle is one script without workers, so a `@horizon/toolkit/worker` task runs in
  place: what a page computes on a worker, a mount computes before the first frame.
- Input scenes: attach the app's real input handlers to the canvas. The bench delivers
  `drag`, `wheel`, `click` and `key` input at the scripted progress.

Reuse the code the live engine uses for uniforms, camera and input, so the bench measures
what visitors see. The black-hole target shares `lib/frame.ts` with `lib/engine.ts`, and
its scenes and camera paths live in `lib/bench-scenes.ts`, plain data Node tests can read.

`tests/bench.test.mjs` checks the statistics, input scheduling, camera paths and report
rendering, and builds the bundle. It does not launch a browser.
