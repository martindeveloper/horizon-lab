# Rendering infrastructure

Import from `@horizon/toolkit/rendering`. Construct these resources inside a
client lifecycle, never while rendering a React component or evaluating a server
module. Importing the package alone does not touch browser globals.

- `createFullscreenPass`: one Three.js full-screen quad and custom ShaderMaterial.
  Supply vertex/fragment source and uniforms. Call `compile()`, `resize(w,h)`,
  `render()` and `dispose()`. Buffers have no depth/stencil or hardware antialiasing.
  Output is LinearSRGB with Three.js tone mapping disabled: the shader owns its
  color pipeline. Shader diagnostics are enabled by default. The optional `powerPreference` is a
  browser GPU-selection hint; its default is `default`, not forced discrete GPU.
- `observeViewport`: ResizeObserver plus explicit `refresh()` when quality changes.
  `bufferSize` multiplies CSS dimensions by resolution scale, capped DPR and an
  optional warm-up factor. It does not set CSS dimensions.
- `createFrameLoop`: animation-frame scheduling with visibility/page lifecycle
  suspension, configurable FPS and external pause predicate. Call `sync()` when
  application pause state changes, and `dispose()` on unmount. The first frame
  and first frame after resuming receive dt=0; a `sync()` while the loop is
  already running (a drag, a store write) does not reset its clock. Per-frame deltas cap at 0.1 seconds;
  throttled frames accumulate time. This is not a fixed-step physics integrator.
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
- `DisposalScope`: owns resources and callbacks. Cleanup runs once, in reverse
  acquisition order; every callback runs even if one throws. Errors are collected
  into an AggregateError. Registration after disposal cleans up immediately.

The consumer owns uniforms, solver step counts, first-frame readiness, scripted
camera movement and pause policy. No WebDriver-specific behavior exists in this
package. Warm-up quality is explicit configuration, not temporal accumulation.
Resources that discard their CPU copy after upload cannot be restored.
