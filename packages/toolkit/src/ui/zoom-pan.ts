/**
 * Zooming and panning a figure inside a frame of its own size: the view's scale and the
 * content's offset in pixels, kept so the content always covers the frame.
 */
export type ZoomView = { scale: number; x: number; y: number };

export const ZOOM_REST: ZoomView = { scale: 1, x: 0, y: 0 };
/** The deepest zoom, and the one a double tap or the zoom-in button steps by. */
export const ZOOM_MAX = 8;
export const ZOOM_STEP = 2;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The view kept inside the frame (`width` × `height`): never smaller than it, never past an edge. */
export function clampView(view: ZoomView, width: number, height: number): ZoomView {
  const scale = clamp(view.scale, 1, ZOOM_MAX);
  return {
    scale,
    x: clamp(view.x, width - width * scale, 0),
    y: clamp(view.y, height - height * scale, 0),
  };
}

/** Zoomed by `factor` about a point of the frame, so the content under it stays put. */
export function zoomAbout(
  view: ZoomView,
  factor: number,
  px: number,
  py: number,
  width: number,
  height: number,
): ZoomView {
  const scale = clamp(view.scale * factor, 1, ZOOM_MAX);
  const k = scale / view.scale;
  return clampView({ scale, x: px - (px - view.x) * k, y: py - (py - view.y) * k }, width, height);
}

/** Moved by a drag of `dx`, `dy` pixels. */
export const panBy = (view: ZoomView, dx: number, dy: number, width: number, height: number) =>
  clampView({ scale: view.scale, x: view.x + dx, y: view.y + dy }, width, height);
