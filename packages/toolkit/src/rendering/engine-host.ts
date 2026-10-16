import { watchContextLoss } from "./context-loss";
import { DisposalScope } from "./disposal";
import { createFrameLoop } from "./frame-loop";
import { observeViewport, type ResolutionOptions } from "./viewport";

export type EngineHost = ReturnType<typeof createEngineHost>;

/**
 * The lifecycle every canvas engine repeats: drawing-buffer sizing, an
 * on-demand redraw flag, context-loss recovery and the frame loop. Create it
 * right after the renderer (the viewport measures at once) and call `start`
 * once the render function exists. Owns no scene, camera or renderer.
 */
export function createEngineHost(options: {
  canvas: HTMLCanvasElement;
  /** The element whose size the drawing buffer follows. */
  host: HTMLElement;
  resolution: () => ResolutionOptions;
  /** Resize the renderer to these buffer pixels; a redraw follows. */
  onResize: (width: number, height: number) => void;
  onError?: (error: unknown) => void;
}) {
  const scope = new DisposalScope();
  let dirty = true;
  let loop: ReturnType<typeof createFrameLoop> | null = null;
  let context: ReturnType<typeof watchContextLoss> | null = null;
  const invalidate = () => {
    dirty = true;
    loop?.sync();
  };
  try {
    const viewport = scope.own(
      observeViewport(options.host, options.resolution, (width, height) => {
        options.onResize(width, height);
        invalidate();
      }),
    );
    return {
      /** Redraw on the next frame, waking the loop if it idles. */
      invalidate,
      /** Flag the next frame as needed without waking an idle loop. */
      markDirty: () => {
        dirty = true;
      },
      /** Re-evaluate `paused` and `fps` after application state changes. */
      sync: () => loop?.sync(),
      /** Re-measure the drawing buffer, e.g. after a quality change. */
      refresh: () => viewport.refresh(),
      /** True until the next frame renders after `invalidate`. */
      get dirty() {
        return dirty;
      },
      get lost() {
        return context?.lost ?? false;
      },
      /**
       * Watch for context loss (after the renderer, so three.js restores first)
       * and start the loop. The loop always pauses while the context is lost.
       */
      start(run: {
        /** `invalidated`: a redraw was requested since the last frame (not just animation). */
        render: (dt: number, invalidated: boolean) => void;
        paused?: () => boolean;
        fps?: () => number;
        /** Mark data textures for upload; the buffer is re-measured and redrawn after. */
        onRestored?: () => void;
      }) {
        if (loop) throw new Error("Engine host already started");
        const watcher = scope.own(
          watchContextLoss(options.canvas, {
            onLost: invalidate,
            onRestored: () => {
              run.onRestored?.();
              viewport.refresh();
            },
            ...(options.onError !== undefined ? { onError: options.onError } : {}),
          }),
        );
        context = watcher;
        loop = scope.own(
          createFrameLoop({
            render: (dt) => {
              const invalidated = dirty;
              dirty = false;
              run.render(dt, invalidated);
            },
            paused: () => watcher.lost || (run.paused?.() ?? false),
            ...(run.fps !== undefined ? { fps: run.fps } : {}),
            ...(options.onError !== undefined ? { onError: options.onError } : {}),
          }),
        );
      },
      dispose: () => {
        loop = null;
        scope.dispose();
      },
    };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
