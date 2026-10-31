/**
 * A still of the last frame laid over the canvas, so one view can dissolve into the next
 * while the camera stays where it is: `capture` copies what the canvas has just drawn (call
 * it in the same task as the render, before the drawing buffer is presented), `show` sets how
 * much of the still covers the live view, 0 hides it, and `clear` lets the still's memory go.
 */
export function createVeil(canvas: HTMLCanvasElement) {
  const veil = document.createElement("canvas");
  veil.setAttribute("aria-hidden", "true");
  veil.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0";
  canvas.insertAdjacentElement("afterend", veil);
  const context = veil.getContext("2d");
  return {
    capture() {
      if (!context) return;
      veil.width = canvas.width;
      veil.height = canvas.height;
      context.drawImage(canvas, 0, 0);
    },
    show(share: number) {
      veil.style.opacity = share > 0 ? share.toFixed(3) : "0";
    },
    clear() {
      veil.width = 0;
      veil.height = 0;
    },
    dispose() {
      veil.remove();
    },
  };
}
