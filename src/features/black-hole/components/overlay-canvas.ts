/** Shared plumbing for the 2D canvases drawn over the hole. */

/**
 * The engine's drawn frames, which the overlays follow: the camera moves only in one, so an
 * overlay at rest needs no frame between them. The engine reports each with its frame-rate
 * cap, which also bounds an overlay's own animation.
 */
export type FrameSignal = {
  notify: (fps: number) => void;
  /** Calls `wake` after every drawn frame; returns the unsubscribe. */
  subscribe: (wake: () => void) => () => void;
  /** The engine's frame-rate cap as it last drew. */
  fps: () => number;
};

export function createFrameSignal(): FrameSignal {
  const listeners = new Set<() => void>();
  let cap = Infinity;
  return {
    notify: (fps) => {
      cap = fps;
      for (const wake of listeners) wake();
    },
    subscribe: (wake) => {
      listeners.add(wake);
      return () => {
        listeners.delete(wake);
      };
    },
    fps: () => cap,
  };
}

/** Half a display frame at 60 Hz: an animation frame due this soon is not skipped. */
const FRAME_SLACK_MS = 8;

/**
 * An overlay's frame loop on animation frames, run only while there is something to draw:
 * after the engine draws (the camera may have moved), after `wake()` (the overlay's own
 * state changed or its boxes resized), and for as long as `frame` returns true (an easing or a
 * reveal under way), then at most at the engine's frame-rate cap. `frame` gets the elapsed
 * seconds (capped at 0.05) and the time. Deliberately not the toolkit's `createFrameLoop`:
 * that loop feeds the frame-rate meter, and these 2D overlays must not count as rendered
 * frames of the hole.
 */
export function overlayLoop(
  frames: FrameSignal,
  frame: (dt: number, now: number) => boolean,
): { wake: () => void; dispose: () => void } {
  let raf = 0;
  let last = performance.now();
  let woken = false;
  let animating = false;
  const run = (now: number) => {
    raf = 0;
    if (!woken && now - last < 1000 / frames.fps() - FRAME_SLACK_MS) {
      raf = window.requestAnimationFrame(run);
      return;
    }
    woken = false;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    animating = frame(dt, now);
    if (animating) raf = window.requestAnimationFrame(run);
  };
  const wake = () => {
    woken = true;
    if (!raf) raf = window.requestAnimationFrame(run);
  };
  const unsubscribe = frames.subscribe(wake);
  wake();
  return {
    wake,
    dispose: () => {
      unsubscribe();
      window.cancelAnimationFrame(raf);
    },
  };
}

/** Overlay layer and hole canvas boxes, with the backing-store pixel ratio. */
type OverlayFit = { layerBox: DOMRect; holeBox: DOMRect; dpr: number; resized: boolean };

/**
 * Keeps `canvas` sized to its layer and the hole canvas's box at hand, measured when either
 * resizes rather than every frame; `onResize` wakes the overlay. `fit()` is null until the
 * first measurement and while the hole canvas is too small to draw over; `resized` is true
 * once after the backing store changed.
 */
export function overlayFit(layer: HTMLElement, canvas: HTMLCanvasElement, onResize: () => void) {
  const hole = layer
    .closest('[data-simulation="black-hole"]')
    ?.querySelector<HTMLCanvasElement>('[data-simulation-canvas="black-hole"]');
  let boxes: { layerBox: DOMRect; holeBox: DOMRect } | null = null;
  let resized = false;
  const backingStore = () => {
    if (!boxes) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rw = Math.max(1, Math.floor(boxes.layerBox.width * dpr));
    const rh = Math.max(1, Math.floor(boxes.layerBox.height * dpr));
    if (canvas.width !== rw || canvas.height !== rh) {
      canvas.width = rw;
      canvas.height = rh;
      resized = true;
    }
    return dpr;
  };
  const observer = new ResizeObserver(() => {
    const layerBox = layer.getBoundingClientRect();
    boxes = { layerBox, holeBox: hole?.getBoundingClientRect() ?? layerBox };
    backingStore();
    onResize();
  });
  observer.observe(layer);
  if (hole) observer.observe(hole);
  return {
    fit(): OverlayFit | null {
      if (!boxes || boxes.holeBox.width < 8 || boxes.holeBox.height < 8) return null;
      /* The pixel ratio changes without a resize when the window moves to another screen. */
      const dpr = backingStore()!;
      const fit = { ...boxes, dpr, resized };
      resized = false;
      return fit;
    },
    dispose: () => observer.disconnect(),
  };
}

/** Clears the canvas and maps CSS pixels to the hole canvas’s top-left corner. */
export function drawOverHole(ctx: CanvasRenderingContext2D, fit: OverlayFit) {
  const { layerBox, holeBox, dpr } = fit;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    (holeBox.left - layerBox.left) * dpr,
    (holeBox.top - layerBox.top) * dpr,
  );
}

export function clearOverlay(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
