# Rendering infrastructure

Import from `@horizon/toolkit/rendering`. Construct these resources inside a
client lifecycle, never while rendering a React component or evaluating a server
module. Importing the package alone does not touch browser globals. The post
passes import their shaders from `../shaders/*.glsl`, so consumers need the
toolkit's `.glsl` loader (see the package README).

- `createFullscreenPass`: one Three.js full-screen quad and custom ShaderMaterial.
  Supply vertex/fragment source and uniforms. Call `compile()`, `resize(w,h)`,
  `render()` and `dispose()`; `renderer` is its WebGLRenderer, for a consumer that draws into
  targets of its own before `render()` (the black hole's cached trace). Buffers have no
  depth/stencil or hardware antialiasing.
  Output is LinearSRGB with Three.js tone mapping disabled: the shader owns its
  color pipeline. Shader diagnostics are enabled by default. The optional `powerPreference` is a
  browser GPU-selection hint; its default is `default`, not forced discrete GPU.
  `render({ antialias, bloom, lens, gamut })` takes `antialias` `off` (default), `fxaa` or
  `supersample`, `bloom` as `BloomSettings` or null (default), `lens` as `LensSettings` or
  null (default) and `gamut` `srgb` (default) or `p3` (the canvas in wide colour; the shader's
  `display` multiplies linear radiance by the pass's `uGamut` before encoding).
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
  An optional `filter: { fragmentShader, uniforms, defines? }` at creation supplies a final
  display-frame filter. Enable it per frame with `render({ filter: true })`; the default
  bypasses it with no extra draw or allocation. It reads encoded canvas bytes as `uImage`
  and buffer-pixel size as `uTexel`, after any FXAA, bloom or lens. Its byte target has no
  depth attachment, resizes with the drawing buffer, and is reused until disposal. The
  consumer owns its uniforms and any masking or colour decoding the effect needs.
- `createCompositePass(renderer, { antialias, bloom, lens, depthBuffer })`: the resolve stage of a scene.
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
  either or the anti-aliasing takes a new pass. With bloom off, the lens builds only
  the mask levels its spikes need (`mask` below). `target` is the offscreen frame; nothing is allocated until
  the first `paint`. `depthBuffer` defaults to `true` for scene geometry; callers that draw
  only full-screen shaders may set it to `false`. `createFullscreenPass` does this for its
  composite targets, avoiding unused depth attachments and clears.
- Wide colour: `setDrawingBufferGamut(renderer, gamut)` switches a renderer's canvas to show
  its bytes in Display P3 (or back to sRGB) and returns the gamut it took: a browser whose
  WebGL cannot switch keeps sRGB, so draw for what comes back; `drawingBufferGamut(renderer)`
  reads it. It is for a shader that owns its display pipeline: it multiplies its linear
  radiance by `gamutMatrix(gamut)` (linear sRGB to the canvas's primaries from the science
  module's colour matrices; the identity for sRGB, so it may apply it always at no cost)
  before it tone-maps and encodes. A scene of ordinary materials encodes sRGB and would gain
  nothing, so the scene host offers no wide colour. `createFullscreenPass`'s `render({ gamut })`
  switches its canvas and sets the pass's `uGamut` (`mat3`) for the shader's display step.
  three.js's own Display P3 output (`outputColorSpace` set to a P3 definition) is not used:
  in r186 its encoder composes the primaries' matrices in the wrong order (white renders as
  0.83, 1, 0.96).
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
- `createLensPass(renderer)`: diffraction spikes as a telescope's spider vanes make them: thin
  lines through each compact bright light, not the light smeared along the arms.
  `render(levelOf, w, h, settings)` finds the lights in level `level` of a frame's bloom chain
  (`levelOf` reads the chain's last render or mask; each texel a cell about a thirty-second of
  the frame): a cell brighter than its eight neighbours is a candidate, then measured in a
  level two finer through a Gaussian window a cell wide centred on the light itself (its own
  light-weighted centre, refined twice), so its energy, place and size change smoothly as it
  or a neighbour moves rather than stepping at a cell's edge; a light no wider than about
  half a cell is a point, and a wider one (a disc filling the view, a galaxy's core, the
  black hole's disk) fades out of spiking. Each point gets a four- or six-point star (`arms`: two vanes across, as Hubble's spider, or three, as JWST's
  struts): lines a pixel or two wide whose brightness falls as 1/r² from a small core, red
  reaching furthest (a vane's diffraction grows with the wavelength), drawn until they
  fade below `threshold` (in the frame's units) and at most `reach` of the frame's height, so
  a brighter light's spikes are longer. An 8-bit frame clips every bright light to white, so
  `full` (frame pixels of light above the mask's threshold) is the energy from which a light
  spikes in full, a fainter one as the cube of its share; 0 spikes every light in full, for a
  radiance frame. Returns the stars at half the frame's size, to be added `strength` times.
  One instanced draw (`lens-star.vert.glsl`, `lens-star.frag.glsl`), an instance per cell and
  line: all but the lights' collapse in their vertex shader, so the fill is the lines' pixels
  alone. The fringe (`fringe` pixels at the corners, none at the centre) is the resolve
  shader's, from `<horizon/lens>`. `LensSettings.mask` is the bloom's settings, which the
  lights are found in when bloom is off. The quality level decides `level` (with the chain's
  `scale`) and `reach`; the switch is the consumer's, off by default. One half-float target
  at half the frame's size.
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
