/** Shared plumbing for the 2D canvases drawn over the hole. */

/**
 * Calls `frame` every animation frame with the elapsed seconds (capped at 0.05)
 * and the frame time. Keeps scheduling while the page is hidden; returns the cancel.
 */
export function frameLoop(frame: (dt: number, now: number) => void): () => void {
  let raf = 0;
  let last = performance.now();
  const tick = () => {
    raf = window.requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt, now);
  };
  raf = window.requestAnimationFrame(tick);
  return () => window.cancelAnimationFrame(raf);
}

/** Overlay layer and hole canvas boxes, with the backing-store pixel ratio. */
export type OverlayFit = { layerBox: DOMRect; holeBox: DOMRect; dpr: number; resized: boolean };

/** Sizes `canvas` to its layer; null while the hole canvas is too small to draw over. */
export function fitOverlay(layer: HTMLElement, canvas: HTMLCanvasElement): OverlayFit | null {
  const gl = layer
    .closest('[data-simulation="black-hole"]')
    ?.querySelector<HTMLCanvasElement>("[data-black-hole-canvas]");
  const layerBox = layer.getBoundingClientRect();
  const holeBox = gl?.getBoundingClientRect() ?? layerBox;
  if (holeBox.width < 8 || holeBox.height < 8) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rw = Math.max(1, Math.floor(layerBox.width * dpr));
  const rh = Math.max(1, Math.floor(layerBox.height * dpr));
  const resized = canvas.width !== rw || canvas.height !== rh;
  if (resized) {
    canvas.width = rw;
    canvas.height = rh;
  }
  return { layerBox, holeBox, dpr, resized };
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
