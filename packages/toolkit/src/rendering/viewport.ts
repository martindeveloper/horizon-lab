export type ResolutionOptions = {
  scale: number;
  dpr: number;
  dprCap: number;
  warmupScale?: number;
};
/** Drawing-buffer dimensions; CSS dimensions are deliberately unchanged. */
export function bufferSize(width: number, height: number, options: ResolutionOptions) {
  if (
    ![width, height].every((value) => Number.isFinite(value) && value >= 0) ||
    ![options.scale, options.dpr, options.dprCap, options.warmupScale ?? 1].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new RangeError(
      "Viewport dimensions must be nonnegative and resolution factors positive and finite",
    );
  const factor = options.scale * (options.warmupScale ?? 1) * Math.min(options.dpr, options.dprCap);
  return {
    width: Math.max(1, Math.floor(Math.floor(width) * factor)),
    height: Math.max(1, Math.floor(Math.floor(height) * factor)),
  };
}
export function observeViewport(
  host: HTMLElement,
  getOptions: () => ResolutionOptions,
  onResize: (width: number, height: number) => void,
) {
  function refresh() {
    const rect = host.getBoundingClientRect();
    const size = bufferSize(rect.width, rect.height, getOptions());
    onResize(size.width, size.height);
  }
  const observer = new ResizeObserver(refresh);
  try {
    observer.observe(host);
    refresh();
  } catch (error) {
    observer.disconnect();
    throw error;
  }
  return { refresh, dispose: () => observer.disconnect() };
}
