/** Raised when the browser does not restore a lost WebGL context in time. */
export class ContextLostError extends Error {
  constructor() {
    super("The WebGL context was lost and not restored");
    this.name = "ContextLostError";
  }
}

/**
 * Keep a canvas restorable after a GPU reset, driver crash or tab eviction.
 * Loss calls preventDefault and `onLost`; pause the frame loop while `lost`.
 * Restore calls `onRestored`: mark textures for upload and redraw. If the page
 * stays visible for `timeout` ms without a restore, `onError` receives a
 * ContextLostError. Register after the renderer so its own restore runs first.
 */
export function watchContextLoss(
  canvas: EventTarget,
  options: {
    onLost?: () => void;
    onRestored: () => void;
    onError?: (error: unknown) => void;
    timeout?: number;
  },
) {
  const timeout = options.timeout ?? 5000;
  let lost = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stopTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  // A hidden tab may only get its context back once shown, so only visible time counts.
  const armTimer = () => {
    if (!lost || document.hidden) return stopTimer();
    if (timer !== null || !options.onError) return;
    timer = setTimeout(() => {
      timer = null;
      if (lost) options.onError?.(new ContextLostError());
    }, timeout);
  };
  const handleLost = (event: Event) => {
    event.preventDefault();
    if (lost) return;
    lost = true;
    options.onLost?.();
    armTimer();
  };
  const handleRestored = () => {
    if (!lost) return;
    lost = false;
    stopTimer();
    options.onRestored();
  };
  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", handleRestored);
  document.addEventListener("visibilitychange", armTimer);
  return {
    get lost() {
      return lost;
    },
    dispose() {
      stopTimer();
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
      document.removeEventListener("visibilitychange", armTimer);
    },
  };
}
