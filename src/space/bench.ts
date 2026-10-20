import type { BenchFrame, BenchInstance, BenchSurface } from "@horizon/toolkit/bench";
import type { SimulationEngine } from "@horizon/toolkit/rendering";
import type { SceneMount } from "@horizon/toolkit/scene";

/**
 * A zoomable scene's real engine on the bench: the stage, the label layer and the canvas as
 * the page mounts them, with the engine's own frame loop driven by the bench instead of the
 * display. The loop asks the window for animation frames; here that request is kept and
 * answered inside each `render`, so every bench frame is exactly one of the engine's, drawn
 * within the runner's timer. `wake` makes the engine want a frame (a store write its bridge
 * sees), since an idle scene draws nothing. Labels show their keys: they are DOM, outside the
 * canvas the bench captures.
 */
export function mountSceneEngine(
  surface: BenchSurface,
  create: (mount: SceneMount) => SimulationEngine,
  wake: () => void,
): BenchInstance {
  const { canvas, width, height } = surface;
  const host = document.createElement("div");
  host.style.cssText = `position:relative;width:${width}px;height:${height}px;overflow:hidden`;
  const labelRoot = document.createElement("div");
  labelRoot.dataset.sceneLabels = "";
  labelRoot.style.cssText = "position:absolute;inset:0;pointer-events:none";
  canvas.replaceWith(host);
  host.append(canvas, labelRoot);

  const requestFrame = window.requestAnimationFrame;
  const cancelFrame = window.cancelAnimationFrame;
  let pending: FrameRequestCallback | null = null;
  window.requestAnimationFrame = (callback) => {
    pending = callback;
    return 1;
  };
  window.cancelAnimationFrame = () => {
    pending = null;
  };
  const restore = () => {
    window.requestAnimationFrame = requestFrame;
    window.cancelAnimationFrame = cancelFrame;
    host.replaceWith(canvas);
  };

  let engine: SimulationEngine;
  try {
    engine = create({
      canvas,
      host,
      labelRoot,
      labels: () => ({}),
      locale: () => "en",
      onError: (error) => console.warn(error),
    });
  } catch (error) {
    restore();
    throw error;
  }
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    engine.dispose();
    restore();
    throw new Error("WebGL 2 is unavailable");
  }
  /* The loop's clock: a sequence's simulation time, or a display frame per static frame. */
  let now = 0;
  return {
    gl,
    render(frame: BenchFrame) {
      wake();
      now += frame.dt > 0 ? frame.dt * 1000 : 1000 / 60;
      const tick = pending;
      pending = null;
      tick?.(now);
    },
    dispose() {
      engine.dispose();
      restore();
    },
  };
}
