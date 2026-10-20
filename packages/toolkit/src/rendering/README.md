# Rendering infrastructure

Import from `@horizon/toolkit/rendering`. Construct these resources inside a
client lifecycle, never while rendering a React component or evaluating a server
module. Importing the package alone does not touch browser globals. The post
passes import their shaders from `../shaders/*.glsl`, so consumers need the
toolkit's `.glsl` loader (see the package README).

- `createFullscreenPass`: one Three.js full-screen quad and custom ShaderMaterial.
  Supply vertex/fragment source and uniforms. Call `compile()`, `resize(w,h)`,
  `render()` and `dispose()`. Buffers have no depth/stencil or hardware antialiasing.
  Output is LinearSRGB with Three.js tone mapping disabled: the shader owns its
  color pipeline. Shader diagnostics are enabled by default. The optional `powerPreference` is a
  browser GPU-selection hint; its default is `default`, not forced discrete GPU.
  `render({ antialias, bloom, lens })` takes `antialias` `off` (default), `fxaa` or
  `supersample`, `bloom` as `BloomSettings` or null (default) and `lens` as `LensSettings` or
  null (default).
  `supersample` needs `supersample: true` at creation and a fragment shader that
  defines `vec3 shade(vec2 fragCoord, bool derivatives)` (one ray's radiance) and
  `vec3 display(vec3 radiance, vec2 fragCoord)` (its display colour) and includes
  `<horizon/supersample>` for its `main()`: the shader is compiled a second time,
  and that pass re-traces four extra rays only where the first frame has an
  edge, judged on display luma. Bloom draws the shader into an offscreen frame, blooms it
  (`createBloomPass`) and resolves both onto the canvas. With the `hdr` option (a resolve
  fragment shader and its uniforms) and a GPU that renders into half-float textures
  (`halfFloatRenderable`), that frame is RGBA16F radiance: the shader's `uHdrOutput`
  uniform is 1, `display` is skipped, the chain thresholds radiance and the resolve shader
  (reading `uImage`, `uTexel`, `uBloom`, `uBloomStrength` and its own uniforms) applies
  `display` to the sum; `hdr` reports which path a pass has. The lens takes the same path:
  the resolve shader includes `<horizon/lens>` and applies it under `HORIZON_LENS`, which the
  pass defines while the lens is on (its spikes and fringe then act on radiance). Otherwise
  bloom and the lens work on the display frame through the composite below. Post resources
  are created on first use.
- `createCompositePass(renderer, { antialias, bloom, lens })`: the resolve stage of a scene.
  `paint(draw)` runs any number of renders (passes over one depth buffer) into an offscreen
  frame of the drawing buffer's size, then writes it onto the canvas in one full-screen pass
  (`composite.frag.glsl`): copied, or anti-aliased as `antialias` says (`msaa` draws the frame
  4× multisampled and resolved as the canvas's MSAA would be; `fxaa` filters it), with `lens`
  (`LensSettings`) with its brightest light spiked and its colours fringed towards the
  corners, with `bloom` (`BloomSettings`) with the frame's bright light blurred and added
  back, and with either a dither of one 8-bit step. The frame holds exactly the bytes the canvas would (8-bit, encoded and
  blended for the renderer's output colour space), so a scene looks the same through it on
  any WebGL 2 device and materials compile alike for the canvas and the frame. The canvas's
  hardware MSAA does not apply offscreen, so create the renderer with `antialias: false`.
  `bloom` and `lens` are read every frame, so their numbers may change in place; switching
  either or the anti-aliasing takes a new pass. With bloom off, the lens builds only the mask
  levels its spikes need (`mask` below). `target` is the offscreen frame; nothing is allocated until
  the first `paint`. `createFxaaPass(renderer)` and `createMsaaPass(renderer)` are this pass
  at `fxaa` and `msaa` without bloom (`render(scene, camera)` on the former draws one scene).
- `createBloomPass(renderer)`: bloom for any texture, dual Kawase. `render(source, w, h,
  settings)` takes the source's light above `threshold` (eased in over `knee` below it, each
  pixel capped at `clamp`, all in the source's units) down a chain of `mips` levels, the
  first `scale` of the source's size (0.5, or 0.25 on tight devices), blurring as each halves
  the one before, then back up with each level's blur summed into the next finer one, and
  returns the first level: the glow, to be added `strength` times. Half-float levels where
  the GPU renders into them, bytes otherwise; levels are allocated on first use and
  reallocated when the size, `mips` or `scale` change. `mask(source, w, h, settings, level)`
  runs the way down alone, as far as `level`, and returns that level (texture and size);
  `level(i)` reads a level of the last render or mask. The quality level decides `mips` and
  `scale`, never whether bloom is on: a switch is the consumer's, off by default. Only what
  is drawn into the frame blooms; DOM labels and readouts sit above the canvas.
- `createLensPass(renderer)`: diffraction spikes for any bright mask (a bloom chain level).
  `render(mask, w, h, settings)` sums the mask along each arm of a four- or six-point star
  (`arms`: two or three directional blurs in one draw, `lens-spike.frag.glsl`), `taps`
  bilinear taps out each way over `reach` of the frame's height, tapering, each tap counting in proportion to
  the square of its brightness over `threshold` (in the mask's units), so only the brightest
  light spikes; returns the star at the mask's size, to be added `strength` times. The
  fringe (`fringe` pixels at the corners, none at the centre) is the resolve shader's, from
  `<horizon/lens>`. `LensSettings.mask` is the bloom's settings, which the spikes draw from
  when bloom is off, and `level` the chain level they read (0: the prefiltered frame at the
  chain's `scale`; each further level coarser and softer). The quality level decides `taps` and `reach`; the switch
  is the consumer's, off by default. One half-float target at the mask's size; one program
  per star shape and tap count (compile-time loop bounds), compiled on first use.
- `RenderQuality`: the four quality levels every simulation offers (`economy`,
  `standard`, `cinema`, `max`, which lifts the device caps), in that order in
  `RENDER_QUALITIES`. Each consumer maps a level to concrete settings in one place (in
  Horizon, each simulation's `lib/quality.ts`), and `standard` is its default. UI that
  only lists the levels imports them from `@horizon/toolkit/rendering/quality`, which
  pulls in no Three.js.
- `createFrameMeter({ span, keep, gap })` and the page's `frameMeter`: loops call `tick(now)`
  after each frame they draw (`createFrameLoop` does so itself); `rate()` is frames per
  second over the last `span` seconds, 0 once a scene stops drawing; `intervals()` the times between the last `keep` frames (a
  pause over `gap` ms starts afresh). Feed it from a
  simulation's main loop only, so frames are not counted twice.
- `observeViewport`: ResizeObserver plus explicit `refresh()` when quality changes.
  `bufferSize` multiplies CSS dimensions by resolution scale, capped DPR and an
  optional warm-up factor. It does not set CSS dimensions.
- `createFrameLoop`: animation-frame scheduling with visibility/page lifecycle
  suspension, configurable FPS and external pause predicate. Call `sync()` when
  application pause state changes, and `dispose()` on unmount. The first frame
  and first frame after resuming receive dt=0; a `sync()` while the loop is
  already running (a drag, a store write) does not reset its clock. Per-frame deltas cap at 0.1 seconds;
  throttled frames accumulate time. A capped loop draws on the display frame nearest
  the target interval, so 30 fps holds at 30 on a 60 Hz screen rather than dropping to 20. This is not a fixed-step physics integrator.
  `onError` receives render exceptions; the loop stops after an exception.
- `observePowerPreference`: optional coarse-pointer and battery hints. A denied
  battery API is ignored. It never decides rendering quality for the application.
- `probeWebGL`: client-only WebGL 2 check on throwaway canvases, released at
  once. Returns `ready`, `software` (CPU rasteriser or a major performance
  caveat) or `unavailable`. Cache the result; the consumer chooses the warning.
  It imports no Three.js, so a gate can run before the renderer chunk loads.
- `watchContextLoss`: canvas `webglcontextlost`/`webglcontextrestored` listener.
  Loss calls `preventDefault` and `onLost`; pause the frame loop while `lost` is
  true. Restore calls `onRestored`. Three.js rebuilds its own state first when the
  watcher is registered after the renderer, then re-uploads geometry and textures
  that still hold their source data on the next render. The consumer marks DataTextures
  for upload, refreshes the viewport and forces a redraw. If the page stays
  visible for `timeout` ms (default 5000) without a restore, `onError` receives a
  `ContextLostError`, so the route error boundary can offer a retry.
- `createEngineHost`: the lifecycle every canvas engine repeats, built from the
  pieces above. Create it right after the renderer: it observes the viewport at
  once and calls `onResize(w, h)` with buffer pixels, then redraws. Call
  `start({ render, paused, fps, onRestored })` once the render function exists;
  it watches for context loss (registered after the renderer) and starts the
  frame loop, which always pauses while the context is lost. `invalidate()`
  marks a redraw and wakes an idle loop; `markDirty()` only marks it; `dirty`
  stays true until the next frame starts, so `paused` can idle a still scene;
  `render(dt, invalidated)` learns whether that frame was requested. A redraw
  requested during `render` gets one more frame.
  `sync()` re-evaluates pause and FPS; `refresh()` re-measures the buffer;
  restore runs `onRestored` (mark DataTextures for upload), then re-measures
  and redraws. It owns no renderer, scene or camera.
- `startEngine(create, onError)`: owns a lazy engine across navigation. `create(signal,
  onError)` returns a `SimulationEngine` (anything with `dispose()`), or a promise of one,
  on the next microtask; `dispose()` aborts the signal, disposes the engine once, disposes
  one that resolves later at once, and drops errors reported after it. No DOM; a React
  effect or any host lifecycle can return its `dispose`.
- `withScope(build)`: a `SimulationEngine` over one `DisposalScope`. `build(scope)` owns its
  resources there; the engine's `dispose()` lets them go, and a `build` that throws lets go
  of whatever it had already made before rethrowing.
- `DisposalScope`: owns resources and callbacks. Cleanup runs once, in reverse
  acquisition order; every callback runs even if one throws. Errors are collected
  into an AggregateError. Registration after disposal cleans up immediately.

The consumer owns uniforms, solver step counts, first-frame readiness, scripted
camera movement and pause policy. No WebDriver-specific behavior exists in this
package. Warm-up quality is explicit configuration, not temporal accumulation.
Resources that discard their CPU copy after upload cannot be restored.
